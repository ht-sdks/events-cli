import { Command } from 'commander';
import { CliError } from '../lib/errors';

export function generateCommand(): Command {
  return new Command('generate')
    .description('fetch event contracts and emit typed SDK wrappers and docs')
    .action(() => {
      throw new CliError('`generate` is not implemented yet.');
    });
}
