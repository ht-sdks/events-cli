/**
 * Fixture generator for the Android compile harness — not a Jest test and not
 * quicktype input. Runs `renderAndroid()` over domain fixtures plus extra event
 * types, writes gitignored `test/harness/android/src/main/java/analytics/HtEvents.java`.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { eventsFromFixture } from '../test/helpers/fixtures';
import { extraHarnessEvents } from '../test/harness/extra-events';
import { renderAndroid } from '../src/render/android';

const OUT = join(
  __dirname,
  '..',
  'test',
  'harness',
  'android',
  'src',
  'main',
  'java',
  'analytics',
  'HtEvents.java',
);

export async function emitAndroidHarness(): Promise<void> {
  const events = [
    ...eventsFromFixture('multi-version.json'),
    ...eventsFromFixture('with-refs.json'),
    ...extraHarnessEvents(),
  ];
  const source = await renderAndroid(events);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source);
  console.error(`Wrote ${OUT}`);
}

const isDirect =
  process.argv[1] !== undefined &&
  /emit-android-harness\.(ts|js)$/.test(process.argv[1]);

if (isDirect) {
  void emitAndroidHarness();
}
