import type { NormalizedEvent } from '../../normalize/types';
import { typeNameFor } from './names';

function propertyKeys(event: NormalizedEvent): string[] {
  if (
    event.schema.properties === undefined ||
    typeof event.schema.properties !== 'object' ||
    event.schema.properties === null
  ) {
    return [];
  }
  return Object.keys(event.schema.properties);
}

/** Quicktype PHP is verbose and remaps JSON keys; emit public-property classes. */
export function renderTypes(events: NormalizedEvent[]): string {
  return events
    .map((event) => {
      const name = typeNameFor(event);
      const keys = propertyKeys(event);
      if (keys.length === 0) {
        return `class ${name}\n{\n}`;
      }
      const fields = keys
        .map((key) => `    /** @var mixed */\n    public $${key};`)
        .join('\n');
      return `class ${name}\n{\n${fields}\n}`;
    })
    .join('\n\n');
}
