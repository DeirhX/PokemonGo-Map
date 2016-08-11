import os
import time
from datetime import datetime, timedelta
from collections import deque

from flask import json
from flask import logging

from .shared import aggregate_producer
from .collect import Queued, Collected

log = logging.getLogger()


scans_time_kept = datetime.timedelta(minutes=1)
refreshes_time_kept = datetime.timedelta(minutes=1)
spawns_time_kept = datetime.timedelta(minutes=1)

def stats_computer():

    refresh_thread_runs = 0
    recompute_every = 15

    while True:
        refresh_thread_runs += 1
        now = datetime.utcnow()

        # Merge newly queued to collected entries
        while not Queued.scans.empty():
            Collected.scans.append(Queued.scans.get())
        while not Queued.refreshes.empty():
            Collected.refreshes.append(Queued.refreshes.get())
        while not Queued.spawns.empty():
            Collected.spawns.append(Queued.spawns.get())

        # Expel all stale scan entries
        while len(Collected.scans):
            if (now - Collected.scans[0][0] > scans_time_kept):
                Collected.scans.popleft()
            else:
                break

        # Expel all stale refresh entries
        while len(Collected.refreshes):
            if (now - Collected.refreshes[0][0]) > refreshes_time_kept:
                Collected.refreshes.popleft()
            else:
                break

        # Expel all stale spawn entries
        while len(Collected.spawns):
            if (now - Collected.spawns[0][0]) > spawns_time_kept:
                Collected.spawns.popleft()
            else:
                break

        # Once in a while, recompute member count (full traversal of live entries)
        if (refresh_thread_runs % recompute_every) == 1:
            members_found = {}
            guests_found = {}
            for elem in Collected.refreshes:
                if elem[2]:  # user
                    members_found[elem[2]] = elem[0]
                else:
                    guests_found[elem[1]] = elem[0]

            d = {'scans_made': len(Collected.scans),
                 'refreshes_made': len(Collected.refreshes),
                 'spawns_viewed': len(Collected.spawns),
                 'guests_seen' : len(guests_found),
                 'members_seen' : len(members_found),
                 }
            aggregate_producer.publish(json.dumps(d))

        time.sleep(1)

