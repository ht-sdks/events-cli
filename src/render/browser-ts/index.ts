import type { NormalizedEvent } from '../../normalize/types';
import { assembleSource } from '../shared/assemble';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE } from './constants';
import { renderHeader } from './header';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

export async function renderBrowserTs(
  events: NormalizedEvent[],
): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const sdkImport = `import type { HtEventsBrowser, Options } from '${MIN_SDK_PACKAGE}';`;
  return assembleSource([renderHeader(), sdkImport, types, wrappers]);
}
