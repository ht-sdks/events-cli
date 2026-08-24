import {
  renderSwift,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/swift';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderSwift', () => {
  defineRendererContractTests({
    render: renderSwift,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `func ${wrapperName}(`,
  });

  it('imports Foundation and the peer SDK', async () => {
    const src = await renderSwift(eventsFromFixture('simple-track.json'));
    expect(src).toContain('import Foundation');
    expect(src).toContain('import Hightouch');
  });

  it('emits camelCase methods and PascalCase Codable types', async () => {
    const src = await renderSwift(eventsFromFixture('simple-track.json'));
    expect(src).toMatch(/struct TrackOrderCompletedDefault/);
    expect(src).toMatch(/func trackOrderCompletedDefault\(/);
    expect(src).toContain('self.track(name:');
  });

  it('pins quicktype title to the wrapper type name', async () => {
    const event: NormalizedEvent = {
      type: 'track',
      name: 'Order Completed',
      version: 'v1',
      domainName: 'Orders',
      envelopeKey: 'properties',
      schema: {
        type: 'object',
        title: 'WrongTitle',
        properties: { orderId: { type: 'string' } },
      },
      wrapperName: 'trackOrderCompletedV1',
    };
    const src = await renderSwift([event]);
    expect(src).toMatch(/struct TrackOrderCompletedV1/);
    expect(src).not.toMatch(/struct WrongTitle/);
  });

  it('emits alias wrappers with newId, not a properties payload', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const src = await renderSwift([event]);
    expect(src).toContain(
      'public func aliasDefault(newId: String, context: [String: Any]? = nil)',
    );
    expect(src).toContain('emitAlias(newId: newId, context: injected.context)');
    expect(src).not.toMatch(/func aliasDefault\(_ properties/);
  });

  it('maps page events to screen', async () => {
    const event: NormalizedEvent = {
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
    const src = await renderSwift([event]);
    expect(src).toContain('emitScreen(title: "Home"');
    expect(src).not.toContain('emitTrack(name: "Home"');
    expect(src).not.toMatch(/self\.page\(/);
  });

  it('emits a latest-version alias function', async () => {
    const src = await renderSwift(eventsFromFixture('multi-version.json'));
    expect(src).toContain(
      'public func trackOrderCompleted(_ properties: TrackOrderCompletedV2, context: [String: Any]? = nil)',
    );
    expect(src).toContain(
      'trackOrderCompletedV2(properties, context: context)',
    );
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
    await expect(renderSwift(events)).rejects.toThrow(
      /Identifier collision: "trackFoo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
