import { quicktype } from 'quicktype-core';
import type { NormalizedEvent } from '../../normalize/types';
import { buildQuicktypeInput } from '../shared/quicktype-input';
import { typeNameFor } from './names';

function stripPackageDecl(source: string): string {
  return source.replace(/^package \w+[ \t]*\n+/, '').trimEnd();
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  if (events.length === 0) return '';

  const inputData = await buildQuicktypeInput(events, typeNameFor);
  const { lines } = await quicktype({
    inputData,
    lang: 'go',
    rendererOptions: {
      'just-types': 'true',
      package: 'analytics',
      'field-tags': 'json',
    },
  });

  return stripPackageDecl(lines.join('\n'));
}
