#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import logging
import time

from threading import Thread
from flask_cors import CORS

from pogom import config
from pogom.app import Pogom
from pogom.utils import get_args, insert_mock_data

from pogom.search import search_loop, create_search_threads, fake_search_loop
from pogom.models import init_database, create_tables, drop_tables, Pokemon, Pokestop, Gym

from pogom.pgoapi.utilities import get_pos_by_name
from pogom.startup import configure

logging.basicConfig(format='%(asctime)s [%(module)14s] [%(levelname)7s] %(message)s')
log = logging.getLogger()
app = Pogom(__name__)

if __name__ == '__main__':
    args = get_args()

    configure(app, args)
    config['ROOT_PATH'] = app.root_path

    if not args.only_server:
        # Gather the pokemons!
        if not args.mock:
            log.debug('Starting a real search thread and {} search runner thread(s)'.format(args.num_threads))
            search_thread = Thread(target=search_loop, args=(args,))
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
        while search_thread.is_alive():
            time.sleep(60)
    else:
        if args.use_ssl:
            context = ('server.cer', 'server.key')
            app.run(threaded=True, use_reloader=False, debug=args.debug, host=args.host, port=args.port,
                    ssl_context=context)
        else:
            app.run(threaded=True, use_reloader=False, debug=args.debug, host=args.host, port=args.port)


