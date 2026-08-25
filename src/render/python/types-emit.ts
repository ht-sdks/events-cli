import { toPascalCase } from '../../normalize/names';
import type { NormalizedEvent } from '../../normalize/types';
import { assignFieldNames, schemaProperties } from '../shared/json-fields';
import { typeNameFor } from './names';

function pyPrimitive(schema: unknown): string | undefined {
  if (schema === null || typeof schema !== 'object') {
    return undefined;
  }
  const type = (schema as { type?: unknown }).type;
  if (type === 'string') {
    return 'str';
  }
  if (type === 'integer') {
    return 'int';
  }
  if (type === 'number') {
    return 'float';
  }
  if (type === 'boolean') {
    return 'bool';
  }
  return undefined;
}

function emitClass(name: string, schema: unknown, extras: string[]): string {
  const properties = schemaProperties(schema);
  if (properties === undefined || Object.keys(properties).length === 0) {
    return `@dataclass\nclass ${name}:\n    pass`;
  }
  const fields = assignFieldNames(Object.keys(properties), 'python');
  const lines = [`@dataclass`, `class ${name}:`];
  for (const [jsonKey, fieldName] of fields) {
    const propSchema = properties[jsonKey];
    const primitive = pyPrimitive(propSchema);
    let typeName = 'Any';
    if (primitive !== undefined) {
      typeName = primitive;
    } else if (
      propSchema !== null &&
      typeof propSchema === 'object' &&
      schemaProperties(propSchema) !== undefined
    ) {
      const nested = `${name}${toPascalCase(fieldName)}`;
      extras.push(emitClass(nested, propSchema, extras));
      typeName = nested;
    } else if (
      propSchema !== null &&
      typeof propSchema === 'object' &&
      (propSchema as { type?: unknown }).type === 'array'
    ) {
      typeName = 'List[Any]';
    }
    const meta =
      fieldName === jsonKey
        ? ''
        : `, metadata={"json": ${JSON.stringify(jsonKey)}}`;
    lines.push(
      `    ${fieldName}: Optional[${typeName}] = field(default=None${meta})`,
    );
  }
  return lines.join('\n');
}

export function renderTypes(events: NormalizedEvent[]): string {
  const payloadEvents = events.filter((event) => event.type !== 'alias');
  const classes: string[] = [];
  for (const event of payloadEvents) {
    const extras: string[] = [];
    const main = emitClass(typeNameFor(event), event.schema, extras);
    classes.push(...extras, main);
  }
  return classes.filter(Boolean).join('\n\n');
}
