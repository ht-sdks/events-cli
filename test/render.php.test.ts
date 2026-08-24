import { renderPhp, MIN_SDK_PACKAGE, MIN_SDK_VERSION } from '../src/render/php';
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
    const src = await renderPhp(eventsFromFixture('simple-track.json'));
    expect(src).toContain('use Hightouch\\Client;');
    expect(src).toContain('class TrackOrderCompletedDefault');
    expect(src).toContain('public $orderId;');
    expect(src).toContain('function trackOrderCompletedDefault(');
    expect(src).toContain('$client->track(');
  });

  it('emits alias wrappers with userId and previousId', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const src = await renderPhp([event]);
    expect(src).toContain('function aliasDefault(');
    expect(src).toContain('string $previousId');
    expect(src).toContain('$client->alias(');
  });
});
