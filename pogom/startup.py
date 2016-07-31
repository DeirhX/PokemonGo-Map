import os
import sys
import logging
import logging.handlers

from pogom import config
from pogom.models import init_database, create_tables, drop_tables, Pokemon, Pokestop, Gym
from pogom.pgoapi.utilities import get_pos_by_name
from pogom.search import create_search_threads

Format = '%(asctime)-15s [%(threadName)16s] [%(funcName)15s] [%(levelname)7s] %(message)s'
logging.basicConfig(format=Format)
log = logging.getLogger()
configured = False

def configure(app, args):

    global configured
    if configured:
        return
    configured = True


    if args.debug_log:
        log.setLevel(logging.DEBUG);
    else:
        log.setLevel(logging.INFO);
    handler = logging.handlers.RotatingFileHandler(os.path.join(config['ROOT_PATH'], 'log/pogom.log'),
                                                   maxBytes=10000000, backupCount=5, )
    handler.setFormatter(logging.Formatter(Format))
    log.addHandler(handler)

    # Let's not forget to run Grunt / Only needed when running with webserver
    if not args.no_server:
        if not os.path.exists(os.path.join(os.path.dirname(__file__)+'\\..', 'static/dist')):
            log.critical('Please run "grunt build" before starting the server.');
            sys.exit();


    # These are very noisey, let's shush them up a bit
    logging.getLogger("peewee").setLevel(logging.INFO)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("pogom.pgoapi.pgoapi").setLevel(logging.WARNING)
    logging.getLogger("pogom.pgoapi.rpc_api").setLevel(logging.INFO)
    logging.getLogger("pogom.models").setLevel(logging.INFO)
    logging.getLogger('werkzeug').setLevel(logging.ERROR)

    config['parse_pokemon'] = not args.no_pokemon
    config['parse_pokestops'] = not args.no_pokestops
    config['parse_gyms'] = not args.no_gyms

    # Turn these back up if debugging
    if args.debug:
        logging.getLogger("requests").setLevel(logging.DEBUG)
        logging.getLogger("pgoapi").setLevel(logging.DEBUG)
        logging.getLogger("rpc_api").setLevel(logging.DEBUG)

    db = init_database()
    if args.clear_db:
        if args.db_type == 'mysql':
            drop_tables(db)
        elif os.path.isfile(args.db):
            os.remove(args.db)
    create_tables(db)

    position = get_pos_by_name(args.location)
    if not any(position):
        log.error('Could not get a position by name, aborting.')
        sys.exit()

    log.info('Parsed location is: {:.4f}/{:.4f}/{:.4f} (lat/lng/alt)'.
             format(*position))
    if args.no_pokemon:
        log.info('Parsing of Pokemon disabled.')
    if args.no_pokestops:
        log.info('Parsing of Pokestops disabled.')
    if args.no_gyms:
        log.info('Parsing of Gyms disabled.')

    config['ORIGINAL_LATITUDE'] = position[0]
    config['ORIGINAL_LONGITUDE'] = position[1]
    config['LOCALE'] = args.locale
    config['CHINA'] = args.china
    config['GMAPS_KEY'] = args.gmaps_key
    config['REQ_SLEEP'] = args.scan_delay

    create_search_threads(args.num_threads)

