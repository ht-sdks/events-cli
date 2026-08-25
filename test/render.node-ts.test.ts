import {
  renderNodeTs,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/node-ts';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderNodeTs', () => {
  defineRendererContractTests({
    render: renderNodeTs,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => wrapperName,
  });

  it('emits PascalCase interfaces named after wrapper names', async () => {
    const ts = await renderNodeTs(eventsFromFixture('simple-track.json'));
    expect(ts).toMatch(/export interface TrackOrderCompletedDefault/);
    expect(ts).toMatch(/orderId/);
  });

  it('emits params-object SDK calls with an optional userId', async () => {
    const ts = await renderNodeTs(eventsFromFixture('simple-track.json'));
    expect(ts).toContain(
      "import type { HtEvents, TrackParams } from '@ht-sdks/events-sdk-js-node'",
    );
    expect(ts).toMatch(
      /export function trackOrderCompletedDefault\(\n {2}userId: string \| undefined,/,
    );
    expect(ts).toContain('htevents.track({');
    expect(ts).toContain('event: "Order Completed"');
  });

  it('emits alias wrappers with userId and previousId, not a properties payload', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const ts = await renderNodeTs([event]);
    expect(ts).toMatch(/export function aliasDefault\(\n {2}userId: string,/);
    expect(ts).toContain('htevents.alias({');
    expect(ts).toContain('previousId,');
    expect(ts).not.toMatch(/aliasDefault\(\n {2}properties:/);
  });

  it('emits group wrappers with groupId and userId', async () => {
    const event: NormalizedEvent = {
      type: 'group',
      version: 'default',
      domainName: 'Accounts',
      envelopeKey: 'traits',
      schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
      wrapperName: 'groupDefault',
    };
    const ts = await renderNodeTs([event]);
    expect(ts).toMatch(
      /export function groupDefault\(\n {2}groupId: string,\n {2}userId: string \| undefined,/,
    );
    expect(ts).toContain('htevents.group({');
  });
});
