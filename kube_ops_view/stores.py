import json
import logging
import random
import string
import redis
import time

from redlock import Redlock
from queue import Queue

logger = logging.getLogger(__name__)

ONE_YEAR = 3600 * 24 * 365


def generate_token(n: int):
    """Generate a random ASCII token of length n"""
    # uses os.urandom()
    rng = random.SystemRandom()
    return "".join([rng.choice(string.ascii_letters + string.digits) for i in range(n)])


def generate_token_data():
    """Generate screen token data for storing"""
    token = generate_token(10)
    now = time.time()
    return {"token": token, "created": now, "expires": now + ONE_YEAR}


def check_token(token: str, remote_addr: str, data: dict):
    """Check whether the given screen token is valid, raises exception if not"""
    now = time.time()
    if (
        data
        and now < data["expires"]
        and data.get("remote_addr", remote_addr) == remote_addr
    ):
        data["remote_addr"] = remote_addr
        return data
    else:
        raise ValueError("Invalid token")


class AbstractStore:
    def get_cluster_ids(self):
        return self.get("cluster-ids") or []

    def set_cluster_ids(self, cluster_ids: set):
        self.set("cluster-ids", list(sorted(cluster_ids)))

    def get_cluster_status(self, cluster_id: str) -> dict:
        return self.get("clusters:{}:status".format(cluster_id)) or {}

    def set_cluster_status(self, cluster_id: str, status: dict):
        self.set("clusters:{}:status".format(cluster_id), status)

    def get_cluster_data(self, cluster_id: str) -> dict:
        return self.get("clusters:{}:data".format(cluster_id)) or {}

    def set_cluster_data(self, cluster_id: str, data: dict):
        self.set("clusters:{}:data".format(cluster_id), data)


class MemoryStore(AbstractStore):
    """Memory-only backend, mostly useful for local debugging"""

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
        return "fake-lock"

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
        token = data["token"]
        self._screen_tokens[token] = data
        return token

    def redeem_screen_token(self, token: str, remote_addr: str):
        data = self._screen_tokens.get(token)
        data = check_token(token, remote_addr, data)
        self._screen_tokens[token] = data


class RedisStore(AbstractStore):
    """Redis-based backend for deployments with replicas > 1"""

    def __init__(self, url: str):
        logger.info("Connecting to Redis on {}..".format(url))
        self._redis = redis.StrictRedis.from_url(url)
        self._redlock = Redlock([url])

    def set(self, key, value):
        self._redis.set(key, json.dumps(value, separators=(",", ":")))

    def get(self, key):
        value = self._redis.get(key)
        if value:
            return json.loads(value.decode("utf-8"))

    def acquire_lock(self):
        return self._redlock.lock("update", 10000)

    def release_lock(self, lock):
        self._redlock.unlock(lock)

    def publish(self, event_type, event_data):
        self._redis.publish(
            "default",
            "{}:{}".format(event_type, json.dumps(event_data, separators=(",", ":"))),
        )

    def listen(self):
        p = self._redis.pubsub()
        p.subscribe("default")
        for message in p.listen():
            if message["type"] == "message":
                event_type, data = message["data"].decode("utf-8").split(":", 1)
                yield (event_type, json.loads(data))

    def create_screen_token(self):
        """Generate a new screen token and store it in Redis"""
        data = generate_token_data()
        token = data["token"]
        self._redis.set("screen-tokens:{}".format(token), json.dumps(data))
        return token

    def redeem_screen_token(self, token: str, remote_addr: str):
        """Validate the given token and bind it to the IP"""
        redis_key = "screen-tokens:{}".format(token)
        data = self._redis.get(redis_key)
        if not data:
            raise ValueError("Invalid token")
        data = json.loads(data.decode("utf-8"))
        data = check_token(token, remote_addr, data)
        self._redis.set(redis_key, json.dumps(data))
