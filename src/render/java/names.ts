import type { NormalizedEvent } from '../../normalize/types';
import {
  assertNoReservedCollisions,
  JAVA_KEYWORDS,
  JAVA_LANG_RESERVED,
  JVM_WRAPPER_RESERVED,
  methodName,
  typeNameFor,
} from '../shared/jvm-names';

export { methodName, typeNameFor };

/** Peer SDK message types imported into the Java wrapper file. */
const FORBIDDEN = new Set([
  ...JAVA_KEYWORDS,
  ...JVM_WRAPPER_RESERVED,
  ...JAVA_LANG_RESERVED,
  'TrackMessage',
  'IdentifyMessage',
  'GroupMessage',
  'PageMessage',
  'ScreenMessage',
  'AliasMessage',
]);

export function assertNoMethodCollisions(
  events: readonly NormalizedEvent[],
  className: string,
): void {
  assertNoReservedCollisions(events, {
    reserved: new Set([...FORBIDDEN, className]),
    language: 'Java',
  });
}
