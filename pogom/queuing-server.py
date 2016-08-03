import time
import pika

credentials = pika.credentials.PlainCredentials(username='panther', password='rabbitbane')
connection = pika.BlockingConnection(pika.ConnectionParameters('yourmom.at', virtual_host='doom', credentials=credentials))
channel = connection.channel()
channel.queue_declare(queue='heroic_epic', durable=True)
channel.basic_qos(prefetch_count=1)

def callback(ch, method, props, body) :
    print(" [x] Received %r" % body)
    time.sleep(body.count(b'.'))
    print(" [x] Done")
    ch.basic_ack(delivery_tag=method.delivery_tag)

channel.basic_consume(callback, queue='heroic')
channel.start_consuming()
