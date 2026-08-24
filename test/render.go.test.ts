import { renderGo, MIN_SDK_PACKAGE, MIN_SDK_VERSION } from '../src/render/go';
import { exportedName } from '../src/render/go/names';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderGo', () => {
  defineRendererContractTests({
    render: renderGo,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `func ${exportedName(wrapperName)}(`,
  });

  it('emits package analytics and the peer SDK import', async () => {
    const src = await renderGo(eventsFromFixture('simple-track.json'));
    expect(src).toContain('package analytics');
    expect(src).toContain(`htevents "${MIN_SDK_PACKAGE}"`);
  });

  it('emits PascalCase wrappers and Payload types named after wrapper names', async () => {
    const src = await renderGo(eventsFromFixture('simple-track.json'));
    expect(src).toMatch(/type TrackOrderCompletedDefaultPayload struct/);
    expect(src).toMatch(
      /func TrackOrderCompletedDefault\(client htevents\.Client/,
    );
    expect(src).toContain('json:"orderId');
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
    const src = await renderGo([event]);
    expect(src).toMatch(/type TrackOrderCompletedV1Payload struct/);
    expect(src).not.toMatch(/type WrongTitle struct/);
  });

  it('emits alias wrappers with userID and previousID, not a properties payload', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const src = await renderGo([event]);
    expect(src).toContain(
      'func AliasDefault(client htevents.Client, userID string, previousID string, opts ...CallOptions) error {',
    );
    expect(src).toContain('return client.Enqueue(htevents.Alias{');
    expect(src).not.toMatch(
      /func AliasDefault\(client htevents\.Client, userID string, props /,
    );
  });

  it('emits a latest-version alias function', async () => {
    const src = await renderGo(eventsFromFixture('multi-version.json'));
    expect(src).toContain(
      'func TrackOrderCompleted(client htevents.Client, userID string, props TrackOrderCompletedV2Payload, opts ...CallOptions) error {',
    );
    expect(src).toContain(
      'return TrackOrderCompletedV2(client, userID, props, opts...)',
    );
  });

  it('fails when exported Go identifiers collide', async () => {
    const events: NormalizedEvent[] = [
      {
        type: 'track',
        name: 'Foo',
        version: 'v1',
        domainName: 'A',
        envelopeKey: 'properties',
        schema: { type: 'object' },
        wrapperName: 'trackFoo',
        latestAlias: 'TrackFoo',
      },
    ];
    await expect(renderGo(events)).rejects.toThrow(
      /Identifier collision: "TrackFoo" is produced by both method trackFoo and latest alias TrackFoo/,
    );
  });
});
