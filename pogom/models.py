#!/usr/bin/python
# -*- coding: utf-8 -*-
import logging
import calendar
import time
import ujson

from Queue import Queue

import sys
import dateutil
from flask import json, jsonify
from peewee import Model, MySQLDatabase, SqliteDatabase, InsertQuery,\
                   IntegerField, CharField, DoubleField, BooleanField,\
                   DateTimeField, OperationalError, SmallIntegerField,\
                   BigIntegerField, CompositeKey, create_model_tables, fn, SelectQuery
from playhouse.flask_utils import FlaskDB
from playhouse.pool import PooledMySQLDatabase
from playhouse.shortcuts import RetryOperationalError
from playhouse.migrate import migrate, MySQLMigrator, SqliteMigrator
from datetime import datetime, timedelta

from base64 import b64encode
from threading import Thread

from pogom.exceptions import NoAuthTicketException, EmptyResponseException
from queuing.db_insert_queue import DbInserterQueueProducer
from . import config
from .utils import get_pokemon_name, get_pokemon_rarity, get_pokemon_types, get_args, send_to_webhook, json_datetime_ts, \
    json_ts_datetime
from .transform import transform_from_wgs_to_gcj
from .customLog import printPokemon

log = logging.getLogger(__name__)

args = get_args()
flaskDb = FlaskDB()

db_schema_version = 5


class MyRetryDB(RetryOperationalError, PooledMySQLDatabase):
    pass


def init_database(app):
    if args.db_type == 'mysql':
        connections = args.db_max_connections
        log.info('Connecting to MySQL database on %s:%i, max connections:%i', args.db_host, args.db_port, connections)
        if hasattr(args, 'accounts'):
            connections *= len(args.accounts)
        db = MyRetryDB(
            args.db_name,
            user=args.db_user,
            password=args.db_pass,
            host=args.db_host,
            port=args.db_port,
            max_connections=connections,
            stale_timeout=5)
    else:
        log.info('Connecting to local SQLite database')
        db = SqliteDatabase(args.db)

    app.config['DATABASE'] = db
    flaskDb.init_app(app)

    return db


class BaseModel(flaskDb.Model):

    @classmethod
    def get_all(cls):
        results = [m for m in cls.select().dicts()]
        if args.china:
            for result in results:
                result['latitude'], result['longitude'] = \
                    transform_from_wgs_to_gcj(
                        result['latitude'], result['longitude'])
        return results


