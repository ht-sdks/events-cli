import { quicktype } from 'quicktype-core';
import type { NormalizedEvent } from '../../normalize/types';
import { buildQuicktypeInput } from './quicktype-input';

export async function runQuicktype(
  events: readonly NormalizedEvent[],
  opts: {
    lang: string;
    rendererOptions: Record<string, string>;
    typeNameFor: (event: NormalizedEvent) => string;
    include?: (event: NormalizedEvent) => boolean;
    postprocess?: (source: string) => string;
  },
): Promise<string> {
  const typed = opts.include ? events.filter(opts.include) : [...events];
  if (typed.length === 0) return '';

  const inputData = await buildQuicktypeInput(typed, opts.typeNameFor);
  const { lines } = await quicktype({
    inputData,
    lang: opts.lang as 'typescript',
    rendererOptions: opts.rendererOptions,
  });
  const source = lines.join('\n');
  return opts.postprocess ? opts.postprocess(source) : source.trimEnd();
}
