#!/usr/bin/python
# -*- coding: utf-8 -*-

import logging
import os
import time
from peewee import Model, MySQLDatabase, SqliteDatabase, InsertQuery,\
                   IntegerField, CharField, DoubleField, BooleanField,\
                   DateTimeField, OperationalError, SmallIntegerField,\
                   BigIntegerField, CompositeKey, create_model_tables
from playhouse.flask_utils import FlaskDB
from playhouse.pool import PooledMySQLDatabase
from playhouse.shortcuts import RetryOperationalError
from datetime import datetime, timedelta
from base64 import b64encode
from threading import Thread
from queue import Queue

from . import config
from .utils import get_pokemon_name, get_pokemon_rarity, get_pokemon_types, get_args, send_to_webhook
from .transform import transform_from_wgs_to_gcj
from .customLog import printPokemon

log = logging.getLogger(__name__)

args = get_args()
db = None


class MyRetryDB(RetryOperationalError, MySQLDatabase):
    pass


def init_database():
    global db
    if db is not None:
        return db

    if args.db_type == 'mysql':
        db = MyRetryDB(
            args.db_name,
            user=args.db_user,
            password=args.db_pass,
            host=args.db_host)
        log.info('Connecting to MySQL database on {}.'.format(args.db_host))
    else:
        db = SqliteDatabase(args.db)
        log.info('Connecting to local SQLLite database.')

    return db


class BaseModel(Model):
    class Meta:
        database = init_database()

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

    @classmethod
    def get_active(cls, swLat, swLng, neLat, neLng, since):
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

    @classmethod
    def get_active_by_id(cls, ids, swLat, swLng, neLat, neLng, since):
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


class Pokestop(BaseModel):
    pokestop_id = CharField(primary_key=True, max_length=50)
    enabled = BooleanField()
    latitude = DoubleField()
    longitude = DoubleField()
    last_modified = DateTimeField()
    last_update = DateTimeField(index=True)
    lure_expiration = DateTimeField(null=True, index=True)
    active_pokemon_id = IntegerField(null=True)

    class Meta:
        indexes = ((('latitude', 'longitude'), False),)

    @classmethod
    def get_stops(cls, swLat, swLng, neLat, neLng, since):
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

    @classmethod
    def get_gyms(cls, swLat, swLng, neLat, neLng, since):
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
    scanned_id = CharField(primary_key=True, max_length=50)
    latitude = DoubleField()
    longitude = DoubleField()
    last_update = DateTimeField(index=True)

    class Meta:
        indexes = ((('latitude', 'longitude'), False),)

    @classmethod
    def get_recent(cls, swLat, swLng, neLat, neLng, since):
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

    class Meta:
        primary_key = CompositeKey('type', 'username')

    @classmethod
    def get_least_used(cls, type):
        query = (Login
                 .select()
                 .where(Login.use == 1)
                 .where(Login.type == type)
                 .order_by(Login.last_request)
                 .limit(1))
        result = query.get()
        return result

    @classmethod
    def set_failed(cls, login):
        login.last_fail = datetime.now()
        login.last_request = login.last_fail
        login.fail_count += 1
        login.save()

    @classmethod
    def set_success(cls, login):
        login.last_login = datetime.now()
        login.last_request = login.last_login
        login.success_count += 1
        login.save()


