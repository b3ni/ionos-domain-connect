FROM python:3-slim

RUN pip install domain-connect-dyndns apscheduler

VOLUME /config.json

COPY ./src /src

CMD [ "python", "-u", "/src/main.py" ]
