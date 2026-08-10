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

  it.each(['init', 'generate', 'check'])(
    '%s exits 1 with a not-implemented notice',
    (name) => {
      const result = runCli(name);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('not implemented');
    },
  );

  it('exits 1 for unknown commands', () => {
    const result = runCli('bogus');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown command');
  });

  it('prints a stack trace with --debug', () => {
    const result = runCli('--debug', 'generate');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CliError');
  });
});
