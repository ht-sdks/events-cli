import { Command } from 'commander';
import { CliError } from '../lib/errors';
import { printResolvedSummary, resolveFromCommand } from '../config/resolve';

export function generateCommand(): Command {
  return new Command('generate')
    .description('fetch event contracts and emit typed SDK wrappers and docs')
    .action((_opts, command: Command) => {
      const resolved = resolveFromCommand(command);
      printResolvedSummary(resolved);
      throw new CliError(
        '`generate` loaded the config successfully, but code generation is not implemented yet.',
      );
    });
}
