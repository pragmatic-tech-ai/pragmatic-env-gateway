# pragmatic-env-gateway

The environment gateway (`pragmatic-gatewayd`, image `ghcr.io/pragmatic-tech-ai/pragmatic-env-gateway`): the public
WebSocket front door of an environment cluster. It reads the `?environment` hint of an upgrade, picks a worker from the
Redis worker directory, dials it over mutual-TLS wss (forwarding the environment, the bearer and the verified client
fingerprint) and relays raw frames both ways. It holds no identity pack and never parses JSON-RPC.

Split out of `pragmatic-server` (dev-kit A3, roadmap 1.3) from `pragmatic-server@2a2e8138`; what it shares with the
environment server (configuration loader, cluster keys, machine TLS, health, rate limiting, audit sinks, observability,
drain, `HostBootstrap`, the worker routing seam) comes from `@pragmatic-tech-ai/pragmatic-env-cluster`.

## Configuration

The gateway reads `PRAGMATIC_*` variables (`ServerConfigLoader.LoadGateway`, declared in
`src/bin/env-gateway-component.ts`). At start the mounted `pragmatic-config-pragmatic-env-gateway` (the tenant admin
console's applied configuration) is laid over them; one the gateway cannot start with exits 78 with the reason.

## Build and test

Packages come from GitHub Packages (`.npmrc`, token in `NODE_AUTH_TOKEN`).

```sh
npm ci
npm run build       # tsc -> dist/
npm test            # src/**/tests + tests/ (descriptor golden, engine singletons)
npm run typecheck   # sources and tests
npx pragmatic-closure-check
```

The Redis router test against a live Redis runs when `PRAGMATIC_TEST_REDIS_URL` is set, else it is skipped.

## Image

`Dockerfile`, `docker-bake.hcl`, `.github/workflows/*` and the `pragmaticClosureCheck` field of `package.json` are
rendered by `pragmatic-container-template` (`@pragmatic-tech-ai/pragmatic-release-toolkit`):

```sh
npx pragmatic-container-template render --app pragmatic-env-gateway --entry src/bin/pragmatic-gatewayd.ts --out .
```

The image carries its component descriptor at `/pragmatic/component.json` (from `dist/release-components.js`) and its
digest as the label `ai.pragmatic-tech.component.digest`. A `v<semver>` tag equal to `package.json`'s version releases
the image (`release.yml`). Port 8080, health `GET /healthz`; configuration is the `PRAGMATIC_*` environment the
descriptor lists (`src/bin/env-gateway-component.ts`).

See `ARCHITECTURE.md` for where things live.
