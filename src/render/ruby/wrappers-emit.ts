import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';
import { snakeName, typeNameFor } from './names';

function rbString(value: string): string {
  return JSON.stringify(value);
}

function rbStringArray(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return 'nil';
  }
  return `[${values.map(rbString).join(', ')}]`;
}

function renderHelpers(): string {
  return [
    'def self.to_map(value)',
    '  return {} if value.nil?',
    '  hash = if value.is_a?(Hash)',
    '           value',
    '         elsif value.respond_to?(:to_h)',
    '           value.to_h',
    '         else',
    '           {}',
    '         end',
    '  hash.each_with_object({}) do |(key, val), out|',
    '    out[key.to_s] = val unless val.nil?',
    '  end',
    'end',
    '',
    'def self.set_at_path(root, path, value)',
    '  return root if path.nil? || path.empty?',
    '  clone = root.dup',
    '  cursor = clone',
    '  path[0...-1].each do |key|',
    '    nxt = cursor[key]',
    '    child = nxt.is_a?(Hash) ? nxt.dup : {}',
    '    cursor[key] = child',
    '    cursor = child',
    '  end',
    '  cursor[path[-1]] = value',
    '  clone',
    'end',
    '',
    'def self.with_schema_version(data, context, path, version, envelope_key)',
    '  return [data, context] if path.nil? || path.empty?',
    '  head, *rest = path',
    '  if head == envelope_key',
    '    return [set_at_path(data.dup, rest, version), context]',
    '  end',
    '  if head == "context"',
    '    ctx = context.is_a?(Hash) ? context.dup : {}',
    '    return [data, set_at_path(ctx, rest, version)]',
    '  end',
    '  [data, context]',
    'end',
    '',
    'class << self',
    '  private :to_map, :set_at_path, :with_schema_version',
    'end',
  ].join('\n');
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = snakeName(event.wrapperName);
  const pathLiteral = rbStringArray(event.schemaVersionPath);
  const version = rbString(event.version);
  const envelope = rbString(event.envelopeKey);
  const lines = [
    `def self.${fn}(client, user_id, previous_id, **opts)`,
    `  _, ctx = with_schema_version({}, opts[:context], ${pathLiteral}, ${version}, ${envelope})`,
    '  client.alias(',
    '    user_id: user_id,',
    '    previous_id: previous_id,',
    '    context: ctx,',
    '    anonymous_id: opts[:anonymous_id],',
    '    timestamp: opts[:timestamp],',
    '    integrations: opts[:integrations]',
    '  )',
    'end',
  ];
  if (event.latestAlias !== undefined) {
    lines.push('', `def self.${snakeName(event.latestAlias)}(*args, **opts)`);
    lines.push(`  ${fn}(*args, **opts)`);
    lines.push('end');
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = snakeName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = rbStringArray(event.schemaVersionPath);
  const version = rbString(event.version);
  const envelope = rbString(event.envelopeKey);
  const lines = [
    `def self.${fn}(client, group_id, user_id, traits = ${typeName}.new, **opts)`,
    `  data, ctx = with_schema_version(to_map(traits), opts[:context], ${pathLiteral}, ${version}, ${envelope})`,
    '  client.group(',
    '    group_id: group_id,',
    '    user_id: user_id,',
    '    traits: data,',
    '    context: ctx,',
    '    anonymous_id: opts[:anonymous_id],',
    '    timestamp: opts[:timestamp],',
    '    integrations: opts[:integrations]',
    '  )',
    'end',
  ];
  if (event.latestAlias !== undefined) {
    lines.push('', `def self.${snakeName(event.latestAlias)}(*args, **opts)`);
    lines.push(`  ${fn}(*args, **opts)`);
    lines.push('end');
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = snakeName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = rbStringArray(event.schemaVersionPath);
  const version = rbString(event.version);
  const envelope = rbString(event.envelopeKey);
  const lines = [
    `def self.${fn}(client, user_id, traits = ${typeName}.new, **opts)`,
    `  data, ctx = with_schema_version(to_map(traits), opts[:context], ${pathLiteral}, ${version}, ${envelope})`,
    '  client.identify(',
    '    user_id: user_id,',
    '    traits: data,',
    '    context: ctx,',
    '    anonymous_id: opts[:anonymous_id],',
    '    timestamp: opts[:timestamp],',
    '    integrations: opts[:integrations]',
    '  )',
    'end',
  ];
  if (event.latestAlias !== undefined) {
    lines.push('', `def self.${snakeName(event.latestAlias)}(*args, **opts)`);
    lines.push(`  ${fn}(*args, **opts)`);
    lines.push('end');
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = snakeName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = rbStringArray(event.schemaVersionPath);
  const version = rbString(event.version);
  const envelope = rbString(event.envelopeKey);
  const method = event.type;
  const extra: string[] = [];
  if (method === 'track') {
    extra.push(`    event: ${rbString(event.name ?? event.type)},`);
  } else if (
    (method === 'page' || method === 'screen') &&
    event.name !== undefined &&
    event.name.trim() !== ''
  ) {
    extra.push(`    name: ${rbString(event.name)},`);
  }
  const defaultProps =
    event.schema.properties !== undefined &&
    typeof event.schema.properties === 'object' &&
    event.schema.properties !== null &&
    Object.keys(event.schema.properties).length > 0
      ? `${typeName}.new`
      : '{}';
  const lines = [
    `def self.${fn}(client, user_id, properties = ${defaultProps}, **opts)`,
    `  data, ctx = with_schema_version(to_map(properties), opts[:context], ${pathLiteral}, ${version}, ${envelope})`,
    `  client.${method}(`,
    '    user_id: user_id,',
    ...extra,
    '    properties: data,',
    '    context: ctx,',
    '    anonymous_id: opts[:anonymous_id],',
    '    timestamp: opts[:timestamp],',
    '    integrations: opts[:integrations]',
    '  )',
    'end',
  ];
  if (event.latestAlias !== undefined) {
    lines.push('', `def self.${snakeName(event.latestAlias)}(*args, **opts)`);
    lines.push(`  ${fn}(*args, **opts)`);
    lines.push('end');
  }
  return lines;
}

function renderEventWrappers(event: NormalizedEvent): string[] {
  if (event.type === 'alias') {
    return renderAliasWrapper(event);
  }
  if (event.type === 'group') {
    return renderGroupWrapper(event);
  }
  if (event.type === 'identify') {
    return renderIdentifyWrapper(event);
  }
  return renderDataWrapper(event);
}

export function renderWrappers(events: NormalizedEvent[]): string {
  assertNoCollisions(events, {
    errorPrefixLabel: 'Ruby',
    generatedMethodName: snakeName,
    generatedTypeName: typeNameFor,
  });
  const inner = [
    renderHelpers(),
    ...events.map((e) => renderEventWrappers(e).join('\n')),
  ].join('\n\n');
  const indented = inner
    .split('\n')
    .map((line) => (line.length === 0 ? line : `  ${line}`))
    .join('\n');
  return `module HtEvents\n${indented}\nend`;
}
