import {
  renderCSharp,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/csharp';
import { methodName } from '../src/render/csharp/names';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderCSharp', () => {
  defineRendererContractTests({
    render: renderCSharp,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `void ${methodName(wrapperName)}(`,
  });

  it('emits Analytics wrappers and public-field types with JSON keys', async () => {
    const src = await renderCSharp(eventsFromFixture('simple-track.json'));
    expect(src).toContain(
      'using AnalyticsClient = Hightouch.Events.Analytics;',
    );
    expect(src).toContain('public class TrackOrderCompletedDefault');
    expect(src).toContain('public object orderId;');
    expect(src).toContain('void TrackOrderCompletedDefault(');
    expect(src).toContain('_analytics.Track(');
  });

  it('emits alias wrappers with newId only', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const src = await renderCSharp([event]);
    expect(src).toContain('void AliasDefault(string newId)');
    expect(src).toContain('_analytics.Alias(newId);');
    expect(src).not.toMatch(/void AliasDefault\(.*previousId/);
  });

  it('keeps page and screen as peer methods', async () => {
    const page: NormalizedEvent = {
      type: 'page',
      name: 'Home',
      version: 'default',
      domainName: 'Web',
      envelopeKey: 'properties',
      schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
      wrapperName: 'pageHomeDefault',
    };
    const screen: NormalizedEvent = {
      type: 'screen',
      name: 'Home',
      version: 'default',
      domainName: 'Mobile',
      envelopeKey: 'properties',
      schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
      wrapperName: 'screenHomeDefault',
    };
    const src = await renderCSharp([page, screen]);
    expect(src).toContain('_analytics.Page("Home"');
    expect(src).toContain('_analytics.Screen("Home"');
  });
});
