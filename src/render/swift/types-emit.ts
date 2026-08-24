import type { NormalizedEvent } from '../../normalize/types';
import { runQuicktype } from '../shared/quicktype';
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

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  return runQuicktype(events, {
    lang: 'swift',
    typeNameFor,
    include: needsPayloadType,
    rendererOptions: {
      'just-types': 'false',
      'access-level': 'public',
      'struct-or-class': 'struct',
      initializers: 'false',
    },
    postprocess: (source) =>
      stripJsonAnyDictionaryExtensions(cleanQuicktypeSwift(source)),
  });
}