class Pokemon(BaseModel):
    # We are base64 encoding the ids delivered by the api
    # because they are too big for sqlite to handle
    encounter_id = CharField(primary_key=True, max_length=50)
    spawnpoint_id = CharField(index=True)
    pokemon_id = IntegerField(index=True)
    latitude = DoubleField()
    longitude = DoubleField()
    disappear_time = DateTimeField(index=True)
    last_modified = DateTimeField()
    last_update = DateTimeField(index=True)

    class Meta:
        indexes = ((('latitude', 'longitude'), False),)

    @staticmethod
    def parse_json(data):
        if 'last_modified' in data:
            data['last_modified'] = json_ts_datetime(data['last_modified'])
        if 'disappear_time' in data:
            data['disappear_time'] = json_ts_datetime(data['disappear_time'])
        if 'last_update' in data:
            data['last_update'] = json_ts_datetime(data['last_update'])

    @staticmethod
    def get_active(swLat, swLng, neLat, neLng, since=datetime.min):
        if swLat is None or swLng is None or neLat is None or neLng is None:
            query = (Pokemon
                     .select()
                     .where((Pokemon.disappear_time > datetime.utcnow()) &
                            (Pokemon.last_update >= since))
                     .dicts())
        else:
            query = (Pokemon
                     .select()
                     .where((Pokemon.disappear_time > datetime.utcnow()) &
                            (Pokemon.last_update >= since) &
                            (Pokemon.latitude >= swLat) &
                            (Pokemon.longitude >= swLng) &
                            (Pokemon.latitude <= neLat) &
                            (Pokemon.longitude <= neLng))
                     .dicts())

        pokemons = []
        for p in query:
            p['pokemon_name'] = get_pokemon_name(p['pokemon_id'])
            p['pokemon_rarity'] = get_pokemon_rarity(p['pokemon_id'])
            p['pokemon_types'] = get_pokemon_types(p['pokemon_id'])
            if args.china:
                p['latitude'], p['longitude'] = \
                    transform_from_wgs_to_gcj(p['latitude'], p['longitude'])
            pokemons.append(p)

        return pokemons

    @staticmethod
    def get_latest():
        query = (Pokemon
            .select(Pokemon.last_update)
            .order_by(-Pokemon.last_update)
            .limit(1))

        if query.count():
            return query.get()
        empty = Pokemon()
        empty.last_update = datetime.min
        return empty

    @staticmethod
    def get_active_by_id(ids, swLat, swLng, neLat, neLng, since=datetime.min):
        if swLat is None or swLng is None or neLat is None or neLng is None:
            query = (Pokemon
                     .select()
                     .where((Pokemon.pokemon_id << ids) &
                            (Pokemon.disappear_time > datetime.utcnow()) &
                            (Pokemon.last_update >= since))
                     .dicts())
        else:
            query = (Pokemon
                     .select()
                     .where((Pokemon.pokemon_id << ids) &
                            (Pokemon.disappear_time > datetime.utcnow()) &
                            (Pokemon.last_update >= since) &
                            (Pokemon.latitude >= swLat) &
                            (Pokemon.longitude >= swLng) &
                            (Pokemon.latitude <= neLat) &
                            (Pokemon.longitude <= neLng))
                     .dicts())

        pokemons = []
        for p in query:
            p['pokemon_name'] = get_pokemon_name(p['pokemon_id'])
            p['pokemon_rarity'] = get_pokemon_rarity(p['pokemon_id'])
            p['pokemon_types'] = get_pokemon_types(p['pokemon_id'])
            if args.china:
                p['latitude'], p['longitude'] = \
                    transform_from_wgs_to_gcj(p['latitude'], p['longitude'])
            pokemons.append(p)

        return pokemons

    @classmethod
    def get_seen(cls, timediff):
        if timediff:
            timediff = datetime.utcnow() - timediff
        pokemon_count_query = (Pokemon
                               .select(Pokemon.pokemon_id,
                                       fn.COUNT(Pokemon.pokemon_id).alias('count'),
                                       fn.MAX(Pokemon.disappear_time).alias('lastappeared')
                                       )
                               .where(Pokemon.disappear_time > timediff)
                               .group_by(Pokemon.pokemon_id)
                               .alias('counttable')
                               )
        query = (Pokemon
                 .select(Pokemon.pokemon_id,
                         Pokemon.disappear_time,
                         Pokemon.latitude,
                         Pokemon.longitude,
                         pokemon_count_query.c.count)
                 .join(pokemon_count_query, on=(Pokemon.pokemon_id == pokemon_count_query.c.pokemon_id))
                 .where(Pokemon.disappear_time == pokemon_count_query.c.lastappeared)
                 .dicts()
                 )
        pokemons = []
        total = 0
        for p in query:
            p['pokemon_name'] = get_pokemon_name(p['pokemon_id'])
            pokemons.append(p)
            total += p['count']

        return {'pokemon': pokemons, 'total': total}

    @classmethod
    def get_appearances(cls, pokemon_id, last_appearance):
        query = (Pokemon
                 .select()
                 .where((Pokemon.pokemon_id == pokemon_id) &
                        (Pokemon.disappear_time > datetime.utcfromtimestamp(last_appearance / 1000.0))
                        )
                 .order_by(Pokemon.disappear_time.asc())
                 .dicts()
                 )
        appearances = []
        for a in query:
            appearances.append(a)
        return appearances

    @classmethod
    def get_spawnpoints(cls, swLat, swLng, neLat, neLng):
        query = Pokemon.select(Pokemon.latitude, Pokemon.longitude, Pokemon.spawnpoint_id)

        if None not in (swLat, swLng, neLat, neLng):
            query = (query
                     .where((Pokemon.latitude >= swLat) &
                            (Pokemon.longitude >= swLng) &
                            (Pokemon.latitude <= neLat) &
                            (Pokemon.longitude <= neLng)
                            )
                     )

        query = query.group_by(Pokemon.spawnpoint_id).dicts()

        return list(query)



