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
import json

from threading import Thread, Lock
from Queue import Queue, PriorityQueue

from pickle import Pickler

from pgoapi import PGoApi
from pgoapi.utilities import f2i, get_cellid
from pogom.utils import json_serial
from queuing.scan_queue import Producer

from . import config
from .models import parse_map, Login, args

log = logging.getLogger(__name__)

TIMESTAMP = '\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000\000'
shared_api = None
shared_api_lock = Lock()

search_queue = Queue(config['SEARCH_QUEUE_DEPTH'])
search_priority = 10
scan_priority = 5
scan_queue = Queue(config['SCAN_QUEUE_DEPTH'])

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

def get_new_coords(init_loc, distance, bearing):
    """ Given an initial lat/lng, a distance(in kms), and a bearing (degrees),
    this will calculate the resulting lat/lng coordinates.
    """ 
    R = 6378.1 #km radius of the earth
    bearing = math.radians(bearing)

    init_coords = [math.radians(init_loc[0]), math.radians(init_loc[1])] # convert lat/lng to radians

    new_lat = math.asin( math.sin(init_coords[0])*math.cos(distance/R) +
        math.cos(init_coords[0])*math.sin(distance/R)*math.cos(bearing))

    new_lon = init_coords[1] + math.atan2(math.sin(bearing)*math.sin(distance/R)*math.cos(init_coords[0]),
        math.cos(distance/R)-math.sin(init_coords[0])*math.sin(new_lat))

    return [math.degrees(new_lat), math.degrees(new_lon)]

def generate_location_steps(initial_loc, step_count):
    #Bearing (degrees)
    NORTH = 0
    EAST = 90
    SOUTH = 180
    WEST = 270

    pulse_radius = 0.07                 # km - radius of players heartbeat is 70m
    xdist = math.sqrt(3)*pulse_radius   # dist between column centers
    ydist = 3*(pulse_radius/2)          # dist between row centers

    yield (initial_loc[0], initial_loc[1], 0) #insert initial location

    ring = 1            
    loc = initial_loc
    while ring < step_count:
        #Set loc to start at top left
        loc = get_new_coords(loc, ydist, NORTH)
        loc = get_new_coords(loc, xdist/2, WEST)
        for direction in range(6):
            for i in range(ring):
                if direction == 0: # RIGHT
                    loc = get_new_coords(loc, xdist, EAST)
                if direction == 1: # DOWN + RIGHT
                    loc = get_new_coords(loc, ydist, SOUTH)
                    loc = get_new_coords(loc, xdist/2, EAST)
                if direction == 2: # DOWN + LEFT
                    loc = get_new_coords(loc, ydist, SOUTH)
                    loc = get_new_coords(loc, xdist/2, WEST)
                if direction == 3: # LEFT
                    loc = get_new_coords(loc, xdist, WEST)
                if direction == 4: # UP + LEFT
                    loc = get_new_coords(loc, ydist, NORTH)
                    loc = get_new_coords(loc, xdist/2, WEST)
                if direction == 5: # UP + RIGHT
                    loc = get_new_coords(loc, ydist, NORTH)
                    loc = get_new_coords(loc, xdist/2, EAST)
                yield (loc[0], loc[1], 0)
        ring += 1

threads_waiting_for_login = 0
lock_threads_waiting_for_login = Lock()
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
        with lock_threads_waiting_for_login:
            threads_waiting_for_login += 1
            wait_time = (threads_waiting_for_login)
        with shared_api_lock:
            if not shared_api:  # Another thread might have logged in while waiting
                api = shared_api = login(position)
            else:
                api = shared_api
        log.info('sleep for: ' + str(wait_time))
        time.sleep(wait_time)
    else:
        threads_waiting_for_login = 0
    return api

loginLock = Lock()
def login(position):
    log.info('Attempting login to Pokemon Go.')

    api = PGoApi()
    with loginLock:
        login_info = Login.get_least_used(1)
        auth_service = 'google' if not login_info.type else 'ptc'
        logged_in = False
        while not logged_in:
            try:
                logged_in = api.login(auth_service, login_info.username, login_info.password, *position)
            except Exception as ex:
                log.error('Exception in api.login: ' + str(ex))
            if not logged_in:
                log.info('Failed to login to Pokemon Go. Trying again in {:g} seconds.'.format(config['LOGIN_DELAY']))
                Login.set_failed(login_info)
                loginLock.release()
                time.sleep(config['LOGIN_DELAY'])
                loginLock.acquire()

        log.info('Login to Pokemon Go successful.')
        Login.set_success(login_info)
    return api


