import {
  renderReactNative,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/react-native';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderReactNative', () => {
  defineRendererContractTests({
    render: renderReactNative,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => wrapperName,
  });

  it('imports HightouchClient types from the peer SDK', async () => {
    const ts = await renderReactNative(eventsFromFixture('simple-track.json'));
    expect(ts).toContain(
      "import type { EnrichmentClosure, GroupTraits, HightouchClient, HightouchEvent, JsonMap, UserTraits } from '@ht-sdks/events-sdk-react-native'",
    );
    expect(ts).toContain(
      'export function setHtEvents(instance: HightouchClient)',
    );
  });

  it('emits PascalCase interfaces named after wrapper names', async () => {
    const ts = await renderReactNative(eventsFromFixture('simple-track.json'));
    expect(ts).toMatch(/export interface TrackOrderCompletedDefault/);
    expect(ts).toMatch(/orderId/);
  });

  it('keeps acronyms in payload type names as pascal case instead of rewriting to all caps', async () => {
    const event: NormalizedEvent = {
      type: 'track',
      name: 'Json Key Probe',
      version: 'default',
      domainName: 'Probe',
      envelopeKey: 'properties',
      schema: {
        type: 'object',
        properties: { foo: { type: 'string' } },
      },
      wrapperName: 'trackJsonKeyProbeDefault',
    };
    const ts = await renderReactNative([event]);
    expect(ts).toMatch(/export interface TrackJsonKeyProbeDefault/);
    expect(ts).toContain('properties: TrackJsonKeyProbeDefault');
    expect(ts).not.toMatch(
      /export type TrackJsonKeyProbeDefault = Record<string, unknown>/,
    );
    expect(ts).not.toMatch(/TrackJSONKeyProbeDefault/);
  });

  it('emits positional SDK calls with optional caller context', async () => {
    const ts = await renderReactNative(eventsFromFixture('simple-track.json'));
    expect(ts).toMatch(
      /export function trackOrderCompletedDefault\(\n {2}properties: TrackOrderCompletedDefault,\n {2}context\?: JsonMap,/,
    );
    expect(ts).toContain('htevents.track(');
    expect(ts).toContain('"Order Completed"');
    expect(ts).toContain('contextEnrichment(injected.context)');
  });

  it('emits alias wrappers with newUserId, not a properties payload or type', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const ts = await renderReactNative([event]);
    expect(ts).toMatch(
      /export function aliasDefault\(\n {2}newUserId: string,\n {2}context\?: JsonMap,/,
    );
    expect(ts).toContain('htevents.alias(');
    expect(ts).not.toMatch(/export interface AliasDefault/);
    expect(ts).not.toMatch(/aliasDefault\(\n {2}properties:/);
  });

  it('emits group wrappers with groupId and traits, not userId', async () => {
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
    const ts = await renderReactNative([event]);
    expect(ts).toMatch(
      /export function groupDefault\(\n {2}groupId: string,\n {2}traits: GroupDefault,/,
    );
    expect(ts).toContain('htevents.group(');
    expect(ts).not.toMatch(/groupDefault\(\n {2}groupId: string,\n {2}userId:/);
  });

  it('emits identify overloads for traits-only and userId + traits', async () => {
    const ts = await renderReactNative(eventsFromFixture('with-refs.json'));
    expect(ts).toContain('htevents.identify(');
    expect(ts).toMatch(
      /export function identifyDefault\(\n {2}traits: IdentifyDefault,\n {2}context\?: JsonMap,\n\): Promise<void>;/,
    );
    expect(ts).toMatch(
      /export function identifyDefault\(\n {2}userId: string,\n {2}traits: IdentifyDefault,\n {2}context\?: JsonMap,\n\): Promise<void>;/,
    );
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
    const ts = await renderReactNative([event]);
    expect(ts).toContain('htevents.screen(');
    expect(ts).toContain('"Home"');
    expect(ts).not.toContain('htevents.page(');
  });

  it('emits an unnamed empty screen as screenDefault named "screen"', async () => {
    const event: NormalizedEvent = {
      type: 'screen',
      version: 'default',
      domainName: 'Mobile',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'screenDefault',
      latestAlias: 'screen',
    };
    const ts = await renderReactNative([event]);
    expect(ts).toContain('htevents.screen(');
    expect(ts).toContain('"screen"');
    expect(ts).toContain(
      'export const screen: typeof screenDefault = screenDefault;',
    );
  });

  it('emits a latest-version alias with the versioned signature', async () => {
    const ts = await renderReactNative(eventsFromFixture('multi-version.json'));
    expect(ts).toContain(
      'export const trackOrderCompleted: typeof trackOrderCompletedV2 = trackOrderCompletedV2;',
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
    await expect(renderReactNative(events)).rejects.toThrow(
      /Identifier collision: "trackFoo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
