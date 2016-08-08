import os

from flask import logging

# Logging
def enableFileLogging(filename) :
    root_path = os.path.dirname(os.path.abspath(__file__))
    Format = '%(asctime)-15s (%(process)6s) [%(threadName)16s] [%(funcName)15s] [%(levelname)7s] %(message)s'
    logging.basicConfig(format=Format)
    handler = logging.handlers.RotatingFileHandler(os.path.join(root_path, filename),
                                                   maxBytes=10000000, backupCount=5, )
    handler.setFormatter(logging.Formatter(Format))
    logging.getLogger().addHandler(handler)
