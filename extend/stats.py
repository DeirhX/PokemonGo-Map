from Queue import Queue

import time
from collections import deque
from datetime import datetime, timedelta
from threading import Thread

scans_new = Queue()
refreshes_new = Queue()
scans_done = deque()
refreshes_done = deque()

scans_made = 0
refreshes_made = 0
guests_seen = 0
members_seen = 0

scans_time_kept = timedelta(minutes=1)
refreshes_time_kept = timedelta(minutes=1)


def mark_scan(request, user):
    scans_new.put((datetime.utcnow(), request.remote_addr, user))

def mark_refresh(request, user):
    refreshes_new.put((datetime.utcnow(), request.remote_addr, user))

def get_scans_made():
    return scans_made

def get_requests_made():
    return refreshes_made

def get_guests_seen():
    return guests_seen

def get_members_seen():
    return members_seen


# Recompute thread
refresh_thread_runs = 0
def refresh_thread_loop():
    recompute_frequency = 10
    global refresh_thread_runs
    while True:
        refresh_thread_runs += 1
        now = datetime.utcnow()

        # Empty queue, move to iterable deque
        while not scans_new.empty():
            scans_done.append(scans_new.get())

        # Expel all stale scan entries
        while len(scans_done):
            if (now - scans_done[0][0] > scans_time_kept):
                scans_done.popleft()
            else:
                break

        global scans_made
        scans_made = len(scans_done)

        # Empty queue, move to iterable deque
        while not refreshes_new.empty():
            refreshes_done.append(refreshes_new.get())

        # Expel all stale refresh entries
        while len(refreshes_done):
            if (now - refreshes_done[0][0]) > refreshes_time_kept:
                refreshes_done.get()
            else:
                break
        global refreshes_made
        refreshes_made = len(refreshes_done)

        # Once in a while, recompute member count (full traversal of live entries)
        if (refresh_thread_runs % recompute_frequency) == 1:
            members_found = {}
            guests_found = {}
            for elem in refreshes_done:
                if elem[2]: # user
                    members_found[elem[2]] = elem[0]
                else:
                    guests_found[elem[1]] = elem[0]

            global guests_seen
            guests_seen = len(guests_found)
            global members_seen
            members_seen = len(members_found)

        time.sleep(1)


refresh_thread = Thread(target=refresh_thread_loop)
refresh_thread.daemon = True
refresh_thread.start()
