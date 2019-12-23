import requests.exceptions


def get_short_error_message(e: Exception):
    """Generate a reasonable short message why the HTTP request failed"""

    if isinstance(e, requests.exceptions.RequestException) and e.response is not None:
        # e.g. "401 Unauthorized"
        return "{} {}".format(e.response.status_code, e.response.reason)
    elif isinstance(e, requests.exceptions.ConnectionError):
        # e.g. "ConnectionError" or "ConnectTimeout"
        return e.__class__.__name__
    else:
        return str(e)
