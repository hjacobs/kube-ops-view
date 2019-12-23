#!/usr/bin/env python3

import gevent.monkey

gevent.monkey.patch_all()

import click
import flask
import functools
import gevent
import gevent.pywsgi
import json
import logging
import os
import signal
import time
import kube_ops_view
from pathlib import Path

from flask import Flask, redirect, url_for
from .oauth import OAuth2ConsumerBlueprintWithClientRefresh
from urllib.parse import urljoin

from .mock import query_mock_cluster
from .kubernetes import query_kubernetes_cluster
from .stores import MemoryStore, RedisStore
from .cluster_discovery import (
    DEFAULT_CLUSTERS,
    StaticClusterDiscoverer,
    ClusterRegistryDiscoverer,
    KubeconfigDiscoverer,
    MockDiscoverer,
)
from .update import update_clusters


logger = logging.getLogger(__name__)

SERVER_STATUS = {"shutdown": False}
AUTHORIZE_URL = os.getenv("AUTHORIZE_URL")
ACCESS_TOKEN_URL = os.getenv("ACCESS_TOKEN_URL")
APP_URL = os.getenv("APP_URL")
SCOPE = os.getenv("SCOPE")

app = Flask(__name__)

oauth_blueprint = OAuth2ConsumerBlueprintWithClientRefresh(
    "oauth",
    __name__,
    authorization_url=AUTHORIZE_URL,
    token_url=ACCESS_TOKEN_URL,
    scope=SCOPE,
)
app.register_blueprint(oauth_blueprint, url_prefix="/login")


