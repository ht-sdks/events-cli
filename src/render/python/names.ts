import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';

const KEYWORDS = new Set([
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

export function toSnakeCase(wrapperName: string): string {
  return wrapperName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

export function snakeName(wrapperName: string): string {
  const name = toSnakeCase(wrapperName);
  return KEYWORDS.has(name) ? `${name}_` : name;
}

export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}
