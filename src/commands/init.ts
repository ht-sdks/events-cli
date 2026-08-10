import { Command } from 'commander';
import { CliError } from '../lib/errors';

export function initCommand(): Command {
  return new Command('init')
    .description('create a htevents.config.json for this project')
    .action(() => {
      throw new CliError('`init` is not implemented yet.');
    });
}
