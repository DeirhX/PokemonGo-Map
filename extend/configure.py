import logging
import os
import re
import sys
from Queue import Queue
from threading import Thread, Event

import math
import requests
from flask.ext.cors import CORS
from pgoapi.utilities import get_pos_by_name
from flask_cache_bust import init_cache_busting

from extend.beehive import generate_hive_cells
from extend.scan import begin_consume_queue
from extend.stats import begin_share_receive_stats
from pogom import config
from pogom.models import init_database, create_tables
from pogom.search import create_scan_queue_dispatcher, search_overseer_thread, fake_search_loop, scan_overseer_thread, \
    scan_radius, limit_locations_to_spawns
from pogom.utils import get_encryption_lib_path, insert_mock_data, get_args

log = logging.getLogger()
args = get_args()

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
    if args.web_server:
        if not os.path.exists(os.path.join(os.path.dirname(__file__)+'/..', 'static/dist')):
            log.critical('Missing front-end assets (static/dist) -- please run "npm install && npm run build" before starting the server');
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
        logging.getLogger("search").setLevel(logging.DEBUG)
        logging.getLogger("requests").setLevel(logging.DEBUG)
        logging.getLogger("pgoapi").setLevel(logging.DEBUG)
        logging.getLogger("rpc_api").setLevel(logging.DEBUG)

    if args.no_pokemon:
        log.info('Parsing of Pokemon disabled')
    if args.no_pokestops:
        log.info('Parsing of Pokestops disabled')
    if args.no_gyms:
        log.info('Parsing of Gyms disabled')

    config['LOCALE'] = args.locale
    config['CHINA'] = args.china
    config['GMAPS_KEY'] = args.gmaps_key

    db = init_database(app)
    if args.clear_db:
        # if args.db_type == 'mysql':
        #     drop_tables(db)
        if os.path.isfile(args.db):
            os.remove(args.db)
    create_tables(db)

    if args.web_server or args.scan_worker or args.robot_worker:
        # use lat/lng directly if matches such a pattern
        prog = re.compile("^(\-?\d+\.\d+),?\s?(\-?\d+\.\d+)$")
        res = prog.match(args.location)
        if res:
            log.debug('Using coords from CLI directly')
            position = (float(res.group(1)), float(res.group(2)), 0)
        else:
            log.debug('Looking up coords in API')
            position = get_pos_by_name(args.location)

        # Use the latitude and longitude to get the local altitude from Google
        try:
            url = 'https://maps.googleapis.com/maps/api/elevation/json?locations={},{}'.format(
                str(position[0]), str(position[1]))
            altitude = requests.get(url).json()[u'results'][0][u'elevation']
            log.debug('Local altitude is: %sm', altitude)
            position = (position[0], position[1], altitude)
        except (requests.exceptions.RequestException, IndexError, KeyError):
            log.error('Unable to retrieve altitude from Google APIs; setting to 0')

        if not any(position):
            log.error('Could not get a position by name, aborting')
            sys.exit()

        log.info('Parsed location is: %.4f/%.4f/%.4f (lat/lng/alt)',
                 position[0], position[1], position[2])

        pause_bit = Event()
        pause_bit.clear()

    if args.web_server:
        # Control the search status (running or not) across threads
        app.set_current_location(position)
        app.set_search_control(pause_bit)
        # No more stale JS
        init_cache_busting(app)
        create_scan_queue_dispatcher()
        begin_share_receive_stats()

    if args.scan_worker:
        begin_consume_queue()
        scan_thread = Thread(target=scan_overseer_thread, name='Scan overseer',
                               args=(args, args.num_threads, pause_bit, encryption_lib_path))
        scan_thread.daemon = True
        scan_thread.name = 'scan_overseer_thread'
        scan_thread.start()

    if args.robot_worker:
        # if args.num_threads <= 1:
        #    location_list.append(position)
        rings = int(math.ceil(math.sqrt(args.num_threads / 3.0))) # beehive me!  num_workers = 1 + 6 * (n * (n+1)/2))  where n = rings
        diam_each = round((2 * args.step_limit - 1) / (2 * rings - 1))
        steps_each = (diam_each + 1) / 2
        location_list = map(lambda x: (x.lat.decimal_degree, x.lon.decimal_degree, 0), generate_hive_cells(position, rings, steps_each))
        if not args.scan_id:
            raise Exception('scan-id is required for robot_worker')

        # Gather the pokemons!
        if not args.mock:
            log.debug('Starting a real search thread')
            # search_thread = Thread(target=search_loop, args=(args,search_control,))
            search_thread = Thread(target=search_overseer_thread, name='Search overseer',
                                   args=(args, location_list, steps_each, pause_bit, encryption_lib_path))
        else:
            log.debug('Starting a fake search thread')
            insert_mock_data(position)
            search_thread = Thread(target=fake_search_loop, name='Fake search loop')

        search_thread.daemon = True
        search_thread.name = 'search_overseer_thread'
        search_thread.start()

    if args.cors:
        CORS(app)


