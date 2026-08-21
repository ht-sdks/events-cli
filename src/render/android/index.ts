import type { NormalizedEvent } from '../../normalize/types';
import { byWrapperName } from '../shared/sort';
import { renderHeader } from './header';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

const BASE_IMPORTS = [
  'com.hightouch.analytics.Analytics',
  'com.hightouch.analytics.Options',
  'com.hightouch.analytics.Properties',
  'com.hightouch.analytics.Traits',
  'java.lang.reflect.Field',
  'java.lang.reflect.Modifier',
  'java.util.ArrayList',
  'java.util.Arrays',
  'java.util.Collection',
  'java.util.LinkedHashMap',
  'java.util.List',
  'java.util.Map',
];

function indentBlock(source: string, spaces: number): string {
  if (source.length === 0) return '';
  const pad = ' '.repeat(spaces);
  return source
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${pad}${line}`))
    .join('\n');
}

function renderImports(extra: readonly string[]): string {
  const all = [...new Set([...BASE_IMPORTS, ...extra])].sort();
  return all.map((pkg) => `import ${pkg};`).join('\n');
}

export async function renderAndroid(
  events: NormalizedEvent[],
): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const typeBlock = indentBlock(types.body, 4);
  const classBody = [typeBlock, wrappers].filter((part) => part.length > 0);
  const sections = [
    renderHeader(),
    'package analytics;',
    renderImports(types.imports),
    `public final class HtEvents {\n${classBody.join('\n\n')}\n}`,
  ];
  return `${sections.join('\n\n')}\n`;
}
