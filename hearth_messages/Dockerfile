# SPDX-License-Identifier: AGPL-3.0-or-later

FROM rust:1-trixie AS builder

WORKDIR /usr/src/app

COPY . .

RUN cargo build --release -p hearth-messages --features scylla

FROM debian:trixie-slim

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="hearth-messages"
LABEL org.opencontainers.image.description="Hearth message storage service"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Hearth"
LABEL org.opencontainers.image.url="https://hearth.app"
LABEL org.opencontainers.image.documentation="https://docs.hearth.app"
LABEL org.opencontainers.image.source="https://github.com/sudo-ivan/hearth"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.hearth.build-version="${BUILD_VERSION}"

WORKDIR /usr/local/bin

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

COPY --from=builder /usr/src/app/target/release/hearth-messages /usr/local/bin/hearth-messages

ENV BUILD_VERSION="${BUILD_VERSION}"

USER 65532:65532

EXPOSE 8090

CMD ["/usr/local/bin/hearth-messages"]
