/**
 * Fixture generator for language compile harnesses. Runs the renderer over
 * domain fixtures plus extra event types and writes gitignored generated files.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { eventsFromFixture } from '../test/helpers/fixtures';
import { extraHarnessEvents } from '../test/harness/extra-events';
import { renderBrowserTs } from '../src/render/browser-ts';
import { renderGo } from '../src/render/go';
import { renderSwift } from '../src/render/swift';
import type { NormalizedEvent } from '../src/normalize/types';

const ROOT = join(__dirname, '..');

function harnessEvents(): NormalizedEvent[] {
  return [
    ...eventsFromFixture('multi-version.json'),
    ...eventsFromFixture('with-refs.json'),
    ...extraHarnessEvents(),
  ];
}

async function writeGenerated(
  out: string,
  source: string,
  format?: { command: string; args: string[] },
): Promise<void> {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, source);
  if (format) {
    const result = spawnSync(format.command, [...format.args, out], {
      encoding: 'utf-8',
    });
    if (result.status !== 0 && result.error) {
      console.error(
        `Wrote ${out} (${format.command} not available: ${result.error.message})`,
      );
      return;
    }
    if (result.status !== 0) {
      console.error(result.stderr);
      process.exit(result.status ?? 1);
    }
  }
  console.error(`Wrote ${out}`);
}

export async function emitBrowserTsHarness(): Promise<void> {
  const out = join(ROOT, 'test', 'harness', 'browser-ts', 'generated.ts');
  await writeGenerated(out, await renderBrowserTs(harnessEvents()), {
    command: 'pnpm',
    args: ['exec', 'prettier', '--write'],
  });
}

export async function emitGoHarness(): Promise<void> {
  const out = join(ROOT, 'test', 'harness', 'go', 'analytics', 'generated.go');
  await writeGenerated(out, await renderGo(harnessEvents()), {
    command: 'gofmt',
    args: ['-w'],
  });
}

export async function emitSwiftHarness(): Promise<void> {
  const out = join(
    ROOT,
    'test',
    'harness',
    'swift',
    'Sources',
    'Analytics',
    'Generated.swift',
  );
  await writeGenerated(out, await renderSwift(harnessEvents()), {
    command: 'swift-format',
    args: ['-i'],
  });
}
