#!/usr/bin/env python3
"""
Helper script for Docker build to install packages from Pipfile.lock without installing Pipenv
"""
import json
import subprocess

with open("Pipfile.lock") as fd:
    data = json.load(fd)

packages = []
for k, v in data["default"].items():
    packages.append(k + v["version"])

subprocess.run(["pip3", "install"] + packages, check=True)
