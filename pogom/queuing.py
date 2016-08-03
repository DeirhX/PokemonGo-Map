import sys
import pika

credentials = pika.credentials.PlainCredentials(username='panther', password='rabbitbane')
connection = pika.BlockingConnection(pika.ConnectionParameters('yourmom.at', virtual_host='doom', credentials=credentials))
channel = connection.channel()
channel.queue_declare(queue='heroic_epic', durable=True)

message = ' '.join(sys.argv[1:]) or "Hello World!"
channel.basic_publish(exchange='', routing_key='heroic', body=message, properties=pika.BasicProperties(
    delivery_mode=2, # persistent message
))
print(' [x] Sent %r' % message)
connection.close()