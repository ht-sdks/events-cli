/**
 * Language-native compile harness. Usage:
 *
 *   pnpm test:harness <sdk>
 *   pnpm test:harness:all
 *
 * Discovers `src/render/<id>/harness.ts`. Do not add a new package.json
 * script per SDK.
 */
import { spawnSync } from 'child_process';
import { join } from 'path';
import { emitHarness, loadHarnesses, type LoadedHarness } from './emit-harness';

const ROOT = join(__dirname, '..');
const required = process.env.RUN_HARNESS === '1';

function run(command: string, args: string[], cwd: string): number {
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

function toolchainReady(spec: LoadedHarness): boolean {
  if (spec.toolchain === undefined) {
    return true;
  }
  return (
    spawnSync(spec.toolchain.command, spec.toolchain.args, {
      encoding: 'utf-8',
    }).status === 0
  );
}

async function runHarness(
  spec: LoadedHarness,
  emitOnly: boolean,
): Promise<number> {
  if (!toolchainReady(spec)) {
    const name = spec.toolchain?.command ?? spec.id;
    if (required) {
      console.error(`${name} is required when RUN_HARNESS=1`);
      return 1;
    }
    console.error(
      `skipping ${spec.id} harness (${name} not on PATH; set RUN_HARNESS=1 to require it)`,
    );
    return 0;
  }

  await emitHarness(spec);
  if (emitOnly) {
    return 0;
  }

  for (const step of spec.test) {
    const code = run(step.command, step.args, join(ROOT, step.cwd));
    if (code !== 0) {
      return code;
    }
  }
  return 0;
}

async function main(): Promise<void> {
  const harnesses = await loadHarnesses();
  const emitOnly = process.argv.includes('--emit-only');
  const args = process.argv.slice(2).filter((arg) => arg !== '--emit-only');
  const all = args[0] === '--all' || args[0] === 'all';

  if (all) {
    let status = 0;
    for (const spec of harnesses) {
      const code = await runHarness(spec, emitOnly);
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

  const spec = harnesses.find((h) => h.id === id);
  if (spec === undefined) {
    console.error(`unknown harness: ${id}`);
    process.exit(1);
  }

  process.exit(await runHarness(spec, emitOnly));
}

void main();
