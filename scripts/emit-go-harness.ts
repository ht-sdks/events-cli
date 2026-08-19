/**
 * Fixture generator for the Go compile harness — not a Jest test and not
 * quicktype input. Runs `renderGo()` over domain fixtures plus extra event
 * types, writes gitignored `test/harness/go/analytics/generated.go`, gofmt.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { eventsFromFixture } from '../test/helpers/fixtures';
import { extraHarnessEvents } from '../test/harness/extra-events';
import { renderGo } from '../src/render/go';

const OUT = join(
  __dirname,
  '..',
  'test',
  'harness',
  'go',
  'analytics',
  'generated.go',
);

export async function emitGoHarness(): Promise<void> {
  const events = [
    ...eventsFromFixture('multi-version.json'),
    ...eventsFromFixture('with-refs.json'),
    ...extraHarnessEvents(),
  ];
  const source = await renderGo(events);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source);
  const formatted = spawnSync('gofmt', ['-w', OUT], { encoding: 'utf-8' });
  if (formatted.status !== 0 && formatted.error) {
    console.error(
      `Wrote ${OUT} (gofmt not available: ${formatted.error.message})`,
    );
    return;
  }
  if (formatted.status !== 0) {
    console.error(formatted.stderr);
    process.exit(formatted.status ?? 1);
  }
  console.error(`Wrote ${OUT}`);
}

const isDirect =
  process.argv[1] !== undefined &&
  /emit-go-harness\.(ts|js)$/.test(process.argv[1]);

if (isDirect) {
  void emitGoHarness();
}
