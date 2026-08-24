import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';
import { methodName, typeNameFor } from './names';

function swiftString(value: string): string {
  return JSON.stringify(value);
}

function swiftStringArray(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return '[]';
  }
  return `[${values.map(swiftString).join(', ')}]`;
}

function eventNameLiteral(event: NormalizedEvent): string {
  return swiftString(event.name ?? event.type);
}

/** Generated helpers. Duplicate per SDK — see `src/render/README.md` §5. */
function renderHelpers(): string {
  return [
    'fileprivate func cloneMap(_ map: [String: Any]) -> [String: Any] {',
    '    var out: [String: Any] = [:]',
    '    for (key, value) in map {',
    '        out[key] = value',
    '    }',
    '    return out',
    '}',
    '',
    'fileprivate func setAtPath(_ root: [String: Any], _ path: [String], _ value: String) -> [String: Any] {',
    '    if path.isEmpty {',
    '        return root',
    '    }',
    '    if path.count == 1 {',
    '        var clone = cloneMap(root)',
    '        clone[path[0]] = value',
    '        return clone',
    '    }',
    '    let key = path[0]',
    '    let rest = Array(path.dropFirst())',
    '    let child = root[key] as? [String: Any] ?? [:]',
    '    var clone = cloneMap(root)',
    '    clone[key] = setAtPath(child, rest, value)',
    '    return clone',
    '}',
    '',
    'fileprivate func toMap<T: Encodable>(_ value: T) -> [String: Any] {',
    '    guard let data = try? JSONEncoder().encode(value),',
    '          let object = try? JSONSerialization.jsonObject(with: data),',
    '          let map = object as? [String: Any]',
    '    else {',
    '        return [:]',
    '    }',
    '    return map',
    '}',
    '',
    'fileprivate func withSchemaVersion(',
    '    _ data: [String: Any],',
    '    _ extraContext: [String: Any]?,',
    '    _ path: [String],',
    '    _ version: String,',
    '    _ envelopeKey: String',
    ') -> (data: [String: Any], context: [String: Any]?) {',
    '    if path.isEmpty {',
    '        return (data, extraContext)',
    '    }',
    '    let head = path[0]',
    '    let rest = Array(path.dropFirst())',
    '    if head == envelopeKey {',
    '        return (setAtPath(data, rest, version), extraContext)',
    '    }',
    '    if head == "context" {',
    '        return (data, setAtPath(extraContext ?? [:], rest, version))',
    '    }',
    '    return (data, extraContext)',
    '}',
    '',
    'extension Analytics {',
    '    fileprivate func emitWithContext(_ context: [String: Any], _ body: () -> Void) {',
    '        let plugin = add(enrichment: { event in',
    '            guard var working = event else { return event }',
    '            var merged = working.context?.dictionaryValue ?? [:]',
    '            for (key, value) in context {',
    '                if var existing = merged[key] as? [String: Any],',
    '                   let incoming = value as? [String: Any] {',
    '                    existing.merge(incoming) { _, new in new }',
    '                    merged[key] = existing',
    '                } else {',
    '                    merged[key] = value',
    '                }',
    '            }',
    '            working.context = try? JSON(merged)',
    '            return working',
    '        })',
    '        body()',
    '        remove(plugin: plugin)',
    '    }',
    '',
    '    fileprivate func emitTrack(name: String, data: [String: Any], context: [String: Any]?) {',
    '        let send = { self.track(name: name, properties: data) }',
    '        if let context = context {',
    '            emitWithContext(context, send)',
    '        } else {',
    '            send()',
    '        }',
    '    }',
    '',
    '    fileprivate func emitScreen(title: String, data: [String: Any], context: [String: Any]?) {',
    '        let send = { self.screen(title: title, properties: data) }',
    '        if let context = context {',
    '            emitWithContext(context, send)',
    '        } else {',
    '            send()',
    '        }',
    '    }',
    '',
    '    fileprivate func emitIdentify(userId: String?, traits: [String: Any], context: [String: Any]?) {',
    '        let send = {',
    '            if let userId = userId {',
    '                self.identify(userId: userId, traits: traits)',
    '            } else if let json = try? JSON(traits) {',
    '                self.identify(traits: json)',
    '            }',
    '        }',
    '        if let context = context {',
    '            emitWithContext(context, send)',
    '        } else {',
    '            send()',
    '        }',
    '    }',
    '',
    '    fileprivate func emitGroup(groupId: String, traits: [String: Any], context: [String: Any]?) {',
    '        let send = { self.group(groupId: groupId, traits: traits) }',
    '        if let context = context {',
    '            emitWithContext(context, send)',
    '        } else {',
    '            send()',
    '        }',
    '    }',
    '',
    '    fileprivate func emitAlias(newId: String, context: [String: Any]?) {',
    '        let send = { self.alias(newId: newId) }',
    '        if let context = context {',
    '            emitWithContext(context, send)',
    '        } else {',
    '            send()',
    '        }',
    '    }',
    '}',
  ].join('\n');
}

