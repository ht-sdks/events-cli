import { spawnSync } from 'child_process';
import { join } from 'path';
const CLI = join(__dirname, '..', 'dist', 'cli.js');
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';

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

  it('init without flags exits 1 in non-interactive mode with missing flags', () => {
    const result = runCli(['init']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Non-interactive init requires');
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

  it('roundtrips through check/generate stubs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'htevents-e2e-'));
    const config = join(dir, 'htevents.config.json');
    const init = runCli([
      'init',
      '--config',
      config,
      '--source',
      'demo-key',
      '--input',
      'git-sync',
      '--git-sync-path',
      './events',
      '--output',
      './generated.ts',
    ]);

    expect(init.status).toBe(0);
    expect(readFileSync(config, 'utf-8')).toContain('demo-key');

    const check = runCli(['check', '--config', config]);
    expect(check.status).toBe(1);
    expect(check.stderr).toContain('Loaded config');
    expect(check.stderr).toContain('not implemented');

    const generate = runCli(['generate', '--config', config]);
    expect(generate.status).toBe(1);
    expect(generate.stderr).toContain('not implemented');
  });

  it('init refuses to overwrite without --force', () => {
    const dir = mkdtempSync(join(tmpdir(), 'htevents-e2e-'));
    const config = join(dir, 'htevents.config.json');
    const args = [
      'init',
      '--config',
      config,
      '--source',
      'a',
      '--input',
      'api',
      '--output',
      './out.ts',
    ];

    expect(runCli(args, { HIGHTOUCH_API_TOKEN: '' }).status).toBe(0);

    const again = runCli(args, { HIGHTOUCH_API_TOKEN: '' });
    expect(again.status).toBe(1);
    expect(again.stderr).toContain('already exists');
  });
});
