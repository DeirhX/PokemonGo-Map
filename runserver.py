#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import shutil
import logging
import time
import re

# Currently supported pgoapi
pgoapi_version = "1.1.6"

# Moved here so logger is configured at load time
logging.basicConfig(format='%(asctime)s [%(threadName)16s][%(module)14s][%(levelname)8s] %(message)s')
log = logging.getLogger()

# Make sure pogom/pgoapi is actually removed if it is an empty directory
# This is a leftover directory from the time pgoapi was embedded in PokemonGo-Map
# The empty directory will cause problems with `import pgoapi` so it needs to go
oldpgoapiPath = os.path.join(os.path.dirname(__file__), "pogom/pgoapi")
if os.path.isdir(oldpgoapiPath):
    log.info("I found %s, but its no longer used. Going to remove it...", oldpgoapiPath)
    shutil.rmtree(oldpgoapiPath)
    log.info("Done!")

# Assert pgoapi is installed
try:
    import pgoapi
except ImportError:
    log.critical("It seems `pgoapi` is not installed. You must run pip install -r requirements.txt again")
    sys.exit(1)

# Assert pgoapi >= 1.1.6 is installed
from distutils.version import StrictVersion
if not hasattr(pgoapi, "__version__") or StrictVersion(pgoapi.__version__) < StrictVersion(pgoapi_version):
    log.critical("It seems `pgoapi` is not up-to-date. You must run pip install -r requirements.txt again")
    sys.exit(1)

from threading import Thread, Event
from queue import Queue
from flask_cors import CORS

from pogom import config
from pogom.app import Pogom
from pogom.scan import begin_consume_queue
from pogom.utils import get_args, insert_mock_data, get_encryption_lib_path

from pogom.search import search_overseer_thread, create_search_threads, fake_search_loop, scan_enqueue, \
    create_scan_queue_dispatcher
from pogom.models import init_database, create_tables, drop_tables, Pokemon, Pokestop, Gym

from pgoapi import utilities as util
from pogom.startup import configure, search_control
from extend.logging import enableFileLogging

enableFileLogging('log/pogom.log')
args = get_args()
app = Pogom(__name__)

def configure(app):

    # Check if we have the proper encryption library file and get its path
    encryption_lib_path = get_encryption_lib_path()
    if encryption_lib_path is "":
        sys.exit(1)

    if args.debug_log:
        log.setLevel(logging.DEBUG)
    else:
        log.setLevel(logging.INFO)

    # Let's not forget to run Grunt / Only needed when running with webserver
    if not args.no_server:
        if not os.path.exists(os.path.join(os.path.dirname(__file__)+'/..', 'static/dist')):
            log.critical('Please run "grunt build" before starting the server.')
            sys.exit()


    # These are very noisey, let's shush them up a bit
    logging.getLogger('peewee').setLevel(logging.INFO)
    logging.getLogger('requests').setLevel(logging.WARNING)
    logging.getLogger('pgoapi.pgoapi').setLevel(logging.WARNING)
    logging.getLogger('pgoapi.rpc_api').setLevel(logging.INFO)
    logging.getLogger('werkzeug').setLevel(logging.ERROR)

    config['parse_pokemon'] = not args.no_pokemon
    config['parse_pokestops'] = not args.no_pokestops
    config['parse_gyms'] = not args.no_gyms

    # Turn these back up if debugging
    if args.debug:
        logging.getLogger("requests").setLevel(logging.DEBUG)
        logging.getLogger("pgoapi").setLevel(logging.DEBUG)
        logging.getLogger("rpc_api").setLevel(logging.DEBUG)

    # use lat/lng directly if matches such a pattern
    prog = re.compile("^(\-?\d+\.\d+),?\s?(\-?\d+\.\d+)$")
    res = prog.match(args.location)
    if res:
        log.debug('Using coords from CLI directly')
        position = (float(res.group(1)), float(res.group(2)), 0)
    else:
        log.debug('Looking up coords in API')
        position = util.get_pos_by_name(args.location)

    if not any(position):
        log.error('Could not get a position by name, aborting')
        sys.exit()

    log.info('Parsed location is: %.4f/%.4f/%.4f (lat/lng/alt)',
             position[0], position[1], position[2])

    if args.no_pokemon:
        log.info('Parsing of Pokemon disabled')
    if args.no_pokestops:
        log.info('Parsing of Pokestops disabled')
    if args.no_gyms:
        log.info('Parsing of Gyms disabled')

    config['LOCALE'] = args.locale
    config['CHINA'] = args.china
    config['ROOT_PATH'] = app.root_path
    config['GMAPS_KEY'] = args.gmaps_key

    db = init_database()
    if args.clear_db:
        # if args.db_type == 'mysql':
        #     drop_tables(db)
        if os.path.isfile(args.db):
            os.remove(args.db)
    create_tables(db)

    # Control the search status (running or not) across threads
    pause_bit = Event()
    pause_bit.clear()

    # Setup the location tracking queue and push the first location on
    new_location_queue = Queue()
    new_location_queue.put(position)

    app.set_current_location(position)
    app.set_search_control(pause_bit)
    app.set_location_queue(new_location_queue)

    !create_search_threads(args.num_threads, search_control)

    create_scan_queue_dispatcher()
    if args.scan_worker:
        begin_consume_queue()

    # Gather the pokemons!
    if (not args.only_server and not args.scan_worker) or args.robot_worker:
        if not args.mock:
            log.debug('Starting a real search thread')
            # search_thread = Thread(target=search_loop, args=(args,search_control,))
            search_thread = Thread(target=search_overseer_thread,
                                   args=(args, args.num_threads, new_location_queue, pause_bit, encryption_lib_path))
        else:
            log.debug('Starting a fake search thread')
            insert_mock_data(position)
            search_thread = Thread(target=fake_search_loop)

        search_thread.daemon = True
        search_thread.name = 'search_thread'
        search_thread.start()

    if args.cors:
        CORS(app);


if __name__ == '__main__':

    configure(app)
    #app.config['APPLICATION_ROOT'] = args.virtual_path
    #app.wsgi_app = PrefixMiddleware(app.wsgi_app, prefix=args.virtual_path)

    if args.no_server:
        # This loop allows for ctrl-c interupts to work since flask won't be holding the program open
        while True:
            time.sleep(60)
    else:
        if args.use_ssl:
            context = ('server.cer', 'server.key')
            app.run(threaded=True, use_reloader=False, debug=args.debug, host=args.host, port=args.port,
                    ssl_context=context)
        else:
            app.run(threaded=True, use_reloader=False, debug=args.debug, host=args.host, port=args.port)
