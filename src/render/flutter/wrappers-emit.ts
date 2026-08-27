import type { NormalizedEvent } from '../../normalize/types';
import { assertNoMethodCollisions, methodName, typeNameFor } from './names';

function dartString(value: string): string {
  return JSON.stringify(value).replace(/\$/g, '\\$');
}

function dartStringList(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return 'const <String>[]';
  }
  return `const [${values.map(dartString).join(', ')}]`;
}

function eventNameLiteral(event: NormalizedEvent): string {
  return dartString(event.name ?? event.type);
}

function sdkMethod(
  event: NormalizedEvent,
): 'track' | 'screen' | 'identify' | 'group' | 'alias' {
  if (event.type === 'page' || event.type === 'screen') {
    return 'screen';
  }
  return event.type;
}

function renderHelpers(): string {
  return [
    '    Map<String, dynamic> _cloneMap(Map<String, dynamic>? map) {',
    '        final out = <String, dynamic>{};',
    '        if (map == null) {',
    '            return out;',
    '        }',
    '        map.forEach((key, value) {',
    '            out[key] = value;',
    '        });',
    '        return out;',
    '    }',
    '',
    '    Map<String, dynamic> _compact(Map<String, dynamic> map) {',
    '        final out = <String, dynamic>{};',
    '        map.forEach((key, value) {',
    '            if (value == null) {',
    '                return;',
    '            }',
    '            if (value is Map) {',
    '                out[key] = _compact(Map<String, dynamic>.from(value));',
    '            } else {',
    '                out[key] = value;',
    '            }',
    '        });',
    '        return out;',
    '    }',
    '',
    '    Map<String, dynamic> _toJsonMap(dynamic value) {',
    '        if (value == null) {',
    '            return <String, dynamic>{};',
    '        }',
    '        if (value is Map<String, dynamic>) {',
    '            return _compact(value);',
    '        }',
    '        final mapped = value.toMap();',
    '        if (mapped is Map) {',
    '            return _compact(Map<String, dynamic>.from(mapped));',
    '        }',
    '        return <String, dynamic>{};',
    '    }',
    '',
    '    Map<String, dynamic> _setAtPath(',
    '        Map<String, dynamic> root,',
    '        List<String> path,',
    '        String value,',
    '    ) {',
    '        if (path.isEmpty) {',
    '            return _cloneMap(root);',
    '        }',
    '        final clone = _cloneMap(root);',
    '        var cursor = clone;',
    '        for (var i = 0; i < path.length - 1; i++) {',
    '            final key = path[i];',
    '            final existing = cursor[key];',
    '            final child = existing is Map',
    '                ? _cloneMap(Map<String, dynamic>.from(existing))',
    '                : <String, dynamic>{};',
    '            cursor[key] = child;',
    '            cursor = child;',
    '        }',
    '        cursor[path.last] = value;',
    '        return clone;',
    '    }',
    '',
    '    Map<String, dynamic> _deepMerge(',
    '        Map<String, dynamic> base,',
    '        Map<String, dynamic> extra,',
    '    ) {',
    '        final out = _cloneMap(base);',
    '        extra.forEach((key, value) {',
    '            final existing = out[key];',
    '            if (value is Map && existing is Map) {',
    '                out[key] = _deepMerge(',
    '                    Map<String, dynamic>.from(existing),',
    '                    Map<String, dynamic>.from(value),',
    '                );',
    '            } else {',
    '                out[key] = value;',
    '            }',
    '        });',
    '        return out;',
    '    }',
    '',
    '    EnrichmentClosure? _contextEnrichment(Map<String, dynamic>? extra) {',
    '        if (extra == null || extra.isEmpty) {',
    '            return null;',
    '        }',
    '        return (event) {',
    '            final existing = event.context;',
    '            final base = existing == null ? <String, dynamic>{} : existing.toJson();',
    '            event.context = Context.fromJson(_deepMerge(base, extra));',
    '            return event;',
    '        };',
    '    }',
    '',
    '    _Injected _withSchemaVersion(',
    '        Map<String, dynamic> data,',
    '        Map<String, dynamic>? context,',
    '        List<String> path,',
    '        String version,',
    '        String envelopeKey,',
    '    ) {',
    '        if (path.isEmpty) {',
    '            return _Injected(data, context);',
    '        }',
    '        final head = path.first;',
    '        final rest = path.sublist(1);',
    '        if (head == envelopeKey) {',
    '            return _Injected(_setAtPath(_cloneMap(data), rest, version), context);',
    '        }',
    '        if (head == "context") {',
    '            return _Injected(',
    '                data,',
    '                _setAtPath(_cloneMap(context), rest, version),',
    '            );',
    '        }',
    '        return _Injected(data, context);',
    '    }',
  ].join('\n');
}

