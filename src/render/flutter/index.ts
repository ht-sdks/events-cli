import type { NormalizedEvent } from '../../normalize/types';
import { renderHeader } from '../shared/header';
import { byWrapperName } from '../shared/sort';
import { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';
import { renderTypes } from './types-emit';
import { renderWrappers } from './wrappers-emit';

export { MIN_SDK_PACKAGE, MIN_SDK_VERSION } from './constants';

const IMPORTS = [
  "import 'package:hightouch_events/analytics.dart';",
  "import 'package:hightouch_events/event.dart';",
].join('\n');

export async function renderFlutter(
  events: NormalizedEvent[],
): Promise<string> {
  const ordered = [...events].sort(byWrapperName);
  const types = await renderTypes(ordered);
  const wrappers = renderWrappers(ordered);
  const sections = [
    renderHeader(MIN_SDK_PACKAGE, MIN_SDK_VERSION),
    IMPORTS,
    types,
    wrappers,
  ].filter((section) => section.length > 0);
  return `${sections.join('\n\n')}\n`;
}
