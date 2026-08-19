# Adding an SDK renderer

This is the playbook for adding a new `outputs[].sdk` target. It is written so an agent can do the bulk of the work without inventing architecture.

The CLI is one Node/TS package (`@ht-sdks/events-cli`, binary `htevents`). Each renderer turns **already-normalized** event contracts into typed wrappers around a **peer** Hightouch SDK. Generated code never constructs, pins, or installs that SDK.

**Do not touch** input loading, `$ref` flattening, envelope unwrap, wrapper naming, or the lockfile unless a renderer truly cannot work without a shared change. Those stages are SDK-agnostic on purpose.

### References (copy the closer one)

- JS/TS: `src/render/browser-ts/` — Jest snapshots plus `test/harness/browser-ts/`
- Non-JS: `src/render/go/` — Jest snapshots plus `test/harness/<id>/`

### Shared helpers (`src/render/shared/`)

Check here before copying. Add to this list when you extract something:

- `sort.ts` — `byWrapperName`
- `header.ts` — `headerLines` (CLI version + peer pin; wrap per language)
- `quicktype-input.ts` — JSON Schema sources for quicktype

Keep language syntax, peer-SDK call shapes, and generated injection helpers in `src/render/<sdk-id>/`. Do **not** move `setAtPath` / `withSchemaVersion` into `shared/` — those are emitted into the customer's file and must match that SDK. `wrappers-emit.ts` is per SDK on purpose (quicktype is types only).

---

## Shipped

Append a bullet when a renderer lands:

- `browser-ts`
- `go`

## Harness (real SDK)

Wire tests against the peer SDK. Separate workflow files so PRs do not all edit `ci.yml`. Append one of each when a renderer lands (JS included — `browser-ts` is the template):

- `test/harness/<id>/` — committed language tests; generated output gitignored
- Shared extra contracts: `test/harness/extra-events.ts`
- `case` in `scripts/run-harness.ts`
- `.github/workflows/<id>-harness.yml` — reuse `.github/actions/setup-cli`; do not add this job to the Node 18–24 matrix

Package pin:

- JS/TS: the CLI `devDependency` (already on the Node job for `ts.createProgram`)
- Other languages: pin in `test/harness/<id>/` (`go.mod`, `requirements.txt`, …)

```sh
pnpm test:harness <id>
# CI sets RUN_HARNESS=1 (fail if the toolchain is missing).
# Locally skip if the binary is absent, unless RUN_HARNESS=1.
# The Node job (`pnpm test`) never runs this.
```

---

## Done when

