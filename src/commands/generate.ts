import { Command } from 'commander';
import { CliError } from '../lib/errors';
import { info, result } from '../lib/output';
import {
  printResolvedConfigSummary,
  resolveConfig,
  type ResolvedConfig,
} from '../config/resolve';
import { loadContracts } from '../input/load';
import { normalize } from '../normalize';
import type { NormalizedEvent } from '../normalize/types';

export async function runGenerate(
  resolvedConfig: ResolvedConfig,
): Promise<NormalizedEvent[]> {
  printResolvedConfigSummary(resolvedConfig);

  const bundle = await loadContracts(resolvedConfig);
  const events = normalize(bundle);
  result(JSON.stringify(events, null, 2));
  info(`Normalized ${events.length} event(s).`);
  return events;
}

export function generateCommand(): Command {
  return new Command('generate')
    .description('fetch event contracts and emit typed SDK wrappers and docs')
    .action(async (_opts, command: Command) => {
      await runGenerate(resolveConfig(command));
      throw new CliError(
        'Code generation is not implemented yet; printed normalized events only.',
      );
    });
}
