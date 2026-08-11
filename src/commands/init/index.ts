import { existsSync } from 'fs';
import { resolve } from 'path';
import { Command } from 'commander';
import { buildConfig, writeConfigFile } from '../../config/write';
import { SUPPORTED_SDKS, type SupportedSdk } from '../../config/schema';
import { CliError } from '../../lib/errors';
import { info, warn } from '../../lib/output';
import { collectInitAnswers, type InitFlags } from './collect';
import { loadPrompter } from './prompter';

export function initCommand(): Command {
  return new Command('init')
    .description('create a htevents.config.json for this project')
    .option('--source <source>', 'write key or source slug')
    .option('--input <type>', 'api | git-sync')
    .option('--git-sync-path <path>', 'local git-sync directory (for git-sync)')
    .option(
      '--sdk <sdk>',
      `target SDK (${SUPPORTED_SDKS.join(', ')})`,
      'browser-ts',
    )
    .option('--output <path>', 'path for generated code')
    .option('--force', 'overwrite an existing config file')
    .action(async (opts, command: Command) => {
      const globals = command.optsWithGlobals() as { config: string };
      const flags: InitFlags = {
        source: opts.source,
        input: opts.input,
        gitSyncPath: opts.gitSyncPath,
        sdk: opts.sdk as SupportedSdk,
        output: opts.output,
        force: opts.force,
      };

      if (flags.input && flags.input !== 'api' && flags.input !== 'git-sync') {
        throw new CliError('`--input` must be "api" or "git-sync".');
      }

      const answers = await collectInitAnswers(flags);
      const configPath = resolve(globals.config);

      if (existsSync(configPath) && !answers.force && !flags.force) {
        if (!process.stdin.isTTY) {
          throw new CliError(
            `Config already exists: ${configPath}\nRe-run with --force to overwrite.`,
          );
        }
        const p = await loadPrompter();
        const ok = await p.confirm({
          message: `${configPath} already exists. Overwrite?`,
          default: false,
        });
        if (!ok) {
          throw new CliError('Aborted; existing config left unchanged.');
        }
      }

      const config = buildConfig({
        source: answers.source,
        inputType: answers.inputType,
        gitSyncPath: answers.gitSyncPath,
        sdk: answers.sdk,
        outputPath: answers.outputPath,
      });

      const written = writeConfigFile(configPath, config, { force: true });
      info(`Wrote ${written}`);

      if (config.input.type === 'api') {
        warn(
          'API input selected. Provide a token via --token or HIGHTOUCH_API_TOKEN when running generate/check (do not put it in the config file).',
        );
      }

      info('Next: run `htevents generate` after contracts are available.');
    });
}
