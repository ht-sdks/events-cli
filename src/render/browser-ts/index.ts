import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';
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
  return (
    [
      renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION, {
        open: '/**',
        linePrefix: ' * ',
        close: ' */',
      }),
      sdkImport,
      types,
      wrappers,
    ].filter(Boolean).join('\n\n') +
    '\n'
  );
}
