# Adding an SDK renderer

This is the playbook for adding a new `outputs[].sdk` target. It is written so an agent can do the bulk of the work without inventing architecture.

The CLI is one Node/TS package (`@ht-sdks/events-cli`, binary `htevents`). Each renderer turns **already-normalized** event contracts into typed wrappers around a **peer** Hightouch SDK. Generated code never constructs, pins, or installs that SDK.

**Reference implementation:** `src/render/browser-ts/`. Copy its file layout, invariants, and test split.

**Share code as renderers accumulate.** If two renderers share logic (quicktype input setup, headers, sort order, version-injection policy, test helpers, etc.), extract it under `src/render/` and reuse it, rather than maintaining duplicate code. When adding a renderer, check for existing shared helpers first. Keep language-specific syntax and peer-SDK call shapes in the per-SDK package.

**Do not touch** input loading, `$ref` flattening, envelope unwrap, wrapper naming, or the lockfile unless a renderer truly cannot work without a shared change. Those stages are SDK-agnostic on purpose.

---

## Done when

A renderer is complete when all of the following hold:

1. `htevents init --sdk <id>` and `htevents.config.json` accept the new SDK identifier.
2. `htevents generate` writes idiomatic wrappers that call the real peer SDK.
3. Snapshot tests cover `simple-track.json`, `multi-version.json`, and `with-refs.json`.
4. Behavioral tests prove SDK method calls and schema-version injection (see [Invariants](#invariants)).
5. Generated output typechecks against the peer SDK, or the PR explains why the toolchain cannot run in this package's CI and still includes a harness.
6. `pnpm test` and `pnpm run check:schema` pass.

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

Do not target archived repos: `events-sdk-js` (use `events-sdk-js-mono`), `events-sdk-node` (use `events-sdk-js-mono` `packages/node`), `events-sdk-ios` (use `events-sdk-swift`).

| Planned id     | quicktype `lang` | Peer SDK                                                                                         | Notes                                                                                    |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `browser-ts`   | `typescript`     | [`ht-sdks/events-sdk-js-mono`](https://github.com/ht-sdks/events-sdk-js-mono) `packages/browser` | Shipped. Reference.                                                                      |
| `swift`        | `swift`          | [`ht-sdks/events-sdk-swift`](https://github.com/ht-sdks/events-sdk-swift)                        | Next. Mobile: `screen`, not `page`. Codable types.                                       |
| `kotlin`       | `kotlin`         | [`ht-sdks/events-sdk-kotlin`](https://github.com/ht-sdks/events-sdk-kotlin)                      | Next. Android/JVM Kotlin SDK (not the Java Android SDK). `screen`, not `page`.           |
| `go`           | `go`             | [`ht-sdks/events-sdk-go`](https://github.com/ht-sdks/events-sdk-go)                              | Next. `client.Enqueue(htevents.Track{…})` typed structs, not `Track()` methods.          |
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

In `src/config/schema.ts`, append to `SUPPORTED_SDKS`.

Regenerate the committed JSON Schema (required; CI checks this):

```sh
pnpm run generate:schema
```

`init --sdk` help text and the init prompt are derived from `SUPPORTED_SDKS`. After adding an id, update `test/__snapshots__/help.test.ts.snap` by running tests.

If the language is not TypeScript, change the init default output path in `src/commands/init/collect.ts` (today: `./src/analytics/generated.ts`) so `init` suggests a sensible path for that SDK.

### 3. Mimic the browser-ts package layout

Create `src/render/<sdk-id>/`. Reuse shared helpers if they already exist; do not copy `types-emit` / header / injection logic that has already been extracted.

| File               | Responsibility                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `index.ts`         | `render<Id>(events): Promise<string>` — sort, stitch header + types + wrappers            |
| `constants.ts`     | `MIN_SDK_PACKAGE`, `MIN_SDK_VERSION` (documented minimum, never pinned in generated code) |
| `header.ts`        | `Generated by @ht-sdks/events-cli@<ver> — do not edit.` plus peer SDK requirement         |
| `types-emit.ts`    | quicktype over `event.schema`                                                             |
| `wrappers-emit.ts` | instance binding + per-event wrappers + version injection                                 |

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

Follow `src/render/browser-ts/types-emit.ts`:

- One `JSONSchemaInput` source per event.
- Set `schema.title` to the language type name derived from `wrapperName` (browser-ts: `toPascalCase(wrapperName)`). This overrides leftover titles on the contract schema.
- Pass `$schema: 'http://json-schema.org/draft-07/schema#'`.
- Call `quicktype({ inputData, lang: '<lang>', rendererOptions })`.
- Preserve JSON property names (`nice-property-names: false` in TypeScript). Do not camelCase keys that the payload will send as-is.
- Prefer `just-types: true` when the language can express types separately from marshaling. Swift is the exception: Typewriter forces full types + `Codable` because `just-types` breaks JSON compatibility. If you subclass a quicktype renderer, do it only for this kind of language constraint.

`event.schema` is already flattened (`src/normalize/flatten.ts`) and envelope-unwrapped (`src/normalize/envelope.ts`). Nested `$ref`s to components will not appear. `FetchingJSONSchemaStore` is still required by `JSONSchemaInput`.

Identifier helpers: reuse `toPascalCase` from `src/normalize/names.ts`. Add a language-specific transliterator in the renderer (Go exported names, Python `snake_case`) rather than changing `wrapperName` upstream.

### 5. Emit wrappers

Follow `src/render/browser-ts/wrappers-emit.ts` and the [invariants](#invariants) below.

Pattern, shared by every SDK:

1. Bind to an **already-configured** analytics instance (write key, plugins, consent live in the app).
2. For each event, emit `wrapperName` and, when set, `latestAlias = wrapperName`.
3. Call the peer SDK method for `event.type` (after page/screen mapping).
4. Inject `event.version` at `schemaVersionPath` using the rules below.
5. Sort events by `wrapperName` before emitting (stable diffs).

### 6. Tests (copy the three-file split)

| File                                    | What it proves                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `test/render.<sdk-id>.test.ts`          | Snapshots + header + type names + sort order + alias has no properties payload |
| `test/render.<sdk-id>.wrappers.test.ts` | Runtime: SDK methods receive the right arguments; version injection matrix     |
| `test/render.<sdk-id>.compile.test.ts`  | Generated source typechecks against the peer SDK                               |

Use `eventsFromFixture` in `test/helpers/fixtures.ts`. Do not invent parallel fixtures unless a language needs an extra event type (e.g. `group` / `alias` are already inlined in the browser-ts tests).

**Snapshots:** `it.each(['simple-track.json', 'multi-version.json', 'with-refs.json'])`.

**Behavioral tests** (browser-ts loads generated TS via `typescript.transpileModule` and a mock analytics object). Replicate that: generate source → evaluate or compile a thin test driver → assert calls. Cover at least:

- Throws / no-ops until the analytics instance is bound.
- `track` with event name + properties.
- `latestAlias` hits the same path as the versioned wrapper.
- `identify` with id + traits, and traits-only if the SDK allows it.
- `group` with group id + traits.
- `alias` with to / optional from; **never** a properties object.
- The [version-injection matrix](#schema-version-injection).

**Compile harness** is CLI test infrastructure, not something `htevents generate` does for customers. Write generated code to a temp dir and typecheck it against the real peer SDK on disk. The published CLI never ships that SDK; generated output only _documents_ the peer requirement (see [Header](#header)). Customers already installed the SDK in their app.

- **JS/TS targets** (`browser-ts`, `node`, `react-native`): add the published npm package as a **CLI `devDependency`** (see `package.json`) and typecheck with `ts.createProgram`, as browser-ts does with `@ht-sdks/events-sdk-js-browser`.
- **Every other language:** do **not** put the SDK in `package.json`. An npm git dependency only dumps source into `node_modules`; it is not a Swift / Kotlin / Go / Python package. Clone the `ht-sdks` repo listed above (sibling checkout, submodule, or CI step) into the layout that language's compiler expects (SPM, Gradle, `go.mod`, …).
- If the compiler is not available in this package's Node CI, still commit the harness and skip at runtime when the binary is missing (`process.env.CI` must not silently skip if the toolchain is supposed to be installed). Call that out in the PR.

Minimum SDK version belongs in `constants.ts` and the generated header, matching the version you compile against.

### 7. Run

```sh
pnpm test
pnpm run lint
pnpm run check:schema
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

Browser-ts uses module-level `setHtEvents(instance)`. Other languages should pick the idiomatic equivalent and document it in the generated header:

- Swift: `extension Analytics` methods, or a small type that holds `Analytics`.
- Kotlin/Android: methods on a class constructed with `Analytics`.
- Go: functions that take the client, or methods on a wrapper struct.
- Node: `setHtEvents` like browser, or a factory `withAnalytics(client)`.

Never call `new Analytics(writeKey)` inside generated code. Never add a dependency manifest that pins the SDK (that fights the app's own install).

### Event → SDK call

| `event.type` | Data argument | Typical SDK call                                                                                                             |
| ------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `track`      | `properties`  | `track(<event.name>, properties, options)`                                                                                   |
| `page`       | `properties`  | Browser/node: `page(...)`. Mobile: map to `screen` if the SDK has no `page`.                                                 |
| `screen`     | `properties`  | `screen(...)`. Browser: SDK has `screen` as well; still emit `screen` for `type: screen`.                                    |
| `identify`   | `traits`      | Overloads: `(userId, traits?, options?)` and `(traits?, options?)` when the SDK allows traits-only.                          |
| `group`      | `traits`      | `(groupId, traits?, options?)`.                                                                                              |
| `alias`      | **none**      | `(to, from?, options?)`. Do not emit a properties/traits parameter. `schema` may be an empty object; ignore it as a payload. |

For `track`, the event name passed to the SDK is `event.name ?? event.type` (see `sdkCall` in `wrappers-emit.ts`).

For named `page` / `screen`, browser-ts calls `htevents.page(undefined, name, data, options)` so the name is the page name, not a category. Re-read the peer SDK before copying that arity.

### Schema version injection

Port of event-router `getCacheKey` (see the comment at the top of `wrappers-emit.ts`). The router walks the **full Segment payload** at `schemaVersionPath`. Wrappers must write `event.version` onto the object the SDK will send, using only the arguments that SDK method has:

| Path head                                             | Applies to                   | Where to write                                                   |
| ----------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| this event's `envelopeKey` (`properties` or `traits`) | that event only              | mutate the properties/traits argument                            |
| `context`                                             | all types, including `alias` | mutate `options.context` (or the SDK's equivalent)               |
| anything else, empty, or absent                       | —                            | **no injection** (router falls back to `default_schema_version`) |
| `properties.*` on identify/group                      | —                            | **no injection** (wrong envelope)                                |
| `traits.*` on track/page/screen                       | —                            | **no injection**                                                 |
| `properties.*` on alias                               | —                            | **no injection** (alias has no properties argument)              |

Clone-on-write: do not mutate the caller's objects. Browser-ts implements this with `setAtPath` + `withSchemaVersion`. Port the behavior, not necessarily the helpers.

Required behavioral cases (already in `test/render.wrappers.test.ts`):

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

Use `cliPackage()` from `src/lib/package-info.ts`. Do not hardcode the CLI version. `<package>` is the name the target language uses for the peer (npm package, SPM URL, Maven coordinate, Go module path) — documentation, not an install step.

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
- Do not add non-JS SDKs to this package's `devDependencies`. npm cannot express Swift / Kotlin / Go / Python packages.
- Do not subclass quicktype's renderer unless the language requires it (Swift `Codable` is the known case). Prefer `quicktype()` + string-concatenated wrappers, like browser-ts.
- Do not copy Typewriter Handlebars templates verbatim. Use them as a hint for call shape, then match **our** SDKs and **our** version-injection rules.
- Do not leave duplicated renderer logic in place once a second copy exists. Extract the shared piece and switch both call sites over in the same PR.

---

## Agent workflow (copy this)

1. Read this file and `src/render/browser-ts/**`.
2. Read the peer SDK's public `track` / `identify` / `page|screen` / `group` / `alias` signatures.
3. Add the id to `SUPPORTED_SDKS`; run `pnpm run generate:schema`.
4. Scaffold `src/render/<sdk-id>/` from browser-ts (or existing shared helpers); register in `src/render/index.ts`.
5. Implement `types-emit` (quicktype) and `wrappers-emit` (invariants above). If you duplicated a helper that another renderer already has, extract it instead.
6. Add the three test files, and any others that are necessary; extend fixtures only if an event type is missing.
7. Run `pnpm test && pnpm run lint && pnpm run check:schema`.
8. In the PR: peer SDK + min version, page vs screen mapping, how instance binding works, any compile-harness gap.
