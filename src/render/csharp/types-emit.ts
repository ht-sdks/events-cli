import type { NormalizedEvent } from '../../normalize/types';
import { JsonNameCSharpTargetLanguage } from '../shared/csharp-json-name-quicktype';
import { indentBlock } from '../shared/jvm-output';
import { runQuicktype } from '../shared/quicktype-input';
import { typeNameFor } from './names';

function dedent(source: string): string {
  const lines = source.split('\n');
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^ */)?.[0].length ?? 0);
  const min = indents.length === 0 ? 0 : Math.min(...indents);
  return lines
    .map((line) => line.slice(min))
    .join('\n')
    .trim();
}

function extractTypes(source: string): string {
  const body = dedent(
    source
      .replace(/^[ \t]*using .+;[ \t]*$/gm, '')
      .replace(/^\/\/ .+$/gm, '')
      .replace(/^namespace \w+\s*\{/, '')
      .replace(/\}\s*$/, ''),
  );
  return indentBlock(body, 4);
}

function declaresType(source: string, name: string): boolean {
  return new RegExp(String.raw`(?:class|enum|struct)\s+${name}\b`).test(source);
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  const payloadEvents = events.filter((event) => event.type !== 'alias');
  const types =
    payloadEvents.length === 0
      ? ''
      : extractTypes(
          await runQuicktype(payloadEvents, {
            typeNameFor,
            lang: 'csharp',
            language: new JsonNameCSharpTargetLanguage(),
            rendererOptions: {
              'just-types': 'true',
              'keep-property-name': true,
              namespace: 'Analytics',
            },
          }),
        );
  const fallbacks = payloadEvents
    .map(typeNameFor)
    .filter((name) => !declaresType(types, name))
    .map((name) => `    public class ${name}\n    {\n    }`);
  return [types, ...fallbacks].filter(Boolean).join('\n\n');
}
