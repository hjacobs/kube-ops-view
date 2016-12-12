#!/usr/bin/env python3

import gevent.monkey
gevent.monkey.patch_all()

import connexion
import flask
import requests


app = connexion.App(__name__)
session = requests.Session()


@app.app.route('/')
def index():
    return flask.render_template('index.html')


def get_clusters():
    response = session.get('http://localhost:8001/api/v1/nodes', timeout=5)
    response.raise_for_status()
    nodes = []
    for node in response.json()['items']:
        print(node)
        nodes.append({'name': node['metadata']['name'], 'labels': node['metadata']['labels'], 'status': node['status']})
    return {'kubernetes_clusters': [{'nodes': nodes}]}


app.add_api('swagger.yaml')

if __name__ == '__main__':
    app.run(port=8080, debug=True) #, server='gevent')
