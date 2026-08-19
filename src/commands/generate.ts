import { Command } from 'commander';
import { info } from '../lib/output';
import { writeFileAtomic } from '../lib/write';
import { resolveConfig, type ResolvedConfig } from '../config/resolve';
import { buildArtifacts, type Artifacts } from '../pipeline/artifacts';

export async function runGenerate(
  resolvedConfig: ResolvedConfig,
): Promise<Artifacts> {
  const artifacts = await buildArtifacts(resolvedConfig);

  for (const file of artifacts.files) {
    writeFileAtomic(file.path, file.contents);
    info(`Wrote ${file.path}`);
  }
  writeFileAtomic(artifacts.lockfilePath, artifacts.lockfileContents);
  info(`Wrote ${artifacts.lockfilePath}`);

  return artifacts;
}

export function generateCommand(): Command {
  return new Command('generate')
    .description('fetch event contracts and emit typed SDK wrappers and docs')
    .action(async (_opts, command: Command) => {
      await runGenerate(resolveConfig(command));
    });
}
