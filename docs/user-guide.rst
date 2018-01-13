============
User's Guide
============

Pod Status
==========

Each pod indicates its status by color and animation:

* Running and all containers ready: constant green
* Running and not all containers ready: flashing green
* Pending or ContainerCreating: flashing yellow
* ImagePullBackoff or CrashLoopBackoff: flashing red
* Succeeded (for jobs): blue


Tooltips
========

Various UI elements provide additional tooltip information when hovering over them with the mouse:

* Hovering over the title bar of a node box reveals the node's labels.
* Hovering over the vertical resource bars will show the node's capacity, sum of all resource requests and current resource usage.
* Hovering over a pod will show the pod's labels, container status and resources.


Filtering Pods
======================

Kubernetes Operational View allows you to quickly find your running application pods.

Typing characters will run the filter, i.e. non-matching pods will be greyed out.

You can filter by:

* name
* labels - when query includes ``=``, e.g. ``env=prod``

The pod filter is persisted in the location bar (``#q=..`` query parameter) which allows to conveniently send the filtered view to other users (e.g. for troubleshooting).


Sorting Pods
============

Pods can be sorted by different properties:

* pod name (this is the default)
* age (start time)
* memory usage (metric collected from Heapster)
* CPU usage (metric collected from Heapster)

Sorting by memory or CPU allows finding the most resource hungry pod (per node).


Filtering Clusters
==================

Clicking on a cluster handle (the top bar of the cluster box) will toggle between showing the single cluster alone and all clusters.


Themes
======

The top menu bar allows selecting an UI color theme matching your taste. The theme selection will be saved in the browser's Local Storage.
