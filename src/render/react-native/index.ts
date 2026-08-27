import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

function sdkTypeImports(events: readonly NormalizedEvent[]): string {
  const names = [
    'EnrichmentClosure',
    'HightouchClient',
    'HightouchEvent',
    'JsonMap',
  ];
  if (events.some((event) => event.type === 'group')) {
    names.push('GroupTraits');
  }
  if (events.some((event) => event.type === 'identify')) {
    names.push('UserTraits');
  }
  names.sort();
  return `import type { ${names.join(', ')} } from '${MIN_SDK_PACKAGE}';`;
}

export async function renderReactNative(
  events: NormalizedEvent[],
): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const sdkImport = sdkTypeImports(ordered);
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
    ]
      .filter(Boolean)
      .join('\n\n') + '\n'
  );
}
