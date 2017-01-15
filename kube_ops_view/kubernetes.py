import datetime
import logging
from urllib.parse import urljoin

import requests

logger = logging.getLogger(__name__)

session = requests.Session()


def map_node_status(status: dict):
    return {
        'addresses': status.get('addresses'),
        'capacity': status.get('capacity'),
    }


def map_node(node: dict):
    return {
        'name': node['metadata']['name'],
        'labels': node['metadata']['labels'],
        'status': map_node_status(node['status']),
        'pods': {}
    }


def map_pod(pod: dict):
    return {
        'name': pod['metadata']['name'],
        'namespace': pod['metadata']['namespace'],
        'labels': pod['metadata'].get('labels', {}),
        'phase': pod['status'].get('phase'),
        'startTime': pod['status']['startTime'] if 'startTime' in pod['status'] else '',
        'containers': []
    }


def map_container(cont: dict, pod: dict):
    obj = {'name': cont['name'], 'image': cont['image'], 'resources': cont['resources']}
    status = list([s for s in pod.get('status', {}).get('containerStatuses', []) if s['name'] == cont['name']])
    if status:
        obj.update(**status[0])
    return obj


def request(cluster, path, **kwargs):
    if 'timeout' not in kwargs:
        # sane default timeout
        kwargs['timeout'] = 5
    return session.get(urljoin(cluster.api_server_url, path), auth=cluster.auth, verify=cluster.ssl_ca_cert, **kwargs)


def query_kubernetes_cluster(cluster):
    cluster_id = cluster.id
    api_server_url = cluster.api_server_url
    response = request(cluster, '/api/v1/nodes')
    response.raise_for_status()
    nodes = {}
    pods_by_namespace_name = {}
    unassigned_pods = {}
    for node in response.json()['items']:
        obj = map_node(node)
        nodes[obj['name']] = obj
    response = request(cluster, '/api/v1/pods')
    response.raise_for_status()
    for pod in response.json()['items']:
        obj = map_pod(pod)
        if 'deletionTimestamp' in pod['metadata']:
            obj['deleted'] = datetime.datetime.strptime(pod['metadata']['deletionTimestamp'],
                                                        '%Y-%m-%dT%H:%M:%SZ').replace(
                tzinfo=datetime.timezone.utc).timestamp()
        for cont in pod['spec']['containers']:
            obj['containers'].append(map_container(cont, pod))
        pods_by_namespace_name[(obj['namespace'], obj['name'])] = obj
        pod_key = '{}/{}'.format(obj['namespace'], obj['name'])
        if 'nodeName' in pod['spec'] and pod['spec']['nodeName'] in nodes:
            nodes[pod['spec']['nodeName']]['pods'][pod_key] = obj
        else:
            unassigned_pods[pod_key] = obj

    try:
        response = request(cluster, '/api/v1/namespaces/kube-system/services/heapster/proxy/apis/metrics/v1alpha1/nodes')
        response.raise_for_status()
        data = response.json()
        if not data.get('items'):
            logger.info('Heapster node metrics not available (yet)')
        else:
            for metrics in data['items']:
                nodes[metrics['metadata']['name']]['usage'] = metrics['usage']
    except:
        logger.exception('Failed to get node metrics')
    try:
        response = request(cluster, '/api/v1/namespaces/kube-system/services/heapster/proxy/apis/metrics/v1alpha1/pods')
        response.raise_for_status()
        data = response.json()
        if not data.get('items'):
            logger.info('Heapster pod metrics not available (yet)')
        else:
            for metrics in data['items']:
                pod = pods_by_namespace_name.get((metrics['metadata']['namespace'], metrics['metadata']['name']))
                if pod:
                    for container in pod['containers']:
                        for container_metrics in metrics['containers']:
                            if container['name'] == container_metrics['name']:
                                container['resources']['usage'] = container_metrics['usage']
    except:
        logger.exception('Failed to get pod metrics')
    return {'id': cluster_id, 'api_server_url': api_server_url, 'nodes': nodes, 'unassigned_pods': unassigned_pods}
