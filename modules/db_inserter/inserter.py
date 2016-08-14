from Queue import Queue
from collections import deque
from datetime import datetime, timedelta
import time
from threading import Lock

import dateutil.parser
import ujson
from flask import logging
from pogom.models import Pokemon, Gym, Pokestop, bulk_upsert, ScannedLocation

log = logging.getLogger()

pokestops = {} # primary: pokestop_id
gyms = {}      # primary: gym_id
pokemons = {}  # primary: encounter_id
scanned = {}   # primary: scanned_id
cached = {
    'pokestops' : pokestops,
    'gyms': gyms,
    'pokemons' : pokemons
}
new = {
    'pokestops': {},
    'pokestops_lock': Lock(),
    'gyms': {},
    'gyms_lock' : Lock(),
    'pokemons': {},
    'pokemons_lock' : Lock(),
    'scanned' : {},
    'scanned_lock' : Lock(),
}
messages_processed = 0

def collect_entry(ch, method, props, body):
    log.debug('Received db insert request: %s', body)

    try:
        message = ujson.loads(body)
    except Exception as ex:
        log.exception('Failed to parse incoming message')
        ch.basic_ack(delivery_tag=method.delivery_tag)
        return

    try:
        # Parse each object and add it to cached and new if not alrady found in cached
        for key, value in message.iteritems():
            if (key == str(Pokemon)):
                for pokemon in value:
                    Pokemon.parse_json(pokemon)
                    if not pokemon['encounter_id'] in cached['pokemons']:
                        with new['pokemons_lock']:
                            new['pokemons'][pokemon['encounter_id']] = cached['pokemons'][pokemon['encounter_id']] = pokemon
            elif (key == str(Gym)):
                for gym in value:
                    Gym.parse_json(gym)
                    if not gym['gym_id'] in cached['gyms']:
                        with new['gyms_lock']:
                            new['gyms'][gym['gym_id']] = cached['gyms'][gym['gym_id']] = gym
            elif (key == str(Pokestop)):
                for pokestop in value:
                    Pokestop.parse_json(pokestop)
                    if not pokestop['pokestop_id'] in cached['pokestops']:
                        with new['pokestops_lock']:
                            new['pokestops'][pokestop['pokestop_id']] = cached['pokestops'][pokestop['pokestop_id']] = pokestop
            elif (key == str(ScannedLocation)):
                for scanned_location in value:
                    ScannedLocation.parse_json(scanned_location)
                    with new['scanned_lock']:
                        new['scanned'][str(scanned_location['latitude'])+'|'+str(scanned_location['longitude'])] = scanned_location
            else:
                log.warn('Unknown type encountered: %s', key)
                pass
        global messages_processed
        messages_processed += 1
        if messages_processed % 10 == 0:
            log.info('Processed %d messages.', messages_processed)
    except Exception as ex:
        log.exception('Failed to parse received objects')
        # Don't ack, maybe we can salvage it later?

# Will upsert everything in new, resetting it
def upsert_new_entries():

    pokestops = {}
    gyms = {}
    pokemons = {}
    scanned = {}

    if len(new['pokestops']):
        with new['pokestops_lock']:
            pokestops = list(new['pokestops'].values())
            new['pokestops'] = {}
        bulk_upsert(Pokestop, pokestops)
        for item in pokestops:
            item['received'] = datetime.utcnow()

    if len(new['gyms']):
        with new['gyms_lock']:
            gyms = list(new['gyms'].values())
            new['gyms'] = {}
        bulk_upsert(Gym, gyms)
        for item in gyms:
            item['received'] = datetime.utcnow()

    if len(new['pokemons']):
        with new['pokemons_lock']:
            pokemons = list(new['pokemons'].values())
            new['pokemons'] = {}
        bulk_upsert(Pokemon, pokemons)
        for item in pokemons:
            item['received'] = datetime.utcnow()

    if len(new['scanned']):
        with new['scanned_lock']:
            scanned = list(new['scanned'].values())
            new['scanned'] = {}
        bulk_upsert(ScannedLocation, scanned)
        #log.info('Inserted scans: %d', len(scanned))
        for item in scanned:
            item['received'] = datetime.utcnow()


    if len(pokemons) or len(gyms) or len(pokestops):
        log.info('upsert_new_entries inserted %d pokemon, %d gyms and %d pokestops', len(pokemons), len(gyms), len(pokestops))

def upserter_loop():
    while True:
        time.sleep(0.05) # 50ms
        upsert_new_entries()

def trim_entries_loop():
    while True:
        keep_age = timedelta(minutes=30)
        max_age = datetime.utcnow() - keep_age

        # Iterate over all maps
        for map in cached.values():
            to_remove = []
            # Find keys of expire values
            for key, value in map.iteritems():
                if (value['received'] < max_age):
                    to_remove.append(key)
            # Remove them
            for to_remove_key in to_remove:
                del map[to_remove_key]

        time.sleep(60 * 10) # wait 10 minutes to retry
