=================
Multiple Clusters
=================

Multiple clusters are supported by either passing a static list of API server URLs, using an existing kubeconfig file or pointing to a Cluster Registry HTTP endpoint.

Static List of API Server URLs
==============================

Set the ``CLUSTERS`` environment variable to a comma separated list of Kubernetes API server URLs.

These can either be unprotected ``localhost`` URLs or OAuth 2 protected API endpoints.

The needed OAuth credentials (``Bearer`` access token) must be provided via a file ``${CREDENTIALS_DIR}/read-only-token-secret``.


Kubeconfig File
===============

The `kubeconfig file`_ allows defining multiple cluster contexts with potential different authentication mechanisms.

Kubernetes Operational View will try to reach all defined contexts when given the ``--kubeconfig-path`` command line option (or ``KUBECONFIG_PATH`` environment variable).

Example:

Assuming ``~/.kube/config`` as the following contents with two defined contexts:

.. code-block:: yaml

    apiVersion: v1
    kind: Config
    clusters:
    - cluster: {server: 'https://kube.foo.example.org'}
      name: kube_foo_example_org
    - cluster: {server: 'https://kube.bar.example.org'}
      name: kube_bar_example_org
    contexts:
    - context: {cluster: kube_foo_example_org, user: kube_foo_example_org}
      name: foo
    - context: {cluster: kube_bar_example_org, user: kube_bar_example_org}
      name: bar
    current-context: kube_foo_example_org
    users:
    - name: kube_foo_example_org
      user: {token: myfootoken123}
    - name: kube_bar_example_org
      user: {token: mybartoken456}

Kubernetes Operational View would try to reach both endpoints with the respective token for authentication:

.. code-block:: bash

    $ # note that we need to mount the local ~/.kube/config file into the Docker container
    $ docker run -it --net=host -v ~/.kube:/kube hjacobs/kube-ops-view --kubeconfig-path=/kube/config

.. Note::

    You need to make sure that the Docker container has access to any required SSL certificate files.
    `Minikube`_ by default will use certificates in ``~/.minikube``. You can copy them to ``~/.kube`` and make the paths in ``~/.kube/config`` relative.

    The following command should work out of the box with Minikube:

    .. code-block:: bash

        $ docker run -it --net=host -v ~/.kube:/kube -v ~/.minikube:$HOME/.minikube hjacobs/kube-ops-view --kubeconfig-path=/kube/config

You can select which clusters should be queried by specifying a list of kubeconfig contexts with the ``--kubeconfig-contexts`` option:

.. code-block:: bash

    $ docker run -it --net=host -v ~/.kube:/kube hjacobs/kube-ops-view --kubeconfig-path=/kube/config --kubeconfig-contexts=bar

This would only query the Kubernetes cluster defined by the ``bar`` context.


Cluster Registry
================

Clusters can be dynamically discovered by providing one HTTP endpoint as the cluster registry.
Set either the ``CLUSTER_REGISTRY_URL`` environment variable or the ``--cluster-registry-url`` option to an URL conforming to:

.. code-block:: bash

    $ curl -H 'Authorization: Bearer mytoken' $CLUSTER_REGISTRY_URL/kubernetes-clusters
    {
        "items": [
            {
                "id": "my-cluster-id",
                "api_server_url": "https://my-cluster.example.org"
            }
        ]
    }

The cluster registry will be queried with an OAuth Bearer token, the token can be statically set via the ``OAUTH2_ACCESS_TOKENS`` environment variable.
Example:

.. code-block:: bash

    $ token=mysecrettoken
    $ docker run -it -p 8080:8080 -e OAUTH2_ACCESS_TOKENS=read-only=$token hjacobs/kube-ops-view --cluster-registry-url=https://cluster-registry.example.org

Otherwise the needed OAuth credentials (``Bearer`` access token) must be provided via a file ``${CREDENTIALS_DIR}/read-only-token-secret``.
You can pass this file by mounting a secret like:

.. code-block:: yaml

    apiVersion: v1
    kind: Secret
    metadata:
      name: kube-ops-view-credentials
    type: Opaque
    data:
      read-only-token-type: Bearer
      read-only-token-secret: dXNlcjpwYXNzCg== # base64 encoded token

The deployment manifest to mount the above secret:

.. code-block:: yaml

    apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
      name: kube-ops-view
    spec:
      replicas: 1
      template:
        metadata:
          labels:
            app: kube-ops-view
        spec:
          containers:
          - name: kube-ops-view
            image: hjacobs/kube-ops-view:latest
            env:
            - name: CLUSTER_REGISTRY_URL
              value: "https://cluster-registry.example.org"
            - name: CREDENTIALS_DIR
              value: "/meta/credentials"
            ports:
            - containerPort: 8080
              protocol: TCP
            volumeMounts:
            - name: credentials
              mountPath: /meta/credentials
              readOnly: true
          volumes:
          - name: credentials
            secret:
              secretName: kube-ops-view-credentials


.. _kubeconfig file: https://kubernetes.io/docs/user-guide/kubeconfig-file/
.. _Minikube: https://github.com/kubernetes/minikube
