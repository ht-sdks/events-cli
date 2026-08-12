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

describe('loadContracts', () => {
  it('rejects api input as not implemented', async () => {
    await expect(
      loadContracts(resolved('valid-api.json', 'tok')),
    ).rejects.toThrow(/API contract input is not implemented/i);
  });

  it('rejects git-sync input as not implemented', async () => {
    await expect(
      loadContracts(resolved('valid-git-sync.json')),
    ).rejects.toThrow(/Git-sync contract input is not implemented/i);
  });

  it('throws CliError (not a generic Error)', async () => {
    await expect(
      loadContracts(resolved('valid-api.json', 'tok')),
    ).rejects.toBeInstanceOf(CliError);
  });
});
