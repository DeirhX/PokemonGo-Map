#!/usr/bin/python
# -*- coding: utf-8 -*-

'''
Search Architecture:
 - Have a list of accounts
 - Create an "overseer" thread
 - Search Overseer:
   - Tracks incoming new location values
   - Tracks "paused state"
   - During pause or new location will clears current search queue
   - Starts search_worker threads
 - Search Worker Threads each:
   - Have a unique API login
   - Listens to the same Queue for areas to scan
   - Can re-login as needed
   - Shares a global lock for map parsing
'''

import logging
import pprint
import time
import math
import json
import geopy.distance as geopy_distance
import os
import random
import time
import geopy.distance as geopy_distance

from threading import Thread, Lock
from operator import itemgetter

from Queue import Queue, PriorityQueue

from datetime import timedelta, datetime

from pogom.exceptions import NoAuthTicketException, EmptyResponseException, NoAvailableLogins
from pogom.utils import json_datetime_iso, check_ip_still_same, local_to_utc
from queuing.scan_queue import ScanQueueProducer
from queue import Queue, Empty
from proxy import check_proxy

from pgoapi import PGoApi
from pgoapi.utilities import f2i
from pgoapi import utilities as util
from pgoapi.exceptions import AuthException

from . import config
from .models import parse_map, parse_and_save_gym_details, save_parsed_to_db, add_encounter_data, \
    Login, args, flaskDb, Pokemon, Spawn, Location, GymDetails, Proxy

log = logging.getLogger(__name__)
scan_radius = 0.07
TIMESTAMP = '\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000'
global_search_queue = Queue(config['SEARCH_QUEUE_DEPTH'])
scan_queue = Queue(config['SCAN_QUEUE_DEPTH'])

def get_new_coords(init_loc, distance, bearing):
    """ Given an initial lat/lng, a distance(in kms), and a bearing (degrees),
    this will calculate the resulting lat/lng coordinates.
    """
    R = 6378.1  # km radius of the earth
    bearing = math.radians(bearing)

    init_coords = [math.radians(init_loc[0]), math.radians(init_loc[1])]  # convert lat/lng to radians

    new_lat = math.asin(math.sin(init_coords[0]) * math.cos(distance / R) +
                        math.cos(init_coords[0]) * math.sin(distance / R) * math.cos(bearing)
                        )

    new_lon = init_coords[1] + math.atan2(math.sin(bearing) * math.sin(distance / R) * math.cos(init_coords[0]),
                                          math.cos(distance / R) - math.sin(init_coords[0]) * math.sin(new_lat)
                                          )

    return [math.degrees(new_lat), math.degrees(new_lon)]


def generate_location_steps(initial_loc, step_count, step_distance):
    # Bearing (degrees)
    NORTH = 0
    EAST = 90
    SOUTH = 180
    WEST = 270

    pulse_radius = step_distance  # km - radius of players heartbeat is 70m
    xdist = math.sqrt(3) * pulse_radius   # dist between column centers
    ydist = 3 * (pulse_radius / 2)          # dist between row centers

    yield (initial_loc[0], initial_loc[1], 0)  # insert initial location

    ring = 1
    loc = initial_loc
    while ring < step_count:
        # Set loc to start at top left
        loc = get_new_coords(loc, ydist, NORTH)
        loc = get_new_coords(loc, xdist / 2, WEST)
        for direction in range(6):
            for i in range(ring):
                if direction == 0:  # RIGHT
                    loc = get_new_coords(loc, xdist, EAST)
                if direction == 1:  # DOWN + RIGHT
                    loc = get_new_coords(loc, ydist, SOUTH)
                    loc = get_new_coords(loc, xdist / 2, EAST)
                if direction == 2:  # DOWN + LEFT
                    loc = get_new_coords(loc, ydist, SOUTH)
                    loc = get_new_coords(loc, xdist / 2, WEST)
                if direction == 3:  # LEFT
                    loc = get_new_coords(loc, xdist, WEST)
                if direction == 4:  # UP + LEFT
                    loc = get_new_coords(loc, ydist, NORTH)
                    loc = get_new_coords(loc, xdist / 2, WEST)
                if direction == 5:  # UP + RIGHT
                    loc = get_new_coords(loc, ydist, NORTH)
                    loc = get_new_coords(loc, xdist / 2, EAST)
                yield (loc[0], loc[1], random.random())
        ring += 1

