FROM alpine:3.4

RUN apk add --no-cache python3 python3-dev alpine-sdk zlib-dev libffi-dev openssl-dev nodejs ca-certificates && \
    python3 -m ensurepip && \
    rm -r /usr/lib/python*/ensurepip && \
    pip3 install --upgrade pip setuptools gevent && \
    apk del python3-dev alpine-sdk zlib-dev libffi-dev openssl-dev && \
    rm -rf /var/cache/apk/* /root/.cache /tmp/* 

EXPOSE 8080

COPY requirements.txt /
RUN pip3 install -r /requirements.txt

COPY kube_ops_view /
COPY app /app

WORKDIR /app
RUN npm install && npm run build

WORKDIR /
ENTRYPOINT ["/usr/bin/python3", "-m", "kube_ops_view"]
