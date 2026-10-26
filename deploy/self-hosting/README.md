# Self-hosting Hearth

Hearth is a self-hosted instant messaging and VoIP stack. This folder holds
the files that run it on a single machine with Podman or Docker Compose.

## Requirements

- Podman 5+ (rootless is fine) or Docker with the Compose plugin
- `openssl` for secret generation
- About 8 GB of free memory and 10 GB of disk for a small instance

`deploy.sh` prefers `docker compose` driven at the Podman API socket
(`systemctl --user enable --now podman.socket`) because it understands the
full compose feature set. `podman-compose` is used as a fallback.

## Quick start

```sh
deploy/self-hosting/deploy.sh ~/hearth chat.example.com https://chat.example.com
```

This writes the compose bundle to `~/hearth`, generates `.env` with fresh
secrets, builds the edge image, and brings the stack up. Arguments are
optional; the defaults deploy on `http://localhost:8080`.

## Compose overlays

List extra files in `COMPOSE_FILE` after `docker-compose.yml`, or pass more
`-f` flags to compose.

| File | Purpose |
| --- | --- |
| `docker-compose.proxy.yml` | Edge listens on `127.0.0.1:8080` plain HTTP for your own reverse proxy |
| `docker-compose.crowdsec.yml` | CrowdSec engine plus a bouncer in the edge |
| `tunnel.compose.yml` | Outbound tunnel instead of listening ports |
| `external-object-store.compose.yml` | Use your own S3 instead of bundled SeaweedFS |
| `ipv6.compose.yml` | IPv6 on the internal network |

## Behind an existing reverse proxy

Use `docker-compose.proxy.yml`. The edge then serves plain HTTP on
`127.0.0.1:8080` and trusts `X-Forwarded-For` from `private_ranges`
(`FLUXER_EDGE_TRUSTED_PROXIES`). Your proxy must:

- terminate TLS for your domain
- forward `X-Forwarded-For`, `X-Forwarded-Proto`, `Host`
- pass WebSocket upgrades on `/gateway` and `/livekit`
- allow large request bodies for uploads

Caddy, nginx and Traefik do all of this for a plain `reverse_proxy`/`proxy_pass`
to `http://127.0.0.1:8080`. Set `FLUXER_PUBLIC_ORIGIN` to the public HTTPS URL.

## CrowdSec

`docker-compose.crowdsec.yml` adds a CrowdSec engine container reading the
edge's JSON access log, and rebuilds the edge Caddy image with
`hslatman/caddy-crowdsec-bouncer` so banned IPs are dropped before they reach
the app.

Installed collections: `caddy`, `linux`, `base-http-scenarios`, `http-cve`,
`appsec-virtual-patching`, `appsec-crs`, `whitelist-good-actors`, plus GeoIP
enrichment. Set `CROWDSEC_ENROLL_KEY` in `.env` to attach the engine to the
CrowdSec console and pull community blocklists.

Useful commands inside the instance folder:

```sh
docker compose exec crowdsec cscli decisions list
docker compose exec crowdsec cscli alerts list
docker compose exec crowdsec cscli bouncers list
```

The bouncer key is `CROWDSEC_BOUNCER_KEY` in `.env`, registered automatically
as bouncer `edge`.

## Layout of a rendered instance folder

```
docker-compose.yml            main stack
docker-compose.*.yml          overlays
Caddyfile                     edge routing
caddy.d/                      extra site directives
crowdsec/                     acquis, edge Containerfile, bouncer snippet
certs/                        optional own certificates
.env                          your settings and secrets
```

## Notes

- `FLUXER_*` remains the runtime environment contract inside the containers;
  only the product and file names changed to Hearth.
- App images default to `ghcr.io/sudo-ivan/hearth-*`; set
  `FLUXER_REGISTRY_OWNER=fluxerapp` and `FLUXER_APP_IMAGE_PREFIX=fluxer` to
  run the upstream build, as `deploy.sh` writes into `.env`.
