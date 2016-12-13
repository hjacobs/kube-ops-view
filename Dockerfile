FROM registry.opensource.zalan.do/stups/python:3.5.2-47

EXPOSE 8080

COPY requirements.txt /
RUN pip3 install -r /requirements.txt

COPY app.py /
COPY templates /templates
COPY static /static
COPY swagger.yaml /

WORKDIR /
CMD /app.py
