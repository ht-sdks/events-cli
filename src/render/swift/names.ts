import { CliError } from '../../lib/errors';
import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';

/** Generated method name — wrapper ids are already camelCase. */
export function methodName(wrapperName: string): string {
  return wrapperName;
}

/** Quicktype / payload type name. PascalCase of the wrapper id. */
export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

export function assertNoMethodCollisions(
  events: readonly NormalizedEvent[],
): void {
  const owners = new Map<string, string>();

  const claim = (name: string, label: string) => {
    const existing = owners.get(name);
    if (existing !== undefined) {
      throw new CliError(
        `Swift identifier collision: "${name}" is produced by both ${existing} and ${label}.`,
      );
    }
    owners.set(name, label);
  };

  for (const event of events) {
    const label = event.wrapperName;
    claim(methodName(event.wrapperName), label);
    if (event.latestAlias !== undefined) {
      claim(methodName(event.latestAlias), label);
    }
  }
}
