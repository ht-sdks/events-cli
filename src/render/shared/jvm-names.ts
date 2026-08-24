import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from './collisions';

export function methodName(wrapperName: string): string {
  return wrapperName;
}

export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

export function assertJvmCollisions(
  events: readonly NormalizedEvent[],
  opts: {
    label: string;
    reserved: ReadonlySet<string>;
    typeKey?: (name: string) => string;
  },
): void {
  assertNoCollisions(events, {
    label: opts.label,
    methodName,
    typeNameFor,
    reserved: opts.reserved,
    typeKey: opts.typeKey,
  });
}
