#!/usr/bin/python
# -*- coding: utf-8 -*-
import logging
import calendar
import time
import ujson

from Queue import Queue

import sys
import math

import gc
from enum import Enum
from peewee import SqliteDatabase, InsertQuery, \
    IntegerField, CharField, DoubleField, BooleanField, \
    DateTimeField, CompositeKey, fn, SmallIntegerField, BigIntegerField, JOIN, FloatField, TextField, DeleteQuery
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

max_pokestops = 1000
max_spawns = 1000
max_pokemon = 1000
max_gyms = 1000
max_scannedcells = 3000

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
    scan_id = SmallIntegerField()
    individual_attack = IntegerField(null=True)
    individual_defense = IntegerField(null=True)
    individual_stamina = IntegerField(null=True)
    attack_1 = IntegerField(null=True)
    attack_2 = IntegerField(null=True)

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
    def get_active(swLat, swLng, neLat, neLng, since=datetime.min, member_id=0):
        if swLat is None or swLng is None or neLat is None or neLng is None:
            query = (Pokemon
                     .select()
                     .where((Pokemon.disappear_time > datetime.utcnow()) &
                            (Pokemon.last_update >= since) &
                            (Pokemon.scan_id << MemberLocation.select(MemberLocation.location_id).where(
                                (MemberLocation.expire_at > datetime.utcnow()) &
                                ((MemberLocation.member_id == member_id) | (MemberLocation.member_id == 0)))))
                     .limit(max_pokemon)
                     .dicts())
        else:
            query = (Pokemon
                     .select()
                     .where((Pokemon.disappear_time > datetime.utcnow()) &
                            (Pokemon.last_update >= since) &
                            (Pokemon.latitude >= swLat) &
                            (Pokemon.longitude >= swLng) &
                            (Pokemon.latitude <= neLat) &
                            (Pokemon.longitude <= neLng) &
                            (Pokemon.scan_id << MemberLocation.select(MemberLocation.location_id).where(
                                (MemberLocation.expire_at > datetime.utcnow()) &
                                ((MemberLocation.member_id == member_id) | (MemberLocation.member_id == 0)))))
                     .limit(max_pokemon)
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
    def get_active_by_id(ids, swLat, swLng, neLat, neLng, since=datetime.min, member_id=0):
        if swLat is None or swLng is None or neLat is None or neLng is None:
            query = (Pokemon
                     .select()
                     .where((Pokemon.pokemon_id << ids) &
                            (Pokemon.disappear_time > datetime.utcnow()) &
                            (Pokemon.last_update >= since) &
                            (Pokemon.scan_id << MemberLocation.select(MemberLocation.location_id).where(
                                (MemberLocation.expire_at > datetime.utcnow()) &
                                ((MemberLocation.member_id == member_id) | (MemberLocation.member_id == 0)))))
                     .limit(max_pokemon)
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
                            (Pokemon.longitude <= neLng) &
                            (Pokemon.scan_id << MemberLocation.select(MemberLocation.location_id).where(
                                (MemberLocation.expire_at > datetime.utcnow()) &
                                ((MemberLocation.member_id == member_id) | (MemberLocation.member_id == 0)))))
                     .limit(max_pokemon)
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
    def get_spawnpoints_in_hex(cls, center, steps):
        log.info('got {}steps'.format(steps))
        # work out hex bounding box
        hdist = ((steps * 120.0) - 50.0) / 1000.0
        vdist = ((steps * 105.0) - 35.0) / 1000.0
        R = 6378.1  # km radius of the earth
        vang = math.degrees(vdist / R)
        hang = math.degrees(hdist / (R * math.cos(math.radians(center[0]))))
        north = center[0] + vang
        south = center[0] - vang
        east = center[1] + hang
        west = center[1] - hang
        # get all spawns in that box
        query = (Pokemon
                 .select(Pokemon.latitude.alias('lat'),
                         Pokemon.longitude.alias('lng'),
                         ((Pokemon.disappear_time.minute * 60) + Pokemon.disappear_time.second).alias('time'),
                         Pokemon.spawnpoint_id
                         ))
        query = (query.where((Pokemon.latitude <= north) &
                             (Pokemon.latitude >= south) &
                             (Pokemon.longitude >= west) &
                             (Pokemon.longitude <= east)
                             ))
        # Sqlite doesn't support distinct on columns
        if args.db_type == 'mysql':
            query = query.distinct(Pokemon.spawnpoint_id)
        else:
            query = query.group_by(Pokemon.spawnpoint_id)

        s = list(query.dicts())
        # for each spawn work out if it is in the hex (clipping the diagonals)
        trueSpawns = []
        for spawn in s:
            spawn['time'] = (spawn['time'] + 2700) % 3600
            # get the offset from the center of each spawn in km
            offset = [math.radians(spawn['lat'] - center[0]) * R, math.radians(spawn['lng'] - center[1]) * (R * math.cos(math.radians(center[0])))]
            # check agains the 4 lines that make up the diagonals
            if (offset[1] + (offset[0] * 0.5)) > hdist:  # too far ne
                continue
            if (offset[1] - (offset[0] * 0.5)) > hdist:  # too far se
                continue
            if ((offset[0] * 0.5) - offset[1]) > hdist:  # too far nw
                continue
            if ((0 - offset[1]) - (offset[0] * 0.5)) > hdist:  # too far sw
                continue
            # if it gets to here its  a good spawn
            trueSpawns.append(spawn)
        return trueSpawns


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
                     .limit(max_pokestops)
                     .dicts())
        else:
            query = (Pokestop
                     .select()
                     .where((Pokestop.latitude >= swLat) &
                            (Pokestop.longitude >= swLng) &
                            (Pokestop.latitude <= neLat) &
                            (Pokestop.longitude <= neLng) &
                            (Pokestop.last_update >= since))
                     .limit(max_pokestops)
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
            results = (Gym
                       .select()
                       .where(Gym.last_update >= since)
                       .limit(max_gyms)
                       .dicts())
        else:
            results = (Gym
                       .select()
                       .where((Gym.latitude >= swLat) &
                            (Gym.longitude >= swLng) &
                            (Gym.latitude <= neLat) &
                            (Gym.longitude <= neLng) &
                            (Gym.last_update >= since))
                       .limit(max_gyms)
                       .dicts())

            # Performance: Disable the garbage collector prior to creating a (potentially) large dict with append()
            gc.disable()

        gyms = {}
        gym_ids = []
        for g in results:
            g['name'] = None
            g['pokemon'] = []
            gyms[g['gym_id']] = g
            gym_ids.append(g['gym_id'])

        if len(gym_ids) > 0:
            pokemon = (GymMember
                       .select(
                GymMember.gym_id,
                GymPokemon.cp.alias('pokemon_cp'),
                GymPokemon.pokemon_id,
                GymPokemon.iv_attack.alias('individual_attack'),
                GymPokemon.iv_defense.alias('individual_defense'),
                GymPokemon.iv_stamina.alias('individual_stamina'),
                Trainer.name.alias('trainer_name'),
                Trainer.level.alias('trainer_level'))
                       .join(Gym, on=(GymMember.gym_id == Gym.gym_id))
                       .join(GymPokemon, on=(GymMember.pokemon_uid == GymPokemon.pokemon_uid))
                       .join(Trainer, on=(GymPokemon.trainer_name == Trainer.name))
                       .where(GymMember.gym_id << gym_ids)
                       .where(GymMember.last_scanned > Gym.last_modified)
                       .order_by(GymMember.gym_id, GymPokemon.cp)
                       .dicts())

            for p in pokemon:
                p['pokemon_name'] = get_pokemon_name(p['pokemon_id'])
                gyms[p['gym_id']]['pokemon'].append(p)

            details = (GymDetails
                       .select(
                GymDetails.gym_id,
                GymDetails.name)
                       .where(GymDetails.gym_id << gym_ids)
                       .dicts())

            for d in details:
                gyms[d['gym_id']]['name'] = d['name']

        # Re-enable the GC.
        gc.enable()

        return gyms

class GymMember(BaseModel):
    gym_id = CharField(index=True)
    pokemon_uid = CharField(max_length=30)
    last_scanned = DateTimeField(default=datetime.utcnow)

    class Meta:
        primary_key = False
        db_table = "gym_member"


class GymPokemon(BaseModel):
    pokemon_uid = CharField(max_length=30, primary_key=True)
    pokemon_id = IntegerField()
    cp = IntegerField()
    trainer_name = CharField(max_length=45)
    num_upgrades = SmallIntegerField(null=True)
    attack_1 = SmallIntegerField(null=True)
    attack_2 = SmallIntegerField(null=True)
    height = FloatField(null=True)
    weight = FloatField(null=True)
    stamina = SmallIntegerField(null=True)
    stamina_max = SmallIntegerField(null=True)
    cp_multiplier = FloatField(null=True)
    additional_cp_multiplier = FloatField(null=True)
    iv_defense = SmallIntegerField(null=True)
    iv_stamina = SmallIntegerField(null=True)
    iv_attack = SmallIntegerField(null=True)
    last_seen = DateTimeField(default=datetime.utcnow)

class Trainer(BaseModel):
    name = CharField(primary_key=True, max_length=50)
    team = IntegerField()
    level = IntegerField()
    last_seen = DateTimeField(default=datetime.utcnow)


class GymDetails(BaseModel):
    gym_id = CharField(primary_key=True, max_length=50)
    name = CharField()
    description = TextField(null=True, default="")
    url = CharField()
    last_update = DateTimeField(default=datetime.utcnow)


class ScannedCell(BaseModel):
    latitude = DoubleField()
    longitude = DoubleField()
    last_update = DateTimeField(index=True)
    scan_id = SmallIntegerField()

    class Meta:
        primary_key = CompositeKey('latitude', 'longitude')

    @staticmethod
    def parse_json(data):
        if 'last_update' in data and isinstance(data['last_update'], unicode):
            data['last_update'] = dateutil.parser.parse(data['last_update'])

    @classmethod
    def get_latest(cls):
        query = (ScannedCell
                 .select(ScannedCell.last_update)
                 .order_by(-ScannedCell.last_update)
                 .limit(1))

        if query.count():
            return query.get()
        empty = ScannedCell()
        empty.last_update = datetime.min
        return empty

    @staticmethod
    def get_recent( swLat, swLng, neLat, neLng, since=datetime.min, member_id=0):
        query = (ScannedCell
                 .select()
                 .where((ScannedCell.last_update >=
                         (datetime.utcnow() - timedelta(minutes=15))) &
                        (ScannedCell.last_update >= since) &
                        (ScannedCell.latitude >= swLat) &
                        (ScannedCell.longitude >= swLng) &
                        (ScannedCell.latitude <= neLat) &
                        (ScannedCell.longitude <= neLng) &
                        (ScannedCell.scan_id << MemberLocation.select(MemberLocation.location_id).where(
                            (MemberLocation.expire_at > datetime.utcnow()) &
                            ((MemberLocation.member_id == member_id) | (MemberLocation.member_id == 0)))))
                 .limit(max_scannedcells)
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


class Member(BaseModel):
    id = SmallIntegerField(primary_key=True)
    username = CharField(max_length=45)
    provider = SmallIntegerField()
    email = CharField(max_length=255)
    token = CharField(max_length=4095)

    @classmethod
    def create_new(cls, provider, email, token, username):
        member = Member()
        member.email = email
        member.provider = provider
        member.username = username
        member.token = token
        member.save(force_insert=True)
        return member

    @classmethod
    def get_by_provider(cls, provider, email):
        query = Member.select().where((Member.email == email) &
                                     (Member.provider == provider))
        if len(query):
            return query.get()
        return None



class Scan(BaseModel):
    id = IntegerField(primary_key=True)
    latitude = DoubleField()
    longitude = DoubleField()
    request_time = DateTimeField()
    complete_time = DateTimeField()
    ip = CharField(max_length=45, index=True)
    account = CharField(max_length=200, index=True)
    scan_id = SmallIntegerField()

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


class MemberScanRelation(Enum):
    public = 0
    owner = 1
    shared = 2

class MemberLocation(BaseModel):
    member_id = SmallIntegerField()
    location_id = SmallIntegerField()
    expire_at = DateTimeField()
    relation = SmallIntegerField()

    class Meta:
        primary_key = CompositeKey('member_id', 'location_id')

class Location(BaseModel):
    id = SmallIntegerField(primary_key=True)
    latitude = DoubleField()
    longitude = DoubleField()
    steps = SmallIntegerField()
    threads = SmallIntegerField()
    speed = SmallIntegerField()
    last_fullscan = DateTimeField()
    last_start = DateTimeField()
    last_keepalive = DateTimeField()
    creation_time = DateTimeField()
    name = CharField(max_length=45)
    spawn_count = SmallIntegerField()

    @classmethod
    def get(cls, id):
        query = Location.select().where(Location.id == id)
        if len(query):
            return query.get()
        return None

    @classmethod
    def get_all(cls):
        query = Location.select()
        radars = []
        for s in query:
            radars.append(s)
        return radars

    @classmethod
    def get_with_relation(cls, member):
        query = Location.select(Location, MemberLocation)\
                        .join(MemberLocation, join_type=JOIN.LEFT_OUTER, on=(MemberLocation.location_id == Location.id).alias('member_location'))\
                        .where((MemberLocation.member_id == member.id) | (MemberLocation.member_id == 0))
        radars = []
        for s in query:
            radars.append(s)
        return radars

    @classmethod
    def update_spawn_count(cls, id, count):
        Location.update(spawn_count = count).where(Location.id == id).execute()



class Spawn(BaseModel):
    id = CharField(max_length=12, primary_key=True)
    latitude = DoubleField(index=True)
    longitude = DoubleField(index=True)
    last_update = DateTimeField(index=True)
    last_disappear = DateTimeField()
    duration_min = SmallIntegerField()
    missed_count = SmallIntegerField()

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
                        (Spawn.longitude <= neLng) &
                        (Spawn.missed_count < 2))
                 .dicts())
        else:
            query = (Spawn
                 .select(Spawn.id, Spawn.latitude, Spawn.longitude, Spawn.last_disappear, Spawn.duration_min)
                 .where((Spawn.latitude >= swLat) &
                        (Spawn.longitude >= swLng) &
                        (Spawn.latitude <= neLat) &
                        (Spawn.longitude <= neLng) &
                        (Spawn.missed_count < 2))
                 .dicts())

        spawns = []
        for s in query:
            spawns.append(s)

        return spawns

    @classmethod
    def get_spawn_stats(cls, id):
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


    @classmethod
    def get_spawn_raw(cls, id):
        # min_date =
        query = (Spawn
                .select(Spawn.id, Pokemon.pokemon_id, Pokemon.disappear_time)
                .join(Pokemon, on=(Spawn.id == Pokemon.spawnpoint_id)).alias('pokemon')
                .where(Spawn.id == id))

        pokestats = []
        for s in query:
            pokestats.append(s)

        return pokestats

    @staticmethod
    def add_missed(id):
        spawn = (Spawn.select().where(Spawn.id == id)).get()
        spawn.missed_count += 1
        spawn.save()


