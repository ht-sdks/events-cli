/**
 * Language-native compile harness. Usage:
 *
 *   pnpm test:harness <sdk>
 *   pnpm test:harness:all
 *
 * Add a `case` here when a new `test/harness/<id>/` lands. Do not add a new
 * package.json script per SDK.
 */
import { spawnSync } from 'child_process';
import { join } from 'path';
import { emitBrowserTsHarness } from './emit-browser-ts-harness';
import { emitGoHarness } from './emit-go-harness';

const ROOT = join(__dirname, '..');
const required = process.env.RUN_HARNESS === '1';

const HARNESS_IDS = ['browser-ts', 'go'] as const;
type HarnessId = (typeof HARNESS_IDS)[number];

function run(command: string, args: string[], cwd: string = ROOT): number {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    encoding: 'utf-8',
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

function hasGo(): boolean {
  return (
    spawnSync('go', ['env', 'GOVERSION'], { encoding: 'utf-8' }).status === 0
  );
}

async function runGo(emitOnly: boolean): Promise<number> {
  if (!hasGo()) {
    if (required) {
      console.error('go is required when RUN_HARNESS=1');
      return 1;
    }
    console.error(
      'skipping go harness (go not on PATH; set RUN_HARNESS=1 to require it)',
    );
    return 0;
  }

  await emitGoHarness();
  if (emitOnly) {
    return 0;
  }

  const harness = join(ROOT, 'test', 'harness', 'go');
  const vet = run('go', ['vet', './...'], harness);
  if (vet !== 0) return vet;
  return run('go', ['test', '-count=1', './...'], harness);
}

async function runBrowserTs(emitOnly: boolean): Promise<number> {
  await emitBrowserTsHarness();
  if (emitOnly) {
    return 0;
  }
  return run('pnpm', [
    'exec',
    'tsx',
    '--test',
    'test/harness/browser-ts/wrappers.test.ts',
  ]);
}

async function runHarness(id: HarnessId, emitOnly: boolean): Promise<number> {
  switch (id) {
    case 'go':
      return runGo(emitOnly);
    case 'browser-ts':
      return runBrowserTs(emitOnly);
    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
}

async function main(): Promise<void> {
  const emitOnly = process.argv.includes('--emit-only');
  const args = process.argv.slice(2).filter((arg) => arg !== '--emit-only');
  const all = args[0] === '--all' || args[0] === 'all';

  if (all) {
    let status = 0;
    for (const id of HARNESS_IDS) {
      const code = await runHarness(id, emitOnly);
      if (code !== 0) status = code;
    }
    process.exit(status);
  }

  const id = args[0];
  if (id === undefined || id.startsWith('-')) {
    console.error(
      'usage: pnpm test:harness <sdk> [--emit-only]\n       pnpm test:harness:all',
    );
    process.exit(1);
  }

  if (!HARNESS_IDS.includes(id as HarnessId)) {
    console.error(`unknown harness: ${id}`);
    process.exit(1);
  }

  process.exit(await runHarness(id as HarnessId, emitOnly));
}

void main();
