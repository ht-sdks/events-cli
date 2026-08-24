import { existsSync, readdirSync, statSync } from 'fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';
import { CliError } from '../../lib/errors';

export type ContractDirShape = 'contracts' | 'domains';
export type PathKind = 'meta' | 'schema' | 'component' | 'other';

const YAML_EXT = '.yaml';
const DOMAIN_META = 'domain.yaml';

export type ResolvedGitSyncLayout = {
  /** Absolute path from config `input.path`. */
  inputPath: string;
  /** Directory that contains `contracts/` or `domains/`. */
  eventsRoot: string;
  shape: ContractDirShape;
};

export function resolveGitSyncPath(
  configPath: string,
  inputPath: string,
): string {
  const base = dirname(resolve(configPath));
  return isAbsolute(inputPath) ? resolve(inputPath) : resolve(base, inputPath);
}

/** True if `dir` exists and contains any `.yaml` file at any depth. Missing dirs are empty. */
function directoryHasYaml(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    if (!statSync(dir).isDirectory()) return false;
  } catch {
    return false;
  }
  return walkHasYaml(dir);
}

function walkHasYaml(dir: string): boolean {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (walkHasYaml(full)) return true;
    } else if (entry.isFile() && entry.name.endsWith(YAML_EXT)) {
      return true;
    }
  }
  return false;
}

export function resolveGitSyncLayout(
  configPath: string,
  inputPath: string,
): ResolvedGitSyncLayout {
  const abs = resolveGitSyncPath(configPath, inputPath);
  if (!existsSync(abs)) {
    throw new CliError(`Git-sync path not found: ${abs}`);
  }
  if (!statSync(abs).isDirectory()) {
    throw new CliError(`Git-sync path is not a directory: ${abs}`);
  }

  const asRepoRoot = join(abs, 'events');
  const repoContracts = directoryHasYaml(join(asRepoRoot, 'contracts'));
  const repoDomains = directoryHasYaml(join(asRepoRoot, 'domains'));
  if (repoContracts || repoDomains) {
    return {
      inputPath: abs,
      eventsRoot: asRepoRoot,
      shape: pickShape(asRepoRoot, repoContracts, repoDomains),
    };
  }

  const dirContracts = directoryHasYaml(join(abs, 'contracts'));
  const dirDomains = directoryHasYaml(join(abs, 'domains'));
  if (dirContracts || dirDomains) {
    return {
      inputPath: abs,
      eventsRoot: abs,
      shape: pickShape(abs, dirContracts, dirDomains),
    };
  }

  throw new CliError(
    `No event contracts found under ${abs}. Expected YAML in one of: ` +
      `events/domains, events/contracts, domains, or contracts.`,
  );
}

function pickShape(
  eventsRoot: string,
  hasContracts: boolean,
  hasDomains: boolean,
): ContractDirShape {
  if (hasContracts && hasDomains) {
    throw new CliError(
      `Ambiguous event contract layout under ${eventsRoot}: found YAML in both contracts/ and domains/. ` +
        `A repository must use exactly one layout.`,
    );
  }
  return hasDomains ? 'domains' : 'contracts';
}

/** All `.yaml` files under `dir`, sorted. Missing dirs yield `[]`. */
export function listYamlFiles(dir: string): string[] {
  const files: string[] = [];
  collectYamlFiles(dir, files);
  files.sort();
  return files;
}

function collectYamlFiles(dir: string, files: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectYamlFiles(full, files);
    } else if (entry.isFile() && entry.name.endsWith(YAML_EXT)) {
      files.push(full);
    }
  }
}

/**
 * Classify a file relative to `eventsRoot` (the directory that contains
 * `contracts/` or `domains/`), not the git-sync repo root.
 */
export function classifyPath(
  shape: ContractDirShape,
  eventsRoot: string,
  absoluteFile: string,
): PathKind {
  const rel = relative(eventsRoot, absoluteFile).split(sep).join('/');
  if (!rel || rel.startsWith('..')) return 'other';

  const parts = rel.split('/');
  const filename = parts[parts.length - 1] ?? '';
  if (!filename.endsWith(YAML_EXT)) return 'other';

  if (shape === 'contracts') {
    if (parts.length === 2 && parts[0] === 'contracts') return 'meta';
    if (parts.length === 3 && parts[0] === 'contracts') return 'schema';
    return 'other';
  }

  if (parts[0] !== 'domains') return 'other';
  if (parts.length === 4 && parts[2] === 'components') return 'component';
  if (parts.length !== 3) return 'other';
  if (filename === DOMAIN_META) return 'meta';
  return 'schema';
}

export function yamlFilenameSlug(filename: string): string {
  return filename.endsWith(YAML_EXT)
    ? filename.slice(0, -YAML_EXT.length)
    : filename;
}
