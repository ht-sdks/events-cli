import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { indentBlock, jvmOutputLayout } from '../shared/jvm-output';
import { byWrapperName } from '../shared/sort';
import {
  DEFAULT_OUTPUT_PATH,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from './constants';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export {
  DEFAULT_OUTPUT_PATH,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from './constants';

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

function renderImports(extra: readonly string[]): string {
  const all = [...new Set([...BASE_IMPORTS, ...extra])].sort();
  return all.map((pkg) => `import ${pkg};`).join('\n');
}

export async function renderAndroid(
  events: NormalizedEvent[],
  outputPath: string = DEFAULT_OUTPUT_PATH,
): Promise<string> {
  const { packageName, className } = jvmOutputLayout(outputPath);
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered, packageName);
  const wrappers = renderWrappers(ordered, className);
  const typeBlock = indentBlock(types.body, 4);
  const classBody = [typeBlock, wrappers].filter((part) => part.length > 0);
  const sections = [
    renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION),
    `package ${packageName};`,
    renderImports(types.imports),
    `public final class ${className} {\n${classBody.join('\n\n')}\n}`,
  ].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
