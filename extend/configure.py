import os
import sys
import logging
import re

from Queue import Queue
from threading import Thread, Event
from flask.ext.cors import CORS
from pgoapi.utilities import get_pos_by_name

from pogom import config
from pogom.models import init_database, create_tables
from pogom.scan import begin_consume_queue
from pogom.search import create_scan_queue_dispatcher, search_overseer_thread, fake_search_loop
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
        position = get_pos_by_name(args.location)

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


