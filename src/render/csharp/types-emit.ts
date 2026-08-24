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

/** Quicktype C# remaps JSON keys; emit public-field classes that keep them. */
export function renderTypes(events: NormalizedEvent[]): string {
  return events
    .map((event) => {
      const name = typeNameFor(event);
      const keys = propertyKeys(event);
      if (keys.length === 0) {
        return `    public class ${name}\n    {\n    }`;
      }
      const fields = keys
        .map((key) => `        public object ${key};`)
        .join('\n');
      return `    public class ${name}\n    {\n${fields}\n    }`;
    })
    .join('\n\n');
}
