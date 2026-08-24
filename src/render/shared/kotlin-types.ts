import type { NormalizedEvent } from '../../normalize/types';
import { runQuicktype } from './quicktype';

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

export function nestQuicktypeKotlin(source: string): {
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

export function fallbackKotlinClasses(
  body: string,
  names: readonly string[],
): string {
  const extras = names
    .filter((name) => !declaresType(body, name))
    .map((name) => `class ${name}`);
  if (extras.length === 0) return body;
  return [body, ...extras].filter(Boolean).join('\n\n');
}

export async function renderNestedKotlinTypes(
  events: readonly NormalizedEvent[],
  typeNameFor: (event: NormalizedEvent) => string,
  packageName: string,
): Promise<{ imports: string[]; body: string }> {
  const typed = events.filter((event) => event.type !== 'alias');
  if (typed.length === 0) return { imports: [], body: '' };

  const source = await runQuicktype(typed, {
    lang: 'kotlin',
    typeNameFor,
    rendererOptions: {
      'just-types': 'true',
      package: packageName,
      'acronym-style': 'original',
    },
  });
  const nested = nestQuicktypeKotlin(source);
  return {
    imports: nested.imports,
    body: fallbackKotlinClasses(nested.body, typed.map(typeNameFor)),
  };
}
