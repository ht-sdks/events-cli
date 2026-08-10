import { spawnSync } from 'child_process';
import { join } from 'path';
const CLI = join(__dirname, '..', 'dist', 'cli.js');

function runCli(...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' });
}

describe('htevents cli (e2e)', () => {
  it('prints usage and exits 0 for --help', () => {
    const result = runCli('--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: htevents');
  });

  it('prints the version for --version', () => {
    const result = runCli('--version');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
