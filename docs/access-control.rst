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
``CREDENTIALS_DIR``
    Folder path to load client credentials from. The folder needs to contain two files: ``authcode-client-id`` and ``authcode-client-secret``.


TODO: how to configure

Screen Tokens
=============

Screen tokens allow non-human access to the UI to support permanent dashboards on TV screens.

On your local machine: authenticate via OAuth redirect flow and go to /screen-tokens to create a new token.
Write down the screen token on a piece of paper.

Go to the TV screen and enter /screen/$TOKEN in the location bar.

TODO: how do screen tokens work?
