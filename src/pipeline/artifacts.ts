import { dirname, resolve } from 'path';
import type { ResolvedConfig } from '../config/resolve';
import { loadContracts } from '../input/load';
import { normalize } from '../normalize';
import type { NormalizedEvent } from '../normalize/types';
import { LOCKFILE_NAME, buildLockfile, serializeLockfile } from '../lockfile';
import { renderSdk } from '../render';
import type { ArtifactFile } from '../render/shared/output';

export type { ArtifactFile } from '../render/shared/output';

export type Artifacts = {
  events: NormalizedEvent[];
  files: ArtifactFile[];
  lockfilePath: string;
  lockfileContents: string;
};

/**
 * Resolve output and lockfile paths relative to the config file's directory,
 * not process.cwd(), so generate/check are cwd-independent.
 */
export function configDir(resolvedConfig: ResolvedConfig): string {
  return dirname(resolve(resolvedConfig.configPath));
}

export function lockfilePathFor(resolvedConfig: ResolvedConfig): string {
  return resolve(configDir(resolvedConfig), LOCKFILE_NAME);
}

/**
 * Load contracts, render expected outputs and the lockfile in memory, and
 * return them. Does not write anything to disk.
 */
export async function buildArtifacts(
  resolvedConfig: ResolvedConfig,
): Promise<Artifacts> {
  const bundle = await loadContracts(resolvedConfig);
  const events = normalize(bundle);
  const dir = configDir(resolvedConfig);

  const files: ArtifactFile[] = [];
  for (const output of resolvedConfig.config.outputs) {
    const rendered = await renderSdk(output.sdk, events, {
      outputPath: output.path,
    });
    if (typeof rendered === 'string') {
      files.push({
        path: resolve(dir, output.path),
        contents: rendered,
      });
      continue;
    }
    const base = resolve(dir, output.path);
    for (const file of rendered) {
      files.push({
        path: resolve(base, file.path),
        contents: file.contents,
      });
    }
  }

  return {
    events,
    files,
    lockfilePath: lockfilePathFor(resolvedConfig),
    lockfileContents: serializeLockfile(
      buildLockfile(resolvedConfig.config.source, events),
    ),
  };
}