class Pokestop(BaseModel):
    pokestop_id = CharField(primary_key=True, max_length=50)
    enabled = BooleanField()
    latitude = DoubleField()
    longitude = DoubleField()
    last_modified = DateTimeField()
    last_update = DateTimeField(index=True)
    lure_expiration = DateTimeField(null=True, index=True)
    active_fort_modifier = CharField(max_length=50, null=True)

    class Meta:
        indexes = ((('latitude', 'longitude'), False),)

    @staticmethod
    def parse_json( data):
        if 'last_modified' in data:
            data['last_modified'] = json_ts_datetime(data['last_modified'])
        if 'lure_expiration' in data:
            data['lure_expiration'] = json_ts_datetime(data['lure_expiration'])
        if 'last_update' in data:
            data['last_update'] = json_ts_datetime(data['last_update'])

    @staticmethod
    def get_latest():
        query = (Pokestop
            .select(Pokestop.last_update)
            .order_by(-Pokestop.last_update)
            .limit(1))

        if query.count():
            return query.get()
        empty = Pokestop()
        empty.last_update = datetime.min
        return empty

    @staticmethod
    def get_stops(swLat, swLng, neLat, neLng, since=datetime.min):
        if swLat is None or swLng is None or neLat is None or neLng is None:
            query = (Pokestop
                     .select()
                     .where(Pokestop.last_update >= since)
                     .dicts())
        else:
            query = (Pokestop
                     .select()
                     .where((Pokestop.latitude >= swLat) &
                            (Pokestop.longitude >= swLng) &
                            (Pokestop.latitude <= neLat) &
                            (Pokestop.longitude <= neLng) &
                            (Pokestop.last_update >= since))
                     .dicts())

        pokestops = []
        for p in query:
            if args.china:
                p['latitude'], p['longitude'] = \
                    transform_from_wgs_to_gcj(p['latitude'], p['longitude'])
            pokestops.append(p)

        return pokestops


class Gym(BaseModel):
    UNCONTESTED = 0
    TEAM_MYSTIC = 1
    TEAM_VALOR = 2
    TEAM_INSTINCT = 3

    gym_id = CharField(primary_key=True, max_length=50)
    team_id = IntegerField()
    guard_pokemon_id = IntegerField()
    gym_points = IntegerField()
    enabled = BooleanField()
    latitude = DoubleField()
    longitude = DoubleField()
    last_modified = DateTimeField()
    last_update = DateTimeField(index=True)

    class Meta:
        indexes = ((('latitude', 'longitude'), False),)

    @staticmethod
    def parse_json(data):
        if 'last_update' in data:
            data['last_update'] = json_ts_datetime(data['last_update'])
        if 'last_modified' in data:
            data['last_modified'] = json_ts_datetime(data['last_modified'])

    @classmethod
    def get_latest(cls):
        query = (Gym
            .select(Gym.last_update)
            .order_by(-Gym.last_update)
            .limit(1))

        if query.count():
            return query.get()
        empty = Gym()
        empty.last_update = datetime.min
        return empty


    @staticmethod
    def get_gyms(swLat, swLng, neLat, neLng, since=datetime.min):
        if swLat is None or swLng is None or neLat is None or neLng is None:
            query = (Gym
                     .select()
                     .where(Gym.last_update >= since)
                     .dicts())
        else:
            query = (Gym
                     .select()
                     .where((Gym.latitude >= swLat) &
                            (Gym.longitude >= swLng) &
                            (Gym.latitude <= neLat) &
                            (Gym.longitude <= neLng) &
                            (Gym.last_update >= since))
                     .dicts())

        gyms = []
        for g in query:
            gyms.append(g)

        return gyms


