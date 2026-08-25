/**
 * Fixture generator for language compile harnesses.
 *
 * Discovers `src/render/<id>/harness.ts` so a new SDK does not edit this file.
 *
 *   pnpm test:harness <sdk> --emit-only
 *   tsx scripts/emit-harness.ts <sdk>
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import { eventsFromFixture } from '../test/helpers/fixtures';
import { extraHarnessEvents } from '../test/harness/extra-events';
import type { NormalizedEvent } from '../src/normalize/types';
import type { SdkHarness } from '../src/render/shared/harness';

const ROOT = join(__dirname, '..');
const RENDER_ROOT = join(ROOT, 'src', 'render');

export type LoadedHarness = SdkHarness & { id: string };

function harnessEvents(): NormalizedEvent[] {
  return [
    ...eventsFromFixture('multi-version.json'),
    ...eventsFromFixture('with-refs.json'),
    ...extraHarnessEvents(),
  ];
}

export async function loadHarnesses(): Promise<LoadedHarness[]> {
  const ids = readdirSync(RENDER_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => entry.name)
    .sort();

  const loaded: LoadedHarness[] = [];
  for (const id of ids) {
    const file = join(RENDER_ROOT, id, 'harness.ts');
    if (!existsSync(file)) {
      continue;
    }
    const mod = (await import(pathToFileURL(file).href)) as {
      harness?: SdkHarness;
    };
    if (mod.harness === undefined) {
      throw new Error(`${file} must export const harness`);
    }
    loaded.push({ id, ...mod.harness });
  }
  return loaded;
}

export async function emitHarness(spec: LoadedHarness): Promise<void> {
  const out = join(ROOT, spec.generatedFile);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await spec.render(harnessEvents()));
  if (spec.format !== undefined) {
    const result = spawnSync(spec.format.command, [...spec.format.args, out], {
      encoding: 'utf-8',
    });
    if (result.status !== 0 && result.error !== undefined) {
      if (spec.format.optional === true) {
        console.error(
          `Wrote ${out} (${spec.format.command} not available: ${result.error.message})`,
        );
        return;
      }
      console.error(result.error.message);
      process.exit(result.status ?? 1);
    }
    if (result.status !== 0) {
      console.error(result.stderr);
      process.exit(result.status ?? 1);
    }
  }
  console.error(`Wrote ${out}`);
}

const isDirect =
  process.argv[1] !== undefined &&
  /emit-harness\.(ts|js)$/.test(process.argv[1]);
if (isDirect) {
  void (async () => {
    const harnesses = await loadHarnesses();
    const ids = harnesses.map((h) => h.id);
    const id = process.argv[2];
    if (id === undefined || !ids.includes(id)) {
      console.error(`usage: tsx scripts/emit-harness.ts <${ids.join('|')}>`);
      process.exit(1);
    }
    const spec = harnesses.find((h) => h.id === id);
    if (spec === undefined) {
      process.exit(1);
    }
    await emitHarness(spec);
  })();
}
