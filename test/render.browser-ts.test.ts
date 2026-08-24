import {
  renderBrowserTs,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/browser-ts';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderBrowserTs', () => {
  defineRendererContractTests({
    render: renderBrowserTs,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => wrapperName,
  });

  it('emits PascalCase interfaces named after wrapper names', async () => {
    const ts = await renderBrowserTs(eventsFromFixture('simple-track.json'));
    expect(ts).toMatch(/export interface TrackOrderCompletedDefault/);
    expect(ts).toMatch(/orderId/);
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
    const ts = await renderBrowserTs([event]);
    expect(ts).toMatch(/export interface TrackOrderCompletedV1/);
    expect(ts).not.toMatch(/export interface WrongTitle/);
  });

  it('emits alias wrappers with to/from ids, not a properties payload', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const ts = await renderBrowserTs([event]);
    expect(ts).toMatch(/export function aliasDefault\(\n {2}to: string,/);
    expect(ts).toContain('return htevents.alias(to, from, injected.options);');
    expect(ts).not.toMatch(/aliasDefault\(\n {2}properties:/);
  });
});
