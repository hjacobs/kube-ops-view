==============
Access Control
==============

Kube Ops View supports protecting the UI via the OAuth Authorization Code Grant flow.

Relevant configuration settings (environment variables) for OAuth are:

``APP_URL``
    The app's own URL, e.g. https://kube-ops-view.example.org. This is used to construct the OAuth 2 redirect URI (callback URL).
``AUTHORIZE_URL``
    OAuth 2 authorization endpoint URL, e.g. https://oauth2.example.org/authorize
``ACCESS_TOKEN_URL``
    Token endpoint URL for the OAuth 2 Authorization Code Grant flow, e.g. https://oauth2.example.org/token
``SCOPE``
    OAuth 2 scopes provide a way to limit the amount of access that is granted to an access token, e.g. https://oauth2.example.org/authorize/readonly
``CREDENTIALS_DIR``
    Folder path to load client credentials from. The folder needs to contain two files: ``authcode-client-id`` and ``authcode-client-secret``.

GitHub OAuth Example
====================

How to configure Kubernetes Operational View to use GitHub OAuth for access control (example with localhost):

* create a new GitHub OAuth application and configure ``http://localhost:8080/login/oauth/authorized`` as "Authorization Callback URL".
* create a file ``authcode-client-id`` with the contents of the generated GitHub "Client ID"
* create a file ``authcode-client-secret`` with the contents of the generated GitHub "Client Secret"
* point the ``CREDENTIALS_DIR`` environment variable to a folder with these two files
* start Kubernetes Operational View with ``OAUTHLIB_INSECURE_TRANSPORT=true`` (needed as localhost is not running with SSL/TLS), ``AUTHORIZE_URL=https://github.com/login/oauth/authorize``, and ``ACCESS_TOKEN_URL=https://github.com/login/oauth/access_token``

Screen Tokens
=============

Screen tokens allow non-human access to the UI to support permanent dashboards on TV screens.

On your local machine: authenticate via OAuth redirect flow and go to /screen-tokens to create a new token.
Write down the screen token on a piece of paper.

Go to the TV screen and enter /screen/$TOKEN in the location bar.

TODO: how do screen tokens work?
