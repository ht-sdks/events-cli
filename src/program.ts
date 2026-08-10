import { readFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';

// Resolves to the repo root from both src/ (ts-jest) and dist/ (compiled).
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

export function buildProgram(): Command {
  return new Command()
    .name('htevents')
    .description('Codegen CLI for Hightouch Events')
    .version(pkg.version);
}
