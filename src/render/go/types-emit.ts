import type { NormalizedEvent } from '../../normalize/types';
import { runQuicktype } from '../shared/quicktype';
import { typeNameFor } from './names';

function stripPackageDecl(source: string): string {
  return source.replace(/^package \w+[ \t]*\n+/, '').trimEnd();
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  return runQuicktype(events, {
    lang: 'go',
    typeNameFor,
    rendererOptions: {
      'just-types': 'true',
      package: 'analytics',
      'field-tags': 'json',
    },
    postprocess: stripPackageDecl,
  });
}
