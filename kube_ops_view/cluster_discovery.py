import logging
import re
import time
from pathlib import Path
from typing import List
from urllib.parse import urljoin

import requests
import tokens
from pykube import HTTPClient
from pykube import KubeConfig
from requests.auth import AuthBase

# default URL points to kubectl proxy
DEFAULT_CLUSTERS = "http://localhost:8001/"
CLUSTER_ID_INVALID_CHARS = re.compile("[^a-z0-9:-]")

logger = logging.getLogger(__name__)

tokens.configure(from_file_only=True)


def generate_cluster_id(url: str):
    """Generate some "cluster ID" from given API server URL."""
    for prefix in ("https://", "http://"):
        if url.startswith(prefix):
            url = url[len(prefix) :]
    return CLUSTER_ID_INVALID_CHARS.sub("-", url.lower()).strip("-")


class StaticAuthorizationHeaderAuth(AuthBase):

    """Static authentication with given "Authorization" header."""

    def __init__(self, authorization):
        self.authorization = authorization

    def __call__(self, request):
        request.headers["Authorization"] = self.authorization
        return request


class OAuthTokenAuth(AuthBase):

    """Dynamic authentication using the "tokens" library to load OAuth tokens from file (potentially mounted from a Kubernetes secret)."""

    def __init__(self, token_name):
        self.token_name = token_name
        tokens.manage(token_name)

    def __call__(self, request):
        token = tokens.get(self.token_name)
        request.headers["Authorization"] = f"Bearer {token}"
        return request


class Cluster:
    def __init__(self, id: str, name: str, api_server_url: str, client: HTTPClient):
        self.id = id
        self.name = name
        self.api_server_url = api_server_url
        self.client = client


class StaticClusterDiscoverer:
    def __init__(self, api_server_urls: list):
        self._clusters = []

        if not api_server_urls:
            try:
                config = KubeConfig.from_service_account()
            except FileNotFoundError:
                # we are not running inside a cluster
                # => assume default kubectl proxy URL
                config = KubeConfig.from_url(DEFAULT_CLUSTERS)
                client = HTTPClient(config)
                cluster = Cluster(
                    generate_cluster_id(DEFAULT_CLUSTERS),
                    "cluster",
                    DEFAULT_CLUSTERS,
                    client,
                )
            else:
                client = HTTPClient(config)
                cluster = Cluster(
                    generate_cluster_id(config.cluster["server"]),
                    "cluster",
                    config.cluster["server"],
                    client,
                )
            self._clusters.append(cluster)
        else:
            for api_server_url in api_server_urls:
                config = KubeConfig.from_url(api_server_url)
                client = HTTPClient(config)
                generated_id = generate_cluster_id(api_server_url)
                self._clusters.append(
                    Cluster(generated_id, generated_id, api_server_url, client)
                )

    def get_clusters(self):
        return self._clusters


class ClusterRegistryDiscoverer:
    def __init__(self, cluster_registry_url: str, cache_lifetime=60):
        self._url = cluster_registry_url
        self._cache_lifetime = cache_lifetime
        self._last_cache_refresh = 0
        self._clusters: List[Cluster] = []
        self._session = requests.Session()
        self._session.auth = OAuthTokenAuth("read-only")

    def refresh(self):
        try:
            response = self._session.get(
                urljoin(self._url, "/kubernetes-clusters"), timeout=10
            )
            response.raise_for_status()
            clusters = []
            for row in response.json()["items"]:
                # only consider "ready" clusters
                if row.get("lifecycle_status", "ready") == "ready":
                    config = KubeConfig.from_url(row["api_server_url"])
                    client = HTTPClient(config)
                    client.session.auth = OAuthTokenAuth("read-only")
                    clusters.append(
                        Cluster(row["id"], row["alias"], row["api_server_url"], client)
                    )
            self._clusters = clusters
            self._last_cache_refresh = time.time()
        except Exception as e:
            logger.exception(
                f"Failed to refresh from cluster registry {self._url}: {e}"
            )

    def get_clusters(self):
        now = time.time()
        if now - self._last_cache_refresh > self._cache_lifetime:
            self.refresh()
        return self._clusters


class KubeconfigDiscoverer:
    def __init__(self, kubeconfig_path: Path, contexts: set):
        self._path = kubeconfig_path
        self._contexts = contexts

    def get_clusters(self):
        # Kubernetes Python client expects "vintage" string path
        config_file = str(self._path)
        config = KubeConfig.from_file(config_file)
        for context in config.contexts:
            if self._contexts and context not in self._contexts:
                # filter out
                continue
            # create a new KubeConfig with new "current context"
            context_config = KubeConfig(config.doc, context)
            client = HTTPClient(context_config)
            cluster = Cluster(
                context, context, context_config.cluster["server"], client
            )
            yield cluster


class MockDiscoverer:
    def get_clusters(self):
        for i in range(3):
            yield Cluster(
                f"mock-cluster-{i}",
                f"mock-cluster-{i}",
                api_server_url=f"https://kube-{i}.example.org",
                client=None,
            )
