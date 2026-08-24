import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

const IMPORTS = [
  'from dataclasses import asdict, is_dataclass',
  'from typing import Any, Dict, List, Optional, Tuple',
  '',
  'from hightouch.htevents.client import Client',
].join('\n');

export async function renderPython(events: NormalizedEvent[]): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const sections = [
    renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION, { linePrefix: '# ' }),
    IMPORTS,
    types,
    wrappers,
  ].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
