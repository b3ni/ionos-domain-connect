FROM python:3-slim

# RUN apk -U upgrade
# RUN apk add --no-cache gcc musl-dev python3-dev libffi-dev openssl-dev libressl-dev
# RUN python3 -m pip install --upgrade pip setuptools wheel

RUN pip install domain-connect-dyndns apscheduler

VOLUME /settings.txt

COPY ./src /src

CMD [ "python", "/src/main.py" ]