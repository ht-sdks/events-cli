import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

export async function renderCSharp(events: NormalizedEvent[]): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const sections = [
    renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION),
    'using System;',
    'using System.Collections;',
    'using System.Collections.Generic;',
    'using Hightouch.Events.Serialization;',
    'using AnalyticsClient = Hightouch.Events.Analytics;',
    `namespace Analytics\n{\n${types}\n\n${wrappers}\n}`,
  ].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
