import type { NormalizedEvent } from '../../normalize/types';
import { runQuicktype } from '../shared/quicktype-input';
import { typeNameFor } from './names';

export { typeNameFor };

function needsPayloadType(event: NormalizedEvent): boolean {
  return event.type !== 'alias';
}

function cleanQuicktypeDart(source: string): string {
  return source
    .replace(/^\/\/ To parse this JSON data, do\n\/\/\n(?:\/\/.+\n)+/, '')
    .replace(/^import 'dart:convert';\n*/, '')
    .replace(/^[A-Za-z0-9_<>, ]+ \w+FromMap\(String str\).+\n*/gm, '')
    .replace(/^String \w+ToMap\(.+\n*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function declaredDartTypes(source: string): string[] {
  return [...source.matchAll(/^class (\w+)/gm)].map((match) => match[1]);
}

function declaresType(source: string, name: string): boolean {
  return new RegExp(String.raw`(?:class)\s+${name}\b`).test(source);
}

/** Quicktype's Dart namer can rewrite Json→JSON. */
function alignTypeNames(source: string, expected: readonly string[]): string {
  const declared = declaredDartTypes(source);
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

function emptyClass(name: string): string {
  return [
    `class ${name} {`,
    `    ${name}();`,
    '',
    '    Map<String, dynamic> toMap() => {};',
    '}',
  ].join('\n');
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  const typed = events.filter(needsPayloadType);
  const names = typed.map(typeNameFor);
  const types =
    typed.length === 0
      ? ''
      : alignTypeNames(
          cleanQuicktypeDart(
            await runQuicktype(typed, {
              typeNameFor,
              lang: 'dart',
              rendererOptions: {
                'just-types': 'false',
                'from-map': 'true',
                'required-props': 'false',
              },
            }),
          ),
          names,
        );
  const fallbacks = names
    .filter((name) => !declaresType(types, name))
    .map(emptyClass);
  return [types, ...fallbacks].filter(Boolean).join('\n\n');
}
