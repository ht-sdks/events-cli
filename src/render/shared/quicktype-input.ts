import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  quicktype,
  type LanguageName,
  type RendererOptions,
} from 'quicktype-core';
import type { NormalizedEvent } from '../../normalize/types';

async function buildQuicktypeInput(
  events: readonly NormalizedEvent[],
  typeNameFor: (event: NormalizedEvent) => string,
): Promise<InputData> {
  const inputData = new InputData();
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());

  for (const event of events) {
    const typeName = typeNameFor(event);
    const schema = {
      ...event.schema,
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: typeName,
    };
    await schemaInput.addSource({
      name: typeName,
      schema: JSON.stringify(schema),
    });
  }

  inputData.addInput(schemaInput);
  return inputData;
}

export type RunQuicktypeOptions<Lang extends LanguageName> = {
  typeNameFor: (event: NormalizedEvent) => string;
  lang: Lang;
  rendererOptions: Partial<RendererOptions<Lang>>;
  postprocess?: (source: string) => string;
};

/**
 * Build JSON Schema input and run quicktype. Callers pass `lang` as the real
 * language name. Filter events (e.g. Swift alias) and empty-payload fallbacks
 * stay at the call site.
 */
export async function runQuicktype<Lang extends LanguageName>(
  events: readonly NormalizedEvent[],
  opts: RunQuicktypeOptions<Lang>,
): Promise<string> {
  if (events.length === 0) {
    return '';
  }
  const inputData = await buildQuicktypeInput(events, opts.typeNameFor);
  const { lines } = await quicktype({
    inputData,
    lang: opts.lang,
    rendererOptions: opts.rendererOptions,
  });
  const source = lines.join('\n').trimEnd();
  return opts.postprocess === undefined ? source : opts.postprocess(source);
}
