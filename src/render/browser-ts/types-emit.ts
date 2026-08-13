import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  quicktype,
} from 'quicktype-core';
import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';

export function typeNameFor(event: NormalizedEvent): string {
  return toPascalCase(event.wrapperName);
}

export async function renderTypes(events: NormalizedEvent[]): Promise<string> {
  if (events.length === 0) return '';

  const inputData = new InputData();
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());

  for (const event of events) {
    const typeName = typeNameFor(event);
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: typeName,
      ...event.schema,
    };
    await schemaInput.addSource({
      name: typeName,
      schema: JSON.stringify(schema),
    });
  }

  inputData.addInput(schemaInput);

  const { lines } = await quicktype({
    inputData,
    lang: 'typescript',
    rendererOptions: {
      'just-types': 'true',
      'nice-property-names': 'false',
    },
  });

  return lines.join('\n').trimEnd();
}
