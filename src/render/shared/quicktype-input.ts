import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
} from 'quicktype-core';
import type { NormalizedEvent } from '../../normalize/types';

export async function buildQuicktypeInput(
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
