import { Command } from 'commander';
import { CliError } from '../lib/errors';
import { info } from '../lib/output';
import {
  printResolvedConfigSummary,
  resolveConfig,
  type ResolvedConfig,
} from '../config/resolve';
import { loadContracts } from '../input/load';
import type { ContractBundle } from '../input/types';

export async function runGenerate(
  resolvedConfig: ResolvedConfig,
): Promise<ContractBundle> {
  printResolvedConfigSummary(resolvedConfig);
  const bundle = await loadContracts(resolvedConfig);
  info(`Loaded ${bundle.domains.length} domain(s).`);
  return bundle;
}

export function generateCommand(): Command {
  return new Command('generate')
    .description('fetch event contracts and emit typed SDK wrappers and docs')
    .action(async (_opts, command: Command) => {
      await runGenerate(resolveConfig(command));
      throw new CliError(
        '`generate` loaded contracts successfully, but code generation is not implemented yet.',
      );
    });
}
