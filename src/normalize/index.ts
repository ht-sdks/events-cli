import { CliError } from '../lib/errors';
import type { ContractBundle, Domain, DomainEvent } from '../input/types';
import { unwrapEnvelope, envelopeKeyForType } from './envelope';
import { flattenComponentRefs } from './flatten';
import {
  assertNoWrapperCollisions,
  pickLatestIndex,
  versionedWrapperName,
  wrapperBase,
} from './names';
import type { NormalizedEvent } from './types';
import type { JsonSchema } from '../input/types';

type GroupKey = string;

function groupKey(type: string, name: string | undefined): GroupKey {
  return `${type}\0${name ?? ''}`;
}

function eventLabel(
  domain: Domain,
  event: DomainEvent,
  version: string,
): string {
  const domainPart = domain.slug ?? domain.name;
  const namePart = event.name ?? event.type;
  return `${domainPart}/${event.type}/${namePart}@${version}`;
}

function componentsForDomain(domain: Domain) {
  return (domain.components ?? [])
    .filter((c): c is typeof c & { slug: string } => Boolean(c.slug))
    .map((c) => ({ slug: c.slug, schema: c.schema }));
}

function normalizeEventSchema(event: DomainEvent, domain: Domain): JsonSchema {
  const components = componentsForDomain(domain);
  let flattened: unknown;
  try {
    flattened = flattenComponentRefs(event.schema, components);
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError(
      err instanceof Error
        ? err.message
        : `Failed to flatten refs: ${String(err)}`,
    );
  }
  return unwrapEnvelope(flattened as JsonSchema, event.type);
}

/**
 * Normalize a raw ContractBundle into emitable events.
 *
 * Latest-version policy (documented for tests): within each
 * (domain, type, name) group, the lexicographically greatest `version`
 * is latest (same as Event Studio `event_version: desc`). Every version
 * gets a suffixed `wrapperName`; only the latest also gets an unsuffixed
 * `latestAlias`.
 */
export function normalize(bundle: ContractBundle): NormalizedEvent[] {
  type Draft = Omit<NormalizedEvent, 'latestAlias'> & {
    group: GroupKey;
    label: string;
  };

  const drafts: Draft[] = [];

  for (const domain of bundle.domains) {
    for (const event of domain.events ?? []) {
      const version = event.version?.trim() || 'default';
      const schema = normalizeEventSchema(event, domain);
      const wrapperName = versionedWrapperName(event.type, event.name, version);
      const label = eventLabel(domain, event, version);

      drafts.push({
        type: event.type,
        ...(event.name !== undefined ? { name: event.name } : {}),
        version,
        domainName: domain.name,
        ...(domain.slug !== undefined ? { domainSlug: domain.slug } : {}),
        ...(domain.schemaVersionPath !== undefined
          ? { schemaVersionPath: domain.schemaVersionPath }
          : {}),
        envelopeKey: envelopeKeyForType[event.type],
        schema,
        wrapperName,
        group: groupKey(event.type, event.name),
        label,
      });
    }
  }

  // Assign latest aliases per (domain + type + name) — include domain in group
  // so the same event name in two domains does not share "latest".
  const byGroup = new Map<string, number[]>();
  drafts.forEach((draft, index) => {
    const key = `${draft.domainSlug ?? draft.domainName}\0${draft.group}`;
    const list = byGroup.get(key) ?? [];
    list.push(index);
    byGroup.set(key, list);
  });

  const events: NormalizedEvent[] = drafts.map((draft) => ({
    type: draft.type,
    ...(draft.name !== undefined ? { name: draft.name } : {}),
    version: draft.version,
    domainName: draft.domainName,
    ...(draft.domainSlug !== undefined ? { domainSlug: draft.domainSlug } : {}),
    ...(draft.schemaVersionPath !== undefined
      ? { schemaVersionPath: draft.schemaVersionPath }
      : {}),
    envelopeKey: draft.envelopeKey,
    schema: draft.schema,
    wrapperName: draft.wrapperName,
  }));

  for (const indices of byGroup.values()) {
    const latestLocal = pickLatestIndex(
      indices.map((i) => ({ version: drafts[i].version })),
    );
    const latestDraft = drafts[indices[latestLocal]];
    const alias = wrapperBase(latestDraft.type, latestDraft.name);
    events[indices[latestLocal]] = {
      ...events[indices[latestLocal]],
      latestAlias: alias,
    };
  }

  assertNoWrapperCollisions(
    events.map((event, i) => ({
      wrapperName: event.wrapperName,
      latestAlias: event.latestAlias,
      label: drafts[i].label,
    })),
  );

  return events;
}
