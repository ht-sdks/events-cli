import type { NormalizedEvent } from '../../normalize/types';
import { assertNoMethodCollisions, methodName, typeNameFor } from './names';

function kotlinString(value: string): string {
  return JSON.stringify(value);
}

function kotlinStringList(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    return 'emptyList()';
  }
  return `listOf(${values.map(kotlinString).join(', ')})`;
}

function eventNameLiteral(event: NormalizedEvent): string {
  return kotlinString(event.name ?? event.type);
}

/** Generated helpers. Duplicate per SDK — see `src/render/README.md` §5. */
function renderHelpers(): string {
  return [
    '    private fun cloneMap(map: Map<String, Any?>?): MutableMap<String, Any?> {',
    '        val out = linkedMapOf<String, Any?>()',
    '        if (map == null) {',
    '            return out',
    '        }',
    '        for ((key, value) in map) {',
    '            out[key] = value',
    '        }',
    '        return out',
    '    }',
    '',
    '    private fun setAtPath(',
    '        root: Map<String, Any?>,',
    '        path: List<String>,',
    '        value: String,',
    '    ): MutableMap<String, Any?> {',
    '        if (path.isEmpty()) {',
    '            return cloneMap(root)',
    '        }',
    '        val clone = cloneMap(root)',
    '        var cursor: MutableMap<String, Any?> = clone',
    '        for (i in 0 until path.size - 1) {',
    '            val key = path[i]',
    '            val existing = cursor[key]',
    '            val child =',
    '                if (existing is Map<*, *>) {',
    '                    cloneMap(existing as Map<String, Any?>)',
    '                } else {',
    '                    linkedMapOf()',
    '                }',
    '            cursor[key] = child',
    '            cursor = child',
    '        }',
    '        cursor[path.last()] = value',
    '        return clone',
    '    }',
    '',
    '    @Suppress("UNCHECKED_CAST")',
    '    private fun convertValue(value: Any?): Any? {',
    '        if (value == null) {',
    '            return null',
    '        }',
    '        if (value is String || value is Number || value is Boolean) {',
    '            return value',
    '        }',
    '        if (value is Map<*, *>) {',
    '            val out = linkedMapOf<String, Any?>()',
    '            for ((key, nested) in value) {',
    '                if (key == null || nested == null) {',
    '                    continue',
    '                }',
    '                out[key.toString()] = convertValue(nested)',
    '            }',
    '            return out',
    '        }',
    '        if (value is Collection<*>) {',
    '            return value.mapNotNull { convertValue(it) }',
    '        }',
    '        if (value::class.java.isEnum) {',
    '            return value.toString()',
    '        }',
    '        if (value::class.java.enclosingClass == HtEvents::class.java) {',
    '            return toMap(value)',
    '        }',
    '        return value',
    '    }',
    '',
    '    private fun toMap(value: Any?): Map<String, Any?> {',
    '        val out = linkedMapOf<String, Any?>()',
    '        if (value == null) {',
    '            return out',
    '        }',
    '        if (value is Map<*, *>) {',
    '            return cloneMap(value as Map<String, Any?>)',
    '        }',
    '        for (field in value::class.java.declaredFields) {',
    '            val modifiers = field.modifiers',
    '            if (',
    '                java.lang.reflect.Modifier.isStatic(modifiers) ||',
    '                field.isSynthetic ||',
    '                field.name.startsWith("\$")',
    '            ) {',
    '                continue',
    '            }',
    '            field.isAccessible = true',
    '            val fieldValue =',
    '                try {',
    '                    field.get(value)',
    '                } catch (_: IllegalAccessException) {',
    '                    continue',
    '                }',
    '            if (fieldValue == null) {',
    '                continue',
    '            }',
    '            out[field.name] = convertValue(fieldValue)',
    '        }',
    '        return out',
    '    }',
    '',
    '    private fun jsonElementOf(value: Any?): JsonElement {',
    '        return when (value) {',
    '            null -> JsonNull',
    '            is JsonElement -> value',
    '            is String -> JsonPrimitive(value)',
    '            is Boolean -> JsonPrimitive(value)',
    '            is Number -> JsonPrimitive(value)',
    '            is Map<*, *> ->',
    '                buildJsonObject {',
    '                    for ((key, nested) in value) {',
    '                        if (key != null && nested != null) {',
    '                            put(key.toString(), jsonElementOf(nested))',
    '                        }',
    '                    }',
    '                }',
    '            is Collection<*> ->',
    '                buildJsonArray {',
    '                    for (item in value) {',
    '                        if (item != null) {',
    '                            add(jsonElementOf(item))',
    '                        }',
    '                    }',
    '                }',
    '            else -> toJsonObject(value)',
    '        }',
    '    }',
    '',
    '    private fun toJsonObject(value: Any?): JsonObject {',
    '        if (value == null) {',
    '            return JsonObject(emptyMap())',
    '        }',
    '        if (value is JsonObject) {',
    '            return value',
    '        }',
    '        val map = toMap(value)',
    '        return buildJsonObject {',
    '            for ((key, nested) in map) {',
    '                if (nested != null) {',
    '                    put(key, jsonElementOf(nested))',
    '                }',
    '            }',
    '        }',
    '    }',
    '',
    '    private fun mergeContext(event: BaseEvent, extra: Map<String, Any?>): BaseEvent {',
    '        val merged = event.context.toMutableMap()',
    '        val extraJson = jsonElementOf(extra)',
    '        if (extraJson is JsonObject) {',
    '            for ((key, nested) in extraJson) {',
    '                val existing = merged[key]',
    '                merged[key] =',
    '                    if (existing is JsonObject && nested is JsonObject) {',
    '                        JsonObject(existing + nested)',
    '                    } else {',
    '                        nested',
    '                    }',
    '            }',
    '        }',
    '        event.context = JsonObject(merged)',
    '        return event',
    '    }',
    '',
    '    private fun contextEnrichment(context: Map<String, Any?>?): EnrichmentClosure? {',
    '        if (context.isNullOrEmpty()) {',
    '            return null',
    '        }',
    '        return { event ->',
    '            if (event == null) {',
    '                event',
    '            } else {',
    '                mergeContext(event, context)',
    '            }',
    '        }',
    '    }',
    '',
    '    private data class Injected(',
    '        val data: Map<String, Any?>,',
    '        val context: Map<String, Any?>?,',
    '    )',
    '',
    '    private fun withSchemaVersion(',
    '        data: Map<String, Any?>,',
    '        context: Map<String, Any?>?,',
    '        path: List<String>,',
    '        version: String,',
    '        envelopeKey: String,',
    '    ): Injected {',
    '        if (path.isEmpty()) {',
    '            return Injected(data, context)',
    '        }',
    '        val head = path.first()',
    '        val rest = path.drop(1)',
    '        if (head == envelopeKey) {',
    '            return Injected(setAtPath(cloneMap(data), rest, version), context)',
    '        }',
    '        if (head == "context") {',
    '            return Injected(data, setAtPath(cloneMap(context), rest, version))',
    '        }',
    '        return Injected(data, context)',
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
    '        val injected = withSchemaVersion(',
    `            ${dataExpr},`,
    '            context,',
    `            ${pathLiteral},`,
    `            ${kotlinString(version)},`,
    `            ${kotlinString(envelope)},`,
    '        )',
  ];
}

function renderAliasWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const pathLiteral = kotlinStringList(event.schemaVersionPath);
  const lines = [
    `    fun ${fn}(newId: String, context: Map<String, Any>? = null) {`,
    ...injectCall('emptyMap()', pathLiteral, event.version, event.envelopeKey),
    '        analytics.alias(newId, contextEnrichment(injected.context))',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    fun ${alias}(newId: String, context: Map<String, Any>? = null) {`,
      `        ${fn}(newId, context)`,
      '    }',
    );
  }
  return lines;
}

function renderIdentifyWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = kotlinStringList(event.schemaVersionPath);
  const inject = injectCall(
    'toMap(traits)',
    pathLiteral,
    event.version,
    event.envelopeKey,
  );
  const lines = [
    `    fun ${fn}(traits: ${typeName}, context: Map<String, Any>? = null) {`,
    ...inject,
    '        analytics.identify(toJsonObject(injected.data), contextEnrichment(injected.context))',
    '    }',
    '',
    `    fun ${fn}(userId: String, traits: ${typeName}, context: Map<String, Any>? = null) {`,
    ...inject,
    '        analytics.identify(userId, toJsonObject(injected.data), contextEnrichment(injected.context))',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    fun ${alias}(traits: ${typeName}, context: Map<String, Any>? = null) {`,
      `        ${fn}(traits, context)`,
      '    }',
      '',
      `    fun ${alias}(userId: String, traits: ${typeName}, context: Map<String, Any>? = null) {`,
      `        ${fn}(userId, traits, context)`,
      '    }',
    );
  }
  return lines;
}

function renderGroupWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = kotlinStringList(event.schemaVersionPath);
  const lines = [
    `    fun ${fn}(groupId: String, traits: ${typeName}, context: Map<String, Any>? = null) {`,
    ...injectCall(
      'toMap(traits)',
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    '        analytics.group(groupId, toJsonObject(injected.data), contextEnrichment(injected.context))',
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    fun ${alias}(groupId: String, traits: ${typeName}, context: Map<String, Any>? = null) {`,
      `        ${fn}(groupId, traits, context)`,
      '    }',
    );
  }
  return lines;
}

function renderDataWrapper(event: NormalizedEvent): string[] {
  const fn = methodName(event.wrapperName);
  const typeName = typeNameFor(event);
  const pathLiteral = kotlinStringList(event.schemaVersionPath);
  const paramName = event.envelopeKey === 'traits' ? 'traits' : 'properties';
  const emit =
    event.type === 'page' || event.type === 'screen'
      ? `        analytics.screen(${eventNameLiteral(event)}, toJsonObject(injected.data), enrichment = contextEnrichment(injected.context))`
      : `        analytics.track(${eventNameLiteral(event)}, toJsonObject(injected.data), contextEnrichment(injected.context))`;

  const lines = [
    `    fun ${fn}(${paramName}: ${typeName}, context: Map<String, Any>? = null) {`,
    ...injectCall(
      `toMap(${paramName})`,
      pathLiteral,
      event.version,
      event.envelopeKey,
    ),
    emit,
    '    }',
  ];
  if (event.latestAlias !== undefined) {
    const alias = methodName(event.latestAlias);
    lines.push(
      '',
      `    fun ${alias}(${paramName}: ${typeName}, context: Map<String, Any>? = null) {`,
      `        ${fn}(${paramName}, context)`,
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
    '    private val analytics: Analytics',
    '',
    '    constructor(analytics: Analytics) {',
    '        this.analytics = analytics',
    '    }',
  ];
  for (const event of events) {
    methodLines.push('');
    methodLines.push(...renderEventWrappers(event));
  }
  return `${renderHelpers()}\n\n${methodLines.join('\n')}`;
}
