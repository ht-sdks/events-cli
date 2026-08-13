import { Command } from 'commander';
import { CliError } from '../lib/errors';
import { printResolvedConfigSummary, resolveConfig } from '../config/resolve';

export function generateCommand(): Command {
  return new Command('generate')
    .description('fetch event contracts and emit typed SDK wrappers and docs')
    .action((_opts, command: Command) => {
      const resolvedConfig = resolveConfig(command);
      printResolvedConfigSummary(resolvedConfig);
      throw new CliError(
        '`generate` loaded the config successfully, but code generation is not implemented yet.',
      );
    });
}
