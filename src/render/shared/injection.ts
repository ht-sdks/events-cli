/**
 * Where a wrapper should write `event.version` for a `schemaVersionPath`.
 * Mirrors event-router `getCacheKey`: only this event's envelope key or
 * `context` are injectable. Wrong-envelope, empty paths, and alias data
 * paths are no-ops.
 *
 * Language-specific `wrappers-emit.ts` still print the SDK call shape; they
 * should implement this policy, not invent a parallel one. Do not unify those
 * printers into one IR until a third renderer needs it.
 */
export type SchemaVersionTarget = 'data' | 'context' | 'none';

export function schemaVersionTarget(
  path: readonly string[] | undefined,
  envelopeKey: string,
  hasDataArgument: boolean = true,
): SchemaVersionTarget {
  if (path === undefined || path.length === 0) {
    return 'none';
  }
  const head = path[0];
  if (head === 'context') {
    return 'context';
  }
  if (hasDataArgument && head === envelopeKey) {
    return 'data';
  }
  return 'none';
}

/** Path to embed in generated wrappers; `undefined` means skip injection. */
export function injectableSchemaVersionPath(event: {
  type: string;
  envelopeKey: string;
  schemaVersionPath?: readonly string[];
}): readonly string[] | undefined {
  const target = schemaVersionTarget(
    event.schemaVersionPath,
    event.envelopeKey,
    event.type !== 'alias',
  );
  if (target === 'none') {
    return undefined;
  }
  return event.schemaVersionPath;
}
