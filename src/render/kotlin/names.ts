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

/**
 * Names that cannot appear as generated methods or nested types: Kotlin
 * keywords, the wrapper class, and peer SDK types imported into the file.
 */
const FORBIDDEN = new Set([
  '_',
  'HtEvents',
  'Injected',
  'Analytics',
  'JsonObject',
  'EnrichmentClosure',
  'Map',
  'Any',
  'String',
  'List',
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
]);

export function assertNoMethodCollisions(
  events: readonly NormalizedEvent[],
): void {
  const methods = new Map<string, string>();
  const types = new Map<string, string>();

  const claim = (
    owners: Map<string, string>,
    name: string,
    label: string,
    kind: 'method' | 'type',
  ) => {
    if (FORBIDDEN.has(name)) {
      throw new CliError(
        `Kotlin identifier collision: "${name}" (${kind} from ${label}) is a reserved Kotlin name.`,
      );
    }
    const existing = owners.get(name);
    if (existing !== undefined) {
      throw new CliError(
        `Kotlin identifier collision: "${name}" is produced by both ${existing} and ${label}.`,
      );
    }
    owners.set(name, label);
  };

  for (const event of events) {
    const label = event.wrapperName;
    claim(methods, methodName(event.wrapperName), label, 'method');
    if (event.type !== 'alias') {
      claim(types, typeNameFor(event), label, 'type');
    }
    if (event.latestAlias !== undefined) {
      claim(methods, methodName(event.latestAlias), label, 'method');
    }
  }
}