def limit_locations_to_spawns(locations, scan_radius):
    # We need to get all spawnpoints in range. This is a square 70m * step_limit * 2
    minlat = reduce(lambda x,y: x if x < y else y, map(lambda loc: loc[0], locations))
    minlng = reduce(lambda x,y: x if x < y else y, map(lambda loc: loc[1], locations))
    maxlat = reduce(lambda x,y: x if x > y else y, map(lambda loc: loc[0], locations))
    maxlng = reduce(lambda x,y: x if x > y else y, map(lambda loc: loc[1], locations))
    # Extend each edge by scan circle radius so we don't ignore those spawns
    south, west = get_new_coords((minlat, minlng), scan_radius, 180), get_new_coords((minlat, minlng), scan_radius, 270)
    north, east = get_new_coords((maxlat, maxlng), scan_radius, 0), get_new_coords((maxlat, maxlng), scan_radius, 90)
    # Use the midpoints to arrive at the corners
    log.debug('For center %f, %f searching for spawnpoints between %f, %f and %f, %f',
              (north[0]+south[0])*0.5, (west[1]+east[1])*0.5, south[0], west[1], north[0], east[1])
    spawnpoints = Spawn.get_spawns(south[0], west[1], north[0], east[1])
    if len(spawnpoints) == 0:
        log.warning(
            'No spawnpoints found in the specified area! (Did you forget to run a normal scan in this area first?)')
    else:
        log.info('{0} spawns found in area for this worker'.format(len(spawnpoints)))

    spawnpoint_locs = set((d['latitude'], d['longitude']) for d in spawnpoints)
    def any_spawnpoints_in_range(coords):
        return any(geopy_distance.distance(coords, x).meters <= 1000 * scan_radius for x in spawnpoints)

    # CAUTION: O(n*n)!
    def closest_location(locs, point): # return distance, location
        return reduce(lambda x,y: x if x[0] < y[0] else y,
                      map(lambda loc: (geopy_distance.distance(point, loc), loc), locs))

    # Get locations with some spawns
    locations_with_spawns = []
    for spawn in spawnpoints:
        spawn_loc = (spawn['latitude'], spawn['longitude'])
        geo_distance, closest_loc = closest_location(locations, spawn_loc)
        if geo_distance.meters <= (1000 * scan_radius):
            locations_with_spawns.append((closest_loc, spawn))
            log.debug('Spawn {2} at [{0},{1}] added to scan'.format(
                spawn_loc[0], spawn_loc[1], spawn['id']))
        else:
            log.debug('Spawn {2} at [{0},{1}] is not inside of any scan circle, closest distance is {3} to [{4}, {5}]'.format(
                spawn_loc[0], spawn_loc[1], spawn['id'], geo_distance.meters, closest_loc[0], closest_loc[1]))

    # Sort by appear time
    locations_with_spawns.sort(key=lambda loc_spawn:
        ((loc_spawn[1]['last_disappear'].minute - loc_spawn[1]['duration_min']) % 60) * 60
         + loc_spawn[1]['last_disappear'].second)

    log.info('{0} spawns are in range and are going to be scanned'.format(len(locations_with_spawns)))
    return locations_with_spawns

def calc_distance(pos1, pos2):
    R = 6378.1  # km radius of the earth

    dLat = math.radians(pos1[0] - pos2[0])
    dLon = math.radians(pos1[1] - pos2[1])

    a = math.sin(dLat / 2) * math.sin(dLat / 2) + \
        math.cos(math.radians(pos1[0])) * math.cos(math.radians(pos2[0])) * \
        math.sin(dLon / 2) * math.sin(dLon / 2)

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    d = R * c

    return d


