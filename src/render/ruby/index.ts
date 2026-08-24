import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

export async function renderRuby(events: NormalizedEvent[]): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const sections = [
    renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION, { linePrefix: '# ' }),
    '# frozen_string_literal: true',
    "require 'hightouch/analytics'",
    types,
    wrappers,
  ].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
