# ionos-domain-connect

## Description

Docker image for update private ip address using [domain-connect-dyndns](https://github.com/Domain-Connect/DomainConnectDDNS-Python)

## Docker compose

```
version: '3.7'

services:
    ionos-domain-connect:
        image: "b3ni/ionos-domain-connect:latest"
        restart: always
        environment:
            - INTERVAL_UPDATE=60    # seconds
        volumes:
            - ./config.json:/config.json
```

## Setup a domain to updater

```
docker run -it --rm -v $(pwd)/config.json:/config.json b3ni/ionos-domain-connect:latest \
    /usr/local/bin/domain-connect-dyndns \
    --config /config.json setup \
    --domain <my-domain.com>
```

## Setup a domain to updater (inside container)

```
/usr/local/bin/domain-connect-dyndns --config /config.json setup \
    --domain <my-domain.com> 
```

## TODO

Send notifications

## License

MIT License

See LICENSE for details.
