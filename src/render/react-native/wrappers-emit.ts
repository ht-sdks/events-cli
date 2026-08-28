import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';
import { typeNameFor } from './types-emit';

function sdkMethod(
  event: NormalizedEvent,
): 'track' | 'screen' | 'identify' | 'group' | 'alias' {
  if (event.type === 'page' || event.type === 'screen') {
    return 'screen';
  }
  return event.type;
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

function jsStringArray(values: readonly string[]): string {
  return `[${values.map(jsString).join(', ')}]`;
}

function eventNameLiteral(event: NormalizedEvent): string {
  return jsString(event.name ?? event.type);
}

/**
 * Emit helpers + per-event wrappers for events-sdk-react-native.
 *
 * Each SDK must emit its own bind / setAtPath / withSchemaVersion (see
 * `src/render/README.md` §5). Do not import those from `src/render/shared/`.
 *
 * Context is a last-arg EnrichmentClosure, not a properties bag.
 */
export function renderWrappers(events: NormalizedEvent[]): string {
  assertNoCollisions(events, { generatedMethodName: (name) => name });

  const lines: string[] = [
    'let analytics: HightouchClient | undefined;',
    '',
    'export function setHtEvents(instance: HightouchClient): void {',
    '  analytics = instance;',
    '}',
    '',
    'function requireAnalytics(): HightouchClient {',
    '  if (analytics === undefined) {',
    "    throw new Error('Call setHtEvents(analytics) before emitting events.');",
    '  }',
    '  return analytics;',
    '}',
    '',
    'function setAtPath(',
    '  root: Record<string, unknown>,',
    '  path: readonly string[],',
    '  value: string,',
    '): Record<string, unknown> {',
    '  if (path.length === 0) return root;',
    '  const clone: Record<string, unknown> = { ...root };',
    '  let cursor = clone;',
    '  for (let i = 0; i < path.length - 1; i += 1) {',
    '    const key = path[i];',
    '    const next = cursor[key];',
    '    const child =',
    '      next !== null && typeof next === "object" && !Array.isArray(next)',
    '        ? { ...(next as Record<string, unknown>) }',
    '        : {};',
    '    cursor[key] = child;',
    '    cursor = child;',
    '  }',
    '  cursor[path[path.length - 1]] = value;',
    '  return clone;',
    '}',
    '',
    'function deepMerge(base: JsonMap, extra: JsonMap): JsonMap {',
    '  const out: JsonMap = { ...base };',
    '  for (const [key, value] of Object.entries(extra)) {',
    '    const existing = out[key];',
    '    if (',
    '      value !== null &&',
    '      typeof value === "object" &&',
    '      !Array.isArray(value) &&',
    '      existing !== null &&',
    '      typeof existing === "object" &&',
    '      !Array.isArray(existing)',
    '    ) {',
    '      out[key] = deepMerge(existing as JsonMap, value as JsonMap);',
    '    } else {',
    '      out[key] = value;',
    '    }',
    '  }',
    '  return out;',
    '}',
    '',
    'function mergeContext(event: HightouchEvent, extra: JsonMap): HightouchEvent {',
    '  const base =',
    '    event.context !== null &&',
    '    typeof event.context === "object" &&',
    '    !Array.isArray(event.context)',
    '      ? (event.context as JsonMap)',
    '      : {};',
    '  event.context = deepMerge(base, extra) as HightouchEvent["context"];',
    '  return event;',
    '}',
    '',
    'function contextEnrichment(',
    '  context: JsonMap | undefined,',
    '): EnrichmentClosure | undefined {',
    '  if (context === undefined || Object.keys(context).length === 0) {',
    '    return undefined;',
    '  }',
    '  return (event) => mergeContext(event, context);',
    '}',
    '',
    'function withSchemaVersion<T extends Record<string, unknown>>(',
    '  data: T,',
    '  context: JsonMap | undefined,',
    '  path: readonly string[] | undefined,',
    '  version: string,',
    '  envelopeKey: "properties" | "traits",',
    '): { data: T; context: JsonMap | undefined } {',
    '  if (path === undefined || path.length === 0) {',
    '    return { data, context };',
    '  }',
    '  const [head, ...rest] = path;',
    '  if (head === envelopeKey) {',
    '    return {',
    '      data: setAtPath(data, rest, version) as T,',
    '      context,',
    '    };',
    '  }',
    '  if (head === "context") {',
    '    const contextRoot =',
    '      context !== null &&',
    '      typeof context === "object" &&',
    '      !Array.isArray(context)',
    '        ? (context as Record<string, unknown>)',
    '        : {};',
    '    return {',
    '      data,',
    '      context: setAtPath(contextRoot, rest, version) as JsonMap,',
    '    };',
    '  }',
    '  return { data, context };',
    '}',
  ];

  for (const event of events) {
    lines.push('', ...renderEventWrappers(event));
  }

  return lines.join('\n');
}

function renderEventWrappers(event: NormalizedEvent): string[] {
  const typeName = typeNameFor(event);
  const method = sdkMethod(event);
  const pathLiteral =
    event.schemaVersionPath && event.schemaVersionPath.length > 0
      ? jsStringArray(event.schemaVersionPath)
      : 'undefined';
  const envelopeLiteral = jsString(event.envelopeKey);

  let fn: string[];
  if (method === 'identify') {
    fn = renderIdentifyWrappers(event, typeName, pathLiteral, envelopeLiteral);
  } else if (method === 'group') {
    fn = renderGroupWrappers(event, typeName, pathLiteral, envelopeLiteral);
  } else if (method === 'alias') {
    fn = renderAliasWrappers(event, pathLiteral, envelopeLiteral);
  } else {
    fn = renderDataWrappers(
      event,
      typeName,
      method,
      pathLiteral,
      envelopeLiteral,
    );
  }

  if (event.latestAlias !== undefined) {
    fn.push(
      '',
      `export const ${event.latestAlias}: typeof ${event.wrapperName} = ${event.wrapperName};`,
    );
  }

  return fn;
}

function injectCall(
  indent: string,
  dataExpr: string,
  pathLiteral: string,
  version: string,
  envelopeLiteral: string,
): string[] {
  return [
    `${indent}const injected = withSchemaVersion(`,
    `${indent}  ${dataExpr},`,
    `${indent}  context,`,
    `${indent}  ${pathLiteral},`,
    `${indent}  ${jsString(version)},`,
    `${indent}  ${envelopeLiteral},`,
    `${indent});`,
  ];
}

function renderDataWrappers(
  event: NormalizedEvent,
  typeName: string,
  method: 'track' | 'screen',
  pathLiteral: string,
  envelopeLiteral: string,
): string[] {
  const dataParam = event.envelopeKey === 'traits' ? 'traits' : 'properties';
  return [
    `export function ${event.wrapperName}(`,
    `  ${dataParam}: ${typeName},`,
    '  context?: JsonMap,',
    '): Promise<void> {',
    '  const htevents = requireAnalytics();',
    ...injectCall(
      '  ',
      `${dataParam} as Record<string, unknown>`,
      pathLiteral,
      event.version,
      envelopeLiteral,
    ),
    `  return htevents.${method}(`,
    `    ${eventNameLiteral(event)},`,
    '    injected.data as JsonMap,',
    '    contextEnrichment(injected.context),',
    '  );',
    '}',
  ];
}

function renderIdentifyWrappers(
  event: NormalizedEvent,
  typeName: string,
  pathLiteral: string,
  envelopeLiteral: string,
): string[] {
  return [
    `export function ${event.wrapperName}(`,
    `  traits: ${typeName},`,
    '  context?: JsonMap,',
    '): Promise<void>;',
    `export function ${event.wrapperName}(`,
    '  userId: string,',
    `  traits: ${typeName},`,
    '  context?: JsonMap,',
    '): Promise<void>;',
    `export function ${event.wrapperName}(`,
    `  userIdOrTraits: string | ${typeName},`,
    `  traitsOrContext?: ${typeName} | JsonMap,`,
    '  maybeContext?: JsonMap,',
    '): Promise<void> {',
    '  const htevents = requireAnalytics();',
    '  const userId =',
    '    typeof userIdOrTraits === "string" ? userIdOrTraits : undefined;',
    `  const traits = (`,
    '    typeof userIdOrTraits === "string" ? traitsOrContext : userIdOrTraits',
    `  ) as ${typeName};`,
    '  const context =',
    '    typeof userIdOrTraits === "string"',
    '      ? maybeContext',
    '      : (traitsOrContext as JsonMap | undefined);',
    ...injectCall(
      '  ',
      '(traits ?? {}) as Record<string, unknown>',
      pathLiteral,
      event.version,
      envelopeLiteral,
    ),
    '  return htevents.identify(',
    '    userId,',
    '    injected.data as UserTraits,',
    '    contextEnrichment(injected.context),',
    '  );',
    '}',
  ];
}

function renderGroupWrappers(
  event: NormalizedEvent,
  typeName: string,
  pathLiteral: string,
  envelopeLiteral: string,
): string[] {
  return [
    `export function ${event.wrapperName}(`,
    '  groupId: string,',
    `  traits: ${typeName},`,
    '  context?: JsonMap,',
    '): Promise<void> {',
    '  const htevents = requireAnalytics();',
    ...injectCall(
      '  ',
      '(traits ?? {}) as Record<string, unknown>',
      pathLiteral,
      event.version,
      envelopeLiteral,
    ),
    '  return htevents.group(',
    '    groupId,',
    '    injected.data as GroupTraits,',
    '    contextEnrichment(injected.context),',
    '  );',
    '}',
  ];
}

function renderAliasWrappers(
  event: NormalizedEvent,
  pathLiteral: string,
  envelopeLiteral: string,
): string[] {
  return [
    `export function ${event.wrapperName}(`,
    '  newUserId: string,',
    '  context?: JsonMap,',
    '): Promise<void> {',
    '  const htevents = requireAnalytics();',
    ...injectCall('  ', '{}', pathLiteral, event.version, envelopeLiteral),
    '  return htevents.alias(',
    '    newUserId,',
    '    contextEnrichment(injected.context),',
    '  );',
    '}',
  ];
}
