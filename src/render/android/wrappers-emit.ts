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

function renderHelpers(className: string): string {
  return [
    '    @SuppressWarnings("unchecked")',
    '    private static Map<String, Object> cloneMap(Map<String, Object> map) {',
    '        Map<String, Object> out = new LinkedHashMap<>();',
    '        if (map == null) {',
    '            return out;',
    '        }',
    '        for (Map.Entry<String, Object> entry : map.entrySet()) {',
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
    '                child = cloneMap((Map<String, Object>) existing);',
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
    `        if (value.getClass().getEnclosingClass() == ${className}.class) {`,
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
    '            @SuppressWarnings("unchecked")',
    '            Map<String, Object> map = (Map<String, Object>) value;',
    '            return cloneMap(map);',
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
    '    private static Properties toProperties(Map<String, Object> data) {',
    '        Properties properties = new Properties();',
    '        if (data != null) {',
    '            properties.putAll(data);',
    '        }',
    '        return properties;',
    '    }',
    '',
    '    private static Traits toTraits(Map<String, Object> data) {',
    '        Traits traits = new Traits();',
    '        if (data != null) {',
    '            traits.putAll(data);',
    '        }',
    '        return traits;',
    '    }',
    '',
    '    private static Options optionsWithContext(',
    '            Options options, Map<String, Object> context) {',
    '        Map<String, Object> integrations =',
    '                options == null',
    '                        ? new LinkedHashMap<String, Object>()',
    '                        : cloneMap(options.integrations());',
    '        return new Options(integrations, context);',
    '    }',
    '',
    '    private static final class Injected {',
    '        final Map<String, Object> data;',
    '        final Options options;',
    '',
    '        Injected(Map<String, Object> data, Options options) {',
    '            this.data = data;',
    '            this.options = options;',
    '        }',
    '    }',
    '',
    '    private static Injected withSchemaVersion(',
    '            Map<String, Object> data,',
    '            Options options,',
    '            String[] path,',
    '            String version,',
    '            String envelopeKey) {',
    '        if (path == null || path.length == 0) {',
    '            return new Injected(data, options);',
    '        }',
    '        String head = path[0];',
    '        String[] rest = Arrays.copyOfRange(path, 1, path.length);',
    '        if (head.equals(envelopeKey)) {',
    '            return new Injected(setAtPath(cloneMap(data), rest, version), options);',
    '        }',
    '        if (head.equals("context")) {',
    '            Map<String, Object> ctx =',
    '                    options == null',
    '                            ? new LinkedHashMap<String, Object>()',
    '                            : cloneMap(options.context());',
    '            return new Injected(data, optionsWithContext(options, setAtPath(ctx, rest, version)));',
    '        }',
    '        return new Injected(data, options);',
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
    '                options,',
    `                ${pathLiteral},`,
    `                ${javaString(version)},`,
    `                ${envelope});`,
  ];
}

