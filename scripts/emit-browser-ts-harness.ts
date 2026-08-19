/**
 * Fixture generator for the browser-ts compile harness — not a Jest test.
 * Runs `renderBrowserTs()` over domain fixtures plus extra event types,
 * writes gitignored `test/harness/browser-ts/generated.ts`.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { eventsFromFixture } from '../test/helpers/fixtures';
import { extraHarnessEvents } from '../test/harness/extra-events';
import { renderBrowserTs } from '../src/render/browser-ts';

const OUT = join(
  __dirname,
  '..',
  'test',
  'harness',
  'browser-ts',
  'generated.ts',
);

export async function emitBrowserTsHarness(): Promise<void> {
  const events = [
    ...eventsFromFixture('multi-version.json'),
    ...eventsFromFixture('with-refs.json'),
    ...extraHarnessEvents(),
  ];
  const source = await renderBrowserTs(events);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source);
  const formatted = spawnSync('pnpm', ['exec', 'prettier', '--write', OUT], {
    encoding: 'utf-8',
  });
  if (formatted.status !== 0) {
    console.error(formatted.stderr || formatted.error?.message);
    process.exit(formatted.status ?? 1);
  }
  console.error(`Wrote ${OUT}`);
}

const isDirect =
  process.argv[1] !== undefined &&
  /emit-browser-ts-harness\.(ts|js)$/.test(process.argv[1]);

if (isDirect) {
  void emitBrowserTsHarness();
}
