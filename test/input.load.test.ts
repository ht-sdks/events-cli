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
    ).resolves.toEqual({ writeKey: 'my-write-key', domains: [] });
  });

  it('rejects git-sync input as not implemented', async () => {
    await expect(
      loadContracts(resolved('valid-git-sync.json')),
    ).rejects.toThrow(/Git-sync contract input is not implemented/i);
  });

  it('throws CliError (not a generic Error) for git-sync', async () => {
    await expect(
      loadContracts(resolved('valid-git-sync.json')),
    ).rejects.toBeInstanceOf(CliError);
  });
});
