import queuing

class StatsSubmitProducer(queuing.ExchangeProducer):
    def __init__(self):
        queuing.ExchangeProducer.__init__(self, queuing.stats_submit_queue(), 'fanout')

class StatsAggregateProducer(queuing.ExchangeProducer):
    def __init__(self):
        queuing.ExchangeProducer.__init__(self, queuing.stats_receive_queue(), 'fanout')


class StatsSubmitConsumer(queuing.ExchangeConsumer):
    def __init__(self):
        queuing.ExchangeConsumer.__init__(self, queuing.stats_submit_queue(), 'fanout')

class StatsAggregateConsumer(queuing.ExchangeConsumer):
    def __init__(self):
        queuing.ExchangeConsumer.__init__(self, queuing.stats_receive_queue(), 'fanout')
