import { readFileSync } from 'fs';
import { join } from 'path';
import { normalize } from '../src/normalize';
import { parseDomain } from '../src/input/parse';
import type { ContractBundle } from '../src/input/types';

const fixtures = join(__dirname, 'fixtures', 'domains');

function domainFixture(name: string) {
  return parseDomain(JSON.parse(readFileSync(join(fixtures, name), 'utf-8')));
}

describe('normalize', () => {
  it('unwraps a simple track event and assigns wrapper + latest alias', () => {
    const bundle: ContractBundle = {
      writeKey: 'wk',
      domains: [domainFixture('simple-track.json')],
    };
    const events = normalize(bundle);
    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event.wrapperName).toBe('trackOrderCompletedDefault');
    expect(event.latestAlias).toBe('trackOrderCompleted');
    expect(event.envelopeKey).toBe('properties');
    expect(event.schemaVersionPath).toEqual([
      'context',
      'protocols',
      'schemaVersion',
    ]);
    expect(event.schema).toMatchObject({
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        total: { type: 'number' },
      },
    });
  });

  it('emits all versions with default-preferring latest alias', () => {
    const bundle: ContractBundle = {
      writeKey: 'wk',
      domains: [domainFixture('multi-version.json')],
    };
    const events = normalize(bundle);
    expect(events.map((e) => e.wrapperName)).toEqual([
      'trackOrderCompletedV1',
      'trackOrderCompletedV2',
    ]);
    expect(events[0].latestAlias).toBeUndefined();
    expect(events[1].latestAlias).toBe('trackOrderCompleted');
  });

  it('flattens component refs then unwraps', () => {
    const bundle: ContractBundle = {
      writeKey: 'wk',
      domains: [domainFixture('with-refs.json')],
    };
    const events = normalize(bundle);
    const track = events.find((e) => e.type === 'track');
    const identify = events.find((e) => e.type === 'identify');
    expect(track?.wrapperName).toBe('trackCartViewedDefault');
    expect(track?.schema).toMatchObject({
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string' },
        itemCount: { type: 'number' },
      },
    });
    expect(identify?.wrapperName).toBe('identifyDefault');
    expect(identify?.latestAlias).toBe('identify');
    expect(identify?.schema).toMatchObject({
      properties: { email: { type: 'string' } },
    });
  });
});
