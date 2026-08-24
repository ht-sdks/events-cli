import type { NormalizedEvent } from '../../normalize/types';
import { typeNameFor } from './names';

/**
 * Quicktype's Ruby target emits dry-struct and snake_case attributes.
 * Emit keyword Structs with the original JSON keys instead.
 */
export function renderTypes(events: NormalizedEvent[]): string {
  return events
    .map((event) => {
      const name = typeNameFor(event);
      const properties =
        event.schema.properties !== undefined &&
        typeof event.schema.properties === 'object' &&
        event.schema.properties !== null
          ? Object.keys(event.schema.properties)
          : [];
      if (properties.length === 0) {
        return `class ${name}; end`;
      }
      const fields = properties.map((key) => `:${key}`).join(', ');
      return `${name} = Struct.new(${fields}, keyword_init: true)`;
    })
    .join('\n\n');
}
