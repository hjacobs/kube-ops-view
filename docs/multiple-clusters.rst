=================
Multiple Clusters
=================

Set the ``CLUSTERS`` environment variable to a comma separated list of Kubernetes API server URLs.

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

The cluster registry will be queryied with an OAuth Bearer token, the token can be statically set via the ``OAUTH2_ACCESS_TOKENS`` environment variable.
Example:

.. code-block:: bash

    $ token=mysecrettoken
    $ docker run -it -p 8080:8080 -e OAUTH2_ACCESS_TOKENS=read-only=$token hjacobs/kube-ops-view --cluster-registry-url=https://cluster-registry.example.org
