import { CliError } from '../lib/errors';
import type { ResolvedConfig } from '../config/resolve';
import type { ContractBundle } from './types';

export async function loadContracts(
  resolved: ResolvedConfig,
): Promise<ContractBundle> {
  const { input } = resolved.config;

  switch (input.type) {
    case 'api':
      throw new CliError(
        'API contract input is not implemented yet. Coming in a later iteration.',
      );
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
