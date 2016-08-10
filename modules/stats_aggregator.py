import os
from flask import logging
from extend.log import enableFileLogging
from queuing.stats_queue import StatsAggregateProducer, StatsSubmitConsumer

enableFileLogging('log/pogom-' + str(os.getpid()) + '.log')
log = logging.getLogger()

def collect_submit(ch, method, props, body):
    log.info('Received stats: %s', body)

if __name__ == '__main__':

    aggregate_producer = StatsAggregateProducer()
    aggregate_producer.connect()

    collector = StatsSubmitConsumer()
    collector.connect()
    collector.start_consume(collect_submit)
