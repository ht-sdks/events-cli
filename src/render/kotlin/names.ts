import type { NormalizedEvent } from '../../normalize/types';
import {
  assertJvmCollisions,
  methodName,
  typeNameFor,
} from '../shared/jvm-names';

export { methodName, typeNameFor };

const KOTLIN_KEYWORDS = [
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
];

export function assertNoMethodCollisions(
  events: readonly NormalizedEvent[],
  className: string,
): void {
  assertJvmCollisions(events, {
    label: 'Kotlin',
    reserved: new Set([
      className,
      'Injected',
      'Analytics',
      'JsonObject',
      'EnrichmentClosure',
      'Map',
      'Any',
      'String',
      'List',
      ...KOTLIN_KEYWORDS,
    ]),
  });
}