function injectCall(
  dataExpr: string,
  pathLiteral: string,
  version: string,
  envelope: string,
): string[] {
  return [
    '        final injected = _withSchemaVersion(',
    `            ${dataExpr},`,
    '            context,',
    `            ${pathLiteral},`,
    `            ${dartString(version)},`,
    `            ${dartString(envelope)},`,
    '        );',
  ];
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const pathLiteral = dartStringList(event.schemaVersionPath);
  const lines = [
    `    Future<void> ${fn}(String newUserId, {Map<String, dynamic>? context}) {`,
    ...injectCall(
      '<String, dynamic>{}',
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    '        return _analytics.alias(',
    '            newUserId,',
    '            enrichment: _contextEnrichment(injected.context),',
    '        );',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    Future<void> ${alias}(String newUserId, {Map<String, dynamic>? context}) {`,
      `        return ${fn}(newUserId, context: context);`,
      '    }',
    );
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = dartStringList(event.schemaVersionPath);
  const lines = [
    `    Future<void> ${fn}({String? userId, required ${typeName} traits, Map<String, dynamic>? context}) {`,
    ...injectCall(
      '_toJsonMap(traits)',
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    '        return _analytics.identify(',
    '            userId: userId,',
    '            userTraits: UserTraits.fromJson(injected.data),',
    '            enrichment: _contextEnrichment(injected.context),',
    '        );',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    Future<void> ${alias}({String? userId, required ${typeName} traits, Map<String, dynamic>? context}) {`,
      `        return ${fn}(userId: userId, traits: traits, context: context);`,
      '    }',
    );
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = dartStringList(event.schemaVersionPath);
  const lines = [
    `    Future<void> ${fn}(String groupId, {required ${typeName} traits, Map<String, dynamic>? context}) {`,
    ...injectCall(
      '_toJsonMap(traits)',
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    '        return _analytics.group(',
    '            groupId,',
    '            groupTraits: GroupTraits.fromJson(injected.data),',
    '            enrichment: _contextEnrichment(injected.context),',
    '        );',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    Future<void> ${alias}(String groupId, {required ${typeName} traits, Map<String, dynamic>? context}) {`,
      `        return ${fn}(groupId, traits: traits, context: context);`,
      '    }',
    );
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = dartStringList(event.schemaVersionPath);
  const method = sdkMethod(event);
  const paramName = event.envelopeKey === 'traits' ? 'traits' : 'properties';
  const lines = [
    `    Future<void> ${fn}(${typeName} ${paramName}, {Map<String, dynamic>? context}) {`,
    ...injectCall(
      `_toJsonMap(${paramName})`,
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    `        return _analytics.${method}(`,
    `            ${eventNameLiteral(event)},`,
    '            properties: injected.data,',
    '            enrichment: _contextEnrichment(injected.context),',
    '        );',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    Future<void> ${alias}(${typeName} ${paramName}, {Map<String, dynamic>? context}) {`,
      `        return ${fn}(${paramName}, context: context);`,
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
  assertNoMethodCollisions(events);
  const methodLines: string[] = [
    '    final Analytics _analytics;',
    '',
    '    HtEvents(this._analytics);',
    '',
    renderHelpers(),
  ];
  for (const event of events) {
    methodLines.push('');
    methodLines.push(...renderEventWrappers(event));
  }
  return [
    'class _Injected {',
    '    final Map<String, dynamic> data;',
    '    final Map<String, dynamic>? context;',
    '    _Injected(this.data, this.context);',
    '}',
    '',
    `class HtEvents {\n${methodLines.join('\n')}\n}`,
  ].join('\n');
}
