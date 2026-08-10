import { readFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { generateCommand } from './commands/generate';
import { checkCommand } from './commands/check';

// Resolves to the repo root from both src/ (ts-jest) and dist/ (compiled).
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

export function buildProgram(): Command {
  const program = new Command()
    .name('htevents')
    .description('Codegen CLI for Hightouch Events')
    .version(pkg.version)
    .option(
      '-c, --config <path>',
      'path to the config file',
      './htevents.config.json',
    )
    .option(
      '--token <token>',
      'Hightouch workspace API token (overrides HIGHTOUCH_API_TOKEN)',
    )
    .option('--debug', 'print stack traces for errors');

  program.addCommand(initCommand());
  program.addCommand(generateCommand());
  program.addCommand(checkCommand());

  return program;
}
