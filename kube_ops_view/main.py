#!/usr/bin/env python3

import gevent.monkey

gevent.monkey.patch_all()

import flask
import functools
import gevent
import gevent.wsgi
import json
import json_delta
import logging
import os
import random
import redis
import signal
import string
import time
from pathlib import Path
from queue import Queue
from redlock import Redlock

from flask import Flask, redirect
from flask_oauthlib.client import OAuth, OAuthRemoteApp
from urllib.parse import urljoin

from .mock import get_mock_clusters
from .kubernetes import get_kubernetes_clusters

ONE_YEAR = 3600 * 24 * 365

logging.basicConfig(level=logging.INFO)


def generate_token(n: int):
    '''Generate a random ASCII token of length n'''
    # uses os.urandom()
    rng = random.SystemRandom()
    return ''.join([rng.choice(string.ascii_letters + string.digits) for i in range(n)])


def generate_token_data():
    '''Generate screen token data for storing'''
    token = generate_token(10)
    now = time.time()
    return {'token': token, 'created': now, 'expires': now + ONE_YEAR}


def check_token(token: str, remote_addr: str, data: dict):
    '''Check whether the given screen token is valid, raises exception if not'''
    now = time.time()
    if data and now < data['expires'] and data.get('remote_addr', remote_addr) == remote_addr:
        data['remote_addr'] = remote_addr
        return data
    else:
        raise ValueError('Invalid token')


class MemoryStore:
    '''Memory-only backend, mostly useful for local debugging'''

    def __init__(self):
        self._data = {}
        self._queues = []
        self._screen_tokens = {}

    def set(self, key, value):
        self._data[key] = value

    def get(self, key):
        return self._data.get(key)

    def acquire_lock(self):
        # no-op for memory store
        return 'fake-lock'

    def release_lock(self, lock):
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

    def create_screen_token(self):
        data = generate_token_data()
        token = data['token']
        self._screen_tokens[token] = data
        return token

    def redeem_screen_token(self, token: str, remote_addr: str):
        data = self._screen_tokens.get(token)
        data = check_token(token, remote_addr, data)
        self._screen_tokens[token] = data


class RedisStore:
    '''Redis-based backend for deployments with replicas > 1'''

    def __init__(self, url: str):
        logging.info('Connecting to Redis on {}..'.format(url))
        self._redis = redis.StrictRedis.from_url(url)
        self._redlock = Redlock([url])

    def set(self, key, value):
        self._redis.set(key, json.dumps(value, separators=(',', ':')))

    def get(self, key):
        value = self._redis.get(key)
        if value:
            return json.loads(value.decode('utf-8'))

    def acquire_lock(self):
        return self._redlock.lock('update', 10000)

    def release_lock(self, lock):
        self._redlock.unlock(lock)

    def publish(self, event_type, event_data):
        self._redis.publish('default', '{}:{}'.format(event_type, json.dumps(event_data, separators=(',', ':'))))

    def listen(self):
        p = self._redis.pubsub()
        p.subscribe('default')
        for message in p.listen():
            if message['type'] == 'message':
                event_type, data = message['data'].decode('utf-8').split(':', 1)
                yield (event_type, json.loads(data))

    def create_screen_token(self):
        '''Generate a new screen token and store it in Redis'''
        data = generate_token_data()
        token = data['token']
        self._redis.set('screen-tokens:{}'.format(token), json.dumps(data))
        return token

    def redeem_screen_token(self, token: str, remote_addr: str):
        '''Validate the given token and bind it to the IP'''
        redis_key = 'screen-tokens:{}'.format(token)
        data = self._redis.get(redis_key)
        if not data:
            raise ValueError('Invalid token')
        data = json.loads(data.decode('utf-8'))
        data = check_token(token, remote_addr, data)
        self._redis.set(redis_key, json.dumps(data))


def get_bool(name: str):
    return os.getenv(name, '').lower() in ('1', 'true')


DEBUG = get_bool('DEBUG')
SERVER_PORT = int(os.getenv('SERVER_PORT', 8080))
SERVER_STATUS = {'shutdown': False}
CREDENTIALS_DIR = os.getenv('CREDENTIALS_DIR', '')
AUTHORIZE_URL = os.getenv('AUTHORIZE_URL')
APP_URL = os.getenv('APP_URL')
MOCK = get_bool('MOCK')
REDIS_URL = os.getenv('REDIS_URL')
STORE = RedisStore(REDIS_URL) if REDIS_URL else MemoryStore()