class ScannedLocation(BaseModel):
    latitude = DoubleField()
    longitude = DoubleField()
    last_update = DateTimeField(index=True)

    class Meta:
        primary_key = CompositeKey('latitude', 'longitude')

    @staticmethod
    def parse_json(data):
        if 'last_update' in data and isinstance(data['last_update'], unicode):
            data['last_update'] = dateutil.parser.parse(data['last_update'])

    @classmethod
    def get_latest(cls):
        query = (ScannedLocation
            .select(ScannedLocation.last_update)
            .order_by(-ScannedLocation.last_update)
            .limit(1))

        if query.count():
            return query.get()
        empty = ScannedLocation()
        empty.last_update = datetime.min
        return empty

    @staticmethod
    def get_recent( swLat, swLng, neLat, neLng, since=datetime.min):
        query = (ScannedLocation
                 .select()
                 .where((ScannedLocation.last_update >=
                        (datetime.utcnow() - timedelta(minutes=15))) &
                        (ScannedLocation.last_update >= since) &
                        (ScannedLocation.latitude >= swLat) &
                        (ScannedLocation.longitude >= swLng) &
                        (ScannedLocation.latitude <= neLat) &
                        (ScannedLocation.longitude <= neLng))
                 .dicts())

        scans = []
        for s in query:
            scans.append(s)

        return scans

class Login(BaseModel):
    type = SmallIntegerField()
    username = CharField(max_length=20)
    password = CharField(max_length=20)
    last_request = DateTimeField()
    last_fail = DateTimeField()
    last_login = DateTimeField()
    requests = BigIntegerField()
    use = SmallIntegerField()
    fail_count = IntegerField()
    success_count = IntegerField()
    empty_response_count = IntegerField()
    accept_tos = SmallIntegerField()

    class Meta:
        primary_key = CompositeKey('type', 'username')

    @classmethod
    def get_least_used(cls, auth, min_age_minutes, type):
        cursor = flaskDb.database.get_cursor()
        cursor.callproc('lock_available_login_type', (auth, min_age_minutes, type))
        result = cursor.fetchone()
        cursor.close()
        return result

    @classmethod
    def get_by_username(cls, username):
        return Login.select().where(Login.username == username).get()

    @staticmethod
    def set_failed(login):
        login.last_fail = datetime.utcnow()
        login.last_request = login.last_fail
        login.fail_count += 1
        login.save()

    @staticmethod
    def set_success(login):
        login.last_login = datetime.utcnow()
        login.last_request = login.last_login
        login.success_count += 1
        login.save()

class Scan(BaseModel):
    id = IntegerField(primary_key=True)
    latitude = DoubleField()
    longitude = DoubleField()
    request_time = DateTimeField()
    complete_time = DateTimeField()
    ip = CharField(max_length=45, index=True)
    account = CharField(max_length=200, index=True)

    @classmethod
    def get_last_scan_by_ip(cls, ip):
        query = (Scan
                 .select()
                 .where(Scan.ip == ip)
                 .order_by(-Scan.request_time)
                 .limit(1))
        if len(query):
            return query.get()
        return None

    @classmethod
    def get_last_scan_by_account(cls, account):
        query = (Scan
                 .select()
                 .where(Scan.account == account)
                 .order_by(-Scan.request_time)
                 .limit(1))
        result = query.get()
        return result

    @classmethod
    def get_scan_count_by_ip(cls, ip, since_datetime):
        query = (Scan
                 .select()
                 .where(Scan.ip == ip)
                 .where(Scan.request_time >= since_datetime)
                 )
        return query.count()

    @classmethod
    def get_scan_count_by_account(cls, account, since_datetime):
        query = (Scan
                 .select()
                 .where(Scan.account == account)
                 .where(Scan.request_time >= since_datetime)
                 )
        return query.count()

