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
  'com.hightouch.analytics.kotlin.core.Analytics',
  'com.hightouch.analytics.kotlin.core.BaseEvent',
  'com.hightouch.analytics.kotlin.core.platform.EnrichmentClosure',
  'kotlinx.serialization.json.JsonArray',
  'kotlinx.serialization.json.JsonElement',
  'kotlinx.serialization.json.JsonNull',
  'kotlinx.serialization.json.JsonObject',
  'kotlinx.serialization.json.JsonPrimitive',
  'kotlinx.serialization.json.add',
  'kotlinx.serialization.json.buildJsonArray',
  'kotlinx.serialization.json.buildJsonObject',
  'kotlinx.serialization.json.put',
];

function renderImports(extra: readonly string[]): string {
  const all = [...new Set([...BASE_IMPORTS, ...extra])].sort();
  return all.map((pkg) => `import ${pkg}`).join('\n');
}

export async function renderKotlin(
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
    `package ${packageName}`,
    renderImports(types.imports),
    `class ${className} {\n${classBody.join('\n\n')}\n}`,
  ].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
