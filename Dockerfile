FROM alpine:3.4

RUN apk add --no-cache python3 python3-dev alpine-sdk zlib-dev libffi-dev openssl-dev nodejs && \
    python3 -m ensurepip && \
    rm -r /usr/lib/python*/ensurepip && \
    pip3 install --upgrade pip setuptools gevent && \
    apk del python3-dev alpine-sdk zlib-dev libffi-dev openssl-dev && \
    rm -rf /var/cache/apk/* /root/.cache /tmp/* 

EXPOSE 8080

COPY requirements.txt /
RUN pip3 install -r /requirements.txt

COPY app.py /
COPY templates /templates
COPY app /app
COPY swagger.yaml /

WORKDIR /app
RUN npm install && npm run build

WORKDIR /
CMD /app.py
