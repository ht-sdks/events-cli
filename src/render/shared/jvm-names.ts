import { CliError } from '../../lib/errors';
import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import { assertNoCollisions } from './collisions';

/** Java keywords plus `_` — invalid as package segments, methods, or types. */
export const JAVA_KEYWORDS = new Set([
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
  '_',
]);

/** Kotlin hard and soft keywords that cannot be method or type names. */
export const KOTLIN_KEYWORDS = new Set([
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
  '_',
]);

/** Helper / peer names always present in generated JVM wrapper files. */
export const JVM_WRAPPER_RESERVED = [
  'Injected',
  'Analytics',
  'JsonName',
] as const;

/** Stdlib types referenced by all three JVM wrapper files. */
export const JVM_STDLIB_RESERVED = ['String', 'List', 'Map'] as const;

/** java.lang / java.util types referenced by the Java and Android wrappers. */
export const JAVA_LANG_RESERVED = [
  'Object',
  'Class',
  ...JVM_STDLIB_RESERVED,
] as const;

/** Generated method name — wrapper ids are already camelCase. */
export function methodName(wrapperName: string): string {
  return wrapperName;
}

/** Quicktype / payload type name. PascalCase of the wrapper id. */
export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

export type ReservedCollisionOptions = {
  reserved: ReadonlySet<string>;
  /** Shown as `{language} identifier collision`. */
  language: string;
  /** Shown as `reserved {reservedLanguage} name`. Defaults to `language`. */
  reservedLanguage?: string;
};

/**
 * Reject methods/types that collide with reserved language or peer-SDK names,
 * then reject wrapper-id collisions via `assertNoCollisions`.
 */
export function assertNoReservedCollisions(
  events: readonly NormalizedEvent[],
  opts: ReservedCollisionOptions,
): void {
  const reservedLanguage = opts.reservedLanguage ?? opts.language;

  const claimReserved = (
    name: string,
    kind: 'method' | 'type',
    label: string,
  ) => {
    if (opts.reserved.has(name)) {
      throw new CliError(
        `${opts.language} identifier collision: "${name}" (${kind} from ${label}) is a reserved ${reservedLanguage} name.`,
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