function overloadWithoutOptions(
  signatureWithOptions: string,
  forwardCall: string,
): string[] {
  const withoutOptions = signatureWithOptions.replace(
    /, Options options\)/,
    ')',
  );
  return [
    `    public void ${withoutOptions} {`,
    `        ${forwardCall}`,
    '    }',
    '',
  ];
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const pathLiteral = javaStringArray(event.schemaVersionPath);
  const envelope = javaString(event.envelopeKey);
  const withOptions = `${fn}(String newId, Options options)`;
  const lines = [
    ...overloadWithoutOptions(withOptions, `${fn}(newId, null);`),
    `    public void ${withOptions} {`,
    ...injectCall(
      'new LinkedHashMap<String, Object>()',
      pathLiteral,
      event.version,
      envelope,
    ),
    '        analytics.alias(newId, injected.options);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    const aliasWithOptions = `${alias}(String newId, Options options)`;
    lines.push(
      '',
      ...overloadWithoutOptions(aliasWithOptions, `${alias}(newId, null);`),
      `    public void ${aliasWithOptions} {`,
      `        ${fn}(newId, options);`,
      '    }',
    );
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = javaStringArray(event.schemaVersionPath);
  const envelope = javaString(event.envelopeKey);
  const inject = injectCall(
    'toMap(traits)',
    pathLiteral,
    event.version,
    envelope,
  );
  const traitsSig = `${fn}(${typeName} traits, Options options)`;
  const userSig = `${fn}(String userId, ${typeName} traits, Options options)`;
  const lines = [
    ...overloadWithoutOptions(traitsSig, `${fn}(traits, null);`),
    `    public void ${traitsSig} {`,
    ...inject,
    '        analytics.identify(null, toTraits(injected.data), injected.options);',
    '    }',
    '',
    ...overloadWithoutOptions(userSig, `${fn}(userId, traits, null);`),
    `    public void ${userSig} {`,
    ...inject,
    '        analytics.identify(userId, toTraits(injected.data), injected.options);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    const aliasTraits = `${alias}(${typeName} traits, Options options)`;
    const aliasUser = `${alias}(String userId, ${typeName} traits, Options options)`;
    lines.push(
      '',
      ...overloadWithoutOptions(aliasTraits, `${alias}(traits, null);`),
      `    public void ${aliasTraits} {`,
      `        ${fn}(traits, options);`,
      '    }',
      '',
      ...overloadWithoutOptions(aliasUser, `${alias}(userId, traits, null);`),
      `    public void ${aliasUser} {`,
      `        ${fn}(userId, traits, options);`,
      '    }',
    );
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = javaStringArray(event.schemaVersionPath);
  const envelope = javaString(event.envelopeKey);
  const withOptions = `${fn}(String groupId, ${typeName} traits, Options options)`;
  const lines = [
    ...overloadWithoutOptions(withOptions, `${fn}(groupId, traits, null);`),
    `    public void ${withOptions} {`,
    ...injectCall('toMap(traits)', pathLiteral, event.version, envelope),
    '        analytics.group(groupId, toTraits(injected.data), injected.options);',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    const aliasWithOptions = `${alias}(String groupId, ${typeName} traits, Options options)`;
    lines.push(
      '',
      ...overloadWithoutOptions(
        aliasWithOptions,
        `${alias}(groupId, traits, null);`,
      ),
      `    public void ${aliasWithOptions} {`,
      `        ${fn}(groupId, traits, options);`,
      '    }',
    );
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = javaStringArray(event.schemaVersionPath);
  const envelope = javaString(event.envelopeKey);
  const paramName = event.envelopeKey === 'traits' ? 'traits' : 'properties';
  const toSdk = event.envelopeKey === 'traits' ? 'toTraits' : 'toProperties';
  const emit =
    event.type === 'page' || event.type === 'screen'
      ? `        analytics.screen(null, ${eventNameLiteral(event)}, toProperties(injected.data), injected.options);`
      : `        analytics.track(${eventNameLiteral(event)}, ${toSdk}(injected.data), injected.options);`;

  const withOptions = `${fn}(${typeName} ${paramName}, Options options)`;
  const lines = [
    ...overloadWithoutOptions(withOptions, `${fn}(${paramName}, null);`),
    `    public void ${withOptions} {`,
    ...injectCall(`toMap(${paramName})`, pathLiteral, event.version, envelope),
    emit,
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    const aliasWithOptions = `${alias}(${typeName} ${paramName}, Options options)`;
    lines.push(
      '',
      ...overloadWithoutOptions(
        aliasWithOptions,
        `${alias}(${paramName}, null);`,
      ),
      `    public void ${aliasWithOptions} {`,
      `        ${fn}(${paramName}, options);`,
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

export function renderWrappers(
  events: NormalizedEvent[],
  className: string,
): string {
  assertNoMethodCollisions(events, className);
  const methodLines: string[] = [
    '    private final Analytics analytics;',
    '',
    `    public ${className}(Analytics analytics) {`,
    '        this.analytics = analytics;',
    '    }',
  ];
  for (const event of events) {
    methodLines.push('');
    methodLines.push(...renderEventWrappers(event));
  }
  return `${renderHelpers(className)}\n\n${methodLines.join('\n')}`;
}
