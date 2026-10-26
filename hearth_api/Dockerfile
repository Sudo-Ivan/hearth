# SPDX-License-Identifier: AGPL-3.0-or-later
ARG BUILD_VERSION

FROM node:26-trixie-slim AS base

WORKDIR /usr/src/app

RUN npm install -g pnpm@11.27.0

FROM base AS deploy

RUN apt-get update && apt-get install -y --no-install-recommends \
		build-essential \
		gcc \
		libssl-dev \
		pkg-config \
		openssl \
		python3 && \
	rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter hearth_api run build
RUN pnpm deploy --legacy --filter=hearth_api --prod --config.allow-unused-patches=true /out && \
	rm -rf /out/pkgs /out/dist

FROM node:26-trixie-slim

ARG BUILD_VERSION
ARG SOURCE_SHA
ARG SOURCE_DATE

LABEL org.opencontainers.image.title="hearth-api"
LABEL org.opencontainers.image.description="Hearth HTTP API and background workers"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Hearth"
LABEL org.opencontainers.image.url="https://hearth.app"
LABEL org.opencontainers.image.documentation="https://docs.hearth.app"
LABEL org.opencontainers.image.source="https://github.com/hearthapp/hearth"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.hearth.build-version="${BUILD_VERSION}"

WORKDIR /usr/src/app/hearth_api

RUN apt-get update && apt-get install -y --no-install-recommends \
		ca-certificates && \
	rm -rf /var/lib/apt/lists/*

COPY --from=deploy --chown=65532:65532 /out ./
COPY --from=deploy --chown=65532:65532 /usr/src/app/hearth_api/dist ./dist
COPY --from=deploy --chown=65532:65532 /usr/src/app/hearth_api/bin ./bin
COPY --from=deploy --chown=65532:65532 /usr/src/app/tsconfigs /usr/src/app/tsconfigs

RUN mkdir -p /run/hearth && \
	chmod 700 /run/hearth && \
	chown 65532:65532 /usr/src/app /usr/src/app/hearth_api /run/hearth

ENV HOME=/usr/src/app
ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ENV BUILD_VERSION=${BUILD_VERSION}

USER 65532:65532

EXPOSE 8080

CMD ["node", "dist/AppEntrypoint.js"]
