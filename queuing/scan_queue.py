import time
import pika
from flask import logging

import queuing

log = logging.getLogger(__name__)

class Consumer:
    def __init__(self):
        self.channel = None
        self.connection = None

    def __del__(self):
        if self.connection:
            self.connection.close()

    @classmethod
    def connect(self):
        self.connection = queuing.connect()
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=queuing.scan_queue(), durable=False)
        self.channel.basic_qos(prefetch_count=1)

    @classmethod
    def register_callback(self, callback):
        self.channel.basic_consume(callback, queue=queuing.scan_queue())
        self.channel.start_consuming()

    @classmethod
    def disconnect(self):
        self.connection.close()
        self.connection = None


class Producer:
    def __init__(self):
        self.channel = None
        self.connection = None

    def __del__(self):
        if self.connection:
            self.connection.close()

    @classmethod
    def connect(self):
        self.connection = queuing.connect()
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=queuing.scan_queue(), durable=False)


    @classmethod
    def publish(self, message):
        if not self.channel:
            raise Exception('Not connected')
        while True:
            try:
                self.channel.basic_publish(exchange='', routing_key=queuing.scan_queue(), body=message,
                                           properties=pika.BasicProperties(delivery_mode=2))
                break
            except pika.exceptions.ConnectionClosed:
                log.warning('Rabbit connection closed, retrying')
                time.sleep(1)
                self.connect()
            except Exception as ex:
                log.warning('Unknown rabbit error ' + str(ex) + ', retrying in ten')
                time.sleep(10)
                self.connect()


    @classmethod
    def disconnect(self):
        self.connection.close()
        self.connection = None




