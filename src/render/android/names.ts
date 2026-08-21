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
 * Names that cannot appear as generated methods or nested types: Java
 * keywords, the wrapper class, and peer SDK types imported into the file.
 */
const FORBIDDEN = new Set([
  '_',
  'HtEvents',
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
        `Android identifier collision: "${name}" (${kind} from ${label}) is a reserved Java name.`,
      );
    }
    const key = kind === 'type' ? name.toLowerCase() : name;
    const existing = owners.get(key);
    if (existing !== undefined) {
      throw new CliError(
        `Android identifier collision: "${name}" is produced by both ${existing} and ${label}.`,
      );
    }
    owners.set(key, label);
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
