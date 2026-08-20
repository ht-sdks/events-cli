import { join } from 'path';
import { loadConfig } from '../src/config/load';
import { loadContracts } from '../src/input/load';
import { CliError } from '../src/lib/errors';
import type { ResolvedConfig } from '../src/config/resolve';

const fixtures = join(__dirname, 'fixtures', 'config');

function resolved(configFile: string, token?: string): ResolvedConfig {
  const configPath = join(fixtures, configFile);
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

describe('loadContracts', () => {
  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('loads api input via mocked fetch', async () => {
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { data: [], hasMore: false }));

    await expect(
      loadContracts(resolved('valid-api.json', 'tok')),
    ).resolves.toEqual({ source: 'web-app', domains: [] });
  });

  it('loads git-sync input from a local events directory', async () => {
    const studio = join(__dirname, 'fixtures', 'git-sync', 'studio');
    const resolvedGitSync: ResolvedConfig = {
      configPath: join(studio, 'htevents.config.json'),
      config: {
        ...loadConfig(join(fixtures, 'valid-git-sync.json')),
        input: { type: 'git-sync', path: studio },
      },
    };

    const bundle = await loadContracts(resolvedGitSync);
    expect(bundle.source).toBe('web-app');
    expect(bundle.domains).toHaveLength(1);
    expect(bundle.domains[0]?.slug).toBe('checkout');
  });

  it('throws CliError when the git-sync path is missing', async () => {
    await expect(
      loadContracts(resolved('valid-git-sync.json')),
    ).rejects.toBeInstanceOf(CliError);
    await expect(
      loadContracts(resolved('valid-git-sync.json')),
    ).rejects.toThrow(/Git-sync path not found/);
  });
});
