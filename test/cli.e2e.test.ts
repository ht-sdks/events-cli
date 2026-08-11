import { spawnSync } from 'child_process';
import { join } from 'path';
const CLI = join(__dirname, '..', 'dist', 'cli.js');

function runCli(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      ...env,
      HIGHTOUCH_API_TOKEN: env?.HIGHTOUCH_API_TOKEN,
    },
  });
}

describe('htevents cli (e2e)', () => {
  it('prints usage and exits 0 for --help', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: htevents');
  });

  it('prints the version for --version', () => {
    const result = runCli(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('init exits 1 with a not-implemented notice', () => {
    const result = runCli(['init']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not implemented');
  });

  it.each(['generate', 'check'])(
    '%s without a config exits 1 with a missing-config error',
    (name) => {
      const result = runCli([name]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Config file not found');
    },
  );

  it('exits 1 for unknown commands', () => {
    const result = runCli(['bogus']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown command');
  });

  it('prints a stack trace with --debug', () => {
    const result = runCli(['--debug', 'generate']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CliError');
  });

  it('generate loads config and prints a summary', () => {
    const config = join(__dirname, 'fixtures', 'config', 'valid-git-sync.json');
    const result = runCli(['generate', '--config', config]);
    // still exits 1 because generation is stubbed
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"type": "git-sync"');
    expect(result.stderr).toContain('Loaded config');
    expect(result.stderr).toContain('not implemented');
  });

  it('generate with api input fails without a token', () => {
    const config = join(__dirname, 'fixtures', 'config', 'valid-api.json');
    const result = runCli(['generate', '--config', config], {
      HIGHTOUCH_API_TOKEN: '',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('requires a token');
  });

  it('generate with api input succeeds with a token in the env', () => {
    const config = join(__dirname, 'fixtures', 'config', 'valid-api.json');
    const result = runCli(['generate', '--config', config], {
      HIGHTOUCH_API_TOKEN: 'secret',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Loaded config');
    expect(result.stderr).toContain('not implemented');
  });

  it('generate with api input succeeds with a token in the flag', () => {
    const config = join(__dirname, 'fixtures', 'config', 'valid-api.json');
    const result = runCli(
      ['generate', '--config', config, '--token', 'secret'],
      {
        HIGHTOUCH_API_TOKEN: undefined,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Loaded config');
    expect(result.stderr).toContain('not implemented');
  });
});
