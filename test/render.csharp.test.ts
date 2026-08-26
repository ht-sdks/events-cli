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
    expect(src).toContain('public partial class TrackOrderCompletedDefault');
    expect(src).toContain('public string orderId { get; set; }');
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

  it('annotates hyphenated keys so ToMap can restore them', async () => {
    const src = await renderCSharp([
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
    ]);
    expect(src).toContain('[JsonPropertyName("order-id")]');
    expect(src).toContain('public string? orderid { get; set; }');
    expect(src).toContain('public string? order_id { get; set; }');
    expect(src).toContain('public string? OrderId { get; set; }');
    expect(src).toContain('public string? orderId { get; set; }');
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
    await expect(renderCSharp(events)).rejects.toThrow(
      /Identifier collision: "TrackFoo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });

  it('emits an unnamed empty screen as ScreenDefault without a nested using', async () => {
    const event: NormalizedEvent = {
      type: 'screen',
      version: 'default',
      domainName: 'Mobile',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'screenDefault',
      latestAlias: 'screen',
    };
    const src = await renderCSharp([event]);
    expect(src).toContain('public class ScreenDefault');
    expect(src).not.toMatch(/namespace Analytics[\s\S]*using /);
    expect(src).toContain('_analytics.Screen("screen", ToJsonObject(data));');
  });
});
