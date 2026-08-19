import { CliError } from '../lib/errors';
import type { ResolvedConfig } from '../config/resolve';
import type { ContractBundle } from './types';
import { loadFromApi } from './api';
import { loadFromGitSync } from './git-sync/load';

export async function loadContracts(
  resolvedConfig: ResolvedConfig,
): Promise<ContractBundle> {
  const { input } = resolvedConfig.config;

  switch (input.type) {
    case 'api':
      return loadFromApi(resolvedConfig);
    case 'git-sync':
      return loadFromGitSync(resolvedConfig);
    default: {
      const _exhaustive: never = input;
      throw new CliError(
        `Unknown contract input type: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
}
