

class PrefixMiddleware(object):
    def __init__(self, app, prefix):
        self.app = app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        if not self.prefix:
            log.info('Called with null prefix')
            return ["Bad Call.".encode()]
        if not environ or not environ['PATH_INFO']:
            log.info('Called with null info')
            return ["Bad URL.".encode()]
        elif environ['PATH_INFO'].startswith(self.prefix):
            environ['PATH_INFO'] = environ['PATH_INFO'][len(self.prefix):]
            environ['SCRIPT_NAME'] = self.prefix
            return self.app(environ, start_response)
        else:
            start_response('404', [('Content-Type', 'text/plain')])
            return ["This url does not belong to the app.".encode()]
