#!/usr/bin/env python3

import gevent.monkey
gevent.monkey.patch_all()

import connexion
import flask
from gevent.wsgi import WSGIServer


app = connexion.App(__name__)

@app.app.route('/')
def index():
    return flask.render_template('index.html')


def get_clusters():
    pass

app.add_api('swagger.yaml')

if __name__ == '__main__':
    app.run(port=8080, server='gevent')
