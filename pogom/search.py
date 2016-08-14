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
import time
import math
import json
import geopy.distance as geopy_distance

from threading import Thread, Lock

from Queue import Queue, PriorityQueue

from pogom.utils import json_datetime_iso
from queuing.scan_queue import ScanQueueProducer
from queue import Queue, Empty

from pgoapi import PGoApi
from pgoapi.utilities import f2i
from pgoapi import utilities as util
from pgoapi.exceptions import AuthException

from . import config
from .models import parse_map, Login, args, flaskDb, Pokemon

log = logging.getLogger(__name__)

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


def generate_location_steps(initial_loc, step_count):
    # Bearing (degrees)
    NORTH = 0
    EAST = 90
    SOUTH = 180
    WEST = 270

    pulse_radius = 0.07                 # km - radius of players heartbeat is 70m
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
                yield (loc[0], loc[1], 0)
        ring += 1

#
# A fake search loop which does....nothing!
#
def fake_search_loop():
    while True:
        log.info('Fake search loop running')
        time.sleep(10)

# The main search loop that keeps an eye on the over all process
def search_overseer_thread(args, location_list, steps, pause_bit, encryption_lib_path):

    log.info('Search overseer starting')
    parse_lock = Lock()

    # Create a search_worker_thread per account
    for i, current_location in enumerate(location_list):

        # update our list of coords
        locations = list(generate_location_steps(current_location, steps))

        # repopulate for our spawn points
        if args.spawnpoints_only:
            # We need to get all spawnpoints in range. This is a square 70m * step_limit * 2
            sp_dist = 0.07 * 2 * args.steps
            log.debug('Spawnpoint search radius: %f', sp_dist)
            # generate coords of the midpoints of each edge of the square
            south, west = get_new_coords(current_location, sp_dist, 180), get_new_coords(current_location, sp_dist, 270)
            north, east = get_new_coords(current_location, sp_dist, 0), get_new_coords(current_location, sp_dist, 90)
            # Use the midpoints to arrive at the corners
            log.debug('Searching for spawnpoints between %f, %f and %f, %f', south[0], west[1], north[0], east[1])
            spawnpoints = set(
                (d['latitude'], d['longitude']) for d in Pokemon.get_spawnpoints(south[0], west[1], north[0], east[1]))
            if len(spawnpoints) == 0:
                log.warning(
                    'No spawnpoints found in the specified area! (Did you forget to run a normal scan in this area first?)')

            def any_spawnpoints_in_range(coords):
                return any(geopy_distance.distance(coords, x).meters <= 70 for x in spawnpoints)

            locations = [coords for coords in locations if any_spawnpoints_in_range(coords)]

        if len(locations) == 0:
            log.warning('Nothing to scan!')

        log.debug('Starting search worker thread %d', i)
        t = Thread(target=search_worker_thread,
                   name='search_worker_{}'.format(i),
                   args=(args, locations, global_search_queue, parse_lock, encryption_lib_path))
        t.daemon = True
        t.start()

    # while True:
    #    time.sleep(1)
    return


def do_search(location, steps):
    for entry in steps_from_location(location, steps):
        global_search_queue.put(entry)

def steps_from_location(location, steps):
    list = []
    for step, step_location in enumerate(generate_location_steps(location, steps), 1):
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
    # The forever loop for the thread
    while True:

        # Get current time
        loop_start_time = int(round(time.time() * 1000))

        # Grab the next thing to search (when available)
        if iterate_locations:
            step_location = iterate_locations[location_i]
            location_i = (location_i + 1) % len(iterate_locations)
            step = location_i
            log.info('Location obtained from local queue, step: %d of %d', step, len(iterate_locations))
        else:
            step, step_location = global_search_queue.get()
            log.info('Location obtained from global queue, remaining: %d', global_search_queue.qsize())

        # Was the scan successful at last?
        success = False
        fail = False

        # Will not stop unless...we succeed or fail really, really hard
        while not success and not fail:
            try:
                log.info('Entering search loop')

                # Create the API instance this will use if not already connected
                if not api:
                    api = PGoApi()

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
                        fail = True
                        break

                    # Increase sleep delay between each failed scan
                    # By default scan_dela=5, scan_retries=5 so
                    # We'd see timeouts of 5, 10, 15, 20, 25
                    sleep_time = args.scan_delay * (1 + failed_total)

                    # Ok, let's get started -- check our login status
                    check_login(args, api, step_location)

                    api.activate_signature(encryption_lib_path)

                    # Make the actual request (finally!)
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
                        parse_map(response_dict, step_location)
                        log.debug('Search step %s completed', step)
                        success = True
                        break  # All done, get out of the request-retry loop
                    except KeyError:
                        log.exception('Search step %s map parsing failed, will relog in %g seconds', step, sleep_time)
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

        # If there's any time left between the start time and the time when we should be kicking off the next
        # loop, hang out until its up.
        sleep_delay_remaining = loop_start_time + (args.scan_delay * 1000) - int(round(time.time() * 1000))
        if sleep_delay_remaining > 0:
            time.sleep(sleep_delay_remaining / 1000)

        loop_start_time += args.scan_delay * 1000

loginLock = Lock()
def check_login(args, api, position):

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
            login_info = Login.get_least_used(1)
            try:
                auth_service = 'google' if not login_info.type else 'ptc'
                api.set_authentication(provider = auth_service, username = login_info.username, password = login_info.password)
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