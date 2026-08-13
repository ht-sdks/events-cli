import { CliError } from '../lib/errors';
import type { ResolvedConfig } from '../config/resolve';
import type { ContractBundle } from './types';
import { loadFromApi } from './api';

export async function loadContracts(
  resolvedConfig: ResolvedConfig,
): Promise<ContractBundle> {
  const { input } = resolvedConfig.config;

  switch (input.type) {
    case 'api':
      return loadFromApi(resolvedConfig);
    case 'git-sync':
      throw new CliError(
        'Git-sync contract input is not implemented yet. Use `input.type: "api"` for now, or wait for the git-sync execution item.',
      );
    default: {
      const _exhaustive: never = input;
      throw new CliError(
        `Unknown contract input type: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}
