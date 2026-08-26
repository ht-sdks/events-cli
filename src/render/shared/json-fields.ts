import { CliError } from '../../lib/errors';
import type { NormalizedEvent } from '../../normalize/types';

export type JsonFieldLang = 'python' | 'ruby' | 'php' | 'csharp';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isKeyword(name: string, lang: JsonFieldLang): boolean {
  if (lang === 'python') {
    return PYTHON_KEYWORDS.has(name.toLowerCase());
  }
  return false;
}

const PYTHON_KEYWORDS = new Set([
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'false',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'none',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'true',
  'try',
  'while',
  'with',
  'yield',
]);

export function schemaProperties(
  schema: unknown,
): Record<string, unknown> | undefined {
  if (schema === null || typeof schema !== 'object') {
    return undefined;
  }
  const properties = (schema as { properties?: unknown }).properties;
  if (properties === undefined || typeof properties !== 'object') {
    return undefined;
  }
  return properties as Record<string, unknown>;
}

export function walkSchemaKeys(schema: unknown): string[] {
  const properties = schemaProperties(schema);
  if (properties === undefined) {
    return [];
  }
  const keys = Object.keys(properties);
  for (const value of Object.values(properties)) {
    keys.push(...walkSchemaKeys(value));
  }
  return keys;
}

export function isValidIdentifier(key: string, lang: JsonFieldLang): boolean {
  if (lang === 'csharp') {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
  }
  if (lang === 'php') {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
  }
  return IDENT.test(key);
}

/** Keep a valid identifier; otherwise strip illegal characters. */
export function legalizeIdentifier(key: string, lang: JsonFieldLang): string {
  if (isValidIdentifier(key, lang) && !isKeyword(key, lang)) {
    return key;
  }
  let out = key.replace(/[^A-Za-z0-9_]/g, '');
  if (out === '' || /^[0-9]/.test(out)) {
    out = `f${out}`;
  }
  if (isKeyword(out, lang)) {
    out = `${out}_`;
  }
  return out;
}

/** Map each JSON key to a unique language field name. */
export function assignFieldNames(
  keys: readonly string[],
  lang: JsonFieldLang,
): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const key of keys) {
    let name = legalizeIdentifier(key, lang);
    let suffix = 2;
    while (used.has(name)) {
      name = `${legalizeIdentifier(key, lang)}${suffix}`;
      suffix += 1;
    }
    used.add(name);
    map.set(key, name);
  }
  return map;
}

export function assertNoKeyCollisions(
  events: readonly NormalizedEvent[],
  lang: JsonFieldLang,
): void {
  for (const event of events) {
    const properties = schemaProperties(event.schema);
    if (properties === undefined) {
      continue;
    }
    const assigned = assignFieldNames(Object.keys(properties), lang);
    const inverted = new Map<string, string>();
    for (const [jsonKey, field] of assigned) {
      const previous = inverted.get(field);
      if (previous !== undefined && previous !== jsonKey) {
        throw new CliError(
          `JSON keys ${JSON.stringify(previous)} and ${JSON.stringify(jsonKey)} collapse to ${field}`,
        );
      }
      inverted.set(field, jsonKey);
    }
  }
}
