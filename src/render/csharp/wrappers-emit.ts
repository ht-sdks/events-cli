import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';
import { methodName, typeNameFor } from './names';

function csString(value: string): string {
  return JSON.stringify(value);
}

function csStringArray(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return 'new string[] {}';
  }
  return `new string[] {${values.map(csString).join(', ')}}`;
}

function renderHelpers(): string {
  return [
    '        private static Dictionary<string, object> CloneMap(Dictionary<string, object> map)',
    '        {',
    '            var clone = new Dictionary<string, object>();',
    '            if (map == null)',
    '            {',
    '                return clone;',
    '            }',
    '            foreach (var entry in map)',
    '            {',
    '                clone[entry.Key] = entry.Value;',
    '            }',
    '            return clone;',
    '        }',
    '',
    '        private static Dictionary<string, object> SetAtPath(Dictionary<string, object> root, string[] path, string value)',
    '        {',
    '            if (path == null || path.Length == 0)',
    '            {',
    '                return root;',
    '            }',
    '            var clone = CloneMap(root);',
    '            var cursor = clone;',
    '            for (var i = 0; i < path.Length - 1; i++)',
    '            {',
    '                var key = path[i];',
    '                Dictionary<string, object> child;',
    '                if (cursor.TryGetValue(key, out var existing) && existing is Dictionary<string, object> dict)',
    '                {',
    '                    child = CloneMap(dict);',
    '                }',
    '                else',
    '                {',
    '                    child = new Dictionary<string, object>();',
    '                }',
    '                cursor[key] = child;',
    '                cursor = child;',
    '            }',
    '            cursor[path[path.Length - 1]] = value;',
    '            return clone;',
    '        }',
    '',
    '        private static Dictionary<string, object> ToMap(object value)',
    '        {',
    '            var result = new Dictionary<string, object>();',
    '            if (value == null)',
    '            {',
    '                return result;',
    '            }',
    '            if (value is Dictionary<string, object> dict)',
    '            {',
    '                return CloneMap(dict);',
    '            }',
    '            foreach (var field in value.GetType().GetFields())',
    '            {',
    '                var fieldValue = field.GetValue(value);',
    '                if (fieldValue == null)',
    '                {',
    '                    continue;',
    '                }',
    '                result[field.Name] = fieldValue;',
    '            }',
    '            return result;',
    '        }',
    '',
    '        private static JsonElement ToJsonElement(object value)',
    '        {',
    '            switch (value)',
    '            {',
    '                case null:',
    '                    return JsonNull.Instance;',
    '                case JsonElement element:',
    '                    return element;',
    '                case string s:',
    '                    return s;',
    '                case bool b:',
    '                    return b;',
    '                case byte n:',
    '                    return (int)n;',
    '                case short n:',
    '                    return n;',
    '                case int n:',
    '                    return n;',
    '                case long n:',
    '                    return n;',
    '                case float n:',
    '                    return n;',
    '                case double n:',
    '                    return n;',
    '                case decimal n:',
    '                    return (double)n;',
    '                case Dictionary<string, object> dict:',
    '                    return ToJsonObject(dict);',
    '                case IDictionary map:',
    '                {',
    '                    var nested = new Dictionary<string, object>();',
    '                    foreach (DictionaryEntry entry in map)',
    '                    {',
    '                        if (entry.Key == null || entry.Value == null)',
    '                        {',
    '                            continue;',
    '                        }',
    '                        nested[entry.Key.ToString()] = entry.Value;',
    '                    }',
    '                    return ToJsonObject(nested);',
    '                }',
    '                default:',
    '                    return value.ToString();',
    '            }',
    '        }',
    '',
    '        private static JsonObject ToJsonObject(Dictionary<string, object> data)',
    '        {',
    '            var obj = new JsonObject();',
    '            if (data == null)',
    '            {',
    '                return obj;',
    '            }',
    '            foreach (var entry in data)',
    '            {',
    '                obj[entry.Key] = ToJsonElement(entry.Value);',
    '            }',
    '            return obj;',
    '        }',
    '',
    '        private static Dictionary<string, object> WithSchemaVersion(Dictionary<string, object> data, string[] path, string version, string envelopeKey)',
    '        {',
    '            if (path == null || path.Length == 0)',
    '            {',
    '                return data;',
    '            }',
    '            var head = path[0];',
    '            if (head == envelopeKey)',
    '            {',
    '                var rest = new string[path.Length - 1];',
    '                Array.Copy(path, 1, rest, 0, rest.Length);',
    '                return SetAtPath(CloneMap(data), rest, version);',
    '            }',
    '            return data;',
    '        }',
  ].join('\n');
}

