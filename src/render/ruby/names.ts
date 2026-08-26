import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import {
  RUBY_KEYWORDS,
  snakeName as sharedSnakeName,
  toSnakeCase,
} from '../shared/snake-names';

export { RUBY_KEYWORDS, toSnakeCase };

export function snakeName(wrapperName: string): string {
  return sharedSnakeName(wrapperName, RUBY_KEYWORDS);
}

export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

export function isRubyKeyword(name: string): boolean {
  return RUBY_KEYWORDS.has(toSnakeCase(name));
}
