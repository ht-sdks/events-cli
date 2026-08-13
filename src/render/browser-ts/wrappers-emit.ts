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
 *   properties.* / traits.* → the props/traits argument
 *   context.* → options.context
 *   empty/absent → no injection (router uses default_schema_version)
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
    '): { data: T; options: Options | undefined } {',
    '  if (path === undefined || path.length === 0) {',
    '    return { data, options };',
    '  }',
    '  const [head, ...rest] = path;',
    '  if (head === "properties" || head === "traits") {',
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
  const call = sdkCall(event, method);

  const fn = [
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
    '  );',
    `  return ${call}`,
    '}',
  ];

  if (event.latestAlias !== undefined) {
    fn.push('', `export const ${event.latestAlias} = ${event.wrapperName};`);
  }

  return fn;
}

function sdkCall(event: NormalizedEvent, method: string): string {
  if (method === 'track') {
    const eventName = event.name ?? event.type;
    return `htevents.track(${jsString(eventName)}, injected.data, injected.options);`;
  }
  if (method === 'identify' || method === 'group') {
    return `htevents.${method}(injected.data, injected.options);`;
  }
  if (event.name !== undefined && event.name.trim() !== '') {
    return `htevents.${method}(undefined, ${jsString(event.name)}, injected.data, injected.options);`;
  }
  return `htevents.${method}(injected.data, injected.options);`;
}