def gym_request(api, position, gym):
    try:
        log.debug('Getting details for gym @ %f/%f (%fkm away)', gym['latitude'], gym['longitude'], calc_distance(position, [gym['latitude'], gym['longitude']]))
        x = api.get_gym_details(gym_id=gym['gym_id'],
                                player_latitude=f2i(position[0]),
                                player_longitude=f2i(position[1]),
                                gym_latitude=gym['latitude'],
                                gym_longitude=gym['longitude'])

        # print pretty(x)
        return x

    except Exception as e:
        log.warning('Exception while downloading gym details: %s', e)
        return False


#
# A fake search loop which does....nothing!
#
def fake_search_loop():
    while True:
        log.info('Fake search loop running')
        time.sleep(10)

# The main search loop that keeps an eye on the over all process
def scan_overseer_thread(args, scan_threads, pause_bit, encryption_lib_path):

    for i in range(scan_threads):
        log.debug('Starting search worker thread %d', i)
        t = Thread(target=search_worker_thread,
                   name='search_worker_{}'.format(i),
                   args=(args, None, global_search_queue, None, encryption_lib_path))
        t.daemon = True
        t.start()

# gets the current time past the hour
def curSec():
    return (60 * time.gmtime().tm_min) + time.gmtime().tm_sec


# gets the diference between two times past the hour (in a range from -1800 to 1800)
def timeDif(a, b):
    dif = a - b
    if (dif < -1800):
        dif += 3600
    if (dif > 1800):
        dif -= 3600
    return dif


# binary search to get the lowest index of the item in Slist that has atleast time T
def SbSearch(Slist, T):
    first = 0
    last = len(Slist) - 1
    while first < last:
        mp = (first + last) // 2
        if Slist[mp]['time'] < T:
            first = mp + 1
        else:
            last = mp
    return first


# The main search loop that keeps an eye on the over all process
def search_overseer_thread(args, location_list, steps, pause_bit, encryption_lib_path):

    log.info('Search overseer starting')
    parse_lock = Lock()

    all_locations = []
    # Create a search_worker_thread per account
    for i, current_location in enumerate(location_list):

        # update our list of coords
        locations = list(generate_location_steps(current_location, steps, scan_radius))

        # repopulate for our spawn points
        if args.spawnpoints_only:
            locations = limit_locations_to_spawns(locations, scan_radius)
            all_locations += locations
        else:
            locations = map(lambda loc: (loc, ), locations)

        log.debug('Starting search worker thread %d', i)
        t = Thread(target=search_worker_thread,
                   name='search_worker_{}'.format(i),
                   args=(args, locations, global_search_queue, parse_lock, encryption_lib_path))
        t.daemon = True
        t.start()

    # while True:
    #    time.sleep(1)
    if args.location_id:
        total = len(all_locations)
        unique_spawns = len(set(map(lambda el: el[1]['id'], all_locations)))
        Location.update_spawn_count(args.location_id, unique_spawns)
    return


def do_search(location, steps, type):
    for entry in steps_from_location(location, steps):
        global_search_queue.put(entry + (type,))

