# SPDX-License-Identifier: AGPL-3.0-or-later
FROM erlang:28.5.0.8-slim AS build

ARG RUST_TOOLCHAIN=1.98.1

ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	curl \
	make \
	gcc \
	g++ \
	libc6-dev \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN curl --retry 5 --retry-delay 2 --retry-all-errors -fsSL https://github.com/erlang/rebar3/releases/download/3.27.3/rebar3 -o /usr/local/bin/rebar3 && \
	chmod +x /usr/local/bin/rebar3

RUN curl --retry 5 --retry-delay 2 --retry-all-errors --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | \
	sh -s -- -y --profile minimal --default-toolchain "${RUST_TOOLCHAIN}"

COPY . .
WORKDIR /usr/src/app/hearth_gateway
RUN rebar3 compile --deps_only

RUN cp config/sys.config.template config/sys.config && \
	rebar3 as prod release

FROM erlang:28.5.0.8-slim

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="hearth-gateway"
LABEL org.opencontainers.image.description="Hearth realtime gateway"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Hearth"
LABEL org.opencontainers.image.url="https://hearth.app"
LABEL org.opencontainers.image.documentation="https://docs.hearth.app"
LABEL org.opencontainers.image.source="https://github.com/hearthapp/hearth"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.hearth.build-version="${BUILD_VERSION}"

WORKDIR /opt/hearth_gateway

RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	curl \
	libstdc++6 \
	&& rm -rf /var/lib/apt/lists/* && \
	groupadd -r -g 65532 hearth && \
	useradd -r -u 65532 -g 65532 -s /sbin/nologin -d /opt/hearth_gateway hearth && \
	chown 65532:65532 /opt/hearth_gateway

COPY --from=build --chown=65532:65532 /usr/src/app/hearth_gateway/_build/prod/rel/hearth_gateway .
COPY --chown=65532:65532 hearth_gateway/scripts/docker_entrypoint.sh /opt/hearth_gateway/bin/docker_entrypoint.sh
COPY --chown=65532:65532 hearth_gateway/scripts/hearth_gateway_release_wrapper.sh /opt/hearth_gateway/bin/hearth_gateway.wrapper

RUN mv /opt/hearth_gateway/bin/hearth_gateway /opt/hearth_gateway/bin/hearth_gateway.real && \
	mv /opt/hearth_gateway/bin/hearth_gateway.wrapper /opt/hearth_gateway/bin/hearth_gateway

USER 65532:65532

ENV BUILD_VERSION="${BUILD_VERSION}"

EXPOSE 8080 8081 4369

ENTRYPOINT ["/opt/hearth_gateway/bin/docker_entrypoint.sh"]
