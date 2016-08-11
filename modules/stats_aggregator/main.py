import os

import time

import datetime
from flask import logging
from extend.log import enableFileLogging
from .shared import aggregate_producer
from .collect import collect_submit
from queuing.stats_queue import StatsAggregateProducer, StatsSubmitConsumer

enableFileLogging('log/pogom-' + str(os.getpid()) + '.log')
log = logging.getLogger()

if __name__ == '__main__':

    aggregate_producer.connect()

    collector = StatsSubmitConsumer()
    collector.connect()
    collector.start_consume(collect_submit)



