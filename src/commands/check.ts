import { Command } from 'commander';
import { CliError } from '../lib/errors';

export function checkCommand(): Command {
  return new Command('check')
    .description('verify generated code is up to date with contracts')
    .action(() => {
      throw new CliError('`check` is not implemented yet.');
    });
}
