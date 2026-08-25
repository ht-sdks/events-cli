import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';
import { snakeName, typeNameFor } from './names';

function pyString(value: string): string {
  return JSON.stringify(value);
}

function pyStringList(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return 'None';
  }
  return `[${values.map(pyString).join(', ')}]`;
}

function renderHelpers(): string {
  return [
    'def to_value(value: Any) -> Any:',
    '    if is_dataclass(value) and not isinstance(value, type):',
    '        return to_map(value)',
    '    if isinstance(value, dict):',
    '        return {k: to_value(v) for k, v in value.items() if v is not None}',
    '    if isinstance(value, list):',
    '        return [to_value(el) for el in value]',
    '    return value',
    '',
    'def to_map(value: Any) -> Dict[str, Any]:',
    '    if value is None:',
    '        return {}',
    '    if is_dataclass(value) and not isinstance(value, type):',
    '        out: Dict[str, Any] = {}',
    '        for item in fields(value):',
    '            nested = getattr(value, item.name)',
    '            if nested is None:',
    '                continue',
    '            key = item.metadata.get("json", item.name)',
    '            out[key] = to_value(nested)',
    '        return out',
    '    if isinstance(value, dict):',
    '        return {k: to_value(v) for k, v in value.items() if v is not None}',
    '    return dict(value)',
    '',
    'def set_at_path(root: Dict[str, Any], path: List[str], value: str) -> Dict[str, Any]:',
    '    if len(path) == 0:',
    '        return root',
    '    clone = dict(root)',
    '    cursor = clone',
    '    for key in path[:-1]:',
    '        nxt = cursor.get(key)',
    '        child = dict(nxt) if isinstance(nxt, dict) else {}',
    '        cursor[key] = child',
    '        cursor = child',
    '    cursor[path[-1]] = value',
    '    return clone',
    '',
    'def with_schema_version(',
    '    data: Dict[str, Any],',
    '    context: Optional[Dict[str, Any]],',
    '    path: Optional[List[str]],',
    '    version: str,',
    '    envelope_key: str,',
    ') -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:',
    '    if path is None or len(path) == 0:',
    '        return data, context',
    '    head, rest = path[0], path[1:]',
    '    if head == envelope_key:',
    '        return set_at_path(dict(data), rest, version), context',
    '    if head == "context":',
    '        ctx = dict(context) if isinstance(context, dict) else {}',
    '        return data, set_at_path(ctx, rest, version)',
    '    return data, context',
  ].join('\n');
}

function extraKwargs(includeAnonymousId = true): string[] {
  const lines = [
    '    context: Optional[Dict[str, Any]] = None,',
    '    timestamp: Any = None,',
    '    integrations: Optional[Dict[str, Any]] = None,',
  ];
  if (includeAnonymousId) {
    lines.unshift('    anonymous_id: Optional[str] = None,');
  }
  return lines;
}

function extraCallKwargs(): string[] {
  return [
    '        anonymous_id=anonymous_id,',
    '        context=ctx,',
    '        timestamp=timestamp,',
    '        integrations=integrations,',
  ];
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = snakeName(event.wrapperName);
  const pathLiteral = pyStringList(event.schemaVersionPath);
  const version = pyString(event.version);
  const envelope = pyString(event.envelopeKey);
  const lines = [
    `def ${fn}(`,
    '    client: Client,',
    '    user_id: str,',
    '    previous_id: str,',
    ...extraKwargs(false),
    ') -> None:',
    `    _, ctx = with_schema_version({}, context, ${pathLiteral}, ${version}, ${envelope})`,
    '    client.alias(',
    '        user_id=user_id,',
    '        previous_id=previous_id,',
    '        context=ctx,',
    '        timestamp=timestamp,',
    '        integrations=integrations,',
    '    )',
  ];
  if (event.latestAlias !== undefined) {
    lines.push('', `${snakeName(event.latestAlias)} = ${fn}`);
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = snakeName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = pyStringList(event.schemaVersionPath);
  const version = pyString(event.version);
  const envelope = pyString(event.envelopeKey);
  const lines = [
    `def ${fn}(`,
    '    client: Client,',
    '    group_id: str,',
    '    user_id: Optional[str] = None,',
    `    traits: Optional[${typeName}] = None,`,
    ...extraKwargs(),
    ') -> None:',
    `    data, ctx = with_schema_version(to_map(traits), context, ${pathLiteral}, ${version}, ${envelope})`,
    '    client.group(',
    '        group_id=group_id,',
    '        user_id=user_id,',
    '        traits=data,',
    ...extraCallKwargs(),
    '    )',
  ];
  if (event.latestAlias !== undefined) {
    lines.push('', `${snakeName(event.latestAlias)} = ${fn}`);
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = snakeName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = pyStringList(event.schemaVersionPath);
  const version = pyString(event.version);
  const envelope = pyString(event.envelopeKey);
  const lines = [
    `def ${fn}(`,
    '    client: Client,',
    '    user_id: Optional[str] = None,',
    `    traits: Optional[${typeName}] = None,`,
    ...extraKwargs(),
    ') -> None:',
    `    data, ctx = with_schema_version(to_map(traits), context, ${pathLiteral}, ${version}, ${envelope})`,
    '    client.identify(',
    '        user_id=user_id,',
    '        traits=data,',
    ...extraCallKwargs(),
    '    )',
  ];
  if (event.latestAlias !== undefined) {
    lines.push('', `${snakeName(event.latestAlias)} = ${fn}`);
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = snakeName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = pyStringList(event.schemaVersionPath);
  const version = pyString(event.version);
  const envelope = pyString(event.envelopeKey);
  const method = event.type;
  const extra: string[] = [];
  if (method === 'track') {
    extra.push(`        event=${pyString(event.name ?? event.type)},`);
  } else if (
    (method === 'page' || method === 'screen') &&
    event.name !== undefined &&
    event.name.trim() !== ''
  ) {
    extra.push(`        name=${pyString(event.name)},`);
  }
  const lines = [
    `def ${fn}(`,
    '    client: Client,',
    '    user_id: Optional[str] = None,',
    `    properties: Optional[${typeName}] = None,`,
    ...extraKwargs(),
    ') -> None:',
    `    data, ctx = with_schema_version(to_map(properties), context, ${pathLiteral}, ${version}, ${envelope})`,
    `    client.${method}(`,
    '        user_id=user_id,',
    ...extra,
    '        properties=data,',
    ...extraCallKwargs(),
    '    )',
  ];
  if (event.latestAlias !== undefined) {
    lines.push('', `${snakeName(event.latestAlias)} = ${fn}`);
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
    generatedMethodName: snakeName,
    generatedTypeName: typeNameFor,
  });
  const parts = [renderHelpers()];
  for (const event of events) {
    parts.push(renderEventWrappers(event).join('\n'));
  }
  return parts.join('\n\n');
}
