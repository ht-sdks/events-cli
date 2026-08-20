import type { NormalizedEvent } from '../../normalize/types';

export function byWrapperName(a: NormalizedEvent, b: NormalizedEvent): number {
  return a.wrapperName.localeCompare(b.wrapperName);
}