class Spawn(BaseModel):
    id = CharField(max_length=12, primary_key=True)
    latitude = DoubleField(index=True)
    longitude = DoubleField(index=True)
    last_update = DateTimeField(index=True)
    last_disappear = DateTimeField()

    @classmethod
    def get_latest(cls):
        query = (Spawn
            .select(Spawn.last_update)
            .order_by(-Spawn.last_update)
            .limit(1))
        if query.count():
           return query.get()
        empty = Spawn()
        empty.last_update = datetime.min
        return empty

    @classmethod
    def get_spawns(cls, swLat, swLng, neLat, neLng, since=None):
        if (since):
            query = (Spawn
                 .select()
                 .where((Spawn.last_update >= since) &
                        (Spawn.latitude >= swLat) &
                        (Spawn.longitude >= swLng) &
                        (Spawn.latitude <= neLat) &
                        (Spawn.longitude <= neLng))
                 .dicts())
        else:
            query = (Spawn
                 .select(Spawn.id, Spawn.latitude, Spawn.longitude, Spawn.last_disappear)
                 .where((Spawn.latitude >= swLat) &
                        (Spawn.longitude >= swLng) &
                        (Spawn.latitude <= neLat) &
                        (Spawn.longitude <= neLng))
                 .dicts())

        spawns = []
        for s in query:
            spawns.append(s)

        return spawns

    @classmethod
    def get_detail(cls, id):
        query = (Spawn
                .select(Spawn.id, Pokemon.pokemon_id, fn.Count(Pokemon.pokemon_id).alias('count'),
                        fn.MAX(Pokemon.disappear_time).alias('max_disappear'))
                .join(Pokemon, on=(Spawn.id == Pokemon.spawnpoint_id)).alias('pokemon')
                .where(Spawn.id == id)
                .group_by(Pokemon.pokemon_id))


        pokestats = []
        for s in query:
            pokestats.append(s)

        return pokestats




class Versions(flaskDb.Model):
    key = CharField()
    val = IntegerField()

    class Meta:
        primary_key = False


