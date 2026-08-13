import { createHash } from 'crypto';
import { cliPackage } from '../lib/package-info';
import type { NormalizedEvent } from '../normalize/types';

export const LOCKFILE_VERSION = 1;
export const LOCKFILE_NAME = 'htevents.lock.json';

export type LockfileEvent = {
  domainSlug: string;
  type: string;
  name: string | null;
  eventVersion: string;
  wrapperName: string;
  latestAlias: string | null;
  schemaHash: string;
};

export type Lockfile = {
  version: typeof LOCKFILE_VERSION;
  writeKey: string;
  generator: { name: string; version: string };
  events: LockfileEvent[];
};

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = canonicalJson((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function hashSchema(schema: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(schema)))
    .digest('hex');
}

export function buildLockfile(
  writeKey: string,
  events: NormalizedEvent[],
): Lockfile {
  const { name, version } = cliPackage();
  const entries: LockfileEvent[] = [...events]
    .sort((a, b) => a.wrapperName.localeCompare(b.wrapperName))
    .map((event) => ({
      domainSlug: event.domainSlug ?? event.domainName,
      type: event.type,
      name: event.name ?? null,
      eventVersion: event.version,
      wrapperName: event.wrapperName,
      latestAlias: event.latestAlias ?? null,
      schemaHash: hashSchema(event.schema),
    }));

  return {
    version: LOCKFILE_VERSION,
    writeKey,
    generator: { name, version },
    events: entries,
  };
}

export function serializeLockfile(lockfile: Lockfile): string {
  return `${JSON.stringify(lockfile, null, 2)}\n`;
}