#
# Search Threads Logic
#
def create_search_threads(thread_count, search_control):
    search_threads = []
    for i in range(thread_count):
        t = Thread(target=search_thread, name='search_thread-{}'.format(i), args=(search_queue, search_control,))
        t.daemon = True
        t.start()
        search_threads.append(t)

def create_scan_queue_dispatcher():
    scan_queue_thread = Thread(target=scan_queue_dispatcher, name='Scan queue thread', args=(args, scan_queue,))
    scan_queue_thread.daemon = True
    scan_queue_thread.start()

def search_thread(q, search_control):
    threadname = threading.currentThread().getName()
    log.debug("Search thread {}: started and waiting".format(threadname))
    instance_api = None
    while True:
        # Get the next item off the queue (this blocks till there is something)
        priority, args, i, total_steps, step_location, step = q.get()
        log.debug("Search queue depth is: " + str(q.qsize()))

        # Pause if searching is disabled
        search_control.wait()

        # If a new location has been set, just mark done and continue
        if 'NEXT_LOCATION' in config:
            log.debug("{}: new location waiting, flushing queue".format(threadname))
            q.task_done()
            continue

        log.debug("{}: processing itteration {} step {}".format(threadname, i, step))
        response_dict = {}
        failed_consecutive = 0
        need_scans = 2
        while need_scans:
            try:
                if instance_api:
                    log.info("Skipping Pokemon Go login process since already logged in")
                else:
                    instance_api = login(step_location)

                response_dict = send_map_request(instance_api, step_location)
                if response_dict:
                    try:
                        parse_map(response_dict, i, step, step_location)
                        need_scans -= 1
                    except KeyError:
                        log.error('Scan step {:d} failed. Response dictionary key error.'.format(step))
                        failed_consecutive += 1
                else:
                    log.info('Map download failed, waiting and retrying')
                    log.debug('{}: itteration {} step {} failed'.format(threadname, i, step))
                    failed_consecutive += 1

                if (failed_consecutive >= config['REQ_MAX_FAILED']):
                    instance_api = None
                    log.error('Niantic servers under heavy load. Waiting before trying again')
                    time.sleep(config['REQ_HEAVY_SLEEP'])
                    failed_consecutive = 0
            except Exception as ex:
                log.error('Uncaught exception in search_loop, trapped: ' + str(ex))

            time.sleep(config['REQ_SLEEP'])

        time.sleep(config['REQ_SLEEP'])
        q.task_done()


#
# Search Overseer
#
def search_loop(args, search_control):
    i = 0
    while search_control.wait():
        log.info("Search loop {} starting".format(i))
        try:
            position = (config['ORIGINAL_LATITUDE'], config['ORIGINAL_LONGITUDE'], 0)
            search(args, i, position, args.step_limit)
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
def search(args, i, position, num_steps):

    # Update the location if needed
    if 'NEXT_LOCATION' in config:
        log.info('New location set')
        config['ORIGINAL_LATITUDE'] = config['NEXT_LOCATION']['lat']
        config['ORIGINAL_LONGITUDE'] = config['NEXT_LOCATION']['lon']
        config.pop('NEXT_LOCATION', None)

    for step, step_location in enumerate(generate_location_steps(position, num_steps), 1):
        log.debug("Queue search iteration {}, step {}".format(i, step))

        search_args = (search_priority, args, i, num_steps, step_location, step)
        search_queue.put(search_args)
#
# Scan consumer - producer
#
def scan_queue_dispatcher(args, queue ):
    producer = Producer()
    producer.connect()
    while True:
        timestamp, expire_time, position, steps = queue.get()
        dict = {'timestamp': timestamp, 'expireTime' : expire_time, 'position': position, 'steps': steps}
        log.info('Dispatching scan request...')
        producer.publish(json.dumps(dict, default=json_serial))
        log.info('Scan request sent.')

def scan_enqueue(timestamp, expire_time, position, steps):
    log.info('Enqueuing scan request...')
    scan_queue.put_nowait((timestamp, expire_time, position, steps))

# A fake search loop which does....nothing!
#
def fake_search_loop():
    while True:
        log.info('Fake search loop running...')
        time.sleep(10)
