import { spawnSync } from 'child_process';
import { join } from 'path';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { loadConfig } from '../src/config/load';
import { runGenerate } from '../src/commands/generate';
import { runCheck } from '../src/commands/check';
import { CliError, EXIT_DRIFT } from '../src/lib/errors';
import type { ResolvedConfig } from '../src/config/resolve';
import { defaultOutputPath } from '../src/commands/init/collect';
import { SUPPORTED_SDKS, type SupportedSdk } from '../src/config/schema';

const WRAPPER_NAMES = [
  'trackCartViewedDefault',
  'identifyDefault',
  'trackOrderCompletedV1',
  'trackOrderCompletedV2',
] as const;

/** Per-SDK strings that must appear in generated output. Add a row with each new SDK. */
const GENERATED_SNIPPETS = {
  'browser-ts': ['trackCartViewedDefault', 'identifyDefault'],
  go: [
    'package analytics',
    'func TrackCartViewedDefault(',
    'func IdentifyDefault(',
    'func TrackOrderCompletedV2(',
    'return client.Enqueue(htevents.Track{',
  ],
  swift: [
    'extension Analytics',
    'func trackCartViewedDefault(',
    'func identifyDefault(',
    'func trackOrderCompletedV2(',
    'self.track(name:',
  ],
  android: [
    'package analytics;',
    'public final class HtEvents',
    'trackCartViewedDefault',
    'identifyDefault',
    'analytics.track(',
  ],
} as const satisfies Record<SupportedSdk, readonly string[]>;

const CLI = join(__dirname, '..', 'dist', 'cli.js');
const configFixtures = join(__dirname, 'fixtures', 'config');
const domainFixtures = join(__dirname, 'fixtures', 'domains');

function generatedPath(dir: string, sdk: SupportedSdk): string {
  return join(dir, defaultOutputPath(sdk).replace(/^\.\//, ''));
}

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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tempApiWorkspace(
  token = 'secret',
  sdk: SupportedSdk = 'browser-ts',
): {
  dir: string;
  configPath: string;
  resolved: ResolvedConfig;
} {
  const dir = mkdtempSync(join(tmpdir(), 'htevents-e2e-'));
  const configPath = join(dir, 'htevents.config.json');
  writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        source: 'web-app',
        input: { type: 'api' },
        outputs: [{ sdk, path: defaultOutputPath(sdk) }],
      },
      null,
      2,
    )}\n`,
  );
  return {
    dir,
    configPath,
    resolved: {
      configPath,
      config: loadConfig(configPath),
      token,
    },
  };
}

function mockDomainsFetch(token: string): jest.SpyInstance {
  const domain = JSON.parse(
    readFileSync(join(domainFixtures, 'with-refs.json'), 'utf-8'),
  );
  const multi = JSON.parse(
    readFileSync(join(domainFixtures, 'multi-version.json'), 'utf-8'),
  );
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
      const url = String(_input);
      expect(url).toContain('source=web-app');
      expect(headers.get('X-Hightouch-Event-Source-Write-Key')).toBeNull();
      return jsonResponse(200, { data: [domain, multi], hasMore: false });
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
    expect(result.stderr).toContain(
      'Git-sync contract input is not implemented',
    );
  });

  it('generate with api input fails without a token', () => {
    const config = join(configFixtures, 'valid-api.json');
    const result = runCli(['generate', '--config', config], {
      HIGHTOUCH_API_TOKEN: '',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('requires a token');
  });

  it.each(SUPPORTED_SDKS)(
    'generate writes %s wrappers and a lockfile',
    async (sdk) => {
      const { dir, resolved } = tempApiWorkspace('secret', sdk);
      const fetchSpy = mockDomainsFetch('secret');

      try {
        const artifacts = await runGenerate(resolved);
        const generated = readFileSync(generatedPath(dir, sdk), 'utf-8');
        expect(generated).toContain(
          'Generated by @ht-sdks/events-cli@0.1.0 — do not edit.',
        );
        for (const snippet of GENERATED_SNIPPETS[sdk]) {
          expect(generated).toContain(snippet);
        }
        expect(artifacts.events.map((e) => e.wrapperName)).toEqual(
          expect.arrayContaining([...WRAPPER_NAMES]),
        );

        const lockfile = JSON.parse(
          readFileSync(join(dir, 'htevents.lock.json'), 'utf-8'),
        ) as { source: string; events: Array<{ wrapperName: string }> };
        expect(lockfile.source).toBe('web-app');
        expect(lockfile.events.map((e) => e.wrapperName)).toEqual(
          expect.arrayContaining([...WRAPPER_NAMES]),
        );
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );

  it('generate surfaces API 401 as CliError', async () => {
    const { resolved } = tempApiWorkspace('bad');
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(401, { message: 'unauthorized' }));

    try {
      await expect(runGenerate(resolved)).rejects.toThrow(
        /401|Authentication/i,
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it.each(SUPPORTED_SDKS)(
    'check exits 0 when %s generated files match',
    async (sdk) => {
      const { resolved } = tempApiWorkspace('secret', sdk);
      const fetchSpy = mockDomainsFetch('secret');

      try {
        await runGenerate(resolved);
        await expect(runCheck(resolved)).resolves.toBeUndefined();
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );

  it.each(SUPPORTED_SDKS)(
    'check exits 2 when the %s generated file is edited',
    async (sdk) => {
      const { dir, resolved } = tempApiWorkspace('secret', sdk);
      const fetchSpy = mockDomainsFetch('secret');

      try {
        await runGenerate(resolved);
        const out = generatedPath(dir, sdk);
        writeFileSync(out, `${readFileSync(out, 'utf-8')}\n`, {
          encoding: 'utf-8',
        });
        await expect(runCheck(resolved)).rejects.toMatchObject({
          exitCode: EXIT_DRIFT,
          message: expect.stringContaining(out),
        });
        await expect(runCheck(resolved)).rejects.toBeInstanceOf(CliError);
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );

  it.each(SUPPORTED_SDKS)(
    'check exits 2 when a %s output file is missing',
    async (sdk) => {
      const { dir, resolved } = tempApiWorkspace('secret', sdk);
      const fetchSpy = mockDomainsFetch('secret');

      try {
        await runGenerate(resolved);
        const out = generatedPath(dir, sdk);
        unlinkSync(out);
        expect(existsSync(out)).toBe(false);
        await expect(runCheck(resolved)).rejects.toMatchObject({
          exitCode: EXIT_DRIFT,
          message: expect.stringMatching(/missing/i),
        });
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );

  it('init git-sync config then check/generate report not implemented', () => {
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
    expect(check.stderr).toContain(
      'Git-sync contract input is not implemented',
    );

    const generate = runCli(['generate', '--config', config]);
    expect(generate.status).toBe(1);
    expect(generate.stderr).toContain(
      'Git-sync contract input is not implemented',
    );
  });

  it.each(SUPPORTED_SDKS)(
    'init --sdk %s writes that sdk and its default output path',
    (sdk) => {
      const dir = mkdtempSync(join(tmpdir(), 'htevents-e2e-'));
      const config = join(dir, 'htevents.config.json');
      const output = defaultOutputPath(sdk);
      const init = runCli([
        'init',
        '--config',
        config,
        '--source',
        'demo-key',
        '--input',
        'api',
        '--sdk',
        sdk,
        '--output',
        output,
      ]);

      expect(init.status).toBe(0);
      expect(JSON.parse(readFileSync(config, 'utf-8'))).toMatchObject({
        outputs: [{ sdk, path: output }],
      });
    },
  );

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
