import { CliError } from '../../lib/errors';
import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';

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
  const owners = new Map<string, string>();

  const claim = (name: string, label: string) => {
    const existing = owners.get(name);
    if (existing !== undefined) {
      throw new CliError(
        `Go identifier collision: "${name}" is produced by both ${existing} and ${label}.`,
      );
    }
    owners.set(name, label);
  };

  for (const event of events) {
    const label = event.wrapperName;
    claim(exportedName(event.wrapperName), label);
    claim(typeNameFor(event), label);
    if (event.latestAlias !== undefined) {
      claim(exportedName(event.latestAlias), label);
    }
  }
}
