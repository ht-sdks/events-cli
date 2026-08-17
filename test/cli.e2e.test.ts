import { spawnSync } from 'child_process';
import { join } from 'path';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { loadConfig } from '../src/config/load';
import { runGenerate } from '../src/commands/generate';
import { EVENT_SOURCE_WRITE_KEY_HEADER } from '../src/input/api';
import type { ResolvedConfig } from '../src/config/resolve';

const CLI = join(__dirname, '..', 'dist', 'cli.js');
const configFixtures = join(__dirname, 'fixtures', 'config');
const domainFixtures = join(__dirname, 'fixtures', 'domains');

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

function resolvedApi(token = 'tok'): ResolvedConfig {
  const configPath = join(configFixtures, 'valid-api.json');
  return {
    configPath,
    config: loadConfig(configPath),
    token,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

  it('generate with git-sync reports not implemented', () => {
    const config = join(configFixtures, 'valid-git-sync.json');
    const result = runCli(['generate', '--config', config]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"type": "git-sync"');
    expect(result.stderr).toContain('Loaded config');
    expect(result.stderr).toContain('not implemented');
  });

  it('generate with api input fails without a token', () => {
    const config = join(configFixtures, 'valid-api.json');
    const result = runCli(['generate', '--config', config], {
      HIGHTOUCH_API_TOKEN: '',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('requires a token');
  });

  it('generate loads contracts from the API', async () => {
    const domain = JSON.parse(
      readFileSync(join(domainFixtures, 'with-refs.json'), 'utf-8'),
    );
    const multi = JSON.parse(
      readFileSync(join(domainFixtures, 'multi-version.json'), 'utf-8'),
    );
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_input, init) => {
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer secret');
        expect(headers.get(EVENT_SOURCE_WRITE_KEY_HEADER)).toBe('my-write-key');
        return jsonResponse(200, { data: [domain, multi], hasMore: false });
      });

    try {
      const bundle = await runGenerate(resolvedApi('secret'));
      expect(bundle.writeKey).toBe('my-write-key');
      expect(bundle.domains.map((d) => d.name)).toEqual(['Checkout', 'Orders']);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('generate surfaces API 401 as CliError', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(401, { message: 'unauthorized' }));

    try {
      await expect(runGenerate(resolvedApi('bad'))).rejects.toThrow(
        /401|Authentication/i,
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('roundtrips through check/generate stubs for git-sync', () => {
    const dir = mkdtempSync(join(tmpdir(), 'htevents-e2e-'));
    const config = join(dir, 'htevents.config.json');
    const init = runCli([
      'init',
      '--config',
      config,
      '--write-key',
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
      '--write-key',
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
