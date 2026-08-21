import type { NormalizedEvent } from '../../normalize/types';
import { assertNoMethodCollisions, methodName, typeNameFor } from './names';

function javaString(value: string): string {
  return JSON.stringify(value);
}

function javaStringArray(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return 'new String[] {}';
  }
  return `new String[] {${values.map(javaString).join(', ')}}`;
}

function eventNameLiteral(event: NormalizedEvent): string {
  return javaString(event.name ?? event.type);
}

function messageBuilder(event: NormalizedEvent): string {
  if (event.type === 'identify') return 'IdentifyMessage.builder()';
  if (event.type === 'group') return 'GroupMessage.builder(groupId)';
  if (event.type === 'page') {
    return `PageMessage.builder(${eventNameLiteral(event)})`;
  }
  if (event.type === 'screen') {
    return `ScreenMessage.builder(${eventNameLiteral(event)})`;
  }
  return `TrackMessage.builder(${eventNameLiteral(event)})`;
}

/** Generated helpers. Duplicate per SDK — see `src/render/README.md` §5. */
function renderHelpers(): string {
  return [
    '    @SuppressWarnings("unchecked")',
    '    private static Map<String, Object> cloneMap(Map<String, ?> map) {',
    '        Map<String, Object> out = new LinkedHashMap<>();',
    '        if (map == null) {',
    '            return out;',
    '        }',
    '        for (Map.Entry<String, ?> entry : map.entrySet()) {',
    '            out.put(entry.getKey(), entry.getValue());',
    '        }',
    '        return out;',
    '    }',
    '',
    '    @SuppressWarnings("unchecked")',
    '    private static Map<String, Object> setAtPath(',
    '            Map<String, Object> root, String[] path, String value) {',
    '        if (path == null || path.length == 0) {',
    '            return root;',
    '        }',
    '        Map<String, Object> clone = cloneMap(root);',
    '        Map<String, Object> cursor = clone;',
    '        for (int i = 0; i < path.length - 1; i++) {',
    '            String key = path[i];',
    '            Object existing = cursor.get(key);',
    '            Map<String, Object> child;',
    '            if (existing instanceof Map) {',
    '                child = cloneMap((Map<String, ?>) existing);',
    '            } else {',
    '                child = new LinkedHashMap<>();',
    '            }',
    '            cursor.put(key, child);',
    '            cursor = child;',
    '        }',
    '        cursor.put(path[path.length - 1], value);',
    '        return clone;',
    '    }',
    '',
    '    @SuppressWarnings("unchecked")',
    '    private static Object convertValue(Object value) {',
    '        if (value instanceof String',
    '                || value instanceof Number',
    '                || value instanceof Boolean) {',
    '            return value;',
    '        }',
    '        if (value instanceof Map) {',
    '            Map<String, Object> out = new LinkedHashMap<>();',
    '            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {',
    '                if (entry.getKey() == null || entry.getValue() == null) {',
    '                    continue;',
    '                }',
    '                out.put(String.valueOf(entry.getKey()), convertValue(entry.getValue()));',
    '            }',
    '            return out;',
    '        }',
    '        if (value instanceof Collection) {',
    '            List<Object> out = new ArrayList<>();',
    '            for (Object item : (Collection<?>) value) {',
    '                if (item != null) {',
    '                    out.add(convertValue(item));',
    '                }',
    '            }',
    '            return out;',
    '        }',
    '        if (value.getClass().isEnum()) {',
    '            return value.toString();',
    '        }',
    '        if (value.getClass().getEnclosingClass() == HtEvents.class) {',
    '            return toMap(value);',
    '        }',
    '        return value;',
    '    }',
    '',
    '    private static Map<String, Object> toMap(Object value) {',
    '        Map<String, Object> out = new LinkedHashMap<>();',
    '        if (value == null) {',
    '            return out;',
    '        }',
    '        if (value instanceof Map) {',
    '            return cloneMap((Map<String, ?>) value);',
    '        }',
    '        for (Field field : value.getClass().getDeclaredFields()) {',
    '            int modifiers = field.getModifiers();',
    '            if (Modifier.isStatic(modifiers) || field.isSynthetic()) {',
    '                continue;',
    '            }',
    '            field.setAccessible(true);',
    '            Object fieldValue;',
    '            try {',
    '                fieldValue = field.get(value);',
    '            } catch (IllegalAccessException e) {',
    '                continue;',
    '            }',
    '            if (fieldValue == null) {',
    '                continue;',
    '            }',
    '            out.put(field.getName(), convertValue(fieldValue));',
    '        }',
    '        return out;',
    '    }',
    '',
    '    private static final class Injected {',
    '        final Map<String, Object> data;',
    '        final Map<String, Object> context;',
    '',
    '        Injected(Map<String, Object> data, Map<String, Object> context) {',
    '            this.data = data;',
    '            this.context = context;',
    '        }',
    '    }',
    '',
    '    private static Injected withSchemaVersion(',
    '            Map<String, Object> data,',
    '            Map<String, ?> context,',
    '            String[] path,',
    '            String version,',
    '            String envelopeKey) {',
    '        if (path == null || path.length == 0) {',
    '            return new Injected(data, context == null ? null : cloneMap(context));',
    '        }',
    '        String head = path[0];',
    '        String[] rest = Arrays.copyOfRange(path, 1, path.length);',
    '        if (head.equals(envelopeKey)) {',
    '            return new Injected(',
    '                    setAtPath(cloneMap(data), rest, version),',
    '                    context == null ? null : cloneMap(context));',
    '        }',
    '        if (head.equals("context")) {',
    '            Map<String, Object> ctx = context == null ? new LinkedHashMap<>() : cloneMap(context);',
    '            return new Injected(data, setAtPath(ctx, rest, version));',
    '        }',
    '        return new Injected(data, context == null ? null : cloneMap(context));',
    '    }',
    '',
    '    @SuppressWarnings("rawtypes")',
    '    private static void applyContext(MessageBuilder builder, Map<String, Object> context) {',
    '        if (context != null && !context.isEmpty()) {',
    '            builder.context(context);',
    '        }',
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
    '        Injected injected = withSchemaVersion(',
    `                ${dataExpr},`,
    '                context,',
    `                ${pathLiteral},`,
    `                ${javaString(version)},`,
    `                ${javaString(envelope)});`,
  ];
}