def search_overseer_thread_ss(args, new_location_queue, pause_bit, encryption_lib_path):
    log.info('Search ss overseer starting')
    search_items_queue = Queue()
    parse_lock = Lock()
    spawns = []

    # Create a search_worker_thread per account
    log.info('Starting search worker threads')
    for i, account in enumerate(args.accounts):
        log.debug('Starting search worker thread %d for user %s', i, account['username'])
        t = Thread(target=search_worker_thread_ss,
                   name='ss_search_worker_{}'.format(i),
                   args=(args, account, search_items_queue, parse_lock, encryption_lib_path))
        t.daemon = True
        t.start()

    if os.path.isfile(args.spawnpoint_scanning):  # if the spawns file exists use it
        try:
            with open(args.spawnpoint_scanning) as file:
                try:
                    spawns = json.load(file)
                except ValueError:
                    log.error(args.spawnpoint_scanning + " is not valid")
                    return
                file.close()
        except IOError:
            log.error("Error opening " + args.spawnpoint_scanning)
            return
    else:  # if spawns file dose not exist use the db
        loc = new_location_queue.get()
        spawns = Pokemon.get_spawnpoints_in_hex(loc, args.step_limit)
    spawns.sort(key=itemgetter('time'))
    log.info('Total of %d spawns to track', len(spawns))
    # find the inital location (spawn thats 60sec old)
    pos = SbSearch(spawns, (curSec() + 3540) % 3600)
    while True:
        while timeDif(curSec(), spawns[pos]['time']) < 60:
            time.sleep(1)
        # make location with a dummy height (seems to be more reliable than 0 height)
        location = [spawns[pos]['lat'], spawns[pos]['lng'], 40.32]
        search_args = (pos, location, spawns[pos]['time'])
        search_items_queue.put(search_args)
        pos = (pos + 1) % len(spawns)



def steps_from_location(location, steps):
    list = []
    for step, step_location in enumerate(generate_location_steps(location, steps, scan_radius), 1):
        log.debug('Queueing step %d @ %f/%f/%f', step, step_location[0], step_location[1], step_location[2])
        search_args = (step, step_location)
        list.append(search_args)
    return list

