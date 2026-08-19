# events-cli

Codegen CLI for Hightouch Events (`htevents`). Fetches event contracts and emits typed SDK wrappers so instrumentation is checked at write time instead of after events hit the server.

```sh
pnpm install
pnpm test
pnpm test:harness go
pnpm test:harness browser-ts
htevents init
htevents generate
htevents check
```

Config lives in committed `htevents.config.json` (JSON Schema in `schemas/config.schema.json`). Tokens are never stored there — use `HIGHTOUCH_API_TOKEN` or `--token` when the input is the API.

## Adding an SDK renderer

Shipped targets: `browser-ts`, `go`. Further SDKs are new packages under `src/render/` plus one `switch` case.

**Playbook for humans and agents:** [`src/render/README.md`](src/render/README.md).
