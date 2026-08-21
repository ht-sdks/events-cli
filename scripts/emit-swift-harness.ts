/**
 * Fixture generator for the Swift compile harness — not a Jest test and not
 * quicktype input. Runs `renderSwift()` over domain fixtures plus extra event
 * types, writes gitignored `test/harness/swift/Sources/Analytics/Generated.swift`.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { eventsFromFixture } from '../test/helpers/fixtures';
import { extraHarnessEvents } from '../test/harness/extra-events';
import { renderSwift } from '../src/render/swift';

const OUT = join(
  __dirname,
  '..',
  'test',
  'harness',
  'swift',
  'Sources',
  'Analytics',
  'Generated.swift',
);

export async function emitSwiftHarness(): Promise<void> {
  const events = [
    ...eventsFromFixture('multi-version.json'),
    ...eventsFromFixture('with-refs.json'),
    ...extraHarnessEvents(),
  ];
  const source = await renderSwift(events);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source);
  const formatted = spawnSync('swift-format', ['-i', OUT], {
    encoding: 'utf-8',
  });
  if (formatted.status !== 0 && formatted.error) {
    console.error(
      `Wrote ${OUT} (swift-format not available: ${formatted.error.message})`,
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
  /emit-swift-harness\.(ts|js)$/.test(process.argv[1]);

if (isDirect) {
  void emitSwiftHarness();
}