def search_worker_thread(args, iterate_locations, global_search_queue, parse_lock, encryption_lib_path):

    log.info('Search worker thread starting')

    # We will attempt new login every this api is None
    api = None

    # If iterating over private locations endlessly
    location_i = 0
    loops_done = -1

    # When true, steps will be delayed until expected spawn time
    first_spawn_loop = False
    wait_for_spawn = args.spawnpoints_only
    advance_spawns = True
    spawn_wait_offset_secs = 30  # Wait this number of secs after spawn in ready before querying it
    spawn_appear_time = None
    spawn_disappear_time = None

    start_time = datetime.now()
    start_hour = start_time - timedelta(minutes=start_time.minute, seconds=start_time.second)
    last_scan_time = None

    # The forever loop for the thread
    while True:

        # Get current time
        loop_start_time = int(round(time.time() * 1000))

        # Grab the next thing to search (when available)
        if iterate_locations:
            step_location_info = iterate_locations[location_i]
            step = location_i
            if step == 0:
                loops_done += 1
            location_i = (location_i + 1) % len(iterate_locations)
            type = 1
            log.info('Location obtained from local queue, loop: %d, step: %d of %d', loops_done, step, len(iterate_locations))
        else:
            step, step_location_info, type = global_search_queue.get()
            step_location_info = (step_location_info,)
            log.info('Location obtained from global queue, remaining: %d', global_search_queue.qsize())

        # Wait for spawn if we have spawns attached
        if wait_for_spawn and iterate_locations and len(step_location_info) == 2:
            spawn = step_location_info[1]
            next_spawn_second = ((spawn['last_disappear'].minute - spawn['duration_min']) % 60 * 60) \
                                + spawn['last_disappear'].second
            spawn_appear_time = start_hour + timedelta(hours=loops_done, seconds=spawn_wait_offset_secs + next_spawn_second)
            spawn_disappear_time = spawn_appear_time + timedelta(minutes=spawn['duration_min'])
            now = datetime.now()

            if first_spawn_loop:  # Don't wait on first spawn loop
                if loops_done:
                    first_spawn_loop = False
                    loops_done = 0  # First loop was special and now it's over
                pass
            else:
                # Skip spawns that have already passed for first iteration and find first that didn't
                if advance_spawns and now > spawn_appear_time:
                    continue                # Advance until we find a spawn in the future
                else:
                    advance_spawns = False  # Stop advancing once there is a spawn in the future

                if now > spawn_disappear_time - timedelta(seconds=60):
                    log.warn("Skipping spawn {0} since it's already past its disappear time {1}".format(
                        spawn['id'], spawn_disappear_time.time()))
                    continue

                # Compute next spawn time, adding up iterations of this list as hours passed
                wait_time = spawn_appear_time - now if spawn_appear_time >= now else timedelta()

                log.info('Waiting {0} seconds to scan spawn {1} appearing at {2}'.format(
                    wait_time.seconds, spawn['id'],str(spawn_appear_time.time())))
                time.sleep(max(0, wait_time.seconds)) # Wait for appearance of spawn

        step_location = step_location_info[0]

        # Was the scan successful at last?
        success = False
        fail = False

        # Will not stop unless...we succeed or fail really, really hard
        while not success and not fail:
            try:
                log.info('Dispatching request in search loop')

                # Create the API instance this will use if not already connected
                if not api:
                    api = PGoApi()

                    proxy = None
                    while not proxy:
                        proxy = Proxy.get_next_available('socks5', 1, 30*60)
                        if not proxy:
                            log.error('No proxies available, waiting...')
                            time.sleep(60)
                            continue
                        proxy_ok = check_proxy(proxy, 5)
                        if proxy_ok:
                            Proxy.set_succeeded(proxy)
                        else:
                            Proxy.set_failed(proxy)

                        while not check_ip_still_same():
                            log.error('IP change detected! Sleeping.')
                            time.sleep(60)

                # Let the api know where we intend to be for this loop
                api.set_position(*step_location)

                # The loop to try very hard to scan this step
                failed_total = 0
                while True:

                    # After so many attempts, let's get out of here
                    if failed_total >= args.scan_retries:
                        # I am choosing to NOT place this item back in the queue
                        # otherwise we could get a "bad scan" area and be stuck
                        # on this overall loop forever. Better to lose one cell
                        # than have the scanner, essentially, halt.
                        log.error('Search step %d went over max scan_retires; abandoning', step)
                        raise KeyError
                        break

                    # Increase sleep delay between each failed scan
                    # By default scan_dela=5, scan_retries=5 so
                    # We'd see timeouts of 5, 10, 15, 20, 25
                    sleep_time = args.scan_delay * (1 + failed_total)

                    # Ok, let's get started -- get a login or wait for one
                    while True:
                        try:
                            check_login(args, api, step_location, type)
                            break
                        except NoAvailableLogins:
                            log.error('No available logins that can be used. Waiting for one...')
                            time.sleep(10)

                    api.activate_signature(encryption_lib_path)

                    # Make the actual request (finally!)
                    last_scan_time = datetime.now()
                    response_dict = map_request(api, step_location)

                    # G'damnit, nothing back. Mark it up, sleep, carry on
                    if not response_dict:
                        log.error('Search step %d area download failed, retrying request in %g seconds', step, sleep_time)
                        failed_total += 1
                        time.sleep(sleep_time)
                        continue

                    # Got the response, lock for parsing and do so (or fail, whatever)
                    # with parse_lock: # no need for lock
                    try:
                        parsed = parse_map(response_dict, step_location, api)
                        Location.update(last_keepalive=datetime.utcnow()).where(Location.id == args.location_id).execute()
                        log.debug('Search step %s completed', step)
                        # Add missed spawn if we actually waited for it and it didn't appear
                        if wait_for_spawn and spawn_appear_time and spawn_disappear_time and \
                            last_scan_time > spawn_appear_time and datetime.now() < spawn_disappear_time and \
                            not any (pokemon['spawnpoint_id'] == step_location_info[1]['id'] for pokemon in parsed['pokemons'].values()):
                                log.warn('Spawn {0} did not spawn anything but should have been active till {1}'.format(
                                    step_location_info[1]['id'], spawn_disappear_time))
                                Spawn.add_missed(step_location_info[1]['id'])

                        # Get detailed information (IV) about pokemon
                        if args.encounter:
                            time.sleep(1) # At least some spacing
                            for encounter_id in parsed['pokemons'].keys():
                                pokemon = parsed['pokemons'][encounter_id]
                                if (pokemon['pokemon_id'] in args.encounter_whitelist or
                                pokemon['pokemon_id'] not in args.encounter_blacklist and not args.encounter_whitelist):
                                    encounter_result = api.encounter(encounter_id=encounter_id,
                                                                     spawn_point_id=pokemon['spawnpoint_id'],
                                                                     player_latitude=step_location[0],
                                                                     player_longitude=step_location[1])
                                    if encounter_result is not None and 'wild_pokemon' in encounter_result['responses']['ENCOUNTER']:
                                        add_encounter_data(pokemon, encounter_result)
                                        log.info("Processed encounter {}".format(encounter_id))
                                    else:
                                        log.warning("Error encountering {}, status code: {}".format(
                                            encounter_id, encounter_result['responses']['ENCOUNTER']['status']))
                                    # Wait a while after encounter - it takes time, right
                                    time.sleep(args.encounter_delay)

                        # Save what we got so far. Gym details will be saved in a different transaction if updated
                        save_parsed_to_db(parsed['pokemons'], parsed['pokestops'], parsed['gyms'])

                        # Get detailed information about gyms
                        if args.gym_info:
                            # build up a list of gyms to update
                            gyms_to_update = {}
                            for gym in parsed['gyms'].values():
                                # Can only get gym details within 1km of our position
                                distance = calc_distance(step_location, [gym['latitude'], gym['longitude']])
                                if distance < 1:
                                    # check if we already have details on this gym (if not, get them)
                                    try:
                                        record = GymDetails.get(gym_id=gym['gym_id'])
                                    except GymDetails.DoesNotExist as e:
                                        gyms_to_update[gym['gym_id']] = gym
                                        continue

                                    # if we have a record of this gym already, check if the gym has been updated since our last update
                                    utc_last_modified = local_to_utc(gym['last_modified'].timetuple())
                                    if record.last_update < utc_last_modified:
                                        gyms_to_update[gym['gym_id']] = gym
                                        continue
                                    else:
                                        log.debug('Skipping update of gym @ %f/%f, up to date', gym['latitude'],
                                                  gym['longitude'])
                                        continue
                                else:
                                    log.debug(
                                        'Skipping update of gym @ %f/%f, too far away from our location at %f/%f (%fkm)',
                                        gym['latitude'], gym['longitude'], step_location[0], step_location[1],
                                        distance)

                            if len(gyms_to_update):
                                gym_responses = {}
                                current_gym = 1
                                log.info('Updating {} gyms for location {},{}...'.format(
                                    len(gyms_to_update), step_location[0], step_location[1]))

                                for gym in gyms_to_update.values():
                                    log.debug('Getting details for gym {} of {} for location {},{}...'.format(
                                        current_gym, len(gyms_to_update), step_location[0], step_location[1]))
                                    time.sleep(random.random() + 2)
                                    response = gym_request(api, step_location, gym)

                                    # make sure the gym was in range. (sometimes the API gets cranky about gyms that are ALMOST 1km away)
                                    if response['responses']['GET_GYM_DETAILS']['result'] == 2:
                                        log.warning('Gym @ %f/%f is out of range (%dkm), skipping',
                                                    gym['latitude'], gym['longitude'], distance)
                                    else:
                                        gym_responses[gym['gym_id']] = response['responses']['GET_GYM_DETAILS']

                                    # increment which gym we're on (for status messages)
                                    current_gym += 1

                                log.debug('Processing details of {} gyms for location {},{}...'.format(
                                    len(gyms_to_update), step_location[0], step_location[1]))

                                if gym_responses:
                                    parse_and_save_gym_details(args, gym_responses, None)

                        success = True
                        break  # All done, get out of the request-retry loop
                    except EmptyResponseException:
                        log.warn('Empty response from server, retrying in %g seconds', sleep_time)
                        failed_total += 1
                        time.sleep(sleep_time)
                    except KeyError as e:
                        log.exception('Search step %s map parsing failed, will retry in %g seconds. Error: %s', step, sleep_time, str(e))
                        failed_total += 1
                        time.sleep(sleep_time)
                        raise # This could be serious and likely need to relog

                flaskDb.close_db(None)
                time.sleep(args.scan_delay)

            # catch any process exceptions, log them, and continue the until_success loop
            except KeyError: # Received empty response probably, this login might be rotten already
                log.warn('About to relogin with a different account')
                Login.set_failed(api.login_info)
                flaskDb.close_db(None)
                api = None
            except Exception as e:
                log.exception('Exception in search_worker: %s', e)
                try:
                    Login.set_failed(api.login_info)
                except Exception as e:
                    log.exception('Failed to write into database')
                flaskDb.close_db(None)
                api = None

        # We got over until_success loop so that means we're successful, yay! Get the next one
        if not iterate_locations:
            global_search_queue.task_done()

        # loop, hang out until its up.
        sleep_delay_remaining = loop_start_time + (args.scan_delay * 1000) - int(round(time.time() * 1000))
        if sleep_delay_remaining > 0:
            time.sleep(sleep_delay_remaining / 1000)

        loop_start_time += args.scan_delay * 1000

