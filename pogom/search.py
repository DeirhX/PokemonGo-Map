#!/usr/bin/python
# -*- coding: utf-8 -*-

'''
Search Architecture:
 - Create a Queue
   - Holds a list of locations to scan
 - Create N search threads
   - Each search thread will be responsible for hitting the API for a given scan location
 - Create a "overseer" loop
   - Creates/updates the search grid, populates the Queue, and waits for the current search itteration to complete
   -
'''

import logging
import time
import math
import threading

from threading import Thread, Lock
from queue import PriorityQueue

from pgoapi import PGoApi
from pgoapi.utilities import f2i, get_cellid

from . import config
from .models import parse_map

log = logging.getLogger(__name__)

TIMESTAMP = '\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000'
shared_api = None
shared_api_lock = Lock()

# Constants for Hex Grid
# Gap between vertical and horzonal "rows"
lat_gap_meters = 150
lng_gap_meters = 86.6

# 111111m is approx 1 degree Lat, which is close enough for this
meters_per_degree = 111111
lat_gap_degrees = float(lat_gap_meters) / meters_per_degree

search_queue = PriorityQueue(config['SEARCH_QUEUE_DEPTH'])
search_priority = 10
scan_priority = 5


def calculate_lng_degrees(lat):
    return float(lng_gap_meters) / \
        (meters_per_degree * math.cos(math.radians(lat)))


def send_map_request(api, position):
    try:
        request = api.create_request()
        request.set_position(*position)
        request.get_map_objects(latitude=f2i(position[0]),
                            longitude=f2i(position[1]),
                            since_timestamp_ms=TIMESTAMP,
                            cell_id=get_cellid(position[0], position[1]))
        return request.call()
    except Exception as e:
        log.warning("Uncaught exception when downloading map " + str(e))
        return False


def generate_location_steps(initial_location, num_steps):

    ring = 1  # Which ring are we on, 0 = center
    lat_location = initial_location[0]
    lng_location = initial_location[1]

    yield (initial_location[0], initial_location[1], 0)  # Middle circle

    while ring < num_steps:
        # Move the location diagonally to top left spot, then start the circle which will end up back here for the next ring
        # Move Lat north first
        lat_location += lat_gap_degrees
        lng_location -= calculate_lng_degrees(lat_location)

        for direction in range(6):
            for i in range(ring):
                if direction == 0:  # Right
                    lng_location += calculate_lng_degrees(lat_location) * 2

                if direction == 1:  # Right Down
                    lat_location -= lat_gap_degrees
                    lng_location += calculate_lng_degrees(lat_location)

                if direction == 2:  # Left Down
                    lat_location -= lat_gap_degrees
                    lng_location -= calculate_lng_degrees(lat_location)

                if direction == 3:  # Left
                    lng_location -= calculate_lng_degrees(lat_location) * 2

                if direction == 4:  # Left Up
                    lat_location += lat_gap_degrees
                    lng_location -= calculate_lng_degrees(lat_location)

                if direction == 5:  # Right Up
                    lat_location += lat_gap_degrees
                    lng_location += calculate_lng_degrees(lat_location)

                yield (lat_location, lng_location, 0)  # Middle circle

        ring += 1

threads_waiting_for_login = 0
def login_if_needed(args, position):
    global shared_api
    api = shared_api  # So we don't have to lock here, usually api exists
    if api and api._auth_provider and api._auth_provider._ticket_expire:
        remaining_time = api._auth_provider._ticket_expire / 1000 - time.time()
        if remaining_time > 60:
            log.info("Skipping Pokemon Go login process since already logged in for another {:.2f} seconds".format(remaining_time))
            return api
        else:
            api = shared_api = None  # Discard connection

    if not api:
        global threads_waiting_for_login
        threads_waiting_for_login += 1
        wait_time = threads_waiting_for_login * 1000
        with shared_api_lock:
            if not shared_api:  # Another thread might have logged in while waiting
                api = shared_api = login(args, position)
            else:
                api = shared_api
        time.sleep(wait_time)
    else:
        threads_waiting_for_login = 0
    return api


