import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import { runQuicktype } from './quicktype-input';

export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

function declaresType(source: string, name: string): boolean {
  return new RegExp(
    String.raw`(?:export\s+)?(?:interface|type|class)\s+${name}\b`,
  ).test(source);
}

/** Quicktype TypeScript interfaces plus empty-payload fallbacks. */
export async function renderTypescriptTypes(
  events: NormalizedEvent[],
): Promise<string> {
  const types = await runQuicktype(events, {
    typeNameFor,
    lang: 'typescript',
    rendererOptions: {
      'just-types': 'true',
      'nice-property-names': 'false',
    },
  });
  const fallbacks = events
    .map(typeNameFor)
    .filter((name) => !declaresType(types, name))
    .map((name) => `export type ${name} = Record<string, unknown>;`);

  return [types, ...fallbacks].filter(Boolean).join('\n\n');
}
