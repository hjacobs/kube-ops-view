import datetime
import logging
import time

import requests

import pykube

from pykube import Pod, Node
from pykube.objects import APIObject, NamespacedAPIObject

from .utils import get_short_error_message

logger = logging.getLogger(__name__)

session = requests.Session()


# https://github.com/kubernetes/community/blob/master/contributors/design-proposals/instrumentation/resource-metrics-api.md
class NodeMetrics(APIObject):

    version = "metrics.k8s.io/v1beta1"
    endpoint = "nodes"
    kind = "NodeMetrics"


# https://github.com/kubernetes/community/blob/master/contributors/design-proposals/instrumentation/resource-metrics-api.md
class PodMetrics(NamespacedAPIObject):

    version = "metrics.k8s.io/v1beta1"
    endpoint = "pods"
    kind = "PodMetrics"


def map_node_status(status: dict):
    return {
        "addresses": status.get("addresses"),
        "capacity": status.get("capacity"),
        "allocatable": status.get("allocatable"),
    }


def map_node(node: dict):
    return {
        "name": node["metadata"]["name"],
        "labels": node["metadata"]["labels"],
        "status": map_node_status(node["status"]),
        "pods": {},
    }


def map_pod(pod: dict):
    return {
        "name": pod["metadata"]["name"],
        "namespace": pod["metadata"]["namespace"],
        "labels": pod["metadata"].get("labels", {}),
        "phase": pod["status"].get("phase"),
        "startTime": pod["status"]["startTime"] if "startTime" in pod["status"] else "",
        "containers": [],
    }


def map_container(cont: dict, pod: dict):
    obj = {"name": cont["name"], "image": cont["image"], "resources": cont["resources"]}
    status = list(
        [
            s
            for s in pod.get("status", {}).get("containerStatuses", [])
            if s["name"] == cont["name"]
        ]
    )
    if status:
        obj.update(**status[0])
    return obj


def parse_time(s: str):
    return (
        datetime.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ")
        .replace(tzinfo=datetime.timezone.utc)
        .timestamp()
    )


def query_kubernetes_cluster(cluster):
    cluster_id = cluster.id
    api_server_url = cluster.api_server_url
    nodes = {}
    pods_by_namespace_name = {}
    unassigned_pods = {}
    for node in Node.objects(cluster.client):
        obj = map_node(node.obj)
        nodes[obj["name"]] = obj
    now = time.time()
    for pod in Pod.objects(cluster.client, namespace=pykube.all):
        obj = map_pod(pod.obj)
        if "deletionTimestamp" in pod.metadata:
            obj["deleted"] = parse_time(pod.metadata["deletionTimestamp"])
        for cont in pod.obj["spec"]["containers"]:
            obj["containers"].append(map_container(cont, pod.obj))
        if obj["phase"] in ("Succeeded", "Failed"):
            last_termination_time = 0
            for container in obj["containers"]:
                termination_time = (
                    container.get("state", {}).get("terminated", {}).get("finishedAt")
                )
                if termination_time:
                    termination_time = parse_time(termination_time)
                    if termination_time > last_termination_time:
                        last_termination_time = termination_time
            if (last_termination_time and last_termination_time < now - 3600) or (
                obj.get("reason") == "Evicted"
            ):
                # the job/pod finished more than an hour ago or if it is evicted by cgroup limits
                # => filter out
                continue
        pods_by_namespace_name[(pod.namespace, pod.name)] = obj
        pod_key = f"{pod.namespace}/{pod.name}"
        node_name = pod.obj["spec"].get("nodeName")
        if node_name in nodes:
            nodes[node_name]["pods"][pod_key] = obj
        else:
            unassigned_pods[pod_key] = obj

    try:
        for node_metrics in NodeMetrics.objects(cluster.client):
            key = node_metrics.name
            nodes[key]["usage"] = node_metrics.obj.get("usage", {})
    except Exception as e:
        logger.warning(
            "Failed to query node metrics {}: {}".format(
                cluster.id, get_short_error_message(e)
            )
        )
    try:
        for pod_metrics in PodMetrics.objects(cluster.client, namespace=pykube.all):
            key = (pod_metrics.namespace, pod_metrics.name)
            pod = pods_by_namespace_name.get(key)
            if pod:
                for container in pod["containers"]:
                    for container_metrics in pod_metrics.obj.get("containers", []):
                        if container["name"] == container_metrics["name"]:
                            container["resources"]["usage"] = container_metrics["usage"]
    except Exception as e:
        logger.warning(
            "Failed to query pod metrics for cluster {}: {}".format(
                cluster.id, get_short_error_message(e)
            )
        )
    return {
        "id": cluster_id,
        "api_server_url": api_server_url,
        "nodes": nodes,
        "unassigned_pods": unassigned_pods,
    }
