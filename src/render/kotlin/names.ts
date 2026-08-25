import type { NormalizedEvent } from '../../normalize/types';
import {
  assertNoReservedCollisions,
  JVM_STDLIB_RESERVED,
  JVM_WRAPPER_RESERVED,
  KOTLIN_KEYWORDS,
  methodName,
  typeNameFor,
} from '../shared/jvm-names';

export { methodName, typeNameFor };

/** Peer SDK types referenced in the Kotlin wrapper file. */
const FORBIDDEN = new Set([
  ...KOTLIN_KEYWORDS,
  ...JVM_WRAPPER_RESERVED,
  ...JVM_STDLIB_RESERVED,
  'JsonObject',
  'EnrichmentClosure',
  'Any',
]);

export function assertNoMethodCollisions(
  events: readonly NormalizedEvent[],
  className: string,
): void {
  assertNoReservedCollisions(events, {
    reserved: new Set([...FORBIDDEN, className]),
    language: 'Kotlin',
  });
}