class Versions(flaskDb.Model):
    key = CharField()
    val = IntegerField()

    class Meta:
        primary_key = False


def construct_pokemon_dict(pokemons, p, encounter_result, d_t):
    pokemons[p['encounter_id']] = {
        'encounter_id': b64encode(str(p['encounter_id'])),
        'spawnpoint_id': p['spawn_point_id'],
        'pokemon_id': p['pokemon_data']['pokemon_id'],
        'latitude': p['latitude'],
        'longitude': p['longitude'],
        'disappear_time': d_t,
        'scan_id': args.location_id
    }
    if encounter_result is not None and 'wild_pokemon' in encounter_result['responses']['ENCOUNTER']:
        pokemon_info = encounter_result['responses']['ENCOUNTER']['wild_pokemon']['pokemon_data']
        attack = pokemon_info.get('individual_attack', 0)
        defense = pokemon_info.get('individual_defense', 0)
        stamina = pokemon_info.get('individual_stamina', 0)
        pokemons[p['encounter_id']].update({
            'individual_attack': attack,
            'individual_defense': defense,
            'individual_stamina': stamina,
            'attack_1': pokemon_info['move_1'],
            'attack_2': pokemon_info['move_2'],
        })
    else:
        if encounter_result is not None and 'wild_pokemon' not in encounter_result['responses']['ENCOUNTER']:
            log.warning("Error encountering {}, status code: {}".format(p['encounter_id'], encounter_result['responses']['ENCOUNTER']['status']))
        pokemons[p['encounter_id']].update({
            'individual_attack': None,
            'individual_defense': None,
            'individual_stamina': None,
            'attack_1': None,
            'attack_2': None,
        })


