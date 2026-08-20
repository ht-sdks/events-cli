import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  quicktype,
} from 'quicktype-core';
import { normalize } from '../src/normalize';
import { parseDomain } from '../src/input/parse';
import type { ContractBundle } from '../src/input/types';
import type { NormalizedEvent } from '../src/normalize/types';
import { CliError } from '../src/lib/errors';

const fixtures = join(__dirname, 'fixtures', 'domains');

function bundleFromDomain(file: string): ContractBundle {
  return {
    source: 'wk',
    domains: [
      parseDomain(JSON.parse(readFileSync(join(fixtures, file), 'utf-8'))),
    ],
  };
}

async function smokeQuicktypeEvent(event: NormalizedEvent): Promise<string> {
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: event.wrapperName,
    ...event.schema,
  };

  const inputData = new InputData();
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
  await schemaInput.addSource({
    name: event.wrapperName,
    schema: JSON.stringify(schema),
  });
  inputData.addInput(schemaInput);

  const { lines } = await quicktype({
    inputData,
    lang: 'typescript',
    rendererOptions: {
      'just-types': 'true',
      'nice-property-names': 'false',
    },
  });

  return lines.join('\n');
}

describe('quicktype smoke', () => {
  it('ingests simple, multi-version, and ref-flattened schemas', async () => {
    for (const file of [
      'simple-track.json',
      'multi-version.json',
      'with-refs.json',
    ]) {
      const events = normalize(bundleFromDomain(file));
      for (const event of events) {
        await expect(smokeQuicktypeEvent(event)).resolves.toEqual(
          expect.any(String),
        );
      }
    }
  });

  it('emits TypeScript interfaces for a track event', async () => {
    const events = normalize(bundleFromDomain('simple-track.json'));
    const ts = await smokeQuicktypeEvent(events[0]);
    expect(ts).toMatch(/orderId/);
    expect(ts).toMatch(/interface/i);
  });

  it('fails normalize loudly on cycles before smoke', () => {
    const domain = parseDomain(
      JSON.parse(readFileSync(join(fixtures, 'with-refs.json'), 'utf-8')),
    );
    domain.components = [
      {
        name: 'A',
        slug: 'a',
        schema: { allOf: [{ $ref: '#/definitions/components/b' }] },
      },
      {
        name: 'B',
        slug: 'b',
        schema: { allOf: [{ $ref: '#/definitions/components/a' }] },
      },
    ];
    domain.events = [
      {
        type: 'track',
        name: 'Cyclic',
        version: 'default',
        schema: {
          type: 'object',
          properties: {
            properties: {
              type: 'object',
              allOf: [{ $ref: '#/definitions/components/a' }],
            },
          },
        },
      },
    ];

    expect(() => normalize({ source: 'wk', domains: [domain] })).toThrow(
      CliError,
    );
    expect(() => normalize({ source: 'wk', domains: [domain] })).toThrow(
      /cycle/i,
    );
  });
});
