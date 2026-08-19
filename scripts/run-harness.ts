/**
 * Language-native compile harness. Usage:
 *
 *   pnpm test:harness go
 *
 * Add a `case` here when a new `test/harness/<id>/` lands. Do not add a new
 * package.json script per SDK.
 */
import { spawnSync } from 'child_process';
import { join } from 'path';
import { emitGoHarness } from './emit-go-harness';

const ROOT = join(__dirname, '..');
const required = process.env.RUN_HARNESS === '1';

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

async function runGo(emitOnly: boolean): Promise<void> {
  if (!hasGo()) {
    if (required) {
      console.error('go is required when RUN_HARNESS=1');
      process.exit(1);
    }
    console.error(
      'skipping go harness (go not on PATH; set RUN_HARNESS=1 to require it)',
    );
    process.exit(0);
  }

  await emitGoHarness();
  if (emitOnly) {
    return;
  }

  const harness = join(ROOT, 'test', 'harness', 'go');
  const vet = run('go', ['vet', './...'], harness);
  if (vet !== 0) process.exit(vet);
  process.exit(run('go', ['test', '-count=1', './...'], harness));
}

async function main(): Promise<void> {
  const id = process.argv[2];
  const emitOnly = process.argv.includes('--emit-only');
  if (id === undefined || id.startsWith('-')) {
    console.error('usage: pnpm test:harness <sdk> [--emit-only]');
    process.exit(1);
  }

  switch (id) {
    case 'go':
      await runGo(emitOnly);
      break;
    default:
      console.error(`unknown harness: ${id}`);
      process.exit(1);
  }
}

void main();