def authorize(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if (
            AUTHORIZE_URL
            and "auth_token" not in flask.session
            and not oauth_blueprint.session.authorized
        ):
            return redirect(url_for("oauth.login"))
        return f(*args, **kwargs)

    return wrapper


@app.route("/health")
def health():
    if SERVER_STATUS["shutdown"]:
        flask.abort(503)
    else:
        return "OK"


@app.route("/")
@authorize
def index():
    static_build_path = Path(__file__).parent / "static" / "build"
    candidates = sorted(static_build_path.glob("app*.js"))
    if candidates:
        app_js = candidates[0].name
        if app.debug:
            # cache busting for local development
            app_js += "?_={}".format(time.time())
    else:
        logger.error(
            "Could not find JavaScript application bundle app*.js in {}".format(
                static_build_path
            )
        )
        flask.abort(503, "JavaScript application bundle not found (missing build)")
    return flask.render_template(
        "index.html",
        app_js=app_js,
        version=kube_ops_view.__version__,
        app_config_json=json.dumps(app.app_config),
    )


def event(cluster_ids: set):
    # first sent full data once
    for cluster_id in app.store.get_cluster_ids():
        if not cluster_ids or cluster_id in cluster_ids:
            status = app.store.get_cluster_status(cluster_id)
            if status:
                # send the cluster status including last_query_time BEFORE the cluster data
                # so the UI knows how to render correctly from the start
                yield "event: clusterstatus\ndata: " + json.dumps(
                    {"cluster_id": cluster_id, "status": status}, separators=(",", ":")
                ) + "\n\n"
            cluster = app.store.get_cluster_data(cluster_id)
            if cluster:
                yield "event: clusterupdate\ndata: " + json.dumps(
                    cluster, separators=(",", ":")
                ) + "\n\n"
    yield "event: bootstrapend\ndata: \n\n"

    while True:
        for event_type, event_data in app.store.listen():
            # hacky, event_data can be delta or full cluster object
            if (
                not cluster_ids
                or event_data.get("cluster_id", event_data.get("id")) in cluster_ids
            ):
                yield "event: " + event_type + "\ndata: " + json.dumps(
                    event_data, separators=(",", ":")
                ) + "\n\n"


@app.route("/events")
@authorize
def get_events():
    """SSE (Server Side Events), for an EventSource"""
    cluster_ids = set()
    for _id in flask.request.args.get("cluster_ids", "").split():
        if _id:
            cluster_ids.add(_id)
    return flask.Response(
        event(cluster_ids),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/screen-tokens", methods=["GET", "POST"])
@authorize
def screen_tokens():
    new_token = None
    if flask.request.method == "POST":
        new_token = app.store.create_screen_token()
    return flask.render_template("screen-tokens.html", new_token=new_token)


@app.route("/screen/<token>")
def redeem_screen_token(token: str):
    remote_addr = (
        flask.request.headers.get("X-Forwarded-For") or flask.request.remote_addr
    )
    logger.info(
        'Trying to redeem screen token "{}" for IP {}..'.format(token, remote_addr)
    )
    try:
        app.store.redeem_screen_token(token, remote_addr)
    except:
        flask.abort(401)
    flask.session["auth_token"] = (token, "")
    return redirect(urljoin(APP_URL, "/"))


@app.route("/logout")
def logout():
    flask.session.pop("auth_token", None)
    return redirect(urljoin(APP_URL, "/"))


def shutdown():
    # just wait some time to give Kubernetes time to update endpoints
    # this requires changing the readinessProbe's
    # PeriodSeconds and FailureThreshold appropriately
    # see https://godoc.org/k8s.io/kubernetes/pkg/api/v1#Probe
    gevent.sleep(10)
    exit(0)


def exit_gracefully(signum, frame):
    logger.info("Received TERM signal, shutting down..")
    SERVER_STATUS["shutdown"] = True
    gevent.spawn(shutdown)


def print_version(ctx, param, value):
    if not value or ctx.resilient_parsing:
        return
    click.echo("Kubernetes Operational View {}".format(kube_ops_view.__version__))
    ctx.exit()


class CommaSeparatedValues(click.ParamType):
    name = "comma_separated_values"

    def convert(self, value, param, ctx):
        if isinstance(value, str):
            values = filter(None, value.split(","))
        else:
            values = value
        return values


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.option(
    "-V",
    "--version",
    is_flag=True,
    callback=print_version,
    expose_value=False,
    is_eager=True,
    help="Print the current version number and exit.",
)
@click.option(
    "-p",
    "--port",
    type=int,
    help="HTTP port to listen on (default: 8080)",
    envvar="SERVER_PORT",
    default=8080,
)
@click.option(
    "-d", "--debug", is_flag=True, help="Run in debugging mode", envvar="DEBUG"
)
@click.option(
    "-m", "--mock", is_flag=True, help="Mock Kubernetes clusters", envvar="MOCK"
)
@click.option(
    "--secret-key",
    help="Secret key for session cookies",
    envvar="SECRET_KEY",
    default="development",
)
@click.option(
    "--redis-url",
    help="Redis URL to use for pub/sub and job locking",
    envvar="REDIS_URL",
)
@click.option(
    "--clusters",
    type=CommaSeparatedValues(),
    help="Comma separated list of Kubernetes API server URLs (default: {})".format(
        DEFAULT_CLUSTERS
    ),
    envvar="CLUSTERS",
)
@click.option(
    "--cluster-registry-url",
    help="URL to cluster registry",
    envvar="CLUSTER_REGISTRY_URL",
)
@click.option(
    "--kubeconfig-path",
    type=click.Path(exists=True),
    help="Path to kubeconfig file",
    envvar="KUBECONFIG_PATH",
)
@click.option(
    "--kubeconfig-contexts",
    type=CommaSeparatedValues(),
    help="List of kubeconfig contexts to use (default: use all defined contexts)",
    envvar="KUBECONFIG_CONTEXTS",
)
@click.option(
    "--query-interval",
    type=float,
    help="Interval in seconds for querying clusters (default: 5)",
    envvar="QUERY_INTERVAL",
    default=5,
)
@click.option(
    "--node-link-url-template",
    help="Template for target URL when clicking on a Node",
    envvar="NODE_LINK_URL_TEMPLATE",
)
@click.option(
    "--pod-link-url-template",
    help="Template for target URL when clicking on a Pod",
    envvar="POD_LINK_URL_TEMPLATE",
)
def main(
    port,
    debug,
    mock,
    secret_key,
    redis_url,
    clusters: list,
    cluster_registry_url,
    kubeconfig_path,
    kubeconfig_contexts: list,
    query_interval,
    node_link_url_template: str,
    pod_link_url_template: str,
):
    logging.basicConfig(level=logging.DEBUG if debug else logging.INFO)

    store = RedisStore(redis_url) if redis_url else MemoryStore()

    app.debug = debug
    app.secret_key = secret_key
    app.store = store
    app.app_config = {
        "node_link_url_template": node_link_url_template,
        "pod_link_url_template": pod_link_url_template,
    }

    if mock:
        cluster_query = query_mock_cluster
        discoverer = MockDiscoverer()
    else:
        cluster_query = query_kubernetes_cluster
        if cluster_registry_url:
            discoverer = ClusterRegistryDiscoverer(cluster_registry_url)
        elif kubeconfig_path:
            discoverer = KubeconfigDiscoverer(
                Path(kubeconfig_path), set(kubeconfig_contexts or [])
            )
        else:
            api_server_urls = clusters or []
            discoverer = StaticClusterDiscoverer(api_server_urls)

    gevent.spawn(
        update_clusters,
        cluster_discoverer=discoverer,
        query_cluster=cluster_query,
        store=store,
        query_interval=query_interval,
        debug=debug,
    )

    signal.signal(signal.SIGTERM, exit_gracefully)
    http_server = gevent.pywsgi.WSGIServer(("0.0.0.0", port), app)
    logger.info("Listening on :{}..".format(port))
    http_server.serve_forever()
