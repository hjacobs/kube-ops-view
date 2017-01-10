===========================
Kubernetes Operational View
===========================

.. image:: https://readthedocs.org/projects/kubernetes-operational-view/badge/?version=latest
   :target: http://kubernetes-operational-view.readthedocs.io/en/latest/?badge=latest
   :alt: Documentation Status

**This project is in pre-alpha, but it might already be useful.**

.. image:: screenshot.png
   :alt: Screenshot

Goal: provide a common operational picture for multiple Kubernetes clusters.

* Render nodes and indicate their overall status ("Ready")
* Show node capacity and resource usage (CPU, memory)

  * Render one "box" per CPU and fill up to sum of pod CPU requests/usage
  * Render vertical bar for total memory and fill up to sum of pod memory requests/usage

* Render individual pods

  * Indicate pod status by border line color (green: ready/running, yellow: pending, red: error etc)
  * Show current CPU/memory usage (gathered from Heapster) by small vertical bars
  * System pods ("kube-system" namespace) will be grouped together at the bottom

* Provide tooltip information for nodes and pods
* Animate pod creation and termination

What it is not:

* It's not a replacement for the `Kubernetes Dashboard`_. The Kubernetes Dashboard is a general purpose UI which allows managing applications.
* It's not a monitoring solution. Use your preferred monitoring system to alert on production issues.
* It's not a operation management tool. Kubernetes Operational View does not allow interacting with the actual cluster.


Usage
=====

You can run the app locally:

.. code-block:: bash

    $ pip3 install -r requirements.txt
    $ kubectl proxy &
    $ (cd app && npm start &)
    $ ./app.py

Now direct your browser to http://localhost:8080

You can find example Kubernetes manifests for deployment in the ``deploy`` folder.
It should be as simple as:

.. code-block:: bash

    $ kubectl apply -f deploy/deployment.yaml -f deploy/service.yaml

Afterwards you can open "kube-ops-view" via the kubectl proxy:

.. code-block:: bash

    $ kubectl proxy

Now direct your browser to http://localhost:8001/api/v1/proxy/namespaces/default/services/kube-ops-view/


Mock Mode
=========

You can start the app in "mock mode" to see all UI features without running any Kubernetes cluster:

.. code-block:: bash

    $ pip3 install -r requirements.txt
    $ (cd app && npm start &)
    $ MOCK=true ./app.py

You can also run the latest Docker image directly:

.. code-block:: bash

    $ docker run -it -p 8080:8080 -e MOCK=true hjacobs/kube-ops-view


Multiple Clusters
=================

Multiple clusters are supported by passing a list of API server URLs in the ``CLUSTERS`` environment variable.
These can either be unprotected ``localhost`` URLs or OAuth 2 protected API endpoints.
Note that authentication via client-certificates is currently not supported!

The needed OAuth credentials (``Bearer`` access token) must be provided via a file ``${CREDENTIALS_DIR}/read-only-token``.


Configuration
=============

The following environment variables are supported:

``AUTHORIZE_URL``
    Optional OAuth 2 authorization endpoint URL for protecting the UI.
``ACCESS_TOKEN_URL``
    Optional token endpoint URL for the OAuth 2 Authorization Code Grant flow.
``CLUSTERS``
    Comma separated list of Kubernetes API server URLs. It defaults to ``http://localhost:8001/`` (default endpoint of ``kubectl proxy``).
``CREDENTIALS_DIR``
    Directory to read (OAuth) credentials from --- these credentials are only used for non-localhost cluster URLs.
``DEBUG``
    Set to "true" for local development to reload code changes.
``MOCK``
    Set to "true" to mock Kubernetes cluster data.
``REDIS_URL``
    Optional Redis server to use for pub/sub events and job locking when running more than one replica. Example: ``redis://my-redis:6379``
``SERVER_PORT``
    HTTP port to listen on. It defaults to ``8080``.


Supported Browsers
==================

The UI uses WebGL, ECMAScript 6, and EventSource features.
The following browsers are known to work:

* Chrome/Chromium 53.0+
* Mozilla Firefox 49.0+

See the `ECMAScript 6 Compatibility Table`_ for details on supported browser versions.

Contributing
============

Easiest way to contribute is to provide feedback! We would love to hear what you like and what you think is missing.
Create an issue or `ping try_except_ on Twitter`_.

PRs are welcome. Please also have a look at `issues labeled with "help wanted"`_.


License
=======

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see http://www.gnu.org/licenses/.

.. _Kubernetes Dashboard: https://github.com/kubernetes/dashboard
.. _ECMAScript 6 Compatibility Table: https://kangax.github.io/compat-table/es6/
.. _ping try_except_ on Twitter: https://twitter.com/try_except_
.. _issues labeled with "help wanted": https://github.com/hjacobs/kube-ops-view/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22