def search_worker_thread_ss(args, account, search_items_queue, parse_lock, encryption_lib_path):
    stagger_thread(args, account)
    log.debug('Search worker ss thread starting')
    # forever loop (for catching when the other forever loop fails)
    while True:
        try:
            log.debug('Entering search loop')
            # create api instance
            api = PGoApi()
            if args.proxy:
                api.set_proxy({'http': args.proxy, 'https': args.proxy})
            api.activate_signature(encryption_lib_path)
            # search forever loop
            while True:
                # Grab the next thing to search (when available)
                step, step_location, spawntime = search_items_queue.get()
                log.info('Searching step %d, remaining %d', step, search_items_queue.qsize())
                if timeDif(curSec(), spawntime) < 840:  # if we arnt 14mins too late
                    # set position
                    api.set_position(*step_location)
                    # try scan (with retries)
                    failed_total = 0
                    while True:
                        if failed_total >= args.scan_retries:
                            log.error('Search step %d went over max scan_retires; abandoning', step)
                            break
                        sleep_time = args.scan_delay * (1 + failed_total)
                        check_login(args, account, api, step_location)
                        # make the map request
                        response_dict = map_request(api, step_location)
                        # check if got anything back
                        if not response_dict:
                            log.error('Search step %d area download failed, retyring request in %g seconds', step, sleep_time)
                            failed_total += 1
                            time.sleep(sleep_time)
                            continue
                        # got responce try and parse it
                        with parse_lock:
                            try:
                                parse_map(response_dict, step_location)
                                log.debug('Search step %s completed', step)
                                search_items_queue.task_done()
                                break
                            except KeyError:
                                log.exception('Search step %s map parsing failed, retrying request in %g seconds. Username: %s', step, sleep_time, account['username'])
                                failed_total += 1
                        time.sleep(sleep_time)
                    time.sleep(sleep_time)
                else:
                    search_items_queue.task_done()
                    log.info('Cant keep up. Skipping')
        except Exception as e:
            log.exception('Exception in search_worker: %s', e)



