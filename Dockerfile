FROM python:3.7-alpine3.8

WORKDIR /

RUN apk add --no-cache python3 python3-dev gcc musl-dev zlib-dev libffi-dev openssl-dev ca-certificates && \
    pip3 install --upgrade gevent && \
    apk del python3-dev gcc musl-dev zlib-dev libffi-dev openssl-dev && \
    rm -rf /var/cache/apk/* /root/.cache /tmp/*

COPY Pipfile.lock /
COPY pipenv-install.py /

RUN /pipenv-install.py && \
    rm -fr /usr/local/lib/python3.7/site-packages/pip && \
    rm -fr /usr/local/lib/python3.7/site-packages/setuptools

FROM python:3.7-alpine3.8

WORKDIR /

COPY --from=0 /usr/local/lib/python3.7/site-packages /usr/local/lib/python3.7/site-packages

COPY kube_ops_view /kube_ops_view

ARG VERSION=dev
RUN sed -i "s/__version__ = .*/__version__ = '${VERSION}'/" /kube_ops_view/__init__.py

ENTRYPOINT ["/usr/local/bin/python3", "-m", "kube_ops_view"]
