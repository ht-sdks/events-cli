import type { NormalizedEvent } from '../../normalize/types';
import { typeNameFor } from './types-emit';

function sdkMethod(event: NormalizedEvent): string {
  return event.type;
}

function dataParamName(event: NormalizedEvent): 'properties' | 'traits' {
  return event.envelopeKey === 'traits' ? 'traits' : 'properties';
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

function jsStringArray(values: readonly string[]): string {
  return `[${values.map(jsString).join(', ')}]`;
}

/**
 * Emit helpers + per-event wrappers for events-sdk-js-node.
 *
 * Each SDK must emit its own bind / setAtPath / withSchemaVersion (see
 * `src/render/README.md` §5). Do not import those from `src/render/shared/`.
 */
export function renderWrappers(events: NormalizedEvent[]): string {
  const lines: string[] = [
    'export type CallOptions = {',
    '  anonymousId?: string;',
    "  context?: TrackParams['context'];",
    "  timestamp?: TrackParams['timestamp'];",
    "  integrations?: TrackParams['integrations'];",
    '};',
    '',
    'let analytics: HtEvents | undefined;',
    '',
    'export function setHtEvents(instance: HtEvents): void {',
    '  analytics = instance;',
    '}',
    '',
    'function requireAnalytics(): HtEvents {',
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
    'function withSchemaVersion<T extends Record<string, unknown>>(',
    '  data: T,',
    '  options: CallOptions | undefined,',
    '  path: readonly string[] | undefined,',
    '  version: string,',
    '  envelopeKey: "properties" | "traits",',
    '): { data: T; options: CallOptions | undefined } {',
    '  if (path === undefined || path.length === 0) {',
    '    return { data, options };',
    '  }',
    '  const [head, ...rest] = path;',
    '  if (head === envelopeKey) {',
    '    return {',
    '      data: setAtPath(data, rest, version) as T,',
    '      options,',
    '    };',
    '  }',
    '  if (head === "context") {',
    '    const contextRoot =',
    '      options?.context !== null &&',
    '      typeof options?.context === "object" &&',
    '      !Array.isArray(options.context)',
    '        ? (options.context as Record<string, unknown>)',
    '        : {};',
    '    return {',
    '      data,',
    '      options: {',
    '        ...options,',
    '        context: setAtPath(contextRoot, rest, version),',
    '      },',
    '    };',
    '  }',
    '  return { data, options };',
    '}',
  ];

  for (const event of events) {
    lines.push('', ...renderEventWrappers(event));
  }

  return lines.join('\n');
}

function renderEventWrappers(event: NormalizedEvent): string[] {
  const typeName = typeNameFor(event);
  const dataParam = dataParamName(event);
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
      dataParam,
      method,
      pathLiteral,
      envelopeLiteral,
    );
  }

  if (event.latestAlias !== undefined) {
    fn.push('', `export const ${event.latestAlias} = ${event.wrapperName};`);
  }

  return fn;
}

function injectCall(
  indent: string,
  dataExpr: string,
  optionsExpr: string,
  pathLiteral: string,
  version: string,
  envelopeLiteral: string,
): string[] {
  return [
    `${indent}const injected = withSchemaVersion(`,
    `${indent}  ${dataExpr},`,
    `${indent}  ${optionsExpr},`,
    `${indent}  ${pathLiteral},`,
    `${indent}  ${jsString(version)},`,
    `${indent}  ${envelopeLiteral},`,
    `${indent});`,
  ];
}

function identityFields(indent: string): string[] {
  return [
    `${indent}anonymousId: injected.options?.anonymousId,`,
    `${indent}context: injected.options?.context,`,
    `${indent}timestamp: injected.options?.timestamp,`,
    `${indent}integrations: injected.options?.integrations,`,
  ];
}

function renderDataWrappers(
  event: NormalizedEvent,
  typeName: string,
  dataParam: 'properties' | 'traits',
  method: string,
  pathLiteral: string,
  envelopeLiteral: string,
): string[] {
  const payloadField = method === 'track' ? 'event' : 'name';
  const payloadValue =
    method === 'track'
      ? jsString(event.name ?? event.type)
      : event.name !== undefined && event.name.trim() !== ''
        ? jsString(event.name)
        : undefined;

  return [
    `export function ${event.wrapperName}(`,
    '  userId: string,',
    `  ${dataParam}: ${typeName},`,
    '  options?: CallOptions,',
    '): void {',
    '  const htevents = requireAnalytics();',
    ...injectCall(
      '  ',
      `${dataParam} as Record<string, unknown>`,
      'options',
      pathLiteral,
      event.version,
      envelopeLiteral,
    ),
    `  htevents.${method}({`,
    ...(payloadValue !== undefined
      ? [`    ${payloadField}: ${payloadValue},`]
      : []),
    '    userId,',
    `    ${dataParam}: injected.data,`,
    ...identityFields('    '),
    '  });',
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
    '  userId: string,',
    `  traits?: ${typeName},`,
    '  options?: CallOptions,',
    '): void {',
    '  const htevents = requireAnalytics();',
    ...injectCall(
      '  ',
      '(traits ?? {}) as Record<string, unknown>',
      'options',
      pathLiteral,
      event.version,
      envelopeLiteral,
    ),
    '  htevents.identify({',
    '    userId,',
    '    traits: injected.data,',
    ...identityFields('    '),
    '  });',
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
    '  userId: string,',
    `  traits: ${typeName},`,
    '  options?: CallOptions,',
    '): void {',
    '  const htevents = requireAnalytics();',
    ...injectCall(
      '  ',
      'traits as Record<string, unknown>',
      'options',
      pathLiteral,
      event.version,
      envelopeLiteral,
    ),
    '  htevents.group({',
    '    groupId,',
    '    userId,',
    '    traits: injected.data,',
    ...identityFields('    '),
    '  });',
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
    '  userId: string,',
    '  previousId: string,',
    '  options?: CallOptions,',
    '): void {',
    '  const htevents = requireAnalytics();',
    ...injectCall(
      '  ',
      '{}',
      'options',
      pathLiteral,
      event.version,
      envelopeLiteral,
    ),
    '  htevents.alias({',
    '    userId,',
    '    previousId,',
    '    context: injected.options?.context,',
    '    timestamp: injected.options?.timestamp,',
    '    integrations: injected.options?.integrations,',
    '  });',
    '}',
  ];
}