loginLock = Lock()
def check_login(args, api, position, type):

    # Logged in? Enough time left? Cool!
    if api._auth_provider and api._auth_provider._ticket_expire:
        remaining_time = api._auth_provider._ticket_expire / 1000 - time.time()
        if remaining_time > 60:
            log.debug('Credentials remain valid for another %f seconds', remaining_time)
            return

    # Try to login (a few times, but don't get stuck here)
    i = 0
    api.set_position(position[0], position[1], position[2])
    with loginLock:
        flaskDb.connect_db()
        while True: # i < args.login_retries:
            # If was already logged in, try to reuse this account first (but only once)
            if api and hasattr(api, 'login_info'):
                login_info = api.login_info
                del api.login_info
            else:
                login_name = Login.get_least_used(1, 35, type)[0] # 30mins is the normal relogin timeout
                if login_name:
                    login_info = Login.get_by_username(login_name)
                else:
                    flaskDb.close_db(None)
                    raise NoAvailableLogins()

            try:
                auth_service = 'google' if not login_info.type else 'ptc'
                if not login_info.accept_tos:
                    api.login(auth_service, login_info.username, login_info.password)
                    time.sleep(2)
                    api.mark_tutorial_complete(tutorials_completed=0, send_marketing_emails=False,
                                               send_push_notifications=False)
                    login_info.accept_tos = 1
                    login_info.save()
                    log.info('Accepted Terms of Service for {}'.format(login_info.username))
                    # print('Response dictionary: \r\n{}'.format(pprint.PrettyPrinter(indent=4).pformat(response)))
                    time.sleep(2)
                    api.check_codename_available(codename=login_info.username)
                    time.sleep(1)
                    api.claim_codename(codename=login_info.username)
                if args.proxy:
	                api.set_authentication(provider=auth_service, username = login_info.username, password = login_info.password, proxy_config={'http': args.proxy, 'https': args.proxy})
    	        else:
        	        api.set_authentication(provider=auth_service, username = login_info.username, password = login_info.password)
                if api._auth_provider._access_token:
                    log.debug('Login for account %s successful', login_info.username)
                    Login.set_success(login_info)
                    api.login_info = login_info
                    break
            except AuthException:
                pass
            i += 1
            log.error('Failed to login to Pokemon Go with account %s. Trying again in %g seconds', login_info.username, args.login_delay)
            Login.set_failed(login_info)
            loginLock.release()
            time.sleep(args.login_delay)
            loginLock.acquire()
        flaskDb.close_db(None)
    time.sleep(1)



