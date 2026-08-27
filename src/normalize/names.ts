import { CliError } from '../lib/errors';
import type { EventType } from '../input/types';

/**
 * Convert an arbitrary label into a PascalCase TypeScript identifier fragment.
 * Leading digits are prefixed with `N`.
 */
export function toPascalCase(input: string): string {
  const parts = input.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) {
    throw new CliError(
      `Cannot derive a TypeScript identifier from empty name ${JSON.stringify(input)}.`,
    );
  }
  const pascal = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return /^[0-9]/.test(pascal) ? `N${pascal}` : pascal;
}

/** Base wrapper name before version suffix, e.g. `trackOrderCompleted` or `identify`. */
export function wrapperBase(type: EventType, name: string | undefined): string {
  if (name === undefined || name.trim() === '') {
    return type;
  }
  return `${type}${toPascalCase(name)}`;
}

export function versionedWrapperName(
  type: EventType,
  name: string | undefined,
  version: string,
): string {
  return `${wrapperBase(type, name)}${toPascalCase(version)}`;
}

export type NamedEventRef = {
  type: EventType;
  name?: string;
  version: string;
  /** Stable id for error messages */
  label: string;
};

/**
 * Latest within a (type, name) group: lexicographically greatest version,
 * matching Event Studio `order_by: { event_version: desc }`. `"default"`
 * sorts before named versions such as `v1` / `v2`.
 */
export function pickLatestIndex(
  versions: ReadonlyArray<{ version: string }>,
): number {
  let latest = 0;
  for (let i = 1; i < versions.length; i += 1) {
    if (versions[i].version > versions[latest].version) {
      latest = i;
    }
  }
  return latest;
}

export function assertNoWrapperCollisions(
  names: ReadonlyArray<{
    wrapperName: string;
    latestAlias?: string;
    label: string;
  }>,
): void {
  const owners = new Map<string, string>();

  const claim = (name: string, label: string) => {
    const existing = owners.get(name);
    if (existing !== undefined) {
      throw new CliError(
        `Wrapper name collision: "${name}" is produced by both ${existing} and ${label}.`,
      );
    }
    owners.set(name, label);
  };

  for (const entry of names) {
    claim(entry.wrapperName, entry.label);
    if (entry.latestAlias !== undefined) {
      claim(entry.latestAlias, entry.label);
    }
  }
}
