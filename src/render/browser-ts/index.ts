import type { NormalizedEvent } from '../../normalize/types';
import { MIN_SDK_PACKAGE } from './constants';
import { renderHeader } from './header';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

function byWrapperName(a: NormalizedEvent, b: NormalizedEvent): number {
  return a.wrapperName.localeCompare(b.wrapperName);
}

export async function renderBrowserTs(
  events: NormalizedEvent[],
): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const sdkImport = `import type { HtEventsBrowser, Options } from '${MIN_SDK_PACKAGE}';`;
  return (
    [renderHeader(), sdkImport, types, wrappers].filter(Boolean).join('\n\n') +
    '\n'
  );
}
