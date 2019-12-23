import logging
import time

import gevent
import json_delta
import requests.exceptions

from .backoff import expo, random_jitter
from .utils import get_short_error_message

logger = logging.getLogger(__name__)


def calculate_backoff(tries: int):
    return random_jitter(expo(tries, factor=2, max_value=60), jitter=4)


def handle_query_failure(e: Exception, cluster, backoff: dict):
    if not backoff:
        backoff = {}
    tries = backoff.get("tries", 0) + 1
    backoff["tries"] = tries
    wait_seconds = calculate_backoff(tries)
    backoff["next_try"] = time.time() + wait_seconds
    message = get_short_error_message(e)
    if isinstance(e, requests.exceptions.RequestException):
        log = logger.error
    else:
        log = logger.exception
    log(
        "Failed to query cluster {} ({}): {} (try {}, wait {} seconds)".format(
            cluster.id, cluster.api_server_url, message, tries, round(wait_seconds)
        )
    )
    return backoff


def update_clusters(
    cluster_discoverer,
    query_cluster: callable,
    store,
    query_interval: float = 5,
    debug: bool = False,
):
    while True:
        lock = store.acquire_lock()
        if lock:
            try:
                clusters = cluster_discoverer.get_clusters()
                cluster_ids = set()
                for cluster in clusters:
                    cluster_ids.add(cluster.id)
                    status = store.get_cluster_status(cluster.id)
                    now = time.time()
                    if now < status.get("last_query_time", 0) + query_interval:
                        continue
                    backoff = status.get("backoff")
                    if backoff and now < backoff["next_try"]:
                        # cluster is still in backoff, skip
                        continue
                    try:
                        logger.debug(
                            "Querying cluster {} ({})..".format(
                                cluster.id, cluster.api_server_url
                            )
                        )
                        data = query_cluster(cluster)
                    except Exception as e:
                        backoff = handle_query_failure(e, cluster, backoff)
                        status["backoff"] = backoff
                        store.publish(
                            "clusterstatus",
                            {"cluster_id": cluster.id, "status": status},
                        )
                    else:
                        status["last_query_time"] = now
                        if backoff:
                            logger.info(
                                "Cluster {} ({}) recovered after {} tries.".format(
                                    cluster.id, cluster.api_server_url, backoff["tries"]
                                )
                            )
                            del status["backoff"]
                        old_data = store.get_cluster_data(data["id"])
                        if old_data:
                            # https://pikacode.com/phijaro/json_delta/ticket/11/
                            # diff is extremely slow without array_align=False
                            delta = json_delta.diff(
                                old_data, data, verbose=debug, array_align=False
                            )
                            store.publish(
                                "clusterdelta",
                                {"cluster_id": cluster.id, "delta": delta},
                            )
                            if delta:
                                store.set_cluster_data(cluster.id, data)
                        else:
                            logger.info(
                                "Discovered new cluster {} ({}).".format(
                                    cluster.id, cluster.api_server_url
                                )
                            )
                            # first send status with last_query_time!
                            store.publish(
                                "clusterstatus",
                                {"cluster_id": cluster.id, "status": status},
                            )
                            store.publish("clusterupdate", data)
                            store.set_cluster_data(cluster.id, data)
                    store.set_cluster_status(cluster.id, status)
                store.set_cluster_ids(cluster_ids)
            except:
                logger.exception("Failed to update")
            finally:
                store.release_lock(lock)
        # sleep 1-2 seconds
        gevent.sleep(min(random_jitter(1), query_interval))
