import pika
import pika.exceptions
import time
from flask import logging

log = logging.getLogger(__name__)

def connect():
    credentials = pika.credentials.PlainCredentials(username='panther', password='rabbitbane')
    connection = pika.BlockingConnection(
        pika.ConnectionParameters('yourmom.at', virtual_host='doom', credentials=credentials,  ))
    return connection

# Queue Names

def scan_queue():
    return 'heroic_scan_queue'

def stats_submit_queue():
    return 'stats_submit_queue'

def stats_receive_queue():
    return 'stats_receive_queue'

def db_insert_queue():
    return 'db_insert_queue'


# Consumer

class Consumer:

    def __init__(self):
        self.queue_name = None
        self.channel = None
        self.connection = None
        self.no_ack = True
        pass

    def __del__(self):
        if self.connection:
            self.connection.close()

    def connect(self):
        raise Exception('connect needs to be implemented')

    def disconnect(self):
        self.connection.close()
        self.connection = None

    def empty_queue(self):
        self.channel.queue_delete(queue=self.queue_name)
        self.disconnect()
        self.connect()

    def start_consume(self, callback):
        while True:
            try:
                self.channel.basic_consume(callback, queue=self.queue_name, no_ack=self.no_ack)
                self.channel.start_consuming()
                break
            except pika.exceptions.ConnectionClosed:
                log.warning('Rabbit connection closed, retrying')
                time.sleep(1)
                self.connect()
            except Exception as ex:
                log.warning('Unknown rabbit error ' + str(ex) + ', retrying in ten')
                time.sleep(10)
                self.connect()


class QueueConsumer(Consumer):

    def __init__(self, queue_name, durable, qos):
        Consumer.__init__(self)
        self.queue_name = queue_name
        self.durable = durable
        self.qos = qos

    def connect(self):
        self.connection = connect()
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=self.queue_name, durable=self.durable)
        if self.qos:
            self.channel.basic_qos(prefetch_count=self.qos)



class ExchangeConsumer(Consumer):
    queue_name = None
    exchange_name = None
    type = None

    def __init__(self, exchange_name, type='fanout'):
        Consumer.__init__(self)
        self.exchange_name = exchange_name
        self.type = type

    def connect(self):
        self.connection = connect()
        self.channel = self.connection.channel()
        self.channel.exchange_declare(exchange=self.exchange_name, type=self.type)
        self.queue_name = self.channel.queue_declare(exclusive=True).method.queue
        self.channel.queue_bind(exchange=self.exchange_name, queue=self.queue_name)



# Producer

class Producer:
    channel = None
    connection = None

    def __init__(self):
        pass

    def __del__(self):
        if self.connection:
            self.connection.close()

    def publish(self, message, delivery_mode=2):
        if not self.channel:
            raise Exception('Not connected')
        while True:
            try:
                self._do_basic_publish(message, delivery_mode)
                break
            except pika.exceptions.ConnectionClosed:
                log.warning('Rabbit connection closed, retrying')
                time.sleep(1)
                self.connect()
            except Exception as ex:
                log.warning('Unknown rabbit error ' + str(ex) + ', retrying in ten')
                time.sleep(10)
                self.connect()

    def _do_basic_publish(self, message, delivery_mode):
        raise Exception('_do_basic_publish needs to be implemented')

    def connect(self):
        raise Exception('connect needs to be implemented')

    def disconnect(self):
        self.connection.close()
        self.connection = None

class QueueProducer(Producer):
    queue_name = None
    durable = None

    def __init__(self, queue_name, durable):
        Producer.__init__(self)
        self.queue_name = queue_name
        self.durable = durable

    def connect(self):
        self.connection = connect()
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=self.queue_name, durable=self.durable)

    def reconnect(self):
        connect()

    def _do_basic_publish(self, message, delivery_mode):
        self.channel.basic_publish(exchange='', routing_key=self.queue_name, body=message,
                                   properties=pika.BasicProperties(delivery_mode=delivery_mode))

class ExchangeProducer(Producer):
    exchange_name = None
    type = None

    def __init__(self, exchange_name, type='fanout'):
        Producer.__init__(self)
        self.exchange_name = exchange_name
        self.type = type

    def connect(self):
        self.connection = connect()
        self.channel = self.connection.channel()
        self.channel.exchange_declare(exchange=self.exchange_name, type=self.type)

    def reconnect(self):
        connect()

    def _do_basic_publish(self, message, delivery_mode):
        self.channel.basic_publish(exchange=self.exchange_name, routing_key='', body=message,
                                   properties=pika.BasicProperties(delivery_mode=delivery_mode))