function injectCall(
  dataExpr: string,
  pathLiteral: string,
  version: string,
  envelope: string,
): string[] {
  return [
    `        let injected = withSchemaVersion(`,
    `            ${dataExpr},`,
    '            context,',
    `            ${pathLiteral},`,
    `            ${swiftString(version)},`,
    `            ${envelope}`,
    '        )',
  ];
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const pathLiteral = swiftStringArray(event.schemaVersionPath);
  const envelope = swiftString(event.envelopeKey);
  const lines = [
    `    public func ${fn}(newId: String, context: [String: Any]? = nil) {`,
    ...injectCall('[:]', pathLiteral, event.version, envelope),
    '        emitAlias(newId: newId, context: injected.context)',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    public func ${alias}(newId: String, context: [String: Any]? = nil) {`,
      `        ${fn}(newId: newId, context: context)`,
      '    }',
    );
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = swiftStringArray(event.schemaVersionPath);
  const envelope = swiftString(event.envelopeKey);
  const inject = injectCall(
    'toMap(traits)',
    pathLiteral,
    event.version,
    envelope,
  );
  const lines = [
    `    public func ${fn}(_ traits: ${typeName}, context: [String: Any]? = nil) {`,
    ...inject,
    '        emitIdentify(userId: nil, traits: injected.data, context: injected.context)',
    '    }',
    '',
    `    public func ${fn}(userId: String, traits: ${typeName}, context: [String: Any]? = nil) {`,
    ...inject,
    '        emitIdentify(userId: userId, traits: injected.data, context: injected.context)',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    public func ${alias}(_ traits: ${typeName}, context: [String: Any]? = nil) {`,
      `        ${fn}(traits, context: context)`,
      '    }',
      '',
      `    public func ${alias}(userId: String, traits: ${typeName}, context: [String: Any]? = nil) {`,
      `        ${fn}(userId: userId, traits: traits, context: context)`,
      '    }',
    );
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = swiftStringArray(event.schemaVersionPath);
  const envelope = swiftString(event.envelopeKey);
  const lines = [
    `    public func ${fn}(groupId: String, traits: ${typeName}, context: [String: Any]? = nil) {`,
    ...injectCall('toMap(traits)', pathLiteral, event.version, envelope),
    '        emitGroup(groupId: groupId, traits: injected.data, context: injected.context)',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    public func ${alias}(groupId: String, traits: ${typeName}, context: [String: Any]? = nil) {`,
      `        ${fn}(groupId: groupId, traits: traits, context: context)`,
      '    }',
    );
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = swiftStringArray(event.schemaVersionPath);
  const envelope = swiftString(event.envelopeKey);
  const paramName = event.envelopeKey === 'traits' ? 'traits' : 'properties';
  const emit =
    event.type === 'page' || event.type === 'screen'
      ? `        emitScreen(title: ${eventNameLiteral(event)}, data: injected.data, context: injected.context)`
      : `        emitTrack(name: ${eventNameLiteral(event)}, data: injected.data, context: injected.context)`;

  const lines = [
    `    public func ${fn}(_ ${paramName}: ${typeName}, context: [String: Any]? = nil) {`,
    ...injectCall(`toMap(${paramName})`, pathLiteral, event.version, envelope),
    emit,
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    public func ${alias}(_ ${paramName}: ${typeName}, context: [String: Any]? = nil) {`,
      `        ${fn}(${paramName}, context: context)`,
      '    }',
    );
  }
  return lines;
}

function renderEventWrappers(event: NormalizedEvent): string[] {
  if (event.type === 'alias') {
    return renderAliasWrapper(event);
  }
  if (event.type === 'identify') {
    return renderIdentifyWrapper(event);
  }
  if (event.type === 'group') {
    return renderGroupWrapper(event);
  }
  return renderDataWrapper(event);
}

export function renderWrappers(events: NormalizedEvent[]): string {
  assertNoCollisions(events, {
    generatedMethodName: methodName,
  });
  const methodLines: string[] = ['extension Analytics {'];
  for (const event of events) {
    if (methodLines.length > 1) {
      methodLines.push('');
    }
    methodLines.push(...renderEventWrappers(event));
  }
  methodLines.push('}');
  return `${renderHelpers()}\n\n${methodLines.join('\n')}`;
}
