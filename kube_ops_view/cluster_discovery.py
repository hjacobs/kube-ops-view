import kubernetes.client
import kubernetes.config
import tokens
from requests.auth import AuthBase

DEFAULT_CLUSTERS = 'http://localhost:8001/'

tokens.configure(from_file_only=True)


class StaticTokenAuth(AuthBase):
    def __init__(self, token):
        self.token = token

    def __call__(self, request):
        request.headers['Authorization'] = 'Bearer {}'.format(self.token)


class OAuthTokenAuth(AuthBase):
    def __init__(self, token_name):
        self.token_name = token_name
        tokens.manage(token_name)

    def __call__(self, request):
        token = tokens.get(self.token_name)
        request.headers['Authorization'] = 'Bearer {}'.format(token)


class Cluster:
    def __init__(self, api_server_url, ssl_ca_cert=None, auth=None):
        self.api_server_url = api_server_url
        self.ssl_ca_cert = ssl_ca_cert
        self.auth = auth


class StaticClusterDiscoverer:

    def __init__(self, api_server_urls):
        self._clusters = []

        if not api_server_urls:
            try:
                kubernetes.config.load_incluster_config()
            except kubernetes.config.ConfigException:
                cluster = Cluster('http://localhost:8001')
            else:
                config = kubernetes.client.configuration
                cluster = Cluster(
                    config.host,
                    ssl_ca_cert=config.ssl_ca_cert,
                    auth=StaticTokenAuth(config.api_key['authorization'].split(' ', 1)[-1]))
            self._clusters.append(cluster)
        else:
            for api_server_url in api_server_urls:

                if 'localhost' not in api_server_url:
                    # TODO: hacky way of detecting whether we need a token or not
                    auth = OAuthTokenAuth('read-only')
                else:
                    auth = None
                self._clusters.append(Cluster(api_server_url, auth=auth))

    def get_clusters(self):
        return self._clusters
