from Queue import Queue
from collections import deque
import dateutil.parser
from flask import json
from flask import logging

log = logging.getLogger()

class Queued:
    scans = Queue()
    refreshes = Queue()
    spawns = Queue()

class Collected:
    scans = deque()
    refreshes = deque()
    spawns = deque()

def collect_submit(ch, method, props, body):
    log.debug('Received stats submit: %s', body)

    message = json.loads(body)
    # Empty queue, move to iterable deque
    for scan in message['scans']:
        scan[0] = dateutil.parser.parse(scan[0])
        Queued.scans.put(scan)
    for refresh in message['refreshes']:
        refresh[0] = dateutil.parser.parse(refresh[0])
        Queued.refreshes.put(refresh)
    for spawn in message['spawn_details']:
        spawn[0] = dateutil.parser.parse(spawn[0])
        Queued.spawns.put(spawn)
