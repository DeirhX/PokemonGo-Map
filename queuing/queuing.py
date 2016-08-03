import pika

def connect():
    credentials = pika.credentials.PlainCredentials(username='panther', password='rabbitbane')
    connection = pika.BlockingConnection(
        pika.ConnectionParameters('yourmom.at', virtual_host='doom', credentials=credentials,  ))
    return connection

def scan_queue():
    return 'heroic_scan_queue'

def get_channel(connection):
    channel = connection.channel()
    channel.queue_declare(queue='heroic_scan_queue', durable=True)
    return channel
