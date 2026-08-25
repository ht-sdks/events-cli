import { renderPhp, MIN_SDK_PACKAGE, MIN_SDK_VERSION } from '../src/render/php';
import { flattenRender } from '../src/render/shared/output';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderPhp', () => {
  defineRendererContractTests({
    render: renderPhp,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `function ${wrapperName}(`,
  });

  it('emits a Client import and camelCase wrappers', async () => {
    const src = flattenRender(
      await renderPhp(eventsFromFixture('simple-track.json')),
    );
    expect(src).toContain('use Hightouch\\Client;');
    expect(src).toContain('namespace Hightouch\\Generated;');
    expect(src).toContain('class TrackOrderCompletedDefault');
    expect(src).toContain('public $orderId;');
    expect(src).toContain('function trackOrderCompletedDefault(');
    expect(src).toContain('$client->track(');
    expect(src).toContain('=== HtEvents.php ===');
    expect(src).toContain('=== TrackOrderCompletedDefault.php ===');
  });

  it('emits alias wrappers with userId and previousId, not a payload type', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const files = await renderPhp([event]);
    const src = flattenRender(files);
    expect(src).toContain('function aliasDefault(');
    expect(src).toContain('string $previousId');
    expect(src).toContain('$client->alias(');
    expect(src).not.toMatch(/function aliasDefault\([^)]*\$properties/);
    expect(files.every((file) => file.path !== 'AliasDefault.php')).toBe(true);
  });

  it('annotates hyphenated keys so toMap can restore them', async () => {
    const src = flattenRender(
      await renderPhp([
        {
          type: 'track',
          name: 'Json Key Probe',
          version: 'default',
          domainName: 'Keys',
          envelopeKey: 'properties',
          schema: {
            type: 'object',
            properties: {
              'order-id': { type: 'string' },
              order_id: { type: 'string' },
              OrderId: { type: 'string' },
              orderId: { type: 'string' },
            },
          },
          wrapperName: 'trackJsonKeyProbeDefault',
        },
      ]),
    );
    expect(src).toContain('@JsonName("order-id")');
    expect(src).toMatch(/@JsonName\("order-id"\)[\s\S]*public \$/);
  });

  it('fails when generated method names collide', async () => {
    const events: NormalizedEvent[] = [
      {
        type: 'track',
        name: 'Foo',
        version: 'v1',
        domainName: 'A',
        envelopeKey: 'properties',
        schema: { type: 'object' },
        wrapperName: 'trackFoo',
        latestAlias: 'trackFoo',
      },
    ];
    await expect(renderPhp(events)).rejects.toThrow(
      /Identifier collision: "trackFoo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
