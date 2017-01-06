#!/usr/bin/env python3

import gevent.monkey

gevent.monkey.patch_all()

import flask
import functools
import gevent
import gevent.wsgi
import json
import logging
import os
import re
import requests
import datetime
import time
import tokens
from queue import Queue

from flask import Flask, redirect
from flask_oauthlib.client import OAuth, OAuthRemoteApp
from urllib.parse import urljoin


class MemoryStore:
    def __init__(self):
        self._queues = []

    def acquire_lock(self):
        # no-op for memory store
        pass

    def release_lock(self):
        # no op for memory store
        pass

    def publish(self, event_type, event_data):
        for queue in self._queues:
            queue.put((event_type, event_data))

    def listen(self):
        queue = Queue()
        self._queues.append(queue)
        try:
            while True:
                item = queue.get()
                yield item
        finally:
            self._queues.remove(queue)


STORE = MemoryStore()


CLUSTER_ID_INVALID_CHARS = re.compile('[^a-z0-9:-]')


def get_bool(name: str):
    return os.getenv(name, '').lower() in ('1', 'true')


DEFAULT_CLUSTERS = 'http://localhost:8001/'
CREDENTIALS_DIR = os.getenv('CREDENTIALS_DIR', '')
AUTHORIZE_URL = os.getenv('AUTHORIZE_URL')
APP_URL = os.getenv('APP_URL')
MOCK = get_bool('MOCK')

app = Flask(__name__)
app.debug = get_bool('DEBUG')
app.secret_key = os.getenv('SECRET_KEY', 'development')

oauth = OAuth(app)


class OAuthRemoteAppWithRefresh(OAuthRemoteApp):
    '''Same as flask_oauthlib.client.OAuthRemoteApp, but always loads client credentials from file.'''

    def __init__(self, oauth, name, **kwargs):
        # constructor expects some values, so make it happy..
        kwargs['consumer_key'] = 'not-needed-here'
        kwargs['consumer_secret'] = 'not-needed-here'
        OAuthRemoteApp.__init__(self, oauth, name, **kwargs)

    def refresh_credentials(self):
        with open(os.path.join(CREDENTIALS_DIR, 'authcode-client-id')) as fd:
            self._consumer_key = fd.read().strip()
        with open(os.path.join(CREDENTIALS_DIR, 'authcode-client-secret')) as fd:
            self._consumer_secret = fd.read().strip()

    @property
    def consumer_key(self):
        self.refresh_credentials()
        return self._consumer_key

    @property
    def consumer_secrect(self):
        self.refresh_credentials()
        return self._consumer_secret


