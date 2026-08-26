import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

function indentModule(body: string): string {
  return body
    .split('\n')
    .map((line) => (line.length === 0 ? line : `  ${line}`))
    .join('\n');
}

export async function renderRuby(events: NormalizedEvent[]): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const inner = [types, wrappers].filter((section) => section.length > 0);
  const sections = [
    renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION, { linePrefix: '# ' }),
    '# frozen_string_literal: true',
    "require 'hightouch/analytics'",
    `module HtEvents\n${indentModule(inner.join('\n\n'))}\nend`,
  ].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
