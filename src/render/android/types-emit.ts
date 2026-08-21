import { quicktype } from 'quicktype-core';
import type { NormalizedEvent } from '../../normalize/types';
import { buildQuicktypeInput } from '../shared/quicktype-input';
import { typeNameFor } from './names';

export { typeNameFor };

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

function needsPayloadType(event: NormalizedEvent): boolean {
  return event.type !== 'alias';
}

function extractImports(source: string): string[] {
  const imports = new Set<string>();
  for (const match of source.matchAll(/^import (.+);$/gm)) {
    imports.add(match[1]);
  }
  return [...imports].sort();
}

/**
 * Flatten quicktype's per-class "files" into nested static classes, hoist
 * imports, and box primitive fields so optional numbers stay omitted instead
 * of serializing as 0. JSON property names are kept as field names
 * (`acronym-style: original`) so reflection can round-trip into Properties
 * without Jackson/Gson.
 */
export function nestQuicktypeClasses(source: string): {
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
  // Keep generated getters/setters; box primitive signatures to match fields.
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

export async function renderTypes(events: NormalizedEvent[]): Promise<{
  imports: string[];
  body: string;
}> {
  const typed = events.filter(needsPayloadType);
  if (typed.length === 0) return { imports: [], body: '' };

  const inputData = await buildQuicktypeInput(typed, typeNameFor);
  const { lines } = await quicktype({
    inputData,
    lang: 'java',
    rendererOptions: {
      'just-types': 'true',
      package: 'analytics',
      'array-type': 'list',
      // quicktype types this as its AcronymStyleOptions enum, whose values are these strings.
      'acronym-style': 'original' as never,
    },
  });

  return nestQuicktypeClasses(lines.join('\n'));
}
