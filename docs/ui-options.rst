==========
UI Options
==========

Kubernetes Operational View has a few options to change the UI behavior.
All these options are passed in the URL's fragment identifier (starting with ``#``) in the format of key/value pairs separated by semicolons.

Example URL: ``https://kube-ops-view.example.org/#dashboard=true;reload=600``


``clusters``
    Comma separated list of cluster IDs to show.
``dashboard``
    Enable dashboard mode which hides the menu bar.
``reload``
    Reload the whole page after X seconds. This is useful for unattended TV screens running 24x7 to mitigate JavaScript memory leaks and browser crashes.
``renderer``
    Forces the fallback canvas renderer (instead of WebGL) when set to "canvas".
``scale``
    Set the initial view scale (``1.0`` is 100%).
