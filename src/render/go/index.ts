import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

const GO_IMPORTS = [
  'import (',
  '\t"encoding/json"',
  '\t"time"',
  '',
  '\thtevents "github.com/ht-sdks/events-sdk-go"',
  ')',
].join('\n');

export async function renderGo(events: NormalizedEvent[]): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const sections = [
    renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION),
    'package analytics',
    GO_IMPORTS,
    types,
    wrappers,
  ].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
