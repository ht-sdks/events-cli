import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';

export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

export function methodName(wrapperName: string): string {
  return wrapperName;
}
