<p align="center">
  <img src="./hearth_static/marketing/branding/logo-color.svg" alt="Hearth logo" width="400">
</p>

# Hearth

Hearth is a self-hosted instant messaging and VoIP chat app for friends,
groups and communities. It is a personal fork of
[Fluxer](https://github.com/fluxerapp/fluxer), rebranded and tuned for
single-host deployments.

## Self-hosting

The stack runs on Podman (rootless) or Docker with Compose:

```sh
deploy/self-hosting/deploy.sh ~/hearth chat.example.com https://chat.example.com
```

See [deploy/self-hosting/README.md](deploy/self-hosting/README.md) for the
full guide, including running behind an existing reverse proxy and the
CrowdSec overlay.

## Fork notes

- `FLUXER_*` remains the runtime environment contract inside containers.
- The operator CLI is `hearthctl` (upstream: `rexctl`).
- App images default to `ghcr.io/sudo-ivan/hearth-*`. Until those are
  published, set `FLUXER_REGISTRY_OWNER=fluxerapp` and
  `FLUXER_APP_IMAGE_PREFIX=fluxer` in `.env` to run the upstream images.
- The default branch is `master`. Issues and pull requests are not used.

## Layout

| Path | Contents |
| --- | --- |
| `hearth_api` | HTTP API and workers (Node) |
| `hearth_app` | Web/desktop client (React) |
| `hearth_gateway` | Realtime gateway (Erlang) |
| `hearth_admin` | Admin panel (Rust/htmx) |
| `hearth_*` services | Rust microservices (users, messages, gifs, unfurl, push, snowflakes, media proxy, app proxy) |
| `hearthctl` | Operator CLI (Go) |
| `packages` | Shared TypeScript packages |
| `deploy` | Helm chart, self-hosting bundle, CrowdSec |

## License

AGPL-3.0-or-later, same as upstream. See [LICENSE](LICENSE).
