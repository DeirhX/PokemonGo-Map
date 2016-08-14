from Queue import Queue

import time
from collections import deque
from datetime import datetime, timedelta
from threading import Thread
from flask import json
from flask import logging

from pogom.utils import json_datetime_iso
from queuing.stats_queue import StatsSubmitProducer, StatsAggregateConsumer

log = logging.getLogger()

class Queued:
    scans_new = Queue()
    refreshes_new = Queue()
    spawns_new = Queue()

stats = {'scans_made': 0,
         'refreshes_made': 0,
         'spawns_viewed': 0,
         'guests_seen' : 0,
         'members_seen' : 0,
        }

def mark_scan(request, user):
    Queued.scans_new.put((datetime.utcnow(), request.remote_addr, user))

def mark_refresh(request, user):
    Queued.refreshes_new.put((datetime.utcnow(), request.remote_addr, user))

def mark_spawn(request, user):
    Queued.spawns_new.put((datetime.utcnow(), request.remote_addr, user))

def get_scans_made():
    return stats['scans_made']

def get_requests_made():
    return stats['refreshes_made']

def get_spawns_viewed():
    return stats['spawns_viewed']

def get_guests_seen():
    return stats['guests_seen']

def get_members_seen():
    return stats['members_seen']


# Dispatch new stats thread
def dispatch_stats_loop():
    dispatcher = StatsSubmitProducer()
    dispatcher.connect()
    while True:

        scans = []
        while not Queued.scans_new.empty():
            scans.append(Queued.scans_new.get())
        refreshes = []
        while not Queued.refreshes_new.empty():
            refreshes.append(Queued.refreshes_new.get())
        spawn_details = []
        while not Queued.spawns_new.empty():
            spawn_details.append(Queued.spawns_new.get())

        d = {'scans': scans,
             'refreshes': refreshes,
             'spawn_details': spawn_details}

        dispatcher.publish(json.dumps(d, default=json_datetime_iso))
        time.sleep(1)

# Consume aggregated stats thread
def receive_stats_loop():

    def consume_stats(ch, method, props, body):
        log.debug('Received aggregate stats')
        global stats
        stats = json.loads(body)

    consumer = StatsAggregateConsumer()
    consumer.connect()
    consumer.start_consume(consume_stats)


def begin_share_receive_stats():
    dispatch_thread = Thread(target=dispatch_stats_loop, name='Dispatch stats thread')
    dispatch_thread.daemon = True
    dispatch_thread.start()

    receive_thread = Thread(target=receive_stats_loop, name='Receive aggregate stats thread')
    receive_thread.daemon = True
    receive_thread.start()