def parse_map(map_dict, step_location):
    pokemons = {}
    pokestops = {}
    gyms = {}
    scanned = {}
    scan = {}

    # log.info('Received map response: %s', json.dumps(map_dict))

    #if 'auth_ticket' not in map_dict:
    #    raise NoAuthTicketException
    cells = map_dict['responses']['GET_MAP_OBJECTS']['map_cells']
    for cell in cells:
        if config['parse_pokemon']:
            for p in cell.get('wild_pokemons', []):
                # time_till_hidden_ms was overflowing causing a negative integer. It was also returning a value above 3.6M ms.
                if (0 < p['time_till_hidden_ms'] < 3600000):
                    d_t = datetime.utcfromtimestamp(
                        (p['last_modified_timestamp_ms'] +
                         p['time_till_hidden_ms']) / 1000.0)
                else:
                    # Set a value of 15 minutes because currently its unknown but larger than 15.
                    d_t = datetime.utcfromtimestamp((p['last_modified_timestamp_ms'] + 900000) / 1000.0)
                printPokemon(p['pokemon_data']['pokemon_id'], p['latitude'],
                             p['longitude'], d_t)
                pokemons[p['encounter_id']] = {
                    'encounter_id': b64encode(str(p['encounter_id'])),
                    'spawnpoint_id': p['spawn_point_id'],
                    'pokemon_id': p['pokemon_data']['pokemon_id'],
                    'latitude': p['latitude'],
                    'longitude': p['longitude'],
                    'disappear_time': d_t,
                    'last_modified': datetime.utcfromtimestamp(
                        p['last_modified_timestamp_ms'] / 1000.0)
                }

                webhook_data = {
                    'encounter_id': b64encode(str(p['encounter_id'])),
                    'spawnpoint_id': p['spawn_point_id'],
                    'pokemon_id': p['pokemon_data']['pokemon_id'],
                    'latitude': p['latitude'],
                    'longitude': p['longitude'],
                    'disappear_time': calendar.timegm(d_t.timetuple()),
                    'last_modified_time': p['last_modified_timestamp_ms'],
                    'time_until_hidden_ms': p['time_till_hidden_ms']
                }

                send_to_webhook('pokemon', webhook_data)

        for f in cell.get('forts', []):
            if config['parse_pokestops'] and f.get('type') == 1:  # Pokestops
                if 'active_fort_modifier' in f:
                    lure_expiration = datetime.utcfromtimestamp(
                        f['last_modified_timestamp_ms'] / 1000.0) + timedelta(minutes=30)
                    active_fort_modifier = f['active_fort_modifier']
                    webhook_data = {
                        'latitude': f['latitude'],
                        'longitude': f['longitude'],
                        'last_modified_time': f['last_modified_timestamp_ms'],
                        'active_fort_modifier': active_fort_modifier
                    }
                    send_to_webhook('pokestop', webhook_data)
                else:
                    lure_expiration, active_fort_modifier = None, None

                pokestops[f['id']] = {
                    'pokestop_id': f['id'],
                    'enabled': f['enabled'],
                    'latitude': f['latitude'],
                    'longitude': f['longitude'],
                    'last_modified': datetime.utcfromtimestamp(
                        f['last_modified_timestamp_ms'] / 1000.0),
                    'lure_expiration': lure_expiration,
                    'active_fort_modifier': active_fort_modifier,
                }

            elif config['parse_gyms'] and f.get('type') is None:  # Currently, there are only stops and gyms
                gyms[f['id']] = {
                    'gym_id': f['id'],
                    'team_id': f.get('owned_by_team', 0),
                    'guard_pokemon_id': f.get('guard_pokemon_id', 0),
                    'gym_points': f.get('gym_points', 0),
                    'enabled': f['enabled'],
                    'latitude': f['latitude'],
                    'longitude': f['longitude'],
                    'last_modified': datetime.utcfromtimestamp(
                        f['last_modified_timestamp_ms'] / 1000.0),
                }

    pokemons_upserted = 0
    pokestops_upserted = 0
    gyms_upserted = 0

    scanned[0] = {
        'latitude': step_location[0],
        'longitude': step_location[1],
    }

    if pokemons and config['parse_pokemon']:
        pokemons_upserted = len(pokemons)
        dispatch_upsert(Pokemon, pokemons)

    if pokestops and config['parse_pokestops']:
        pokestops_upserted = len(pokestops)
        dispatch_upsert(Pokestop, pokestops)

    if gyms and config['parse_gyms']:
        gyms_upserted = len(gyms)
        dispatch_upsert(Gym, gyms)

    dispatch_upsert(ScannedLocation, scanned)

    # clean_database()

    flaskDb.close_db(None)

    if pokemons_upserted == 0 and pokestops_upserted == 0 and gyms_upserted == 0:
        # log.error('Received empty map response: %s', json.dumps(map_dict))
        raise EmptyResponseException()

    log.info('Upserted %d pokemon, %d pokestops, and %d gyms',
             pokemons_upserted,
             pokestops_upserted,
             gyms_upserted)

    return True


def clean_database():
    query = (ScannedLocation
             .delete()
             .where((ScannedLocation.last_update <
                    (datetime.utcnow() - timedelta(minutes=30)))))
    query.execute()

    if args.purge_data > 0:
        query = (Pokemon
                 .delete()
                 .where((Pokemon.disappear_time <
                        (datetime.utcnow() - timedelta(hours=args.purge_data)))))
        query.execute()

