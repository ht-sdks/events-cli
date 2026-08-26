# @ht-sdks/events-cli

Generate typed wrappers from [Hightouch event contracts](https://hightouch.com/docs/events/contracts/management) so your instrumentation is checked in the editor, not after events reach Hightouch.

The CLI (`htevents`) fetches contracts for an event source and emits wrappers around supported Hightouch Events SDKs ([Browser](https://hightouch.com/docs/events/sdks/browser), [Swift](https://hightouch.com/docs/events/sdks/swift), etc.). You call those wrappers instead of untyped `track` / `identify` methods. Generated code never installs or constructs the SDK — you keep using the SDK you already have.

## Install

Requires [Node.js](https://nodejs.org/) 18 or later, which includes `npm` and `npx`.

```sh
npm install --save-dev @ht-sdks/events-cli
```

Run it from the project directory with `npx`:

```sh
npx htevents --help
```

A local install does not put `htevents` on your `PATH`; `npx` resolves the copy in `node_modules`. To put it on your `PATH`, install globally with `npm install -g @ht-sdks/events-cli`. Prefer the local install above so the CLI version stays pinned in CI and shared project environments.

If your repo has no `package.json` (for example, a Swift or Android app), `npm install --save-dev` will create one. You can also run the CLI without adding a dependency using:

```sh
npx @ht-sdks/events-cli --help
```

Install the Events SDK for your platform separately. Generated files declare the peer package they wrap.

## Getting Started

1. Create at least one [event contract](https://hightouch.com/docs/events/contracts/management) and attach its domain to an event source.
2. Copy the source **Slug** from the event source **Setup** tab in Hightouch.
3. From your application repository, create a configuration file:

```sh
npx htevents init
```

`init` asks for the source slug, how to load contracts, which SDK to generate for, and where to write output. It writes `htevents.config.json`.

4. If you chose API input, provide a [workspace API key](https://hightouch.com/docs/developer-tools/api-guide) as `HIGHTOUCH_API_TOKEN` or `--token`. Do not put the token in the configuration file.
5. Generate wrappers:

```sh
export HIGHTOUCH_API_TOKEN="htk_..."
npx htevents generate
```

6. Initialize your Events SDK as usual, then call the generated functions.

TypeScript (browser) example after generating for `browser-ts`:

```ts
import { HtEventsBrowser } from '@ht-sdks/events-sdk-js-browser';
import { setHtEvents, trackOrderCompleted } from './src/analytics/generated';

const analytics = HtEventsBrowser.load(
  { writeKey: 'WRITE_KEY' },
  { apiHost: 'us-east-1.hightouch-events.com' },
);
setHtEvents(analytics);

trackOrderCompleted({ orderId: 'abc-123', total: 49.99 });
```

Other SDKs follow the same idea: call a generated function (or method) instead of the raw SDK call. Some languages take the SDK client as an argument instead of `setHtEvents`.

Commit `htevents.config.json`. You can commit the generated sources and `htevents.lock.json`, or gitignore them and run `htevents generate` after clone and in CI. Do not edit generated files. Re-run `htevents generate` when contracts change.

## Configuration

`htevents.config.json` is the committed configuration. Tokens are never stored there.

```json
{
  "$schema": "./node_modules/@ht-sdks/events-cli/schemas/config.schema.json",
  "source": "web-app",
  "input": { "type": "api" },
  "outputs": [{ "sdk": "browser-ts", "path": "./src/analytics/generated.ts" }]
}
```

| Field     | Description                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------- |
| `source`  | Event source slug from the source **Setup** tab. Not the write key.                                  |
| `input`   | Where contracts come from. `api` fetches from Hightouch. `git-sync` reads a local Git Sync checkout. |
| `outputs` | One or more SDK targets and output paths.                                                            |

### API input

```json
{ "type": "api" }
```

Requires a token at generate/check time:

```sh
export HIGHTOUCH_API_TOKEN="htk_..."
npx htevents generate
# or
npx htevents generate --token "htk_..."
```

`--token` overrides `HIGHTOUCH_API_TOKEN`.

### Git Sync input

If you [version-control contracts with Git Sync](https://hightouch.com/docs/extensions/git-sync#event-contract-schema), point the CLI at that checkout. No API token is required.

```json
{
  "input": { "type": "git-sync", "path": "./events" }
}
```

`path` can be the Git repository root (the CLI looks for `events/domains` or `events/contracts`) or the `events` directory itself.

### Multiple outputs

Add an entry per SDK. Paths are relative to the configuration file.

```json
{
  "outputs": [
    { "sdk": "browser-ts", "path": "./src/analytics/generated.ts" },
    { "sdk": "node-ts", "path": "./server/analytics/generated.ts" }
  ]
}
```

PHP writes a directory of files. Set `path` to that directory.

### Generated names

Each contract version becomes a wrapper whose name includes the event type, name, and version: `Order Completed` version `v2` becomes `trackOrderCompletedV2` (or `track_order_completed_v2` in snake_case languages).

The latest version of each event also gets an unversioned alias (`trackOrderCompleted`). Wrappers inject the schema version so Hightouch validates against the matching contract.

## Commands

```text
htevents [options] [command]
```

**Global options**

| Option                | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `-c, --config <path>` | Configuration file. Default: `./htevents.config.json` |
| `--token <token>`     | Workspace API token. Overrides `HIGHTOUCH_API_TOKEN`  |
| `--debug`             | Print stack traces                                    |
| `-V, --version`       | CLI version                                           |

### `htevents init`

Create `htevents.config.json`. Interactive in a TTY. Non-interactive runs need `--source`, `--input`, and `--output` (and `--git-sync-path` when `--input git-sync`).

```sh
npx htevents init \
  --source web-app \
  --input api \
  --sdk browser-ts \
  --output ./src/analytics/generated.ts
```

| Option                   | Description                              |
| ------------------------ | ---------------------------------------- |
| `--source <slug>`        | Event source slug                        |
| `--input <type>`         | `api` or `git-sync`                      |
| `--git-sync-path <path>` | Local Git Sync directory (git-sync only) |
| `--sdk <sdk>`            | Target SDK. Default: `browser-ts`        |
| `--output <path>`        | Output path for generated code           |
| `--force`                | Overwrite an existing configuration file |

### `htevents generate`

Load contracts and write typed wrappers plus `htevents.lock.json` next to the configuration file.

### `htevents check`

Rebuild the expected output and compare it to files on disk. Exits `0` when they match. Exits `2` when they differ (including missing files), and prints:

```text
Generated files are out of date:
  src/analytics/generated.ts
Run `htevents generate` to update.
```

Use this in CI when generated files are committed. If those files are gitignored, run `htevents generate` before you compile instead.

```sh
npx htevents check
```

## Supported SDKs

| `outputs[].sdk` | Peer SDK                                                                                      | Default output path                       |
| --------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `browser-ts`    | [`@ht-sdks/events-sdk-js-browser`](https://hightouch.com/docs/events/sdks/browser)            | `./src/analytics/generated.ts`            |
| `node-ts`       | [`@ht-sdks/events-sdk-js-node`](https://hightouch.com/docs/events/sdks/nodejs)                | `./src/analytics/generated.ts`            |
| `python`        | [`events-sdk-python`](https://hightouch.com/docs/events/sdks/python)                          | `./analytics/generated.py`                |
| `ruby`          | [`events-sdk-ruby`](https://hightouch.com/docs/events/sdks/ruby)                              | `./analytics/generated.rb`                |
| `php`           | [`ht-sdks/events-sdk-php`](https://hightouch.com/docs/events/sdks/php)                        | `./src/Hightouch/Generated/`              |
| `csharp`        | [`Hightouch.Events.CSharp`](https://hightouch.com/docs/events/sdks/csharp)                    | `./Analytics/HtEvents.cs`                 |
| `go`            | [`github.com/ht-sdks/events-sdk-go`](https://hightouch.com/docs/events/sdks/go)               | `./analytics/generated.go`                |
| `swift`         | [`events-sdk-swift`](https://hightouch.com/docs/events/sdks/ios)                              | `./Sources/Analytics/Generated.swift`     |
| `android`       | [`com.hightouch.analytics.android:analytics`](https://hightouch.com/docs/events/sdks/android) | `./src/main/java/analytics/HtEvents.java` |
| `kotlin`        | `com.github.ht-sdks.events-sdk-kotlin:core`                                                   | `./src/main/kotlin/analytics/HtEvents.kt` |
| `java`          | [`com.github.ht-sdks.events-sdk-java:analytics`](https://hightouch.com/docs/events/sdks/java) | `./analytics/HtEvents.java`               |

Generated files record the minimum peer SDK version they were tested against.

This package is the Events codegen CLI (`htevents`). It is not the [Hightouch CLI](https://hightouch.com/docs/developer-tools/cli-guide) (`ht`), which manages workspace resources such as models and syncs.

## Contributing

This repository is the CLI implementation. Generated wrappers live in the consuming application, not here.

- Renderer playbook (for humans and agents): [`src/render/README.md`](src/render/README.md)
- JSON Schema for `htevents.config.json`: [`schemas/config.schema.json`](schemas/config.schema.json)
- Cutting a release: [`RELEASING.md`](RELEASING.md)

```sh
pnpm install
pnpm test
pnpm test:harness:all
```

## License

[MIT](LICENSE)
