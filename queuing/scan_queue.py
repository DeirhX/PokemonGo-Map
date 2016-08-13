import queuing

class ScanQueueConsumer(queuing.QueueConsumer):
    def __init__(self):
        queuing.QueueConsumer.__init__(self, queuing.scan_queue(), True, 1)

class ScanQueueProducer(queuing.QueueProducer):
    def __init__(self):
        queuing.QueueProducer.__init__(self, queuing.scan_queue(), True)


