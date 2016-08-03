#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import logging
import time

from threading import Thread, Event
from flask_cors import CORS

from pogom import config
from pogom.app import Pogom
from pogom.scan import begin_consume_queue
from pogom.utils import get_args, insert_mock_data

from pogom.search import search_loop,  create_search_threads, fake_search_loop, scan_enqueue
from pogom.models import init_database, create_tables, drop_tables, Pokemon, Pokestop, Gym

from pogom.pgoapi.utilities import get_pos_by_name
from pogom.startup import configure, search_control

from werkzeug.serving import run_simple
from werkzeug.wsgi import DispatcherMiddleware


class PrefixMiddleware(object):
    def __init__(self, app, prefix):
        self.app = app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        if not self.prefix:
            log.info('Called with null prefix')
            return ["Bad Call.".encode()]
        if not environ or not environ['PATH_INFO']:
            log.info('Called with null info')
            return ["Bad URL.".encode()]
        elif environ['PATH_INFO'].startswith(self.prefix):
            environ['PATH_INFO'] = environ['PATH_INFO'][len(self.prefix):]
            environ['SCRIPT_NAME'] = self.prefix
            return self.app(environ, start_response)
        else:
            start_response('404', [('Content-Type', 'text/plain')])
            return ["This url does not belong to the app.".encode()]

root_path = os.path.dirname(os.path.abspath(__file__))
Format = '%(asctime)-15s (%(process)6s) [%(threadName)16s] [%(funcName)15s] [%(levelname)7s] %(message)s'
logging.basicConfig(format=Format)
handler = logging.handlers.RotatingFileHandler(os.path.join(root_path, 'log/pogom.log'),
                                               maxBytes=10000000, backupCount=5, )
handler.setFormatter(logging.Formatter(Format))
log = logging.getLogger()
log.addHandler(handler)

app = Pogom(__name__)
#args = get_args()
#app.config['APPLICATION_ROOT'] = args.virtual_path
#app.wsgi_app = PrefixMiddleware(app.wsgi_app, prefix=args.virtual_path)

if __name__ == '__main__':
    args = get_args()

    config['ROOT_PATH'] = app.root_path

    configure(app, args)

    if (not args.only_server and not args.scan_worker) or args.robot_worker:
        # Gather the pokemons!
        if not args.mock:
            log.debug('Starting a real search thread and {} search runner thread(s)'.format(args.num_threads))
            search_thread = Thread(target=search_loop, args=(args,search_control,))
        else:
            log.debug('Starting a fake search thread')
            insert_mock_data()
            search_thread = Thread(target=fake_search_loop)

        search_thread.daemon = True
        search_thread.name = 'search_thread'
        search_thread.start()

    if args.cors:
        CORS(app);

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


