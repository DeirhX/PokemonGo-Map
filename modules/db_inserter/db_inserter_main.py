import os
import logging
import time
import datetime
from extend.log import enableFileLogging
from threading import Thread
from datetime import timedelta, datetime
from flask import json

from modules.db_inserter.collect import trim_entries_loop, collect_entry
from queuing.db_insert_queue import DbInserterQueueConsumer

enableFileLogging('log/pogom-' + str(os.getpid()) + '.log')
log = logging.getLogger()
log.setLevel(logging.INFO)

if __name__ == '__main__':

    trim_thread = Thread(target=trim_entries_loop, name='Trim entries thread')
    trim_thread.daemon = True
    trim_thread.start()
    log.info('Trim thread started')

    collector = DbInserterQueueConsumer()
    collector.connect()
    log.info('About to start consuming submits')
    collector.start_consume(collect_entry)



