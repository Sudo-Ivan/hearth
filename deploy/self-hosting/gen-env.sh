#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# gen-env.sh <target-dir> [domain] [origin]
# Writes <target-dir>/.env with fresh secrets. Existing .env is not touched.
set -euo pipefail

target=${1:?folder to write .env into}
domain=${2:-localhost}
origin=${3:-http://localhost:8080}
env="$target/.env"

[ -f "$env" ] && { echo ".env already exists at $env"; exit 0; }

hex32() { openssl rand -hex 32; }

# VAPID keypair (P-256) for web push.
vapid_pem=$(mktemp)
openssl ecparam -genkey -name prime256v1 -noout -out "$vapid_pem"
vapid_pub=$(openssl ec -in "$vapid_pem" -pubout -outform DER 2>/dev/null | tail -c 65 | basenc --base64url | tr -d '\n=')
vapid_priv=$(openssl ec -in "$vapid_pem" -noout -text 2>/dev/null \
	| awk '/^priv:/{f=1;next}/^pub:/{f=0}f' | tr -d ' :\n' | xxd -r -p | basenc --base64url | tr -d '\n=')
rm -f "$vapid_pem"

cat > "$env" <<ENVEOF
# Hearth instance settings. Generated $(date -u +%Y-%m-%dT%H:%M:%SZ).

FLUXER_SETTINGS_LOADED=true

FLUXER_DOMAIN=$domain
FLUXER_PUBLIC_ORIGIN=$origin
FLUXER_PUBLIC_SCHEME=http
FLUXER_PUBLIC_PORT=8080

# Upstream image set. Point these at ghcr.io/sudo-ivan once the fork
# publishes its own images.
FLUXER_REGISTRY_OWNER=fluxerapp
FLUXER_APP_IMAGE_PREFIX=fluxer
FLUXER_IMAGE_TAG=v1

# Postgres identity. Set explicitly: the compose default differs from the
# upstream image's built-in fallback, so both sides must agree.
FLUXER_POSTGRES_USERNAME=hearth
FLUXER_POSTGRES_DATABASE=hearth
POSTGRES_PASSWORD=$(hex32)
MEILI_MASTER_KEY=$(hex32)
FLUXER_S3_ACCESS_KEY=hearth
FLUXER_S3_SECRET_KEY=$(hex32)
LIVEKIT_API_KEY=hearth
LIVEKIT_API_SECRET=$(hex32)

FLUXER_SUDO_MODE_SECRET=$(hex32)
FLUXER_CONNECTION_INITIATION_SECRET=$(hex32)
FLUXER_PROFILE_PSEUDONYM_SECRET=$(hex32)
FLUXER_GATEWAY_RPC_AUTH_TOKEN=$(hex32)
FLUXER_ERLANG_COOKIE=$(hex32)
FLUXER_MEDIA_PROXY_SECRET_KEY=$(hex32)
FLUXER_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64=$(openssl rand -base64 32)
FLUXER_ADMIN_SECRET_KEY_BASE=$(hex32)
FLUXER_ADMIN_OAUTH_CLIENT_SECRET=$(hex32)
FLUXER_VAPID_PUBLIC_KEY=$vapid_pub
FLUXER_VAPID_PRIVATE_KEY=$vapid_priv
FLUXER_VAPID_EMAIL=admin@$domain

# CrowdSec
CROWDSEC_BOUNCER_KEY=$(hex32)

# Behind an existing reverse proxy: edge listens on 127.0.0.1:8080 plain
# HTTP and trusts the local proxies for client IPs.
FLUXER_EDGE_BIND=127.0.0.1:8080
FLUXER_EDGE_TRUSTED_PROXIES=private_ranges
FLUXER_TRUST_CLIENT_IP_HEADER=true

COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml:docker-compose.crowdsec.yml
ENVEOF
chmod 600 "$env"
echo "wrote $env"
