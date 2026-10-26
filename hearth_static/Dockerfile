# syntax=docker/dockerfile:1.7
# SPDX-License-Identifier: AGPL-3.0-or-later

FROM alpine:3.24 AS spellcheck-dictionaries
RUN apk add --no-cache curl
COPY hearth_static/fetch-spellcheck-dictionaries.sh hearth_static/spellcheck-dictionaries.sha256 /src/
RUN sh /src/fetch-spellcheck-dictionaries.sh /dictionaries

FROM caddy:2.11-alpine AS caddy
RUN setcap -r /usr/bin/caddy

FROM alpine:3.24

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="hearth-static"
LABEL org.opencontainers.image.description="Self-hostable static asset bundle for Hearth"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later AND CC-BY-SA-4.0 AND CC-BY-4.0"
LABEL org.opencontainers.image.vendor="Hearth"
LABEL org.opencontainers.image.url="https://hearth.app"
LABEL org.opencontainers.image.documentation="https://docs.hearth.app"
LABEL org.opencontainers.image.source="https://github.com/hearthapp/hearth"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.hearth.build-version="${BUILD_VERSION}"

RUN apk add --no-cache ca-certificates mailcap

COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY hearth_static/Caddyfile /etc/caddy/Caddyfile
COPY --chown=65532:65532 hearth_static/LICENSE hearth_static/THIRD_PARTY_LICENSES.md /srv/hearth-static/
COPY --chown=65532:65532 hearth_static/avatars /srv/hearth-static/avatars
COPY --chown=65532:65532 hearth_static/badges /srv/hearth-static/badges
COPY --chown=65532:65532 hearth_static/desktop /srv/hearth-static/desktop
COPY --chown=65532:65532 --from=spellcheck-dictionaries /dictionaries /srv/hearth-static/desktop/spellcheck/dictionaries
COPY --chown=65532:65532 hearth_static/email /srv/hearth-static/email
COPY --chown=65532:65532 hearth_static/emoji /srv/hearth-static/emoji
COPY --chown=65532:65532 hearth_static/web /srv/hearth-static/web

RUN mkdir -p /config/caddy /data/caddy \
	&& chown -R 65532:65532 /config /data /srv/hearth-static

ENV XDG_CONFIG_HOME=/config
ENV XDG_DATA_HOME=/data

USER 65532:65532
WORKDIR /srv

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -q -O - http://127.0.0.1:8080/_health | grep -q OK

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
