import { readFileSync } from 'fs';
import { join } from 'path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { configSchema } from '../src/config/schema';

it('committed JSON schema matches the zod schema', () => {
  const expected = `${JSON.stringify(
    zodToJsonSchema(configSchema, {
      name: 'HteventsConfig',
      $refStrategy: 'none',
    }),
    null,
    2,
  )}\n`;
  const actual = readFileSync(
    join(__dirname, '..', 'schemas', 'config.schema.json'),
    'utf-8',
  );
  expect(actual).toBe(expected);
});
