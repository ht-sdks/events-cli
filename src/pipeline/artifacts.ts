import { dirname, resolve } from 'path';
import type { ResolvedConfig } from '../config/resolve';
import { loadContracts } from '../input/load';
import { normalize } from '../normalize';
import type { NormalizedEvent } from '../normalize/types';
import { LOCKFILE_NAME, buildLockfile, serializeLockfile } from '../lockfile';
import { renderBrowserTs } from '../render/browser-ts';

export type ArtifactFile = {
  path: string;
  contents: string;
};

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
    const contents = await renderBrowserTs(events);
    files.push({
      path: resolve(dir, output.path),
      contents,
    });
  }

  return {
    events,
    files,
    lockfilePath: lockfilePathFor(resolvedConfig),
    lockfileContents: serializeLockfile(
      buildLockfile(resolvedConfig.config.writeKey, events),
    ),
  };
}
