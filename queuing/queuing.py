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




# Consumer

class Consumer:
    channel = None
    connection = None

    def __init__(self):
        pass

    def __del__(self):
        if self.connection:
            self.connection.close()

    @classmethod
    def register_callback(self, queue_name, callback):
        self.channel.basic_consume(callback, queue=queue_name)
        self.channel.start_consuming()

    @classmethod
    def connect(self):
        raise Exception('connect needs to be implemented')

    @classmethod
    def disconnect(self):
        self.connection.close()
        self.connection = None


class QueueConsumer(Consumer):
    queue_name = None
    durable = None
    qos = None

    def __init__(self, queue_name, durable, qos):
        Consumer.__init__(self)
        self.queue_name = queue_name
        self.durable = durable
        self.qos = qos

    @classmethod
    def connect(self):
        self.connection = connect()
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=self.queue_name, durable=self.durable)
        if self.qos:
            self.channel.basic_qos(prefetch_count=self.qos)

class ExchangeConsumer(Consumer):
    exchange_name = None
    type = None

    def __init__(self, exchange_name, type='fanout'):
        Consumer.__init__(self)
        self.exchange_name = exchange_name
        self.type = type

    @classmethod
    def connect(self):
        self.connection = connect()
        self.channel = self.connection.channel()
        self.channel.exchange_declare(exchange=self.exchange_name, type=type)
        result = self.channel.queue_declare(exclusive=True)
        self.channel.queue_bind(exchange=self.exchange_name, queue=result.method.queue)



# Producer

class Producer:
    channel = None
    connection = None

    def __init__(self):
        pass

    def __del__(self):
        if self.connection:
            self.connection.close()

    @classmethod
    def publish(self, message, queue_name, exchange='', delivery_mode=2):
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

    @classmethod
    def _do_basic_publish(self, message, delivery_mode):
        raise Exception('_do_basic_publish needs to be implemented')

    @classmethod
    def connect(self):
        raise Exception('connect needs to be implemented')

    @classmethod
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

    @classmethod
    def connect(self):
        self.connection = connect()
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=self.queue_name, durable=self.durable)

    @classmethod
    def reconnect(self):
        connect()

    @classmethod
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

    @classmethod
    def connect(self):
        self.connection = connect()
        self.channel = self.connection.channel()
        self.channel.exchange_declare(exchange=self.exchange_name, type=self.type)

    @classmethod
    def reconnect(self):
        connect()

    @classmethod
    def _do_basic_publish(self, message, delivery_mode):
        self.channel.basic_publish(exchange=self.exchange_name, routing_key='', body=message,
                                   properties=pika.BasicProperties(delivery_mode=delivery_mode))






