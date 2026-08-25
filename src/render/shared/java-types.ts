import type { NormalizedEvent } from '../../normalize/types';
import { JsonNameJavaTargetLanguage } from './jvm-json-name-quicktype';
import { runQuicktype } from './quicktype-input';

const BOXED: Record<string, string> = {
  boolean: 'Boolean',
  byte: 'Byte',
  char: 'Character',
  double: 'Double',
  float: 'Float',
  int: 'Integer',
  long: 'Long',
  short: 'Short',
};

function extractImports(source: string): string[] {
  const imports = new Set<string>();
  for (const match of source.matchAll(/^import (.+);$/gm)) {
    imports.add(match[1]);
  }
  return [...imports].sort();
}

function declaresType(source: string, name: string): boolean {
  return new RegExp(String.raw`(?:class|enum|interface)\s+${name}\b`).test(
    source,
  );
}

/**
 * Flatten quicktype's per-class Java files into nested static classes, hoist
 * imports, and box primitive fields so optional numbers stay omitted instead
 * of serializing as 0. When a JSON key is not a valid identifier, `@JsonName`
 * holds the original key so `toMap` can round-trip without Jackson/Gson.
 */
export function nestQuicktypeJava(source: string): {
  imports: string[];
  body: string;
} {
  const imports = extractImports(source);
  let body = source
    .replace(/^\/\/ .+\.java\s*$/gm, '')
    .replace(/^package [\w.]+;\s*/gm, '')
    .replace(/^import .+;\s*/gm, '')
    .replace(/\/\*\*[\s\S]*?\*\/\s*/g, '')
    .trim();

  body = body.replace(
    /public (class|enum|interface) /g,
    'public static final $1 ',
  );
  // Nested enums are implicitly static; `final enum` is invalid.
  body = body.replace(/public static final enum /g, 'public static enum ');
  body = body.replace(/public static final interface /g, 'public static ');

  body = body.replace(
    /^([ \t]*)private ([^;\n]+);$/gm,
    (_all, indent: string, decl: string) => {
      const boxed = decl.replace(
        /^(boolean|byte|char|double|float|int|long|short)\b/,
        (primitive) => BOXED[primitive] ?? primitive,
      );
      return `${indent}private ${boxed};`;
    },
  );
  body = body.replace(
    /\b(public|private) (boolean|byte|char|double|float|int|long|short) /g,
    (_all, vis: string, primitive: string) =>
      `${vis} ${BOXED[primitive] ?? primitive} `,
  );
  body = body.replace(
    /\((boolean|byte|char|double|float|int|long|short) /g,
    (_all, primitive: string) => `(${BOXED[primitive] ?? primitive} `,
  );
  body = body.replace(/\n{3,}/g, '\n\n').trim();

  return { imports, body };
}

export function fallbackJavaClasses(
  body: string,
  names: readonly string[],
): string {
  const extras = names
    .filter((name) => !declaresType(body, name))
    .map((name) => `public static final class ${name} {}`);
  if (extras.length === 0) return body;
  return [body, ...extras].filter(Boolean).join('\n\n');
}

export async function renderNestedJavaTypes(
  events: readonly NormalizedEvent[],
  typeNameFor: (event: NormalizedEvent) => string,
  packageName: string,
): Promise<{ imports: string[]; body: string }> {
  const typed = events.filter((event) => event.type !== 'alias');
  if (typed.length === 0) return { imports: [], body: '' };

  const source = await runQuicktype(typed, {
    typeNameFor,
    lang: 'java',
    language: new JsonNameJavaTargetLanguage(),
    rendererOptions: {
      'just-types': 'true',
      package: packageName,
      'array-type': 'list',
      'acronym-style': 'original' as never,
    },
  });
  const nested = nestQuicktypeJava(source);
  return {
    imports: nested.imports,
    body: fallbackJavaClasses(nested.body, typed.map(typeNameFor)),
  };
}
