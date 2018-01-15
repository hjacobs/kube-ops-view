import time


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
        'bobby-briggs',
        'laura-palmer',
        'leland-palmer',
        'log-lady',
        'sheriff-truman',
    ]
    labels = {
        'env': ['prod', 'dev'],
        'owner': ['x-wing', 'iris']
    }
    pod_phases = ['Pending', 'Running', 'Running']

    pod_labels = {}
    for li, k in enumerate(labels):
        v = labels[k]
        label_choice = hash_int((index + 1) * (i + 1) * (j + 1) * (li + 1)) % (len(v) + 1)
        if(label_choice != 0):
            pod_labels[k] = v[label_choice - 1]

    phase = pod_phases[hash_int((index + 1) * (i + 1) * (j + 1)) % len(pod_phases)]
    containers = []
    for k in range(1 + j % 2):
        container = {
            'name': 'myapp', 'image': 'foo/bar/{}'.format(j), 'resources': {'requests': {'cpu': '100m', 'memory': '100Mi'}, 'limits': {}},
            'ready': True,
            'state': {'running': {}}
        }
        if phase == 'Running':
            if j % 13 == 0:
                container.update(**{'ready': False, 'state': {'waiting': {'reason': 'CrashLoopBackOff'}}})
            elif j % 7 == 0:
                container.update(**{'ready': True, 'state': {'running': {}}, 'restartCount': 3})
        containers.append(container)
    pod = {
        'name': '{}-{}-{}'.format(names[hash_int((i + 1) * (j + 1)) % len(names)], i, j),
        'namespace': 'kube-system' if j < 3 else 'default',
        'labels': pod_labels,
        'phase': phase,
        'containers': containers
    }
    if phase == 'Running' and j % 17 == 0:
        pod['deleted'] = 123

    return pod


def query_mock_cluster(cluster):
    '''Generate deterministic (no randomness!) mock data'''
    index = int(cluster.id.split('-')[-1])
    nodes = {}
    for i in range(10):
        # add/remove the second to last node every 13 seconds
        if i == 8 and int(time.time() / 13) % 2 == 0:
            continue
        labels = {}
        if i < 2:
            if index == 0:
                labels['kubernetes.io/role'] = 'master'
            elif index == 1:
                labels['node-role.kubernetes.io/master'] = ''
            else:
                labels['master'] = 'true'
        pods = {}
        for j in range(hash_int((index + 1) * (i + 1)) % 32):
            # add/remove some pods every 7 seconds
            if j % 17 == 0 and int(time.time() / 7) % 2 == 0:
                pass
            else:
                pod = generate_mock_pod(index, i, j)
                pods['{}/{}'.format(pod['namespace'], pod['name'])] = pod
        node = {'name': 'node-{}'.format(i), 'labels': labels, 'status': {
            'capacity': {'cpu': '4', 'memory': '32Gi', 'pods': '110'},
            'allocatable': {'cpu': '3800m', 'memory': '31Gi'}}, 'pods': pods}
        nodes[node['name']] = node
    pod = generate_mock_pod(index, 11, index)
    unassigned_pods = {'{}/{}'.format(pod['namespace'], pod['name']): pod}
    return {
        'id': 'mock-cluster-{}'.format(index),
        'api_server_url': 'https://kube-{}.example.org'.format(index),
        'nodes': nodes,
        'unassigned_pods': unassigned_pods
    }
