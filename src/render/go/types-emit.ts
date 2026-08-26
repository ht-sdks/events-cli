import type { NormalizedEvent } from '../../normalize/types';
import { runQuicktype } from '../shared/quicktype-input';
import { typeNameFor } from './names';

function stripPackageDecl(source: string): string {
  return source.replace(/^package \w+[ \t]*\n+/, '').trimEnd();
}

function declaredGoTypes(source: string): string[] {
  return [...source.matchAll(/^type (\w+) /gm)].map((match) => match[1]);
}

/** Quicktype's Go namer has no acronym-style option and rewrites Json→JSON. */
function alignTypeNames(source: string, expected: readonly string[]): string {
  const declared = declaredGoTypes(source);
  let out = source;
  for (const name of expected) {
    if (declared.includes(name)) continue;
    const actual = declared.find(
      (ident) => ident.toLowerCase() === name.toLowerCase(),
    );
    if (actual === undefined) continue;
    out = out.replace(new RegExp(`\\b${actual}\\b`, 'g'), name);
  }
  return out;
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  const names = events.map(typeNameFor);
  return runQuicktype(events, {
    typeNameFor,
    lang: 'go',
    rendererOptions: {
      'just-types': 'true',
      package: 'analytics',
      'field-tags': 'json',
    },
    postprocess: (source) => alignTypeNames(stripPackageDecl(source), names),
  });
}
