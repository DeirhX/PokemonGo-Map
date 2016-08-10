import json
import dateutil.parser

from Queue import Queue
from ast import literal_eval
from datetime import datetime
from threading import Thread

from flask import logging

from pogom.search import do_search
from pogom.utils import get_args
from queuing import scan_queue

consumer = None
args = get_args()
log = logging.getLogger(__name__)

def begin_consume_queue():
    # Build (possibly) multiple dispatch threads
    queue = Queue(1000)
    def scan_dispatcher(queue):
        while True:
            timestamp, expire_time, position, steps = queue.get()
            log.info('Processing scan request...')
            do_search(position, steps)
    scan_enqueue_thread = Thread(target=scan_dispatcher, name='Scan queue thread', args=(queue,))
    scan_enqueue_thread.daemon = True
    scan_enqueue_thread.start()

    # Handler for incoming queue requests
    def callback(ch, method, props, body):
        try:
            data = json.loads(body)
            tu = (dateutil.parser.parse(data['timestamp']), dateutil.parser.parse(data['expireTime']), tuple(data['position']), data['steps'])
            queue.put(tu)
        except ValueError:
            log.error('Received invalid scan message')
        ch.basic_ack(delivery_tag=method.delivery_tag)

    def consume_thread():
        global consumer
        consumer = scan_queue.ScanQueueConsumer()
        consumer.connect()
        log.info('Listening to scan queue...')
        consumer.register_callback(callback)

    # Begin consuming
    thread = Thread(target=consume_thread)
    thread.daemon = True
    thread.start()

