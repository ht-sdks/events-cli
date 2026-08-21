/**
 * Fixture generator for the Kotlin compile harness — not a Jest test and not
 * quicktype input. Runs `renderKotlin()` over domain fixtures plus extra event
 * types, writes gitignored `test/harness/kotlin/src/main/kotlin/analytics/HtEvents.kt`.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { eventsFromFixture } from '../test/helpers/fixtures';
import { extraHarnessEvents } from '../test/harness/extra-events';
import { renderKotlin } from '../src/render/kotlin';

const OUT = join(
  __dirname,
  '..',
  'test',
  'harness',
  'kotlin',
  'src',
  'main',
  'kotlin',
  'analytics',
  'HtEvents.kt',
);

export async function emitKotlinHarness(): Promise<void> {
  const events = [
    ...eventsFromFixture('multi-version.json'),
    ...eventsFromFixture('with-refs.json'),
    ...extraHarnessEvents(),
  ];
  const source = await renderKotlin(events);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source);
  console.error(`Wrote ${OUT}`);
}

const isDirect =
  process.argv[1] !== undefined &&
  /emit-kotlin-harness\.(ts|js)$/.test(process.argv[1]);

if (isDirect) {
  void emitKotlinHarness();
}
