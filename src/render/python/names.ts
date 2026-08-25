import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import {
  PYTHON_KEYWORDS,
  snakeName as sharedSnakeName,
  toSnakeCase,
} from '../shared/snake-names';

export { toSnakeCase };

export function snakeName(wrapperName: string): string {
  return sharedSnakeName(wrapperName, PYTHON_KEYWORDS);
}

export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}
