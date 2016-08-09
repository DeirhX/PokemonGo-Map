#!/usr/bin/python
# -*- coding: utf-8 -*-

import logging
import os
import shutil
import sys
import time

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

from pogom import config
from pogom.app import Pogom
from pogom.utils import get_args

from extend.log import enableFileLogging


enableFileLogging('log/pogom-' + str(os.getpid()) + '.log')
args = get_args()
app = Pogom(__name__)

if __name__ == '__main__':

    config['ROOT_PATH'] = app.root_path

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
