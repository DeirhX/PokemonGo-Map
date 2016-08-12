import os
import logging
import time

import datetime
from threading import Thread


from extend.log import enableFileLogging
from queuing.stats_queue import StatsAggregateProducer, StatsSubmitConsumer

from modules.stats_aggregator.recompute import stats_computer_loop
from modules.stats_aggregator.collect import collect_submit
from modules.stats_aggregator.shared import aggregate_producer

enableFileLogging('log/pogom-' + str(os.getpid()) + '.log')
log = logging.getLogger()
log.setLevel(logging.INFO)

if __name__ == '__main__':

    aggregate_producer.connect()

    stats_thread = Thread(target=stats_computer_loop)
    stats_thread.daemon = True
    stats_thread.start()
    log.info('Stats recompute thread started')

    collector = StatsSubmitConsumer()
    collector.connect()
    log.info('About to start consuming submits')
    collector.start_consume(collect_submit)