1. `htevents init --sdk <id>` and `htevents.config.json` accept the new SDK identifier.
2. `htevents generate` writes idiomatic wrappers that call the real peer SDK.
3. Snapshot tests cover `simple-track.json`, `multi-version.json`, and `with-refs.json`.
4. Behavioral tests prove SDK method calls and schema-version injection (see [Invariants](#invariants)). Arg-level JS checks stay in Jest; **wire** tests live in `test/harness/<id>/` (real client + HTTP capture).
5. Generated output typechecks against the peer SDK. JS/TS: `ts.createProgram` in this package. Other languages: `test/harness/<id>/` with a package-manager pin.
6. `pnpm test` and `pnpm run check:schema` pass. `pnpm test:harness <id>` passes in that SDK's workflow.

---

## Pipeline

```
htevents.config.json
        │
        ▼
  loadContracts  →  normalize  →  renderSdk(sdk, events)  →  write files
                         │                    │
                         │                    └── src/render/<sdk-id>/
                         └── NormalizedEvent[] (lockfile hashes these)
```

| Stage                    | Path                                         | Renderer may change?                                                 |
| ------------------------ | -------------------------------------------- | -------------------------------------------------------------------- |
| Config schema            | `src/config/schema.ts`                       | Yes — add the id to `SUPPORTED_SDKS`                                 |
| Dispatch                 | `src/render/index.ts`                        | Yes — add a `case`                                                   |
| Contract fetch/parse     | `src/input/`                                 | No                                                                   |
| Flatten / unwrap / names | `src/normalize/`                             | No                                                                   |
| Lockfile                 | `src/lockfile/`                              | No                                                                   |
| Write + `check` drift    | `src/pipeline/artifacts.ts`, `src/commands/` | Only if returning multiple files (see [Output shape](#output-shape)) |

`normalize()` is the renderer contract. Every target receives the same `NormalizedEvent[]`.

### `NormalizedEvent` (from `src/normalize/types.ts`)

| Field               | Meaning                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`              | `track` \| `identify` \| `page` \| `screen` \| `group` \| `alias`                                                                                                                                                             |
| `name`              | Event name for `track` / `page` / `screen`. Omitted for `identify` / `group` / `alias` when the contract has no name.                                                                                                         |
| `version`           | Schema version string (`default`, `v1`, …). Inject this at `schemaVersionPath`.                                                                                                                                               |
| `envelopeKey`       | `properties` (track/page/screen/alias) or `traits` (identify/group).                                                                                                                                                          |
| `schema`            | Self-contained JSON Schema for the **unwrapped** payload. Safe to pass to quicktype. Do not unwrap or flatten again.                                                                                                          |
| `schemaVersionPath` | Path on the Segment-style payload where the router reads the version, e.g. `["context","protocols","schemaVersion"]`. May be absent.                                                                                          |
| `wrapperName`       | Canonical function id, already version-suffixed, e.g. `trackOrderCompletedV2`. **Stable identity** (also stored in the lockfile). Transliterate for the target language; do not rename from `type`+`name`+`version` yourself. |
| `latestAlias`       | Unsuffixed name for the latest version only, e.g. `trackOrderCompleted`. Emit as an alias of `wrapperName`.                                                                                                                   |

Latest-version policy lives in `src/normalize/index.ts`: prefer `version === "default"` if present, else last in input order. Renderers must not re-decide latest.

---

## Step-by-step

Do these in order.

### 1. Pick the config id and read the peer SDK

Choose a kebab-case id (`swift`, `kotlin`, `go`, `node`, …). Then **read the peer SDK's public API** from its repo in [`ht-sdks`](https://github.com/orgs/ht-sdks/repositories) before writing wrappers. Match real method names, parameter order, and options/context types. Do not copy Segment Typewriter signatures or guess.

Do not target archived repos:

- `events-sdk-js` → `events-sdk-js-mono`
- `events-sdk-node` → `events-sdk-js-mono` `packages/node`
- `events-sdk-ios` → `events-sdk-swift`

| Planned id     | quicktype `lang` | Peer SDK                                                                                         | Notes                                                                                    |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `browser-ts`   | `typescript`     | [`ht-sdks/events-sdk-js-mono`](https://github.com/ht-sdks/events-sdk-js-mono) `packages/browser` | Shipped. JS/TS reference.                                                                |
| `go`           | `go`             | [`ht-sdks/events-sdk-go`](https://github.com/ht-sdks/events-sdk-go)                              | Shipped. `client.Enqueue(htevents.Track{…})`; structs + `json` tags; `just-types: true`. |
| `swift`        | `swift`          | [`ht-sdks/events-sdk-swift`](https://github.com/ht-sdks/events-sdk-swift)                        | Next. Mobile: `screen`, not `page`. Codable types.                                       |
| `kotlin`       | `kotlin`         | [`ht-sdks/events-sdk-kotlin`](https://github.com/ht-sdks/events-sdk-kotlin)                      | Next. Android/JVM Kotlin SDK (not the Java Android SDK). `screen`, not `page`.           |
| `node`         | `typescript`     | [`ht-sdks/events-sdk-js-mono`](https://github.com/ht-sdks/events-sdk-js-mono) `packages/node`    | Object-style methods (`track({ event, properties, … })`), not positional.                |
| `react-native` | `typescript`     | [`ht-sdks/events-sdk-react-native`](https://github.com/ht-sdks/events-sdk-react-native)          | Likely `.tsx` if JSX is required; otherwise `.ts`.                                       |
| `android`      | `java`           | [`ht-sdks/events-sdk-android`](https://github.com/ht-sdks/events-sdk-android)                    | Java Android SDK. Distinct from `kotlin` and server `java`. `screen`, not `page`.        |
| `flutter`      | `dart`           | [`ht-sdks/events-sdk-flutter`](https://github.com/ht-sdks/events-sdk-flutter)                    | Mobile: `screen`, not `page`.                                                            |
| `python`       | `python`         | [`ht-sdks/events-sdk-python`](https://github.com/ht-sdks/events-sdk-python)                      | `htevents.track(user_id, event, properties)` (user id is required on server calls).      |
| `ruby`         | `ruby`           | [`ht-sdks/events-sdk-ruby`](https://github.com/ht-sdks/events-sdk-ruby)                          | Keyword args: `analytics.track(user_id:, event:, properties:)`.                          |
| `php`          | `php`            | [`ht-sdks/events-sdk-php`](https://github.com/ht-sdks/events-sdk-php)                            | Array payloads: `Hightouch::track(['event' => …, 'userId' => …])`.                       |
| `csharp`       | `csharp`         | [`ht-sdks/events-sdk-csharp`](https://github.com/ht-sdks/events-sdk-csharp)                      |                                                                                          |
| `java`         | `java`           | [`ht-sdks/events-sdk-java`](https://github.com/ht-sdks/events-sdk-java)                          | Server JVM SDK. Not Android (`events-sdk-android`) and not Kotlin (`events-sdk-kotlin`). |

`page` exists on browser/node. Mobile SDKs use `screen`. Map per SDK; do not emit an identical surface for every target.

### 2. Add the id to the config enum

- Append to `SUPPORTED_SDKS` in `src/config/schema.ts`.
- Add a `defaultOutputPath` case (`./src/analytics/generated.ts` for TS; a package directory + file for Go-like languages).
- Extend `DEFAULT_OUTPUT_PATHS` in `test/init.collect.test.ts` (`satisfies Record<SupportedSdk, string>`).
- `pnpm run generate:schema` (required; CI checks this).
- Refresh `test/__snapshots__/help.test.ts.snap` by running tests.

### 3. Mimic the package layout

Create `src/render/<sdk-id>/`. Reuse `src/render/shared/` first.

| File               | Responsibility                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `index.ts`         | `render<Id>(events): Promise<string>` — sort, stitch header + types + wrappers            |
| `constants.ts`     | `MIN_SDK_PACKAGE`, `MIN_SDK_VERSION` (documented minimum, never pinned in generated code) |
| `header.ts`        | Wrap `headerLines` in language comment syntax                                             |
| `types-emit.ts`    | `buildQuicktypeInput` + `quicktype({ lang, rendererOptions })`                            |
| `wrappers-emit.ts` | instance binding + **generated helpers below** + per-event SDK calls                      |

Register it in `src/render/index.ts`:

```ts
switch (sdk) {
  case 'browser-ts':
    return renderBrowserTs(events);
  case '<sdk-id>':
    return render<Id>(events);
  default: {
    const exhaustive: never = sdk;
    throw new Error(`Unsupported SDK: ${String(exhaustive)}`);
  }
}
```

Keep the `default` / `never` branch. TypeScript will fail the build if `SUPPORTED_SDKS` gains an id with no `case`.

### 4. Emit types with quicktype

Follow `src/render/browser-ts/types-emit.ts` / `src/render/go/types-emit.ts`:

- `buildQuicktypeInput(events, typeNameFor)` (sets `schema.title` and `$schema`).
- `quicktype({ inputData, lang: '<lang>', rendererOptions })`.
- Preserve JSON property names (`nice-property-names: false` in TypeScript; Go `json` tags).
- Prefer `just-types: true` when the language can express types separately from marshaling. Swift is the exception: Typewriter forces full types + `Codable` because `just-types` breaks JSON compatibility. If you subclass a quicktype renderer, do it only for this kind of language constraint.

`event.schema` is already flattened (`src/normalize/flatten.ts`) and envelope-unwrapped (`src/normalize/envelope.ts`). Nested `$ref`s to components will not appear. `FetchingJSONSchemaStore` is still required by `JSONSchemaInput`.

Identifier helpers: reuse `toPascalCase` from `src/normalize/names.ts`. Add a language-specific transliterator in the renderer (Go exported names, Python `snake_case`) rather than changing `wrapperName` upstream.

### 5. Emit wrappers

Follow the closer `wrappers-emit.ts` and the [invariants](#invariants) below. Quicktype does **not** emit these.

**Must emit per SDK** (string-concatenated generated source — not CLI runtime, not `src/render/shared/`). Copy the _jobs_, not the syntax. browser-ts inlines them at the top of `renderWrappers`; Go puts them in `renderHelpers()`. Either layout is fine.

| Job                         | browser-ts                              | go                                    | Why it cannot be shared                                                |
| --------------------------- | --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Bind to an existing client  | `setHtEvents` + `requireAnalytics`      | `client` argument on every func       | module singleton vs `Enqueue` receiver                                 |
| Clone-on-write nested write | `setAtPath`                             | `setAtPath` + `cloneMap`              | TS spread vs Go maps                                                   |
| Version-injection policy    | `withSchemaVersion` → `options.context` | `withSchemaVersion` → `Context.Extra` | [rules](#schema-version-injection) are shared; the write target is not |
| Typed payload → SDK map     | (already a JS object)                   | `toMap` (`json` tags)                 | only if the type is not already a map                                  |
| Clone typed context         | (plain object spread)                   | `cloneContext`                        | only if context is a struct                                            |

Optional extras that also stay per SDK: options bag (`CallOptions`), identify/group overloads, `latestAlias` shape (`export const` vs forwarding `func`).

Then:

- For each event, emit `wrapperName` and, when set, `latestAlias = wrapperName`.
- Call the peer SDK method for `event.type` (after page/screen mapping).
- Call the generated `withSchemaVersion` from every wrapper.
- Sort events by `wrapperName` before emitting (stable diffs).

### 6. Tests

Jest snapshots prove **string drift**. They do not prove compile or SDK behavior.

**JS/TS** (`browser-ts`, later `node` / `react-native`):

- `test/render.<sdk-id>.test.ts` — snapshots, header, type names, sort, alias has no properties payload
- `test/render.<sdk-id>.wrappers.test.ts` — SDK **args** (Jest mock) + version-injection matrix
- `test/render.<sdk-id>.compile.test.ts` — `ts.createProgram` against the npm `devDependency`
- `test/harness/<id>/` — real client + local HTTP server; generated source gitignored (copy `browser-ts`)

**Non-JS** (copy `test/harness/go/`):

- `test/render.<sdk-id>.test.ts` — same three domain-fixture snapshots
- `test/harness/<id>/` — real client + httptest (or equivalent); generated source gitignored
- Fixture generator (`scripts/emit-<id>-harness.ts`) — runs the renderer, not quicktype directly; extra event types live in `test/harness/extra-events.ts`

Snapshots: `it.each(['simple-track.json', 'multi-version.json', 'with-refs.json'])`.

Behavioral coverage:

- Throws / no-ops until bound (JS `setHtEvents`; skip if wrappers take the client as an argument)
- `track` with event name + properties
- `latestAlias` hits the same path as the versioned wrapper
- `identify` with id + traits (traits-only if the SDK allows it)
- `group` with group id + traits
- `alias` with to / optional from; **never** a properties object
- The [version-injection matrix](#schema-version-injection)

Compile harness is CLI test infrastructure, not something `htevents generate` does for customers.

- JS/TS: npm `devDependency` + `ts.createProgram`
- Package-manager languages: pin in `test/harness/<id>/` (`go.mod`, `requirements.txt`, …). Do not put them in this package's `package.json`.
- Clone-from-GitHub: Swift SPM, Android AAR, and similar — not the default when a registry pin exists
- Assert parsed fields, not byte-equal SDK fixtures (`messageId` / `timestamp` / `sentAt` / library)

Minimum SDK version belongs in `constants.ts` and the generated header.

### 7. Run

```sh
pnpm test
pnpm run lint
pnpm run check:schema
pnpm test:harness <id>
```

---

## Invariants

These are product rules, not TypeScript-isms. Port them faithfully.

### Wrapper names

- Every version emits `wrapperName` (already suffixed by normalize).
- Only the latest version also emits `latestAlias`.
- Collision detection is already done in normalize. If you transliterate names, check that two canonical names cannot collapse (e.g. case-insensitive filesystems, Go export rules). If they can, fail with `CliError` in the renderer.

### Instance binding

Generated code is a wrapper, not a new SDK. The app already constructed the client.

- Browser-ts: module-level `setHtEvents(instance)`
- Go: functions that take the client, or methods on a wrapper struct
- Swift: `extension Analytics` methods, or a small type that holds `Analytics`
- Kotlin/Android: methods on a class constructed with `Analytics`
- Node: `setHtEvents` like browser, or a factory `withAnalytics(client)`

Never call `new Analytics(writeKey)` inside generated code. Never add a dependency manifest that pins the SDK (that fights the app's own install).

### Event → SDK call

| `event.type` | Data argument | Typical SDK call                                                                                                             |
| ------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `track`      | `properties`  | `track(<event.name>, properties, options)`                                                                                   |
| `page`       | `properties`  | Browser/node: `page(...)`. Mobile: map to `screen` if the SDK has no `page`.                                                 |
| `screen`     | `properties`  | `screen(...)`. Browser: SDK has `screen` as well; still emit `screen` for `type: screen`.                                    |
| `identify`   | `traits`      | Overloads: `(userId, traits?, options?)` and `(traits?, options?)` when the SDK allows it.                                   |
| `group`      | `traits`      | `(groupId, traits?, options?)`.                                                                                              |
| `alias`      | **none**      | `(to, from?, options?)`. Do not emit a properties/traits parameter. `schema` may be an empty object; ignore it as a payload. |

For `track`, the event name passed to the SDK is `event.name ?? event.type` (see `sdkCall` in `wrappers-emit.ts`).

For named `page` / `screen`, browser-ts calls `htevents.page(undefined, name, data, options)` so the name is the page name, not a category. Re-read the peer SDK before copying that arity.

### Schema version injection

Port of event-router `getCacheKey`. Re-implement as **generated** `withSchemaVersion` in that language's `wrappers-emit.ts` (see [Must emit per SDK](#5-emit-wrappers)). The router walks the **full Segment payload** at `schemaVersionPath`. Wrappers must write `event.version` onto the object the SDK will send, using only the arguments that SDK method has:

| Path head                                             | Applies to                   | Where to write                                                   |
| ----------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| this event's `envelopeKey` (`properties` or `traits`) | that event only              | mutate the properties/traits argument                            |
| `context`                                             | all types, including `alias` | mutate `options.context` (or the SDK's equivalent)               |
| anything else, empty, or absent                       | —                            | **no injection** (router falls back to `default_schema_version`) |
| `properties.*` on identify/group                      | —                            | **no injection** (wrong envelope)                                |
| `traits.*` on track/page/screen                       | —                            | **no injection**                                                 |
| `properties.*` on alias                               | —                            | **no injection** (alias has no properties argument)              |

Clone-on-write: do not mutate the caller's objects. Each SDK's generated `setAtPath` + `withSchemaVersion` must implement this. Port the behavior, not the helper source.

Required behavioral cases (`test/render.wrappers.test.ts`, `test/harness/browser-ts/wrappers.test.ts`, `test/harness/go/analytics/wrappers_test.go`):

1. `context.protocols.schemaVersion` on track → options.context.
2. `properties.apiVersion` on track → properties.
3. `traits.apiVersion` on identify → traits.
4. `properties.*` on identify → unchanged traits, no options mutation.
5. `traits.*` on track → unchanged properties.
6. `context.*` on alias → options.context; still no properties argument.
7. `properties.*` on alias → no injection, no properties argument.

### Header

```
Generated by @ht-sdks/events-cli@<cli version> — do not edit.
Requires peer <package>@^<min version> or later.
```

Use `headerLines` from `src/render/shared/header.ts` (calls `cliPackage()`). Do not hardcode the CLI version. `<package>` is the name the target language uses for the peer (npm package, SPM URL, Maven coordinate, Go module path) — documentation, not an install step.

### Constraints quicktype cannot express

Regex, min/max, etc. stay as doc comments on the generated types if the language has them. No runtime validation in this iteration.

---

## Output shape

Today `renderSdk` returns one `string`. `buildArtifacts` writes it to `output.path` (resolved relative to the config file directory).

If a language needs multiple files (e.g. `Types.swift` + `HtEvents.swift`):

1. Change `renderSdk` to return `ArtifactFile[]` (see `src/pipeline/artifacts.ts`).
2. Treat `output.path` as a **directory**.
3. Keep `generate` / `check` writing and diffing every file, including the lockfile.
4. Do this in the same PR as the first multi-file renderer. Do not invent a parallel write path.

Markdown API docs are a **separate** renderer (not part of an SDK PR).

---

## What not to do

- Do not re-flatten `$ref`s or unwrap `properties` / `traits`. Normalize already did.
- Do not change `wrapperName` / `latestAlias` in `src/normalize/names.ts` for one language.
- Do not put API tokens, write keys, or workspace ids in generated code.
- Do not `npm install` / pin the peer SDK from generated output, and do not auto-install it during `generate` / `check`. The customer's app owns that dependency.
- Do not add non-JS SDKs to this package's `devDependencies`. Pin them in `test/harness/<id>/` instead.
- Do not add a new `package.json` script per SDK; extend `scripts/run-harness.ts`.
- Do not put a harness (JS or not) on the Node version matrix; add `.github/workflows/<id>-harness.yml`.
- Do not subclass quicktype's renderer unless the language requires it (Swift `Codable` is the known case). Prefer `quicktype()` + string-concatenated wrappers.
- Do not copy Typewriter Handlebars templates verbatim. Use them as a hint for call shape, then match **our** SDKs and **our** version-injection rules.
- Do not leave duplicated **CLI** renderer logic in place once a second copy exists. Extract into `src/render/shared/` and switch both call sites in the same PR.
- Do **not** extract the [Must emit per SDK](#5-emit-wrappers) helpers. Those belong in each `wrappers-emit.ts` even when both files have a `setAtPath`.
- Do not unify `wrappers-emit.ts` across languages until a third renderer forces a shared IR.

---

## Agent workflow (copy this)

1. Read this file, then `src/render/shared/` and the closer of `src/render/browser-ts/**` or `src/render/go/**`.
2. Read the peer SDK's public `track` / `identify` / `page|screen` / `group` / `alias` signatures.
3. Add the id to `SUPPORTED_SDKS` and `defaultOutputPath`; run `pnpm run generate:schema`.
4. Scaffold `src/render/<sdk-id>/`; register in `src/render/index.ts`.
5. Implement `types-emit` (shared quicktype input) and `wrappers-emit` (must-emit helpers + invariants). Extract CLI-only duplication; leave generated helpers per SDK.
6. Add Jest snapshots, `test/harness/<id>/`, a `run-harness.ts` case, and `.github/workflows/<id>-harness.yml`.
7. Run `pnpm test && pnpm run lint && pnpm run check:schema && pnpm test:harness <id>`.
8. In the PR: peer SDK + min version, page vs screen mapping, instance binding, harness location.
