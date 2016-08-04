from Queue import PriorityQueue

import time
from datetime import datetime, timedelta
from threading import Thread

scans_done = PriorityQueue()
refreshes_done = PriorityQueue()

scans_made = 0
refreshes_made = 0
guests_seen = 0
members_seen = 0

scans_time_kept = timedelta(minutes=1)
refreshes_time_kept = timedelta(minutes=1)


def mark_scan(request, user):
    scans_done.put((datetime.utcnow(), request.remote_addr, user))

def mark_refresh(request, user):
    refreshes_done.put((datetime.utcnow(), request.remote_addr, user))

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
        while not scans_done.empty():
            if (scans_done.queue[0][0] - now > scans_time_kept):
                scans_done.get()
            else:
                break
        global scans_made
        scans_made = scans_done.qsize()

        if (refresh_thread_runs % recompute_frequency) == 1:
            members_found = {}
            guests_found = {}
        while not refreshes_done.empty():
            # Fill
            if (refresh_thread_runs % recompute_frequency) == 1:
                if refreshes_done.queue[0][2]: # user
                    members_found[refreshes_done.queue[0][2]] = refreshes_done.queue[0][0]
                else:
                    guests_found[refreshes_done.queue[0][1]] = refreshes_done.queue[0][0]

            if (refreshes_done.queue[0][0] - now > refreshes_time_kept):
                refreshes_done.get()
            else:
                break
        global refreshes_made
        refreshes_made = refreshes_done.qsize()

        if (refresh_thread_runs % recompute_frequency) == 1:
            global guests_seen
            guests_seen = len(guests_found)
            global members_seen
            members_seen = len(members_found)

        time.sleep(1)


refresh_thread = Thread(target=refresh_thread_loop)
refresh_thread.daemon = True
refresh_thread.start()
