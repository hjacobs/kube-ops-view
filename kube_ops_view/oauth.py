import os

from flask_dance.consumer import OAuth2ConsumerBlueprint


CREDENTIALS_DIR = os.getenv("CREDENTIALS_DIR", "")


class OAuth2ConsumerBlueprintWithClientRefresh(OAuth2ConsumerBlueprint):
    """Same as flask_dance.consumer.OAuth2ConsumerBlueprint, but loads client credentials from file"""

    def refresh_credentials(self):
        with open(os.path.join(CREDENTIALS_DIR, "authcode-client-id")) as fd:
            # note that we need to set two attributes because of how OAuth2ConsumerBlueprint works :-/
            self._client_id = self.client_id = fd.read().strip()
        with open(os.path.join(CREDENTIALS_DIR, "authcode-client-secret")) as fd:
            self.client_secret = fd.read().strip()

    def login(self):
        self.refresh_credentials()
        return super().login()