app = Flask(__name__)
app.debug = DEBUG
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


@app.route('/health')
def health():
    if SERVER_STATUS['shutdown']:
        flask.abort(503)
    else:
        return 'OK'


@app.route('/')
@authorize
def index():
    static_build_path = Path(__file__).parent / 'static' / 'build'
    candidates = sorted(static_build_path.glob('app*.js'))
    if candidates:
        app_js = candidates[0].name
        if app.debug:
            # cache busting for local development
            app_js += '?_={}'.format(time.time())
    else:
        logging.error('Could not find JavaScript application bundle app*.js in {}'.format(static_build_path))
        flask.abort(503, 'JavaScript application bundle not found (missing build)')
    return flask.render_template('index.html', app_js=app_js)


def event(cluster_ids: set):
    # first sent full data once
    for cluster_id in (STORE.get('cluster-ids') or []):
        if not cluster_ids or cluster_id in cluster_ids:
            cluster = STORE.get(cluster_id)
            yield 'event: clusterupdate\ndata: ' + json.dumps(cluster, separators=(',', ':')) + '\n\n'
    while True:
        for event_type, event_data in STORE.listen():
            # hacky, event_data can be delta or full cluster object
            if not cluster_ids or event_data.get('cluster_id', event_data.get('id')) in cluster_ids:
                yield 'event: ' + event_type + '\ndata: ' + json.dumps(event_data, separators=(',', ':')) + '\n\n'


@app.route('/events')
@authorize
def get_events():
    '''SSE (Server Side Events), for an EventSource'''
    cluster_ids = set()
    for _id in flask.request.args.get('cluster_ids', '').split():
        if _id:
            cluster_ids.add(_id)
    return flask.Response(event(cluster_ids), mimetype='text/event-stream')


@app.route('/screen-tokens', methods=['GET', 'POST'])
@authorize
def screen_tokens():
    new_token = None
    if flask.request.method == 'POST':
        new_token = STORE.create_screen_token()
    return flask.render_template('screen-tokens.html', new_token=new_token)


@app.route('/screen/<token>')
def redeem_screen_token(token: str):
    remote_addr = flask.request.headers.get('X-Forwarded-For') or flask.request.remote_addr
    logging.info('Trying to redeem screen token "{}" for IP {}..'.format(token, remote_addr))
    try:
        STORE.redeem_screen_token(token, remote_addr)
    except:
        flask.abort(401)
    flask.session['auth_token'] = (token, '')
    return redirect(urljoin(APP_URL, '/'))


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


def update():
    while True:
        lock = STORE.acquire_lock()
        if lock:
            try:
                if MOCK:
                    clusters = get_mock_clusters()
                else:
                    clusters = get_kubernetes_clusters()
                cluster_ids = []
                for cluster in clusters:
                    old_data = STORE.get(cluster['id'])
                    if old_data:
                        # https://pikacode.com/phijaro/json_delta/ticket/11/
                        # diff is extremely slow without array_align=False
                        delta = json_delta.diff(old_data, cluster, verbose=DEBUG, array_align=False)
                        STORE.publish('clusterdelta', {'cluster_id': cluster['id'], 'delta': delta})
                    else:
                        STORE.publish('clusterupdate', cluster)
                    STORE.set(cluster['id'], cluster)
                    cluster_ids.append(cluster['id'])
                STORE.set('cluster-ids', cluster_ids)
            except:
                logging.exception('Failed to update')
            finally:
                STORE.release_lock(lock)
        gevent.sleep(5)


def shutdown():
    # just wait some time to give Kubernetes time to update endpoints
    # this requires changing the readinessProbe's
    # PeriodSeconds and FailureThreshold appropriately
    # see https://godoc.org/k8s.io/kubernetes/pkg/api/v1#Probe
    gevent.sleep(10)
    exit(0)


def exit_gracefully(signum, frame):
    logging.info('Received TERM signal, shutting down..')
    SERVER_STATUS['shutdown'] = True
    gevent.spawn(shutdown)


def main():
    signal.signal(signal.SIGTERM, exit_gracefully)
    http_server = gevent.wsgi.WSGIServer(('0.0.0.0', SERVER_PORT), app)
    gevent.spawn(update)
    logging.info('Listening on :{}..'.format(SERVER_PORT))
    http_server.serve_forever()
