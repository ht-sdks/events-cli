import { existsSync, readFileSync } from 'fs';
import { Command } from 'commander';
import { CliError, EXIT_DRIFT } from '../lib/errors';
import { info } from '../lib/output';
import { resolveConfig, type ResolvedConfig } from '../config/resolve';
import { buildArtifacts } from '../pipeline/artifacts';

export async function runCheck(resolvedConfig: ResolvedConfig): Promise<void> {
  const artifacts = await buildArtifacts(resolvedConfig);

  const expected = [
    ...artifacts.files,
    { path: artifacts.lockfilePath, contents: artifacts.lockfileContents },
  ];

  const drifted: string[] = [];
  for (const file of expected) {
    if (!existsSync(file.path)) {
      drifted.push(`${file.path} (missing)`);
      continue;
    }
    if (readFileSync(file.path, 'utf-8') !== file.contents) {
      drifted.push(file.path);
    }
  }

  if (drifted.length > 0) {
    throw new CliError(
      `Generated files are out of date:\n${drifted
        .map((path) => `  ${path}`)
        .join('\n')}\nRun \`htevents generate\` to update.`,
      EXIT_DRIFT,
    );
  }

  info('Generated files are up to date.');
}

export function checkCommand(): Command {
  return new Command('check')
    .description('verify generated code is up to date with contracts')
    .action(async (_opts, command: Command) => {
      await runCheck(resolveConfig(command));
    });
}
