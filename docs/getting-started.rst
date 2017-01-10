===============
Getting Started
===============

You can find example Kubernetes manifests for deployment in the deploy folder. It should be as simple as:

.. code-block:: bash

    $ git clone git@github.com:hjacobs/kube-ops-view.git
    $ kubectl apply -f kube-ops-view/deploy

Afterwards you can open "kube-ops-view" via the kubectl proxy:

.. code-block:: bash

    $ kubectl proxy

Now direct your browser to http://localhost:8001/api/v1/proxy/namespaces/default/services/kube-ops-view/