function overloadWithoutContext(
  signatureWithContext: string,
  forwardCall: string,
): string[] {
  const without = signatureWithContext.replace(
    /, Map<String, \?> context\)/,
    ')',
  );
  return [
    `    public void ${without} {`,
    `        ${forwardCall}`,
    '    }',
    '',
  ];
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const pathLiteral = javaStringArray(event.schemaVersionPath);
  const withContext = `${fn}(String userId, String previousId, Map<String, ?> context)`;
  const lines = [
    ...overloadWithoutContext(withContext, `${fn}(userId, previousId, null);`),
    `    public void ${withContext} {`,
    ...injectCall(
      'new LinkedHashMap<String, Object>()',
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    '        AliasMessage.Builder builder = AliasMessage.builder(previousId).userId(userId);',
    '        applyContext(builder, injected.context);',
    '        analytics.enqueue(builder);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    const aliasWith = `${alias}(String userId, String previousId, Map<String, ?> context)`;
    lines.push(
      '',
      ...overloadWithoutContext(
        aliasWith,
        `${alias}(userId, previousId, null);`,
      ),
      `    public void ${aliasWith} {`,
      `        ${fn}(userId, previousId, context);`,
      '    }',
    );
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = javaStringArray(event.schemaVersionPath);
  const withContext = `${fn}(String userId, ${typeName} traits, Map<String, ?> context)`;
  const lines = [
    ...overloadWithoutContext(withContext, `${fn}(userId, traits, null);`),
    `    public void ${withContext} {`,
    ...injectCall(
      'toMap(traits)',
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    '        IdentifyMessage.Builder builder =',
    '                IdentifyMessage.builder().userId(userId).traits(injected.data);',
    '        applyContext(builder, injected.context);',
    '        analytics.enqueue(builder);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    const aliasWith = `${alias}(String userId, ${typeName} traits, Map<String, ?> context)`;
    lines.push(
      '',
      ...overloadWithoutContext(aliasWith, `${alias}(userId, traits, null);`),
      `    public void ${aliasWith} {`,
      `        ${fn}(userId, traits, context);`,
      '    }',
    );
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = javaStringArray(event.schemaVersionPath);
  const withContext = `${fn}(String groupId, String userId, ${typeName} traits, Map<String, ?> context)`;
  const lines = [
    ...overloadWithoutContext(
      withContext,
      `${fn}(groupId, userId, traits, null);`,
    ),
    `    public void ${withContext} {`,
    ...injectCall(
      'toMap(traits)',
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    '        GroupMessage.Builder builder =',
    '                GroupMessage.builder(groupId).userId(userId).traits(injected.data);',
    '        applyContext(builder, injected.context);',
    '        analytics.enqueue(builder);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    const aliasWith = `${alias}(String groupId, String userId, ${typeName} traits, Map<String, ?> context)`;
    lines.push(
      '',
      ...overloadWithoutContext(
        aliasWith,
        `${alias}(groupId, userId, traits, null);`,
      ),
      `    public void ${aliasWith} {`,
      `        ${fn}(groupId, userId, traits, context);`,
      '    }',
    );
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = javaStringArray(event.schemaVersionPath);
  const paramName = event.envelopeKey === 'traits' ? 'traits' : 'properties';
  const dataMethod = event.envelopeKey === 'traits' ? 'traits' : 'properties';
  const builderType =
    event.type === 'page'
      ? 'PageMessage.Builder'
      : event.type === 'screen'
        ? 'ScreenMessage.Builder'
        : 'TrackMessage.Builder';
  const withContext = `${fn}(String userId, ${typeName} ${paramName}, Map<String, ?> context)`;
  const lines = [
    ...overloadWithoutContext(
      withContext,
      `${fn}(userId, ${paramName}, null);`,
    ),
    `    public void ${withContext} {`,
    ...injectCall(
      `toMap(${paramName})`,
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    `        ${builderType} builder =`,
    `                ${messageBuilder(event)}.userId(userId).${dataMethod}(injected.data);`,
    '        applyContext(builder, injected.context);',
    '        analytics.enqueue(builder);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    const aliasWith = `${alias}(String userId, ${typeName} ${paramName}, Map<String, ?> context)`;
    lines.push(
      '',
      ...overloadWithoutContext(
        aliasWith,
        `${alias}(userId, ${paramName}, null);`,
      ),
      `    public void ${aliasWith} {`,
      `        ${fn}(userId, ${paramName}, context);`,
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
    '    private final Analytics analytics;',
    '',
    '    public HtEvents(Analytics analytics) {',
    '        this.analytics = analytics;',
    '    }',
  ];
  for (const event of events) {
    methodLines.push('');
    methodLines.push(...renderEventWrappers(event));
  }
  return `${renderHelpers()}\n\n${methodLines.join('\n')}`;
}
