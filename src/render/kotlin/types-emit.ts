import type { NormalizedEvent } from '../../normalize/types';
import { JsonNameKotlinTargetLanguage } from '../shared/jvm-json-name-quicktype';
import { runQuicktype } from '../shared/quicktype-input';
import { typeNameFor } from './names';

export { typeNameFor };

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

function declaresType(source: string, name: string): boolean {
  return new RegExp(
    String.raw`(?:class|enum|interface|object)\s+${name}\b`,
  ).test(source);
}

function nestQuicktypeKotlin(source: string): {
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

function fallbackKotlinClasses(body: string, names: readonly string[]): string {
  const extras = names
    .filter((name) => !declaresType(body, name))
    .map((name) => `class ${name}`);
  if (extras.length === 0) return body;
  return [body, ...extras].filter(Boolean).join('\n\n');
}

export async function renderTypes(
  events: NormalizedEvent[],
  packageName: string,
): Promise<{ imports: string[]; body: string }> {
  const typed = events.filter((event) => event.type !== 'alias');
  if (typed.length === 0) return { imports: [], body: '' };

  const source = await runQuicktype(typed, {
    typeNameFor,
    lang: 'kotlin',
    language: new JsonNameKotlinTargetLanguage(),
    rendererOptions: {
      'just-types': 'true',
      package: packageName,
      'acronym-style': 'original' as never,
    },
  });
  const nested = nestQuicktypeKotlin(source);
  return {
    imports: nested.imports,
    body: fallbackKotlinClasses(nested.body, typed.map(typeNameFor)),
  };
}
