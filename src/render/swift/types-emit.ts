import type { NormalizedEvent } from '../../normalize/types';
import { runQuicktype } from '../shared/quicktype-input';
import { typeNameFor } from './names';

export { typeNameFor };

function cleanQuicktypeSwift(source: string): string {
  return source
    .replace(
      /^\/\/ This file was generated from JSON Schema using quicktype[\s\S]*?(?=^\/\/ MARK:|^public |^struct |^enum |^class )/m,
      '',
    )
    .replace(/^import Foundation\n+/gm, '')
    .trimEnd();
}

function needsPayloadType(event: NormalizedEvent): boolean {
  return event.type !== 'alias';
}

function stripJsonAnyDictionaryExtensions(source: string): string {
  return source
    .replace(
      /public extension Dictionary where Key == String, Value == JSONAny \{[\s\S]*?\n\}\n*/g,
      '',
    )
    .trimEnd();
}

function declaredSwiftTypes(source: string): string[] {
  return [...source.matchAll(/^public struct (\w+)/gm)].map(
    (match) => match[1],
  );
}

function alignTypeNames(source: string, expected: readonly string[]): string {
  const declared = declaredSwiftTypes(source);
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
  const typed = events.filter(needsPayloadType);
  return runQuicktype(typed, {
    typeNameFor,
    lang: 'swift',
    rendererOptions: {
      'just-types': 'false',
      'access-level': 'public',
      'struct-or-class': 'struct',
      initializers: 'false',
    },
    postprocess: (source) =>
      alignTypeNames(
        stripJsonAnyDictionaryExtensions(cleanQuicktypeSwift(source)),
        typed.map(typeNameFor),
      ),
  });
}
