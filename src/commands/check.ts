import { Command } from 'commander';
import { CliError } from '../lib/errors';
import { printResolvedSummary, resolveFromCommand } from '../config/resolve';

export function checkCommand(): Command {
  return new Command('check')
    .description('verify generated code is up to date with contracts')
    .action((_opts, command: Command) => {
      const resolved = resolveFromCommand(command);
      printResolvedSummary(resolved);
      throw new CliError(
        '`check` loaded the config successfully, but drift detection is not implemented yet.',
      );
    });
}