def parse_map(map_dict, iteration_num, step, step_location):
    pokemons = {}
    pokestops = {}
    gyms = {}
    scanned = {}

    cells = map_dict['responses']['GET_MAP_OBJECTS']['map_cells']
    for cell in cells:
        if config['parse_pokemon']:
            for p in cell.get('wild_pokemons', []):
                d_t = datetime.utcfromtimestamp(
                    (p['last_modified_timestamp_ms'] +
                     p['time_till_hidden_ms']) / 1000.0)
                printPokemon(p['pokemon_data']['pokemon_id'], p['latitude'],
                             p['longitude'], d_t)
                pokemons[p['encounter_id']] = {
                    'encounter_id': b64encode(str(p['encounter_id'])),
                    'spawnpoint_id': p['spawnpoint_id'],
                    'pokemon_id': p['pokemon_data']['pokemon_id'],
                    'latitude': p['latitude'],
                    'longitude': p['longitude'],
                    'disappear_time': d_t,
                    'last_modified': datetime.utcfromtimestamp(
                        p['last_modified_timestamp_ms'] / 1000.0),
                    'last_update': datetime.utcnow(),
                }

                webhook_data = {
                    'encounter_id': b64encode(str(p['encounter_id'])),
                    'spawnpoint_id': p['spawnpoint_id'],
                    'pokemon_id': p['pokemon_data']['pokemon_id'],
                    'latitude': p['latitude'],
                    'longitude': p['longitude'],
                    'disappear_time': time.mktime(d_t.timetuple()),
                    'last_modified_time': p['last_modified_timestamp_ms'],
                    'time_until_hidden_ms': p['time_till_hidden_ms']
                }

                send_to_webhook('pokemon', webhook_data)

        for f in cell.get('forts', []):
            if config['parse_pokestops'] and f.get('type') == 1:  # Pokestops
                    if 'lure_info' in f:
                        lure_expiration = datetime.utcfromtimestamp(
                            f['lure_info']['lure_expires_timestamp_ms'] / 1000.0)
                        active_pokemon_id = f['lure_info']['active_pokemon_id']
                    else:
                        lure_expiration, active_pokemon_id = None, None

                    pokestops[f['id']] = {
                        'pokestop_id': f['id'],
                        'enabled': f['enabled'],
                        'latitude': f['latitude'],
                        'longitude': f['longitude'],
                        'last_modified': datetime.utcfromtimestamp(
                            f['last_modified_timestamp_ms'] / 1000.0),
                        'last_update': datetime.utcnow(),
                        'lure_expiration': lure_expiration,
                        'active_pokemon_id': active_pokemon_id
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
                        'last_update': datetime.utcnow()
                    }

    pokemons_upserted = 0
    pokestops_upserted = 0
    gyms_upserted = 0

    if pokemons and config['parse_pokemon']:
        pokemons_upserted = len(pokemons)
        log.debug("Upserting {} pokemon".format(len(pokemons)))
        bulk_upsert(Pokemon, pokemons)

    if pokestops and config['parse_pokestops']:
        pokestops_upserted = len(pokestops)
        log.debug("Upserting {} pokestops".format(len(pokestops)))
        bulk_upsert(Pokestop, pokestops)

    if gyms and config['parse_gyms']:
        gyms_upserted = len(gyms)
        log.debug("Upserting {} gyms".format(len(gyms)))
        bulk_upsert(Gym, gyms)

    log.info("Upserted {} pokemon, {} pokestops, and {} gyms".format(
      pokemons_upserted,
      pokestops_upserted,
      gyms_upserted))

    scanned[0] = {
        'scanned_id': str(step_location[0])+','+str(step_location[1]),
        'latitude': step_location[0],
        'longitude': step_location[1],
        'last_update': datetime.utcnow()
    }

    bulk_upsert(ScannedLocation, scanned)

sqlQueue = Queue(1000)
def write_thread(in_q) :
    while True:
        cls, data = in_q.get()
        log.info("Update queue size: " + str(in_q.qsize()))

        num_rows = len(data.values())
        i = 0
        step = 120
        while i < num_rows:
            log.debug("Inserting items {} to {}".format(i, min(i+step, num_rows)))
            try:
                InsertQuery(cls, rows=data.values()[i:min(i+step, num_rows)]).upsert().execute()
            except OperationalError as e:
                log.warning("%s... Retrying", e)
                continue
            i += step

writer_thread = Thread(target=write_thread, args=(sqlQueue,))
writer_thread.start()

def bulk_upsert(cls, data):
    sqlQueue.put((cls, data))

def create_tables(db):
    db.connect()
    db.create_tables([Pokemon, Pokestop, Gym, ScannedLocation], safe=True)
    db.close()

def drop_tables(db):
    db.connect()
    db.drop_tables([Pokemon, Pokestop, Gym, ScannedLocation], safe=True)
    db.close()
