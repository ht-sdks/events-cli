import type { NormalizedEvent } from '../../normalize/types';
import { runQuicktype } from '../shared/quicktype-input';
import { typeNameFor } from './names';

function declaresType(source: string, name: string): boolean {
  return new RegExp(String.raw`^class ${name}\b`, 'm').test(source);
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  const types = await runQuicktype(events, {
    typeNameFor,
    lang: 'python',
    rendererOptions: {
      'just-types': 'true',
      'nice-property-names': 'false',
      'python-version': '3.7',
    },
  });
  const fallbacks = events
    .map(typeNameFor)
    .filter((name) => !declaresType(types, name))
    .map((name) => `@dataclass\nclass ${name}:\n    pass`);

  return [types, ...fallbacks].filter(Boolean).join('\n\n');
}
