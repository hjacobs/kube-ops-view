import logging
import time

import gevent
import json_delta
import requests.exceptions

from .backoff import expo, random_jitter

logger = logging.getLogger(__name__)


def calculate_backoff(tries: int):
    return random_jitter(expo(tries, factor=2, max_value=120), jitter=4)


def get_short_error_message(e: requests.exceptions.RequestException):
    '''Generate a reasonable short message why the HTTP request failed'''

    if e.response is not None:
        # e.g. "401 Unauthorized"
        return '{} {}'.format(e.response.status_code, e.response.reason)
    elif isinstance(e, requests.exceptions.ConnectionError):
        # e.g. "ConnectionError" or "ConnectTimeout"
        return e.__class__.__name__
    else:
        return str(e)


def handle_query_failure(e: Exception, cluster, backoff: dict):
    if not backoff:
        backoff = {}
    tries = backoff.get('tries', 0) + 1
    backoff['tries'] = tries
    wait_seconds = calculate_backoff(tries)
    backoff['next_try'] = time.time() + wait_seconds
    if isinstance(e, requests.exceptions.RequestException):
        message = get_short_error_message(e)
        log = logger.error
    else:
        message = str(e)
        log = logger.exception
    log('Failed to query cluster {} ({}): {} (try {}, wait {} seconds)'.format(
        cluster.id, cluster.api_server_url, message, tries, round(wait_seconds)))
    return backoff


def update_clusters(cluster_discoverer, query_cluster: callable, store, query_interval=5, debug: bool=False):
    while True:
        lock = store.acquire_lock()
        if lock:
            try:
                clusters = cluster_discoverer.get_clusters()
                cluster_ids = set()
                for cluster in clusters:
                    cluster_ids.add(cluster.id)
                    status_key = '{}:status'.format(cluster.id)
                    status = store.get(status_key) or {}
                    now = time.time()
                    if now < status.get('last_query_time', 0) + query_interval:
                        continue
                    backoff = status.get('backoff')
                    if backoff and now < backoff['next_try']:
                        # cluster is still in backoff, skip
                        continue
                    try:
                        logger.debug('Querying cluster {} ({})..'.format(cluster.id, cluster.api_server_url))
                        data = query_cluster(cluster)
                    except Exception as e:
                        backoff = handle_query_failure(e, cluster, backoff)
                        status['backoff'] = backoff
                    else:
                        status['last_query_time'] = now
                        if backoff:
                            logger.info('Cluster {} ({}) recovered after {} tries.'.format(cluster.id, cluster.api_server_url, backoff['tries']))
                            del status['backoff']
                        old_data = store.get(data['id'])
                        if old_data:
                            # https://pikacode.com/phijaro/json_delta/ticket/11/
                            # diff is extremely slow without array_align=False
                            delta = json_delta.diff(old_data, data, verbose=debug, array_align=False)
                            store.publish('clusterdelta', {'cluster_id': cluster.id, 'delta': delta})
                            if delta:
                                store.set(cluster.id, data)
                        else:
                            logger.info('Discovered new cluster {} ({}).'.format(cluster.id, cluster.api_server_url))
                            store.publish('clusterupdate', data)
                            store.set(cluster.id, data)
                    store.set(status_key, status)
                store.set('cluster-ids', list(sorted(cluster_ids)))
            except:
                logger.exception('Failed to update')
            finally:
                store.release_lock(lock)
        gevent.sleep(random_jitter(1))
