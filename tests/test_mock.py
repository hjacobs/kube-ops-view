from kube_ops_view.cluster_discovery import MockDiscoverer
from kube_ops_view.mock import query_mock_cluster


def test_query_mock_clusters():
    discoverer = MockDiscoverer()
    for cluster in discoverer.get_clusters():
        data = query_mock_cluster(cluster)
        assert data['id'].startswith('mock-cluster-')
