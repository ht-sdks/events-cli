import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';

/** Exported Go function name derived from a canonical wrapper id. */
export function exportedName(wrapperName: string): string {
  return toPascalCase(wrapperName);
}

/**
 * Quicktype struct name. Suffixed so it cannot collide with the exported
 * wrapper function, which is also PascalCase of `wrapperName`.
 */
export function typeNameFor(event: NormalizedEvent): string {
  return `${toPascalCase(event.wrapperName)}Payload`;
}

export function assertNoExportedCollisions(
  events: readonly NormalizedEvent[],
): void {
  assertNoCollisions(events, {
    label: 'Go',
    methodName: exportedName,
    typeNameFor,
    sharedPool: true,
    includeType: () => true,
  });
}
