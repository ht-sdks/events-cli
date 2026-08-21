import { quicktype } from 'quicktype-core';
import type { NormalizedEvent } from '../../normalize/types';
import { buildQuicktypeInput } from '../shared/quicktype-input';
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
  const typed = events.filter(needsPayloadType);
  if (typed.length === 0) return '';

  const inputData = await buildQuicktypeInput(typed, typeNameFor);
  const { lines } = await quicktype({
    inputData,
    lang: 'swift',
    rendererOptions: {
      'just-types': 'false',
      'access-level': 'public',
      'struct-or-class': 'struct',
      initializers: 'false',
    },
  });

  return stripJsonAnyDictionaryExtensions(
    cleanQuicktypeSwift(lines.join('\n')),
  );
}
