#!/usr/bin/env python3

import gevent.monkey
gevent.monkey.patch_all()

import flask
import gevent.wsgi
import logging
import os
import json
import requests
import tokens

from flask import Flask, redirect, url_for, session, request, send_from_directory
from flask_oauthlib.client import OAuth, OAuthRemoteApp
from urllib.parse import urljoin


DEFAULT_CLUSTERS = 'http://localhost:8001/'

app = Flask(__name__)
app.debug = os.getenv('DEBUG') == 'true'
app.secret_key = os.getenv('SECRET_KEY', 'development')
session = requests.Session()

tokens.configure(from_file_only=True)
tokens.manage('read-only')


@app.route('/')
def index():
    return flask.render_template('index.html')


@app.route('/kubernetes-clusters')
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
        unassigned_pods = []
        for node in response.json()['items']:
            obj = {'name': node['metadata']['name'], 'labels': node['metadata']['labels'], 'status': node['status'], 'pods': []}
            nodes.append(obj)
            nodes_by_name[obj['name']] = obj
        response = session.get(urljoin(api_server_url, '/api/v1/pods'), timeout=5)
        response.raise_for_status()
        for pod in response.json()['items']:
            obj = {'name': pod['metadata']['name'],
                    'namespace': pod['metadata']['namespace'],
                    'labels': pod['metadata'].get('labels', {}), 'status': pod['status'], 'containers': []}
            for cont in pod['spec']['containers']:
                obj['containers'].append({'name': cont['name'], 'image': cont['image'], 'resources': cont['resources']})
            if 'nodeName' in pod['spec'] and pod['spec']['nodeName'] in nodes_by_name:
                nodes_by_name[pod['spec']['nodeName']]['pods'].append(obj)
            else:
                unassigned_pods.append(obj)

        try:
            response = session.get(urljoin(api_server_url, '/api/v1/namespaces/kube-system/services/heapster/proxy/apis/metrics/v1alpha1/nodes'), timeout=5)
            response.raise_for_status()
            for metrics in response.json()['items']:
                nodes_by_name[metrics['metadata']['name']]['usage'] = metrics['usage']
        except:
            logging.exception('Failed to get metrics')
        clusters.append({'api_server_url': api_server_url, 'nodes': nodes, 'unassigned_pods': unassigned_pods})

    return json.dumps({'kubernetes_clusters': clusters}, separators=(',',':'))


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    port = 8080
    http_server = gevent.wsgi.WSGIServer(('0.0.0.0', port), app)
    logging.info('Listening on {}..'.format(port))
    http_server.serve_forever()

