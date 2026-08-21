import { quicktype } from 'quicktype-core';
import type { NormalizedEvent } from '../../normalize/types';
import { buildQuicktypeInput } from '../shared/quicktype-input';
import { typeNameFor } from './names';

export { typeNameFor };

function needsPayloadType(event: NormalizedEvent): boolean {
  return event.type !== 'alias';
}

function extractImports(source: string): string[] {
  const imports = new Set<string>();
  for (const match of source.matchAll(/^import (.+)$/gm)) {
    const spec = match[1].trim();
    if (spec.length > 0) {
      imports.add(spec);
    }
  }
  return [...imports].sort();
}

/**
 * Flatten quicktype's per-class Kotlin files into nested classes, hoist
 * imports, and drop package/file annotations so they can live inside HtEvents.
 */
export function nestQuicktypeClasses(source: string): {
  imports: string[];
  body: string;
} {
  const imports = extractImports(source);
  let body = source
    .replace(/^\/\/ .+\.kt\s*$/gm, '')
    .replace(/^@file:.*$/gm, '')
    .replace(/^package [\w.]+\s*/gm, '')
    .replace(/^import .+\s*/gm, '')
    .replace(/\/\*\*[\s\S]*?\*\/\s*/g, '')
    .trim();

  body = body.replace(/\n{3,}/g, '\n\n').trim();

  return { imports, body };
}

export async function renderTypes(events: NormalizedEvent[]): Promise<{
  imports: string[];
  body: string;
}> {
  const typed = events.filter(needsPayloadType);
  if (typed.length === 0) return { imports: [], body: '' };

  const inputData = await buildQuicktypeInput(typed, typeNameFor);
  const { lines } = await quicktype({
    inputData,
    lang: 'kotlin',
    rendererOptions: {
      'just-types': 'true',
      package: 'analytics',
      // quicktype types this as its AcronymStyleOptions enum, whose values are these strings.
      'acronym-style': 'original' as never,
    },
  });

  return nestQuicktypeClasses(lines.join('\n'));
}
