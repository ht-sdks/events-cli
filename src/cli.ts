#!/usr/bin/env node
import { CliError } from './lib/errors';
import { buildProgram } from './program';
import { error } from './lib/output';

async function main(): Promise<void> {
  const program = buildProgram();

  try {
    await program.parseAsync();
  } catch (err) {
    if (err instanceof CliError) {
      error(err.message);
      if (program.opts().debug) {
        process.stderr.write(`${err.stack}\n`);
      }
      process.exitCode = err.exitCode;
    } else {
      throw err;
    }
  }
}

void main();