function injectCall(dataExpr: string, event: NormalizedEvent): string[] {
  return [
    `            var data = WithSchemaVersion(${dataExpr}, ${csStringArray(event.schemaVersionPath)}, ${csString(event.version)}, ${csString(event.envelopeKey)});`,
  ];
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const lines = [
    `        public void ${fn}(string newId)`,
    '        {',
    ...injectCall('new Dictionary<string, object>()', event),
    '            _analytics.Alias(newId);',
    '        }',
  ];
  if (event.latestAlias !== undefined) {
    lines.push(
      '',
      `        public void ${methodName(event.latestAlias)}(string newId)`,
      '        {',
      `            ${fn}(newId);`,
      '        }',
    );
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const lines = [
    `        public void ${fn}(string groupId, ${typeName} traits)`,
    '        {',
    ...injectCall('ToMap(traits)', event),
    '            _analytics.Group(groupId, ToJsonObject(data));',
    '        }',
  ];
  if (event.latestAlias !== undefined) {
    lines.push(
      '',
      `        public void ${methodName(event.latestAlias)}(string groupId, ${typeName} traits)`,
      '        {',
      `            ${fn}(groupId, traits);`,
      '        }',
    );
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const inject = injectCall('ToMap(traits)', event);
  const lines = [
    `        public void ${fn}(${typeName} traits)`,
    '        {',
    ...inject,
    '            _analytics.Identify(ToJsonObject(data));',
    '        }',
    '',
    `        public void ${fn}(string userId, ${typeName} traits)`,
    '        {',
    ...inject,
    '            _analytics.Identify(userId, ToJsonObject(data));',
    '        }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `        public void ${alias}(${typeName} traits)`,
      '        {',
      `            ${fn}(traits);`,
      '        }',
      '',
      `        public void ${alias}(string userId, ${typeName} traits)`,
      '        {',
      `            ${fn}(userId, traits);`,
      '        }',
    );
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const sdkCall =
    event.type === 'page'
      ? `_analytics.Page(${csString(event.name ?? event.type)}, ToJsonObject(data));`
      : event.type === 'screen'
        ? `_analytics.Screen(${csString(event.name ?? event.type)}, ToJsonObject(data));`
        : `_analytics.Track(${csString(event.name ?? event.type)}, ToJsonObject(data));`;
  const lines = [
    `        public void ${fn}(${typeName} properties)`,
    '        {',
    ...injectCall('ToMap(properties)', event),
    `            ${sdkCall}`,
    '        }',
  ];
  if (event.latestAlias !== undefined) {
    lines.push(
      '',
      `        public void ${methodName(event.latestAlias)}(${typeName} properties)`,
      '        {',
      `            ${fn}(properties);`,
      '        }',
    );
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
    errorPrefixLabel: 'CSharp',
    generatedMethodName: methodName,
  });
  const body = [
    '        private readonly AnalyticsClient _analytics;',
    '',
    '        public HtEvents(AnalyticsClient analytics)',
    '        {',
    '            _analytics = analytics;',
    '        }',
    '',
    renderHelpers(),
    ...events.map((e) => renderEventWrappers(e).join('\n')),
  ].join('\n\n');
  return `    public sealed class HtEvents\n    {\n${body}\n    }`;
}
