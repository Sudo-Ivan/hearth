#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# deploy.sh <target-dir> [domain] [origin]
#
# Copies the compose bundle into <target-dir>, writes .env if missing,
# builds the CrowdSec edge image, and starts the stack.
#
# Engine order:
#   1. docker compose pointed at the Podman API socket (full compose
#      semantics: nested ${} interpolation and !override tags).
#   2. podman-compose, if DOCKER_HOST=unix:///.../podman.sock is unset.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
files="$here/../../hearthctl/internal/stack/files"
target=$(realpath -m "${1:-$HOME/hearth}")
domain=${2:-localhost}
origin=${3:-http://localhost:8080}

compose_args=(-f docker-compose.yml -f docker-compose.proxy.yml -f docker-compose.crowdsec.yml)

for f in docker-compose.yml docker-compose.proxy.yml docker-compose.crowdsec.yml \
	tunnel.compose.yml ipv6.compose.yml external-object-store.compose.yml \
	Caddyfile profiles.json; do
	install -Dm644 "$files/$f" "$target/$f"
done
cp -r "$files/crowdsec" "$target/"
mkdir -p "$target/certs" "$target/caddy.d"

"$here/gen-env.sh" "$target" "$domain" "$origin"

cd "$target"

if command -v podman >/dev/null 2>&1; then
	echo "building hearth-edge-crowdsec with podman"
	podman build -q -t localhost/hearth-edge-crowdsec:v0.14.1 crowdsec/edge
fi

if command -v docker >/dev/null 2>&1 && [ -S "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock" ]; then
	export DOCKER_HOST="unix://${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock"
	exec docker compose --env-file .env "${compose_args[@]}" up -d
elif command -v podman-compose >/dev/null 2>&1; then
	exec podman-compose --env-file .env "${compose_args[@]}" up -d
else
	echo "no compose engine found; install podman-compose or enable the podman socket" >&2
	exit 1
fi
