import type { NormalizedEvent } from '../../normalize/types';
import type { ArtifactFile } from '../shared/output';
import { byWrapperName } from '../shared/sort';
import { phpFilePreamble } from './preamble';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

export async function renderPhp(
  events: NormalizedEvent[],
): Promise<ArtifactFile[]> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = `${phpFilePreamble()}namespace Hightouch\\Generated;\n\nuse Hightouch\\Client;\n\n${renderWrappers(ordered)}\n`;
  return [
    {
      path: 'HtEvents.php',
      contents: wrappers,
    },
    ...types,
  ];
}
