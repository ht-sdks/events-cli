import type { NormalizedEvent } from '../../normalize/types';
import { assembleSource } from '../shared/assemble';
import { byWrapperName } from '../shared/sort';
import { renderHeader } from './header';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

export async function renderSwift(events: NormalizedEvent[]): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  return assembleSource([
    renderHeader(),
    'import Foundation\nimport Hightouch',
    types,
    wrappers,
  ]);
}
