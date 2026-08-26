import type { NormalizedEvent } from '../../normalize/types';
import { schemaProperties } from '../shared/json-fields';
import { typeNameFor } from './names';

function rbString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Bare `:orderId` when legal; `:'order-id'` otherwise. */
export function rbSymbol(key: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return `:${key}`;
  }
  return `:${rbString(key)}`;
}

export function renderTypes(events: NormalizedEvent[]): string {
  return events
    .filter((event) => event.type !== 'alias')
    .map((event) => {
      const name = typeNameFor(event);
      const properties = Object.keys(schemaProperties(event.schema) ?? {});
      if (properties.length === 0) {
        return `class ${name}; end`;
      }
      const fields = properties.map(rbSymbol).join(', ');
      return `${name} = Struct.new(${fields}, keyword_init: true)`;
    })
    .join('\n\n');
}