def login(args, position):
    log.info('Attempting login to Pokemon Go.')

    api = PGoApi()
    while not api.login(args.auth_service, args.username, args.password, *position):
        log.info('Failed to login to Pokemon Go. Trying again in {:g} seconds.'.format(args.login_delay))
        time.sleep(args.login_delay)

    log.info('Login to Pokemon Go successful.')
    return api


#
# Search Threads Logic
#
def create_search_threads(num):
    search_threads = []
    for i in range(num):
        t = Thread(target=search_thread, name='search_thread-{}'.format(i), args=(search_queue,))
        t.daemon = True
        t.start()
        search_threads.append(t)


def search_thread(q):
    threadname = threading.currentThread().getName()
    log.debug("Search thread {}: started and waiting".format(threadname))
    while True:
        # Get the next item off the queue (this blocks till there is something)
        priority, args, i, total_steps, step_location, step = q.get()
        log.debug("Search queue depth is: " + str(q.qsize()))

        # If a new location has been set, just mark done and continue
        if 'NEXT_LOCATION' in config:
            log.debug("{}: new location waiting, flushing queue".format(threadname))
            q.task_done()
            continue

        log.debug("{}: processing itteration {} step {}".format(threadname, i, step))
        response_dict = {}
        failed_consecutive = 0
        while not response_dict:
            instance_api = login_if_needed(args, step_location)
            response_dict = send_map_request(instance_api, step_location)
            if response_dict:
                try:
                    parse_map(response_dict, i, step, step_location)
                except KeyError:
                    log.error('Scan step {:d} failed. Response dictionary key error.'.format(step))
                    failed_consecutive += 1
                    response_dict = {}
            else:
                log.info('Map download failed, waiting and retrying')
                log.debug('{}: itteration {} step {} failed'.format(threadname, i, step))
                failed_consecutive += 1

            if (failed_consecutive >= config['REQ_MAX_FAILED']):
                global shared_api
                if shared_api is instance_api:  # If not already changed / reset by other worker
                    shared_api = None  # Drop connection, will relogin on next pass
                log.error('Niantic servers under heavy load. Waiting before trying again')
                time.sleep(config['REQ_HEAVY_SLEEP'])
                failed_consecutive = 0

        time.sleep(config['REQ_SLEEP'])
        q.task_done()


#
# Search Overseer
#
def search_loop(args):
    i = 0
    while True:
        log.info("Search loop {} starting".format(i))
        try:
            search(args, i)
            log.info("Search loop {} complete.".format(i))
            i += 1
        except Exception as e:
            log.error('Scanning error @ {0.__class__.__name__}: {0}'.format(e))
        finally:
            if args.thread_delay > 0:
                log.info('Waiting {:g} seconds before beginning new scan.'.format(args.thread_delay))
                time.sleep(args.thread_delay)


#
# Overseer main logic
#
def search(args, i):
    num_steps = args.step_limit
def search(args, i, position, num_steps):

    # Update the location if needed
    if 'NEXT_LOCATION' in config:
        log.info('New location set')
        config['ORIGINAL_LATITUDE'] = config['NEXT_LOCATION']['lat']
        config['ORIGINAL_LONGITUDE'] = config['NEXT_LOCATION']['lon']
        config.pop('NEXT_LOCATION', None)


    for step, step_location in enumerate(generate_location_steps(position, num_steps), 1):
        log.debug("Queue search itteration {}, step {}".format(i, step))

        search_args = (search_priority, args, i, num_steps, step_location, step)
        search_queue.put(search_args)

def search_loop(args):
    i = 0
    try:
        while True:
            log.info("Map iteration: {}".format(i))
            position = (config['ORIGINAL_LATITUDE'], config['ORIGINAL_LONGITUDE'], 0)
            search(args, i, position, args.step_limit)
            log.info("Scanning complete.")
            if args.scan_delay > 1:
                log.info('Waiting {:f} seconds before beginning new scan.'.format(args.scan_delay))
                time.sleep(args.scan_delay)
            i += 1

    # This seems appropriate
    except Exception as e:
        log.info('{0.__class__.__name__}: {0} - waiting {1} sec(s) before restarting'.format(e, args.scan_delay))
        time.sleep(args.scan_delay)
        search_loop(args)
# A fake search loop which does....nothing!
#
def fake_search_loop():
    while True:
        log.info('Fake search loop running...')
        time.sleep(10)
