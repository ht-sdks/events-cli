import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';

const KEYWORDS = new Set([
  'alias',
  'and',
  'begin',
  'break',
  'case',
  'class',
  'def',
  'defined',
  'do',
  'else',
  'elsif',
  'end',
  'ensure',
  'false',
  'for',
  'if',
  'in',
  'module',
  'next',
  'nil',
  'not',
  'or',
  'redo',
  'rescue',
  'retry',
  'return',
  'self',
  'super',
  'then',
  'true',
  'undef',
  'unless',
  'until',
  'when',
  'while',
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
