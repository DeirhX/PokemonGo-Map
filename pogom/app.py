#!/usr/bin/python
# -*- coding: utf-8 -*-

import calendar
import logging
from Queue import Full
from collections import OrderedDict
from datetime import datetime
from datetime import timedelta

from flask import Flask, jsonify, render_template, request
from flask import session
from flask.json import JSONEncoder
from flask_compress import Compress
from s2sphere import LatLng

from extend.configure import configure
from extend.member import member_scan_pool_max, member_scan_pool_remain_user, \
    member_scan_pool_remain_ip
from extend.stats import get_guests_seen, get_members_seen, get_requests_made, get_scans_made, mark_refresh, mark_scan
from extend.user import verify_token
from pogom.utils import get_args
from . import config
from .models import Pokemon, Gym, Pokestop, ScannedLocation, bulk_upsert, Scan, Spawn, dispatch_upsert
from .search import scan_enqueue

log = logging.getLogger(__name__)
compress = Compress()
args = get_args() # Performance reasons

class Pogom(Flask):
    def __init__(self, import_name, **kwargs):
        super(Pogom, self).__init__(import_name, **kwargs)
        configure(self)
        compress.init_app(self)
        self.json_encoder = CustomJSONEncoder
        self.route("/", methods=['GET'])(self.fullmap)
        self.route("/raw_data", methods=['GET'])(self.raw_data)
        self.route("/scan", methods=['GET'])(self.scan)
        self.route("/stats", methods=['GET'])(self.stats)
        self.route("/message", methods=['GET'])(self.message)
        self.route("/auth", methods=['GET'])(self.auth)
        self.route("/spawn_detail", methods=['GET'])(self.spawn_detail)
        self.route("/loc", methods=['GET'])(self.loc)
        self.route("/next_loc", methods=['POST'])(self.next_loc)
        self.route("/mobile", methods=['GET'])(self.list_pokemon)
        self.route("/search_control", methods=['GET'])(self.get_search_control)
        self.route("/search_control", methods=['POST'])(self.post_search_control)
        self.route("/stats", methods=['GET'])(self.get_stats)

        config['ROOT_PATH'] = self.root_path
        self.secret_key = args.app_secret_key

    def set_search_control(self, control):
        self.search_control = control

    def set_location_queue(self, queue):
        self.location_queue = queue

    def set_current_location(self, location):
        self.current_location = location

    def get_search_control(self):
        return jsonify({'status': not self.search_control.is_set()})

    def post_search_control(self):
        if not args.search_control:
            return 'Search control is disabled', 403
        action = request.args.get('action', 'none')
        if action == 'on':
            self.search_control.clear()
            log.info('Search thread resumed')
        elif action == 'off':
            self.search_control.set()
            log.info('Search thread paused')
        else:
            return jsonify({'message': 'invalid use of api'})
        return self.get_search_control()

    def fullmap(self):
        #args = get_args()
        fixed_display = "none" if args.fixed_location else "inline"
        search_display = "inline" if args.search_control else "none"

        return render_template('map.html',
                               lat=self.current_location[0],
                               lng=self.current_location[1],
                               gmaps_key=config['GMAPS_KEY'],
                               lang=config['LOCALE'],
                               is_fixed=fixed_display,
                               search_control=search_display,
                               script_src=config['SCRIPT_SRC'] if not args.debug else '',
                               script_ext=config['SCRIPT_EXT'] if not args.debug else '',
                               )

    def raw_data(self):
        user = session['email'] if 'email' in session else None
        d = {}
        swLat = request.args.get('swLat')
        swLng = request.args.get('swLng')
        neLat = request.args.get('neLat')
        neLng = request.args.get('neLng')
        key = request.args.get('key')
        if (key != u'dontspam'):
            return ""

        last_pokemon = request.args.get('lastTimestamps[lastPokemon]')
        last_pokemon = datetime.utcfromtimestamp(float(last_pokemon) / 1000.0) if last_pokemon else datetime.min
        last_spawn = request.args.get('lastTimestamps[lastSpawn]')
        last_spawn = datetime.utcfromtimestamp(float(last_spawn) / 1000.0) if last_spawn else datetime.min
        last_gym = request.args.get('lastTimestamps[lastGym]')
        last_gym = datetime.utcfromtimestamp(float(last_gym) / 1000.0) if last_gym else datetime.min
        last_pokestop = request.args.get('lastTimestamps[lastPokestop]')
        last_pokestop = datetime.utcfromtimestamp(float(last_pokestop) / 1000.0) if last_pokestop else datetime.min
        last_scannedloc = request.args.get('lastTimestamps[lastScannedLoc]')
        last_scannedloc = datetime.utcfromtimestamp(float(last_scannedloc) / 1000.0) if last_scannedloc else datetime.min

        d['lastTimestamps'] = {'lastPokemon': Pokemon.get_latest().last_update,
                               'lastSpawn': Spawn.get_latest().last_update,
                               'lastGym': Gym.get_latest().last_update,
                               'lastPokestop': Pokestop.get_latest().last_update,
                               'lastScannedLoc': ScannedLocation.get_latest().last_update}

        if request.args.get('pokemon', 'true') == 'true':
            if request.args.get('ids'):
                ids = [int(x) for x in request.args.get('ids').split(',')]
                d['pokemons'] = Pokemon.get_active_by_id(ids, swLat, swLng,
                                                         neLat, neLng, last_pokemon)
            else:
                d['pokemons'] = Pokemon.get_active(swLat, swLng, neLat, neLng, last_pokemon)

        if request.args.get('pokestops', 'false') == 'true':
            d['pokestops'] = Pokestop.get_stops(swLat, swLng, neLat, neLng, last_gym)
        if request.args.get('seen', 'false') == 'true':
            for duration in self.get_valid_stat_input()["duration"]["items"].values():
                if duration["selected"] == "SELECTED":
                    d['seen'] = Pokemon.get_seen(duration["value"])
                    break

        if request.args.get('appearances', 'false') == 'true':
            d['appearances'] = Pokemon.get_appearances(request.args.get('pokemonid'), request.args.get('last', type=float))

        if request.args.get('gyms', 'true') == 'true':
            d['gyms'] = Gym.get_gyms(swLat, swLng, neLat, neLng, last_pokestop)

        if request.args.get('scanned', 'true') == 'true':
            d['scanned'] = ScannedLocation.get_recent(swLat, swLng, neLat,
                                                      neLng, last_scannedloc)

        if request.args.get('spawns', 'false') == 'true':
            d['spawns'] = Spawn.get_spawns(swLat, swLng, neLat, neLng, last_spawn)
            for spawn in d['spawns']:
                spawn['last_appear'] = spawn['last_disappear'] - timedelta(minutes=15)

        mark_refresh(request, user)
        return jsonify(d)


    def loc(self):
        d = {}
        d['lat'] = self.current_location[0]
        d['lng'] = self.current_location[1]

        return jsonify(d)

    def next_loc(self):
        #args = get_args()
        if args.fixed_location:
            return 'Location changes are turned off', 403
        # part of query string
        if request.args:
            lat = request.args.get('lat', type=float)
            lon = request.args.get('lon', type=float)
        # from post requests
        if request.form:
            lat = request.form.get('lat', type=float)
            lon = request.form.get('lon', type=float)

        if not (lat and lon):
            log.warning('Invalid next location: %s,%s', lat, lon)
            return 'bad parameters', 400
        else:
            self.location_queue.put((lat, lon, 0))
            self.set_current_location((lat, lon, 0))
            log.info('Changing next location: %s,%s', lat, lon)
            return 'ok'

    def list_pokemon(self):
        # todo: check if client is android/iOS/Desktop for geolink, currently
        # only supports android
        pokemon_list = []

        # Allow client to specify location
        lat = request.args.get('lat', self.current_location[0], type=float)
        lon = request.args.get('lon', self.current_location[1], type=float)
        origin_point = LatLng.from_degrees(lat, lon)

        for pokemon in Pokemon.get_active(None, None, None, None):
            pokemon_point = LatLng.from_degrees(pokemon['latitude'],
                                                pokemon['longitude'])
            diff = pokemon_point - origin_point
            diff_lat = diff.lat().degrees
            diff_lng = diff.lng().degrees
            direction = (('N' if diff_lat >= 0 else 'S')
                         if abs(diff_lat) > 1e-4 else '') +\
                        (('E' if diff_lng >= 0 else 'W')
                         if abs(diff_lng) > 1e-4 else '')
            entry = {
                'id': pokemon['pokemon_id'],
                'name': pokemon['pokemon_name'],
                'card_dir': direction,
                'distance': int(origin_point.get_distance(
                    pokemon_point).radians * 6366468.241830914),
                'time_to_disappear': '%d min %d sec' % (divmod((
                    pokemon['disappear_time'] - datetime.utcnow()).seconds, 60)),
                'disappear_time': pokemon['disappear_time'],
                'disappear_sec': (pokemon['disappear_time'] - datetime.utcnow()).seconds,
                'latitude': pokemon['latitude'],
                'longitude': pokemon['longitude']
            }
            pokemon_list.append((entry, entry['distance']))
        pokemon_list = [y[0] for y in sorted(pokemon_list, key=lambda x: x[1])]
        return render_template('mobile_list.html',
                               pokemon_list=pokemon_list,
                               origin_lat=lat,
                               origin_lng=lon)

    def get_valid_stat_input(self):
        duration = request.args.get("duration", type=str)
        sort = request.args.get("sort", type=str)
        order = request.args.get("order", type=str)
        valid_durations = OrderedDict()
        valid_durations["1h"] = {"display": "Last Hour", "value": timedelta(hours=1), "selected": ("SELECTED" if duration == "1h" else "")}
        valid_durations["3h"] = {"display": "Last 3 Hours", "value": timedelta(hours=3), "selected": ("SELECTED" if duration == "3h" else "")}
        valid_durations["6h"] = {"display": "Last 6 Hours", "value": timedelta(hours=6), "selected": ("SELECTED" if duration == "6h" else "")}
        valid_durations["12h"] = {"display": "Last 12 Hours", "value": timedelta(hours=12), "selected": ("SELECTED" if duration == "12h" else "")}
        valid_durations["1d"] = {"display": "Last Day", "value": timedelta(days=1), "selected": ("SELECTED" if duration == "1d" else "")}
        valid_durations["7d"] = {"display": "Last 7 Days", "value": timedelta(days=7), "selected": ("SELECTED" if duration == "7d" else "")}
        valid_durations["14d"] = {"display": "Last 14 Days", "value": timedelta(days=14), "selected": ("SELECTED" if duration == "14d" else "")}
        valid_durations["1m"] = {"display": "Last Month", "value": timedelta(days=365 / 12), "selected": ("SELECTED" if duration == "1m" else "")}
        valid_durations["3m"] = {"display": "Last 3 Months", "value": timedelta(days=3 * 365 / 12), "selected": ("SELECTED" if duration == "3m" else "")}
        valid_durations["6m"] = {"display": "Last 6 Months", "value": timedelta(days=6 * 365 / 12), "selected": ("SELECTED" if duration == "6m" else "")}
        valid_durations["1y"] = {"display": "Last Year", "value": timedelta(days=365), "selected": ("SELECTED" if duration == "1y" else "")}
        valid_durations["all"] = {"display": "Map Lifetime", "value": 0, "selected": ("SELECTED" if duration == "all" else "")}
        if duration not in valid_durations:
            valid_durations["1d"]["selected"] = "SELECTED"
        valid_sort = OrderedDict()
        valid_sort["count"] = {"display": "Count", "selected": ("SELECTED" if sort == "count" else "")}
        valid_sort["id"] = {"display": "Pokedex Number", "selected": ("SELECTED" if sort == "id" else "")}
        valid_sort["name"] = {"display": "Pokemon Name", "selected": ("SELECTED" if sort == "name" else "")}
        if sort not in valid_sort:
            valid_sort["count"]["selected"] = "SELECTED"
        valid_order = OrderedDict()
        valid_order["asc"] = {"display": "Ascending", "selected": ("SELECTED" if order == "asc" else "")}
        valid_order["desc"] = {"display": "Descending", "selected": ("SELECTED" if order == "desc" else "")}
        if order not in valid_order:
            valid_order["desc"]["selected"] = "SELECTED"
        valid_input = OrderedDict()
        valid_input["duration"] = {"display": "Duration", "items": valid_durations}
        valid_input["sort"] = {"display": "Sort", "items": valid_sort}
        valid_input["order"] = {"display": "Order", "items": valid_order}
        return valid_input

    def get_stats(self):
        return render_template('statistics.html',
                               lat=self.current_location[0],
                               lng=self.current_location[1],
                               gmaps_key=config['GMAPS_KEY'],
                               valid_input=self.get_valid_stat_input()
                               )


    def scan(self):
        try:
            user = session['email'] if 'email' in session else None
            key = request.args.get('key')
            if (key != u'dontspam'):
                return ""
            lat = request.args.get('lat', type=float)
            lon = request.args.get('lon', type=float)
            if not (lat and lon):
                print('[-] Invalid location: %s,%s' % (lat, lon))
                return 'bad parameters', 400
            position = (lat, lon, 0)

            # Check remaining pool
            if (user):
                remain = member_scan_pool_remain_user(user)
            else:
                remain = member_scan_pool_remain_ip(request.remote_addr)
            if (remain <= 0):
                d = {'result': 'full'}

            # Check spam filter
            last_scan = Scan.get_last_scan_by_ip(request.remote_addr)
            if (last_scan):
                db_time = self.config['DATABASE'].execute_sql('select current_timestamp();')
                scan_offset = db_time.fetchone()[0] - last_scan.request_time
                if (scan_offset < timedelta(seconds=10)):
                    return jsonify({'result': 'full'})


            scan = {}
            scan[0] = {
                'latitude': lat,
                'longitude': lon,
                'ip': request.remote_addr,
                'account': user
            }
            dispatch_upsert(Scan, scan)

            scan_enqueue(datetime.utcnow(), datetime.utcnow() + timedelta(minutes=5), position, 3)
            mark_scan(request, user)
            d = {'result': 'received'}
        except Full:
            d = {'result': 'full'}
        except Exception as ex:
            log.exception('Error adding to scan queue')
            d = {'result': 'failed'}
        return jsonify(d)


    def stats(self):
        user = session['email'] if 'email' in session else None
        return jsonify({
            'guests': get_guests_seen(),
            'members': get_members_seen(),
            'scans': get_scans_made(),
            'refreshes': get_requests_made(),
            'memberScanPoolLeft': member_scan_pool_remain_user (user) if user
                                  else member_scan_pool_remain_ip(request.remote_addr),
            'memberScanPool': member_scan_pool_max(user),
        })

    def spawn_detail(self):
        user = session['email'] if 'email' in session else None
        if not request.args:
            return jsonify({'result' : 'failed'})

        id = request.args.get('id')
        total = 0
        details = Spawn.get_detail(id)
        if (len(details)):
            for entry in details:
                total += entry.count
            last_despawn = details[0].max_disappear.time()
            next_despawn = datetime.utcnow()
            next_despawn = datetime(next_despawn.year, next_despawn.month, next_despawn.day,
                                    next_despawn.hour, last_despawn.minute, last_despawn.second)
            next_spawn = next_despawn - timedelta(minutes=15)
            chances = []
            d = {'rank': total, 'spawn': next_spawn, 'despawn': next_despawn,'chances': chances}
            for entry in details:
                chances.append({'pokemon_id': entry.id.pokemon_id, 'chance': round(100 * entry.count / float(total)) })
        else: d = {}
        return jsonify(d)

    def auth(self):
        try:
            id_token = request.args.get('idToken', type=str)
            user_info = verify_token(id_token)
            if user_info and user_info['email_verified']:
                session['token'] = id_token
                session['email'] = user_info['email']
                session['sub'] = user_info['sub']
                return jsonify({'result': 'authenticated' })
            return jsonify({'result': 'denied'})
        except Exception as ex:
            return jsonify({'result': 'failed'})

    def message(self):
        return jsonify({'message' : 'New crypto is defeated. Scans will be coming back slowly.'})

class CustomJSONEncoder(JSONEncoder):

    def default(self, obj):
        try:
            if isinstance(obj, datetime):
                if obj.utcoffset() is not None:
                    obj = obj - obj.utcoffset()
                millis = int(
                    calendar.timegm(obj.timetuple()) * 1000 +
                    obj.microsecond / 1000
                )
                return millis
            iterable = iter(obj)
        except TypeError:
            pass
        else:
            return list(iterable)
        return JSONEncoder.default(self, obj)