def parse_map(map_dict, step_location, api):
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
                # time_till_hidden_ms was overflowing causing a negative integer.
                # It was also returning a value above 3.6M ms.
                if 0 < p['time_till_hidden_ms'] < 3600000:
                    d_t = datetime.utcfromtimestamp(
                        (p['last_modified_timestamp_ms'] +
                         p['time_till_hidden_ms']) / 1000.0)
                else:
                    # Set a value of 15 minutes because currently its unknown but larger than 15.
                    d_t = datetime.utcfromtimestamp((p['last_modified_timestamp_ms'] + 900000) / 1000.0)

                printPokemon(p['pokemon_data']['pokemon_id'], p['latitude'],
                             p['longitude'], d_t)

                # Scan for IVs and moves
                encounter_result = None
                if (args.encounter and (p['pokemon_data']['pokemon_id'] in args.encounter_whitelist or
                                        p['pokemon_data']['pokemon_id'] not in args.encounter_blacklist and not args.encounter_whitelist)):
                    time.sleep(args.encounter_delay)
                    encounter_result = api.encounter(encounter_id=p['encounter_id'],
                                                     spawn_point_id=p['spawn_point_id'],
                                                     player_latitude=step_location[0],
                                                     player_longitude=step_location[1])
                construct_pokemon_dict(pokemons, p, encounter_result, d_t)

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
                        'pokestop_id': b64encode(str(f['id'])),
                        'enabled': f['enabled'],
                        'latitude': f['latitude'],
                        'longitude': f['longitude'],
                        'last_modified_time': f['last_modified_timestamp_ms'],
                        'lure_expiration': calendar.timegm(lure_expiration.timetuple()),
                        'active_fort_modifier': active_fort_modifier
                    }

                    # Include lured pokéstops in our updates to webhooks
                    if args.webhook_updates_only:
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

                # Send all pokéstops to webhooks
                if not args.webhook_updates_only:
                    # Explicitly set 'webhook_data', in case we want to change the information pushed to webhooks,
                    # similar to above and previous commits.
                    l_e = None

                    if lure_expiration is not None:
                        l_e = calendar.timegm(lure_expiration.timetuple())

                    webhook_data = {
                        'pokestop_id': b64encode(str(f['id'])),
                        'enabled': f['enabled'],
                        'latitude': f['latitude'],
                        'longitude': f['longitude'],
                        'last_modified': calendar.timegm(pokestops[f['id']]['last_modified'].timetuple()),
                        'lure_expiration': l_e,
                        'active_fort_modifier': active_fort_modifier,
                    }
                    send_to_webhook('pokestop', webhook_data)

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

                # Send gyms to webhooks
                if not args.webhook_updates_only:
                    # Explicitly set 'webhook_data', in case we want to change the information pushed to webhooks,
                    # similar to above and previous commits.
                    webhook_data = {
                        'gym_id': b64encode(str(f['id'])),
                        'team_id': f.get('owned_by_team', 0),
                        'guard_pokemon_id': f.get('guard_pokemon_id', 0),
                        'gym_points': f.get('gym_points', 0),
                        'enabled': f['enabled'],
                        'latitude': f['latitude'],
                        'longitude': f['longitude'],
                        'last_modified': calendar.timegm(gyms[f['id']]['last_modified'].timetuple()),
                    }
                    send_to_webhook('gym', webhook_data)

    pokemons_upserted = 0
    pokestops_upserted = 0
    gyms_upserted = 0

    scanned[0] = {
        'latitude': step_location[0],
        'longitude': step_location[1],
        'scan_id': args.location_id
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

    dispatch_upsert(ScannedCell, scanned)

    # clean_database()

    flaskDb.close_db(None)

    if pokemons_upserted == 0 and pokestops_upserted == 0 and gyms_upserted == 0:
        # log.error('Received empty map response: %s', json.dumps(map_dict))
        raise EmptyResponseException()

    log.info('Upserted %d pokemon, %d pokestops, and %d gyms',
             pokemons_upserted,
             pokestops_upserted,
             gyms_upserted)

    return {'pokemons': pokemons, 'pokestops': pokestops, 'gyms': gyms}


def parse_gyms(args, gym_responses, wh_update_queue):
    gym_details = {}
    gym_members = {}
    gym_pokemon = {}
    trainers = {}

    i = 0
    for g in gym_responses.values():
        gym_state = g['gym_state']
        gym_id = gym_state['fort_data']['id']

        gym_details[gym_id] = {
            'gym_id': gym_id,
            'name': g['name'],
            'description': g.get('description'),
            'url': g['urls'][0],
        }

        if args.webhooks:
            webhook_data = {
                'id': gym_id,
                'latitude': gym_state['fort_data']['latitude'],
                'longitude': gym_state['fort_data']['longitude'],
                'team': gym_state['fort_data'].get('owned_by_team', 0),
                'name': g['name'],
                'description': g.get('description'),
                'url': g['urls'][0],
                'pokemon': [],
            }

        for member in gym_state.get('memberships', []):
            gym_members[i] = {
                'gym_id': gym_id,
                'pokemon_uid': member['pokemon_data']['id'],
            }

            gym_pokemon[i] = {
                'pokemon_uid': member['pokemon_data']['id'],
                'pokemon_id': member['pokemon_data']['pokemon_id'],
                'cp': member['pokemon_data']['cp'],
                'trainer_name': member['trainer_public_profile']['name'],
                'num_upgrades': member['pokemon_data'].get('num_upgrades', 0),
                'attack_1': member['pokemon_data'].get('move_1'),
                'attack_2': member['pokemon_data'].get('move_2'),
                'height': member['pokemon_data'].get('height_m'),
                'weight': member['pokemon_data'].get('weight_kg'),
                'stamina': member['pokemon_data'].get('stamina'),
                'stamina_max': member['pokemon_data'].get('stamina_max'),
                'cp_multiplier': member['pokemon_data'].get('cp_multiplier'),
                'additional_cp_multiplier': member['pokemon_data'].get('additional_cp_multiplier', 0),
                'iv_defense': member['pokemon_data'].get('individual_defense', 0),
                'iv_stamina': member['pokemon_data'].get('individual_stamina', 0),
                'iv_attack': member['pokemon_data'].get('individual_attack', 0),
                'last_seen': datetime.utcnow(),
            }

            trainers[i] = {
                'name': member['trainer_public_profile']['name'],
                'team': gym_state['fort_data']['owned_by_team'],
                'level': member['trainer_public_profile']['level'],
                'last_seen': datetime.utcnow(),
            }

            if args.webhooks:
                webhook_data['pokemon'].append({
                    'pokemon_uid': member['pokemon_data']['id'],
                    'pokemon_id': member['pokemon_data']['pokemon_id'],
                    'cp': member['pokemon_data']['cp'],
                    'num_upgrades': member['pokemon_data'].get('num_upgrades', 0),
                    'move_1': member['pokemon_data'].get('move_1'),
                    'move_2': member['pokemon_data'].get('move_2'),
                    'height': member['pokemon_data'].get('height_m'),
                    'weight': member['pokemon_data'].get('weight_kg'),
                    'stamina': member['pokemon_data'].get('stamina'),
                    'stamina_max': member['pokemon_data'].get('stamina_max'),
                    'cp_multiplier': member['pokemon_data'].get('cp_multiplier'),
                    'additional_cp_multiplier': member['pokemon_data'].get('additional_cp_multiplier', 0),
                    'iv_defense': member['pokemon_data'].get('individual_defense', 0),
                    'iv_stamina': member['pokemon_data'].get('individual_stamina', 0),
                    'iv_attack': member['pokemon_data'].get('individual_attack', 0),
                    'trainer_name': member['trainer_public_profile']['name'],
                    'trainer_level': member['trainer_public_profile']['level'],
                })

            i += 1
        if args.webhooks:
            wh_update_queue.put(('gym_details', webhook_data))

    # All this database stuff is synchronous (not using the upsert queue) on purpose.
    # Since the search workers load the GymDetails model from the database to determine if a gym
    # needs rescanned, we need to be sure the GymDetails get fully committed to the database before moving on.
    #
    # We _could_ synchronously upsert GymDetails, then queue the other tables for
    # upsert, but that would put that Gym's overall information in a weird non-atomic state.

    # upsert all the models
    if len(gym_details):
        bulk_upsert(GymDetails, gym_details)
    if len(gym_pokemon):
        bulk_upsert(GymPokemon, gym_pokemon)
    if len(trainers):
        bulk_upsert(Trainer, trainers)

    # This needs to be completed in a transaction, because we don't wany any other thread or process
    # to mess with the GymMembers for the gyms we're updating while we're updating the bridge table.
    with flaskDb.database.transaction():
        # get rid of all the gym members, we're going to insert new records
        if len(gym_details):
            DeleteQuery(GymMember).where(GymMember.gym_id << gym_details.keys()).execute()

        # insert new gym members
        if len(gym_members):
            bulk_upsert(GymMember, gym_members)

    log.info('Upserted %d gyms and %d gym members',
             len(gym_details),
             len(gym_members))



def clean_database():
    query = (ScannedCell
             .delete()
             .where((ScannedCell.last_update <
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
    if (cls is Pokemon) or (cls is Gym) or (cls is Pokestop) or (cls is ScannedCell):
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
    db.create_tables([Pokemon, Pokestop, Gym, ScannedCell], safe=True)
    db.close()

def drop_tables(db):
    db.connect()
    db.drop_tables([Pokemon, Pokestop, Gym, ScannedCell, Versions], safe=True)
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

        if ScannedCell.table_exists():
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
        db.drop_tables([ScannedCell])

    if old_ver < 5:
        # Some pokemon were added before the 595 bug was "fixed"
        # Clean those up for a better UX
        query = (Pokemon
                 .delete()
                 .where(Pokemon.disappear_time >
                        (datetime.utcnow() - timedelta(hours=24))))
        query.execute()
