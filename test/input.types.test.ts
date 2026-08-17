import { readFileSync } from 'fs';
import { join } from 'path';
import { parseContractBundle, parseDomain } from '../src/input/parse';
import { CliError } from '../src/lib/errors';
import { COMPONENT_REF_PREFIX } from '../src/input/types';

const fixtures = join(__dirname, 'fixtures', 'domains');

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(fixtures, name), 'utf8'));
}

describe('parseDomain', () => {
  it('parses a simple track domain', () => {
    const domain = parseDomain(readJson('simple-track.json'));
    expect(domain.slug).toBe('commerce');
    expect(domain.events?.[0]?.name).toBe('Order Completed');
    expect(domain.schemaVersionPath).toEqual([
      'context',
      'protocols',
      'schemaVersion',
    ]);
  });

  it('parses domains with component $refs intact', () => {
    const domain = parseDomain(readJson('with-refs.json'));
    expect(domain.components).toHaveLength(2);
    const cart = domain.components?.find((c) => c.slug === 'cart');
    expect(cart?.imports).toEqual(['money']);
    const eventSchema = JSON.stringify(domain.events?.[0]?.schema);
    expect(eventSchema).toContain(`${COMPONENT_REF_PREFIX}cart`);
  });

  it('parses multi-version events', () => {
    const domain = parseDomain(readJson('multi-version.json'));
    const versions = domain.events?.map((e) => e.version);
    expect(versions).toEqual(['v1', 'v2']);
  });

  it('rejects invalid domains', () => {
    expect(() => parseDomain(readJson('invalid-missing-name.json'))).toThrow(
      CliError,
    );
  });

  it.each(['identify', 'page', 'screen', 'group'] as const)(
    'allows a null name on %s events',
    (type) => {
      const domain = parseDomain({
        name: 'My domain',
        events: [
          {
            type,
            name: null,
            schema: { type: 'object' },
          },
        ],
      });
      expect(domain.events).toHaveLength(1);
      expect(domain.events?.[0]?.type).toBe(type);
      expect(domain.events?.[0]?.name).toBeUndefined();
    },
  );
});

describe('parseContractBundle', () => {
  it('parses a bundle fixture', () => {
    const bundle = parseContractBundle(readJson('bundle.json'));
    expect(bundle.writeKey).toBe('web-app');
    expect(bundle.domains.length).toBeGreaterThan(0);
  });
});
