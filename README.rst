===========================
Kubernetes Operational View
===========================

Goal: provide a common operational picture for multiple Kubernetes clusters.

* Render nodes and indicate their overall status ("Ready")
* Show node capacity and resource usage (CPU, memory)

  * Render one "box" per CPU and fill up to sum of pod CPU requests
  * Render vertical bar for total memory and fill up to sum of pod memory requests

* Render individual pods

  * Indicate pod status by border line color (green: ready/running, yellow: pending, red: error etc)
  * Show current CPU usage (gather from Heapster) by tinting ("hot" color: high CPU usage)
  * System pods ("kube-system" namespace) should be grouped together

* Provide tooltip information for nodes and pods

What it is not:

* It's not a replacement for the `Kubernetes Dashboard`_. The Kubernetes Dashboard is a general purpose UI which allows managing applications.
* It's not a monitoring solution. Use your preferred monitoring system to alert on production issues.
* It's not a operation management tool. Kubernetes Operational View does not allow interacting with the actual cluster.


Usage
=====

.. code-block:: bash

    $ pip3 install -r requirements.txt
    $ kubectl proxy &
    $ ./app.py

Now direct your browser to http://localhost:8080


Supported Browsers
==================

The UI uses WebGL and ECMAScript 6 features.
The following browsers are known to work:

* Chrome/Chromium 53.0+
* Mozilla Firefox 49.0+

See the `ECMAScript 6 Compatibility Table`_ for details on supported browser versions.


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
