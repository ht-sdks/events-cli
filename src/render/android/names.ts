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

/**
 * Names that cannot appear as generated methods or nested types: Java
 * keywords, the wrapper class, and peer SDK types imported into the file.
 */
const FORBIDDEN = new Set([
  '_',
  'Injected',
  'Analytics',
  'Options',
  'Properties',
  'Traits',
  'Object',
  'Class',
  'String',
  'List',
  'Map',
  'abstract',
  'assert',
  'boolean',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'class',
  'const',
  'continue',
  'default',
  'do',
  'double',
  'else',
  'enum',
  'extends',
  'final',
  'finally',
  'float',
  'for',
  'goto',
  'if',
  'implements',
  'import',
  'instanceof',
  'int',
  'interface',
  'long',
  'native',
  'new',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'short',
  'static',
  'strictfp',
  'super',
  'switch',
  'synchronized',
  'this',
  'throw',
  'throws',
  'transient',
  'try',
  'void',
  'volatile',
  'while',
  'true',
  'false',
  'null',
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
        `Android identifier collision: "${name}" (${kind} from ${label}) is a reserved Java name.`,
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
    generatedMethodName: methodName,
  });
}
