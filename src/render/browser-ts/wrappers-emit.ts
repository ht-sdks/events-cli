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
 * Emit helpers + per-event wrappers.
 *
 * Version injection follows event-router `getCacheKey` in
 * hightouchio/hightouch packages/backend/core/events/event-router/schemas/cache-key.ts,
 * which walks the full Segment payload at `schema_version_path`:
 *   properties.* → properties argument (track/page/screen only)
 *   traits.* → traits argument (identify/group only)
 *   context.* → options.context
 *   alias has no properties/traits argument; only context.* is injected
 *   empty/absent, or a head that is not this event's envelope / context
 *     → no injection (router uses default_schema_version)
 */
export function renderWrappers(events: NormalizedEvent[]): string {
  const lines: string[] = [
    'let analytics: HtEventsBrowser | undefined;',
    '',
    'export function setHtEvents(instance: HtEventsBrowser): void {',
    '  analytics = instance;',
    '}',
    '',
    'function requireAnalytics(): HtEventsBrowser {',
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
    '  options: Options | undefined,',
    '  path: readonly string[] | undefined,',
    '  version: string,',
    '  envelopeKey: "properties" | "traits",',
    '): { data: T; options: Options | undefined } {',
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
  if (method === 'identify' || method === 'group') {
    fn = renderIdWrappers(
      event,
      typeName,
      dataParam,
      method,
      pathLiteral,
      envelopeLiteral,
    );
  } else if (method === 'alias') {
    fn = renderAliasWrappers(event, method, pathLiteral, envelopeLiteral);
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

function renderDataWrappers(
  event: NormalizedEvent,
  typeName: string,
  dataParam: 'properties' | 'traits',
  method: string,
  pathLiteral: string,
  envelopeLiteral: string,
): string[] {
  return [
    `export function ${event.wrapperName}(`,
    `  ${dataParam}: ${typeName},`,
    '  options?: Options,',
    `): ReturnType<HtEventsBrowser['${method}']> {`,
    '  const htevents = requireAnalytics();',
    '  const injected = withSchemaVersion(',
    `    ${dataParam} as Record<string, unknown>,`,
    '    options,',
    `    ${pathLiteral},`,
    `    ${jsString(event.version)},`,
    `    ${envelopeLiteral},`,
    '  );',
    `  return ${sdkCall(event, method)}`,
    '}',
  ];
}

function renderAliasWrappers(
  event: NormalizedEvent,
  method: string,
  pathLiteral: string,
  envelopeLiteral: string,
): string[] {
  const returnType = `ReturnType<HtEventsBrowser['${method}']>`;
  return [
    `export function ${event.wrapperName}(`,
    '  to: string,',
    '  options?: Options,',
    `): ${returnType};`,
    `export function ${event.wrapperName}(`,
    '  to: string,',
    '  from?: string,',
    '  options?: Options,',
    `): ${returnType};`,
    `export function ${event.wrapperName}(`,
    '  to: string,',
    '  fromOrOptions?: string | Options,',
    '  maybeOptions?: Options,',
    `): ${returnType} {`,
    '  const htevents = requireAnalytics();',
    '  const from = typeof fromOrOptions === "string" ? fromOrOptions : undefined;',
    '  const options = typeof fromOrOptions === "string" ? maybeOptions : fromOrOptions;',
    '  const injected = withSchemaVersion(',
    '    {},',
    '    options,',
    `    ${pathLiteral},`,
    `    ${jsString(event.version)},`,
    `    ${envelopeLiteral},`,
    '  );',
    '  return htevents.alias(to, from, injected.options);',
    '}',
  ];
}

function renderIdWrappers(
  event: NormalizedEvent,
  typeName: string,
  dataParam: 'properties' | 'traits',
  method: string,
  pathLiteral: string,
  envelopeLiteral: string,
): string[] {
  const idParam = method === 'group' ? 'groupId' : 'userId';
  const returnType = `ReturnType<HtEventsBrowser['${method}']>`;
  const inject = (
    indent: string,
    dataExpr: string,
    optionsExpr: string,
  ): string[] => [
    `${indent}const injected = withSchemaVersion(`,
    `${indent}  ${dataExpr},`,
    `${indent}  ${optionsExpr},`,
    `${indent}  ${pathLiteral},`,
    `${indent}  ${jsString(event.version)},`,
    `${indent}  ${envelopeLiteral},`,
    `${indent});`,
  ];
  return [
    `export function ${event.wrapperName}(`,
    `  ${idParam}: string,`,
    `  ${dataParam}?: ${typeName},`,
    '  options?: Options,',
    `): ${returnType};`,
    `export function ${event.wrapperName}(`,
    `  ${dataParam}?: ${typeName},`,
    '  options?: Options,',
    `): ${returnType};`,
    `export function ${event.wrapperName}(`,
    `  idOrTraits?: string | ${typeName},`,
    `  traitsOrOptions?: ${typeName} | Options,`,
    '  maybeOptions?: Options,',
    `): ${returnType} {`,
    '  const htevents = requireAnalytics();',
    '  if (typeof idOrTraits === "string") {',
    ...inject(
      '    ',
      `((traitsOrOptions as ${typeName} | undefined) ?? {}) as Record<string, unknown>`,
      'maybeOptions',
    ),
    `    return htevents.${method}(idOrTraits, injected.data, injected.options);`,
    '  }',
    ...inject(
      '  ',
      '(idOrTraits ?? {}) as Record<string, unknown>',
      'traitsOrOptions as Options | undefined',
    ),
    `  return htevents.${method}(injected.data, injected.options);`,
    '}',
  ];
}

function sdkCall(event: NormalizedEvent, method: string): string {
  if (method === 'track') {
    const eventName = event.name ?? event.type;
    return `htevents.track(${jsString(eventName)}, injected.data, injected.options);`;
  }
  if (event.name !== undefined && event.name.trim() !== '') {
    return `htevents.${method}(undefined, ${jsString(event.name)}, injected.data, injected.options);`;
  }
  return `htevents.${method}(injected.data, injected.options);`;
}
