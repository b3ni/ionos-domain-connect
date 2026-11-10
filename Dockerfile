# syntax=docker/dockerfile:1

FROM node:22-slim AS builder
WORKDIR /app
COPY webui/package.json webui/package-lock.json ./
RUN npm ci
COPY webui/ ./
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY requirements.txt /tmp/requirements.txt
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip tini \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --break-system-packages -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

RUN mkdir -p /backups

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
COPY src/ /src/

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# tini reaps orphaned CLI processes (node / python would otherwise be PID 1)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./docker-entrypoint.sh"]