dispatch_upsert_queue = Queue()
dispatch_upsert_producer = DbInserterQueueProducer()
dispatch_upsert_producer.connect()

def dispatch_upsert(cls, data):
    if (cls is Pokemon) or (cls is Gym) or (cls is Pokestop) or (cls is ScannedLocation):
        dispatch_upsert_queue.put(ujson.dumps({str(cls): data.values()}))
    else:
        bulk_upsert(cls, data)

def bulk_upsert(cls, data):
    if isinstance(data, dict):
        data = data.values()

    num_rows = len(data)
    i = 0
    step = 120

    while i < num_rows:
        log.debug('Inserting items %d to %d', i, min(i + step, num_rows))
        try:
            InsertQuery(cls, rows=data[i:min(i + step, num_rows)]).upsert().execute()
        except Exception as e:
            log.warning('%s... Retrying', e)
            continue

        i += step

def create_tables(db):
    db.connect()
    verify_database_schema(db)
    db.create_tables([Pokemon, Pokestop, Gym, ScannedLocation], safe=True)
    db.close()

def drop_tables(db):
    db.connect()
    db.drop_tables([Pokemon, Pokestop, Gym, ScannedLocation, Versions], safe=True)
    db.close()

def publish_dispatch_upsert_loop():
    while True:
        data = dispatch_upsert_queue.get()
        dispatch_upsert_producer.publish(data)

publish_upsert_thread = Thread(target=publish_dispatch_upsert_loop, name='Publish upsert thread')
publish_upsert_thread.daemon = True
publish_upsert_thread.start()
log.info('Publish upsert thread started')

def verify_database_schema(db):
    if not Versions.table_exists():
        db.create_tables([Versions])

        if ScannedLocation.table_exists():
            # Versions table didn't exist, but there were tables. This must mean the user
            # is coming from a database that existed before we started tracking the schema
            # version. Perform a full upgrade.
            InsertQuery(Versions, {Versions.key: 'schema_version', Versions.val: 0}).execute()
            database_migrate(db, 0)
        else:
            InsertQuery(Versions, {Versions.key: 'schema_version', Versions.val: db_schema_version}).execute()

    else:
        db_ver = Versions.get(Versions.key == 'schema_version').val

        if db_ver < db_schema_version:
            database_migrate(db, db_ver)

        elif db_ver > db_schema_version:
            log.error("Your database version (%i) appears to be newer than the code supports (%i).",
                      db_ver, db_schema_version)
            log.error("Please upgrade your code base or drop all tables in your database.")
            sys.exit(1)


def database_migrate(db, old_ver):
    # Update database schema version
    Versions.update(val=db_schema_version).where(Versions.key == 'schema_version').execute()

    log.info("Detected database version %i, updating to %i", old_ver, db_schema_version)

    # Perform migrations here
    migrator = None
    if args.db_type == 'mysql':
        migrator = MySQLMigrator(db)
    else:
        migrator = SqliteMigrator(db)

#   No longer necessary, we're doing this at schema 4 as well
#    if old_ver < 1:
#        db.drop_tables([ScannedLocation])

    if old_ver < 2:
        migrate(migrator.add_column('pokestop', 'encounter_id', CharField(max_length=50, null=True)))

    if old_ver < 3:
        migrate(
            migrator.add_column('pokestop', 'active_fort_modifier', CharField(max_length=50, null=True)),
            migrator.drop_column('pokestop', 'encounter_id'),
            migrator.drop_column('pokestop', 'active_pokemon_id')
        )

    if old_ver < 4:
        db.drop_tables([ScannedLocation])

    if old_ver < 5:
        # Some pokemon were added before the 595 bug was "fixed"
        # Clean those up for a better UX
        query = (Pokemon
                 .delete()
                 .where(Pokemon.disappear_time >
                        (datetime.utcnow() - timedelta(hours=24))))
        query.execute()
