import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { configSchema } from '../src/config/schema';

const OUT = join(__dirname, '..', 'schemas', 'config.schema.json');

function buildSchemaJson(): string {
  const schema = zodToJsonSchema(configSchema, {
    name: 'HteventsConfig',
    $refStrategy: 'none',
  });
  return `${JSON.stringify(schema, null, 2)}\n`;
}

const checkOnly = process.argv.includes('--check');
const next = buildSchemaJson();

if (checkOnly) {
  if (!existsSync(OUT)) {
    console.error(`Missing ${OUT}. Run: pnpm run generate:schema`);
    process.exit(1);
  }
  const current = readFileSync(OUT, 'utf-8');
  if (current !== next) {
    console.error(
      'schemas/config.schema.json is stale. Run: pnpm run generate:schema',
    );
    process.exit(1);
  }
  console.error('schemas/config.schema.json is up to date.');
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, next);
console.error(`Wrote ${OUT}`);
