"""A single common terminal for all websockets.
"""
import tornado.web
from tornado.ioloop import IOLoop
from terminado import TermSocket, SingleTermManager

if __name__ == '__main__':
    term_manager = SingleTermManager(shell_command=['bash'])
    handlers = [
                (r"/websocket", TermSocket, {'term_manager': term_manager}),
                (r"/()", tornado.web.StaticFileHandler, {'path':'index.html'}),
                (r"/terminado_attach.js()", tornado.web.StaticFileHandler, {'path':'terminado_attach.js'}),
               ]
    app = tornado.web.Application(handlers, static_path="../dist/")
    app.listen(8010)
    IOLoop.current().start()
