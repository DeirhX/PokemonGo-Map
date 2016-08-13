import queuing

class DbInserterQueueConsumer(queuing.QueueConsumer):
    def __init__(self):
        queuing.QueueConsumer.__init__(self, queuing.db_insert_queue(), True, 10)

class DbInserterQueueProducer(queuing.QueueProducer):
    def __init__(self):
        queuing.QueueProducer.__init__(self, queuing.db_insert_queue(), True)


