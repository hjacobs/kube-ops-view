#!/usr/bin/env python3

import gevent.monkey
gevent.monkey.patch_all()

import connexion
import flask
import logging
import os
import requests
import tokens

from urllib.parse import urljoin


DEFAULT_CLUSTERS = 'http://localhost:8001/'

app = connexion.App(__name__)
session = requests.Session()

tokens.configure(from_file_only=True)
tokens.manage('read-only')


@app.app.route('/')
def index():
    return flask.render_template('index.html')


def get_clusters():
    clusters = []
    for api_server_url in os.getenv('CLUSTERS', DEFAULT_CLUSTERS).split(','):
        if 'localhost' not in api_server_url:
            # TODO: hacky way of detecting whether we need a token or not
            session.headers['Authorization'] = 'Bearer {}'.format(tokens.get('read-only'))
        response = session.get(urljoin(api_server_url, '/api/v1/nodes'), timeout=5)
        response.raise_for_status()
        nodes = []
        nodes_by_name = {}
        for node in response.json()['items']:
            obj = {'name': node['metadata']['name'], 'labels': node['metadata']['labels'], 'status': node['status'], 'pods': []}
            nodes.append(obj)
            nodes_by_name[obj['name']] = obj
        response = session.get(urljoin(api_server_url, '/api/v1/pods'), timeout=5)
        response.raise_for_status()
        for pod in response.json()['items']:
            if 'nodeName' in pod['spec']:
                nodes_by_name[pod['spec']['nodeName']]['pods'].append(pod)

        try:
            response = session.get(urljoin(api_server_url, '/api/v1/namespaces/kube-system/services/heapster/proxy/apis/metrics/v1alpha1/nodes'), timeout=5)
            response.raise_for_status()
            for metrics in response.json()['items']:
                nodes_by_name[metrics['metadata']['name']]['usage'] = metrics['usage']
        except:
            logging.exception('Failed to get metrics')
        clusters.append({'api_server_url': api_server_url, 'nodes': nodes})

    return {'kubernetes_clusters': clusters}


app.add_api('swagger.yaml')

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    if os.getenv('DEBUG', False):
        kwargs = {'debug': True}
    else:
        kwargs = {'server': 'gevent'}
    app.run(port=8080, **kwargs)
