import { CliError } from '../../lib/errors';
import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from '../shared/collisions';

/** Generated method name — wrapper ids are already camelCase. */
export function methodName(wrapperName: string): string {
  return wrapperName;
}

/** Quicktype / payload type name. PascalCase of the wrapper id. */
export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

const FORBIDDEN = new Set([
  '_',
  'as',
  'break',
  'class',
  'continue',
  'do',
  'else',
  'false',
  'for',
  'fun',
  'if',
  'in',
  'interface',
  'is',
  'null',
  'object',
  'package',
  'return',
  'super',
  'this',
  'throw',
  'true',
  'try',
  'typealias',
  'typeof',
  'val',
  'var',
  'when',
  'while',
  'abstract',
  'annotation',
  'companion',
  'const',
  'data',
  'enum',
  'inner',
  'internal',
  'open',
  'override',
  'private',
  'protected',
  'public',
  'sealed',
  'suspend',
  'Injected',
  'Analytics',
  'JsonObject',
  'EnrichmentClosure',
  'Map',
  'Any',
  'String',
  'List',
]);

export function assertNoMethodCollisions(
  events: readonly NormalizedEvent[],
  className: string,
): void {
  const reserved = new Set([...FORBIDDEN, className]);

  const claimReserved = (
    name: string,
    kind: 'method' | 'type',
    label: string,
  ) => {
    if (reserved.has(name)) {
      throw new CliError(
        `Kotlin identifier collision: "${name}" (${kind} from ${label}) is a reserved Kotlin name.`,
      );
    }
  };

  for (const event of events) {
    const label = event.wrapperName;
    claimReserved(methodName(event.wrapperName), 'method', label);
    if (event.type !== 'alias') {
      claimReserved(typeNameFor(event), 'type', label);
    }
    if (event.latestAlias !== undefined) {
      claimReserved(methodName(event.latestAlias), 'method', label);
    }
  }

  assertNoCollisions(events, {
    errorPrefixLabel: 'Kotlin',
    generatedMethodName: methodName,
  });
}
