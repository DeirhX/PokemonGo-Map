from Queue import Queue
from collections import deque
from datetime import datetime, timedelta
import time
import dateutil.parser
from flask import json
from flask import logging
from pogom.models import Pokemon, Gym, Pokestop

log = logging.getLogger()

pokestops = {} # primary: pokestop_id
gyms = {}      # primary: gym_id
pokemons = {} # primary: encounter_id
everything = {
    'pokestops' : pokestops,
    'gyms': gyms,
    'pokemons' : pokemons
}

def collect_entry(ch, method, props, body):
    log.debug('Received db insert request: %s', body)
    message = json.loads(body)
    for key, value in message.iteritems():
        if (key == str(Pokemon)):
            for poke_entry in value:
                pokemon = Pokemon().from_json(poke_entry)
        if (key == str(Gym)):
            for gym_entry in value:
                gym = Gym().from_json(gym_entry)
        if (key == str(Pokestop)):
            for pokestop_entry in value:
                pokestop = Pokestop().from_json(pokestop_entry)


def trim_entries_loop():
    while True:
        keep_age = timedelta(minutes=30)
        max_age = datetime.utcnow() - keep_age

        # Iterate over all maps
        for map in everything.values():
            to_remove = []
            # Find keys of expire values
            for key, value in map.iteritems():
                if (value.last_updated < max_age):
                    to_remove.append(key)
            # Remove them
            for to_remove_key in to_remove:
                del map[to_remove_key]

        time.sleep(60 * 10) # wait 10 minutes to retry