def authorize(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if AUTHORIZE_URL and 'auth_token' not in flask.session:
            return redirect(urljoin(APP_URL, '/login'))
        return f(*args, **kwargs)

    return wrapper


auth = OAuthRemoteAppWithRefresh(
    oauth,
    'auth',
    request_token_url=None,
    access_token_method='POST',
    access_token_url=os.getenv('ACCESS_TOKEN_URL'),
    authorize_url=AUTHORIZE_URL
)
oauth.remote_apps['auth'] = auth

session = requests.Session()

tokens.configure(from_file_only=True)
tokens.manage('read-only')


@app.route('/health')
def health():
    return 'OK'


@app.route('/')
@authorize
def index():
    app_js = None
    for entry in os.listdir('static/build'):
        if entry.startswith('app'):
            app_js = entry
            if app.debug:
                # cache busting for local development
                app_js += '?_={}'.format(time.time())
            break
    return flask.render_template('index.html', app_js=app_js)


def hash_int(x: int):
    x = ((x >> 16) ^ x) * 0x45d9f3b
    x = ((x >> 16) ^ x) * 0x45d9f3b
    x = (x >> 16) ^ x
    return x


def generate_mock_pod(index: int, i: int, j: int):
    names = [
        'agent-cooper',
        'black-lodge',
        'bob',
        'bobby-briggs'
        'laura-palmer',
        'leland-palmer',
        'log-lady',
        'sheriff-truman',
    ]
    pod_phases = ['Pending', 'Running', 'Running']
    labels = {}
    phase = pod_phases[hash_int((index + 1) * (i + 1) * (j + 1)) % len(pod_phases)]
    containers = []
    for k in range(1 + j % 2):
        containers.append({'name': 'myapp', 'image': 'foo/bar/{}'.format(j), 'resources': {'requests': {'cpu': '100m', 'memory': '100Mi'}, 'limits': {}}})
    status = {'phase': phase}
    if phase == 'Running':
        if j % 13 == 0:
            status['containerStatuses'] = [{'ready': False, 'state': {'waiting': {'reason': 'CrashLoopBackOff'}}}]
        elif j % 7 == 0:
            status['containerStatuses'] = [{'ready': True, 'state': {'running': {}}, 'restartCount': 3}]
    pod = {'name': '{}-{}-{}'.format(names[hash_int((i + 1) * (j + 1)) % len(names)], i, j), 'namespace': 'kube-system' if j < 3 else 'default', 'labels': labels, 'status': status, 'containers': containers}
    if phase == 'Running' and j % 17 == 0:
        pod['deleted'] = 123

    return pod


def generate_cluster_id(url: str):
    '''Generate some "cluster ID" from given API server URL'''
    for prefix in ('https://', 'http://'):
        if url.startswith(prefix):
            url = url[len(prefix):]
    return CLUSTER_ID_INVALID_CHARS.sub('-', url.lower()).strip('-')


def generate_mock_cluster_data(index: int):
    '''Generate deterministic (no randomness!) mock data'''
    nodes = []
    for i in range(10):
        labels = {}
        if i < 2:
            labels['master'] = 'true'
        pods = []
        for j in range(hash_int((index + 1) * (i + 1)) % 32):
            if j % 17 == 0 and int(time.time() / 6) % 2 == 0:
                pass
            else:
                pods.append(generate_mock_pod(index, i, j))
        nodes.append({'name': 'node-{}'.format(i), 'labels': labels, 'status': {'capacity': {'cpu': '4', 'memory': '32Gi', 'pods': '110'}}, 'pods': pods})
    unassigned_pods = [generate_mock_pod(index, 11, index)]
    return {
        'id': 'mock-cluster-{}'.format(index),
        'api_server_url': 'https://kube-{}.example.org'.format(index),
        'nodes': nodes,
        'unassigned_pods': unassigned_pods
    }


def get_mock_clusters():
    for i in range(3):
        data = generate_mock_cluster_data(i)
        yield data


def get_kubernetes_clusters():
    for api_server_url in (os.getenv('CLUSTERS') or DEFAULT_CLUSTERS).split(','):
        cluster_id = generate_cluster_id(api_server_url)
        if 'localhost' not in api_server_url:
            # TODO: hacky way of detecting whether we need a token or not
            session.headers['Authorization'] = 'Bearer {}'.format(tokens.get('read-only'))
        response = session.get(urljoin(api_server_url, '/api/v1/nodes'), timeout=5)
        response.raise_for_status()
        nodes = []
        nodes_by_name = {}
        pods_by_namespace_name = {}
        unassigned_pods = []
        for node in response.json()['items']:
            obj = {'name': node['metadata']['name'], 'labels': node['metadata']['labels'], 'status': node['status'],
                   'pods': []}
            nodes.append(obj)
            nodes_by_name[obj['name']] = obj
        response = session.get(urljoin(api_server_url, '/api/v1/pods'), timeout=5)
        response.raise_for_status()
        for pod in response.json()['items']:
            obj = {'name': pod['metadata']['name'],
                   'namespace': pod['metadata']['namespace'],
                   'labels': pod['metadata'].get('labels', {}),
                   'status': pod['status'],
                   'startTime': pod['status']['startTime'] if 'startTime' in pod['status'] else '',
                   'containers': []
                   }
            if 'deletionTimestamp' in pod['metadata']:
                obj['deleted'] = datetime.datetime.strptime(pod['metadata']['deletionTimestamp'],
                                                            '%Y-%m-%dT%H:%M:%SZ').replace(
                    tzinfo=datetime.timezone.utc).timestamp()
            for cont in pod['spec']['containers']:
                obj['containers'].append({'name': cont['name'], 'image': cont['image'], 'resources': cont['resources']})
            pods_by_namespace_name[(obj['namespace'], obj['name'])] = obj
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
        try:
            response = session.get(urljoin(api_server_url,
                                           '/api/v1/namespaces/kube-system/services/heapster/proxy/apis/metrics/v1alpha1/pods'),
                                   timeout=5)
            response.raise_for_status()
            for metrics in response.json()['items']:
                pod = pods_by_namespace_name.get((metrics['metadata']['namespace'], metrics['metadata']['name']))
                if pod:
                    for container in pod['containers']:
                        for container_metrics in metrics['containers']:
                            if container['name'] == container_metrics['name']:
                                container['resources']['usage'] = container_metrics['usage']
        except:
            logging.exception('Failed to get metrics')
        yield {'id': cluster_id, 'api_server_url': api_server_url, 'nodes': nodes, 'unassigned_pods': unassigned_pods}


def event(cluster_ids: set):
    while True:
        for event_type, cluster in STORE.listen():
            if not cluster_ids or cluster['id'] in cluster_ids:
                yield 'event: ' + event_type + '\ndata: ' + json.dumps(cluster, separators=(',', ':')) + '\n\n'


@app.route('/events')
@authorize
def get_events():
    '''SSE (Server Side Events), for an EventSource'''
    cluster_ids = set()
    for _id in flask.request.args.get('cluster_ids', '').split():
        if _id:
            cluster_ids.add(_id)
    return flask.Response(event(cluster_ids), mimetype='text/event-stream')


@app.route('/login')
def login():
    redirect_uri = urljoin(APP_URL, '/login/authorized')
    return auth.authorize(callback=redirect_uri)


@app.route('/logout')
def logout():
    flask.session.pop('auth_token', None)
    return redirect(urljoin(APP_URL, '/'))


@app.route('/login/authorized')
def authorized():
    resp = auth.authorized_response()
    if resp is None:
        return 'Access denied: reason=%s error=%s' % (
            flask.request.args['error'],
            flask.request.args['error_description']
        )
    if not isinstance(resp, dict):
        return 'Invalid auth response'
    flask.session['auth_token'] = (resp['access_token'], '')
    return redirect(urljoin(APP_URL, '/'))


@auth.tokengetter
def get_auth_oauth_token():
    return flask.session.get('auth_token')


def update():
    while True:
        try:
            STORE.acquire_lock()
            if MOCK:
                clusters = get_mock_clusters()
            else:
                clusters = get_kubernetes_clusters()
            for cluster in clusters:
                STORE.publish('clusterupdate', cluster)
        except:
            logging.exception('Failed to update')
        finally:
            STORE.release_lock()
        gevent.sleep(5)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    port = 8080
    http_server = gevent.wsgi.WSGIServer(('0.0.0.0', port), app)
    gevent.spawn(update)
    logging.info('Listening on :{}..'.format(port))
    http_server.serve_forever()
