# pragmatic-env-gateway — Architecture Index

## Layering

- Container repository of the environment gateway image. Depends only on published packages:
  `pragmatic-env-cluster` (shared with `pragmatic-env-server`), `pragmatic-observability`, `pragmatic-component`,
  `pragmatic-protocol` (transport heartbeat, backpressure, close codes), `redis`, `ws`; `@opentelemetry/api` is
  provided here because pragmatic-env-cluster takes it as a peer (one API per process).
- The gateway never imports environment-server code; the worker side of the contract (`WorkerRegistration`,
  `IWorkerRouter`, `WorkerEndpoint`, `ClusterKeys`, machine headers) lives in pragmatic-env-cluster.

## Entry points

- **Process:** `src/bin/pragmatic-gatewayd.ts` (the image ENTRYPOINT `dist/bin/pragmatic-gatewayd.js`) imports
  `src/bin/gateway-main.ts`: `ServerConfigLoader.LoadGateway(process.env)` → observability, `RedisWorkerRouter`,
  audit sink and rate limit via `HostBootstrap` → `Gateway.StartAsync(GatewayBootstrap.ComposeGatewayOptions(...))`;
  SIGTERM / SIGINT drain and dispose.
- **Options and startup line:** `GatewayBootstrap` — `src/bin/gateway-bootstrap.ts` (the gateway third of the old
  `ServerBootstrap`; the shared pieces are `HostBootstrap` in pragmatic-env-cluster).
- **Component descriptor:** `EnvGatewayComponent` — `src/bin/env-gateway-component.ts`; `src/release-components.ts`
  exports `Components` (`ContainerComponentSource`) for `pragmatic-component-descriptors` in the image build.

## Transport

- `Gateway` — `src/cluster/gateway.ts`: HTTP(S) listener + `WebSocketServer({ noServer: true })`; `/healthz` and
  `/readyz` through `HealthEndpoint` (optionally on a separate health port); upgrades are rate limited, the inbound
  machine fingerprint header is always stripped and re-stamped only from a verified peer certificate, the W3C trace
  context is forwarded; the client upgrade completes only after the worker socket opens. Frames are relayed raw with
  the protocol's backpressure policy (a destination over the hard limit past the grace window is shed). Shutdown drains
  through `DrainController` (503 retryable while draining).
- `RedisWorkerRouter` — `src/cluster/redis-worker-router.ts`: picks a live worker for an environment from the Redis
  directory the workers register in (`ClusterKeys`, `WorkerRegistration`).
- `WorkerTlsName` — `src/cluster/worker-tls-name.ts`: SNI and identity check for the worker dial (DNS name as SNI, an
  IP name checked against that IP).

## Tests

- `src/**/tests/*.test.ts` next to their subjects (copied from pragmatic-server); `src/cluster/tests/fake-redis.ts`
  is the in-memory Redis double, `src/tests/fixtures/tls` the 127.0.0.1 test certificates.
- `src/component/tests/component-golden.ts` / `component-sources.ts`: the golden-descriptor and reader-scan helpers
  (copies; also in other container repositories).
- `tests/descriptor-golden.test.ts`: the released descriptor equals the pragmatic-server golden digest and vendored
  bytes; `tests/singletons.test.ts`: one installed todl-runtime.
- The cluster journeys that run gateway and workers together (drain, rate-limit upgrade, cluster e2e) are
  pragmatic-e2e's.
