from Queue import Queue
from collections import deque

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
    log.info('Received stats: %s', body)

    message = json.loads(body)
    # Empty queue, move to iterable deque
    for scan in message['scans']:
        Queued.scans.put(scan)
    for refresh in message['refreshes']:
        Queued.refreshes.put(refresh)
    for spawn in message['spawnDetails']:
        Queued.spawns.put(spawn)
