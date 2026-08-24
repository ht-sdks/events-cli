import { quicktype } from 'quicktype-core';
import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import { buildQuicktypeInput } from '../shared/quicktype-input';

export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

function declaresType(source: string, name: string): boolean {
  return new RegExp(
    String.raw`(?:export\s+)?(?:interface|type|class)\s+${name}\b`,
  ).test(source);
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  if (events.length === 0) return '';

  const inputData = await buildQuicktypeInput(events, typeNameFor);
  const { lines } = await quicktype({
    inputData,
    lang: 'typescript',
    rendererOptions: {
      'just-types': 'true',
      'nice-property-names': 'false',
    },
  });

  const types = lines.join('\n').trimEnd();
  const fallbacks = events
    .map(typeNameFor)
    .filter((name) => !declaresType(types, name))
    .map((name) => `export type ${name} = Record<string, unknown>;`);

  return [types, ...fallbacks].filter(Boolean).join('\n\n');
}