def map_request(api, position):
    try:
        cell_ids = util.get_cell_ids(position[0], position[1])
        timestamps = [0, ] * len(cell_ids)
        return api.get_map_objects(latitude=f2i(position[0]),
                                   longitude=f2i(position[1]),
                                   since_timestamp_ms=timestamps,
                                   cell_id=cell_ids)
    except Exception as e:
        log.warning('Exception while downloading map: %s', e)
        return False


def stagger_thread(args, account):
    # If we have more than one account, stagger the logins such that they occur evenly over scan_delay
    if len(args.accounts) > 1:
        if len(args.accounts) > args.scan_delay:  # force ~1 second delay between threads if you have many accounts
            delay = args.accounts.index(account) + ((random.random() - .5) / 2) if args.accounts.index(account) > 0 else 0
        else:
            delay = (args.scan_delay / len(args.accounts)) * args.accounts.index(account)
            log.debug('Delaying thread startup for %.2f seconds', delay)
        time.sleep(delay)


class TooManyLoginAttempts(Exception):
    pass


#
# Scan consumer - producer
#
def create_scan_queue_dispatcher():
    scan_queue_thread = Thread(target=scan_queue_dispatcher, name='Scan producer', args=(args, scan_queue,))
    scan_queue_thread.daemon = True
    scan_queue_thread.start()

def scan_queue_dispatcher(args, queue ):
    producer = ScanQueueProducer()
    producer.connect()
    while True:
        timestamp, expire_time, position, steps = queue.get()
        dict = {'timestamp': timestamp, 'expireTime' : expire_time, 'position': position, 'steps': steps}
        log.info('Dispatching scan request...')
        producer.publish(json.dumps(dict, default=json_datetime_iso))
        log.info('Scan request sent.')

def scan_enqueue(timestamp, expire_time, position, steps):
    log.info('Enqueuing scan request...')
    scan_queue.put_nowait((timestamp, expire_time, position, steps))

#