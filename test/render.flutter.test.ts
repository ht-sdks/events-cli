import {
  renderFlutter,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/flutter';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import { jsonKeyProbeHarnessEvents } from './harness/extra-events';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderFlutter', () => {
  defineRendererContractTests({
    render: renderFlutter,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `Future<void> ${wrapperName}(`,
  });

  it('imports the peer SDK analytics and event types', async () => {
    const src = await renderFlutter(eventsFromFixture('simple-track.json'));
    expect(src).toContain("import 'package:hightouch_events/analytics.dart';");
    expect(src).toContain("import 'package:hightouch_events/event.dart';");
    expect(src).toContain('class HtEvents');
    expect(src).toContain('HtEvents(this._analytics);');
  });

  it('emits camelCase methods and PascalCase payload types with toMap', async () => {
    const src = await renderFlutter(eventsFromFixture('simple-track.json'));
    expect(src).toMatch(/class TrackOrderCompletedDefault/);
    expect(src).toMatch(
      /Future<void> trackOrderCompletedDefault\(TrackOrderCompletedDefault properties/,
    );
    expect(src).toContain('_analytics.track(');
    expect(src).toContain('toMap()');
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
    const src = await renderFlutter([event]);
    expect(src).toMatch(/class TrackJsonKeyProbeDefault/);
    expect(src).toContain(
      'Future<void> trackJsonKeyProbeDefault(TrackJsonKeyProbeDefault properties',
    );
    expect(src).not.toMatch(/TrackJSONKeyProbeDefault/);
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
    const src = await renderFlutter([event]);
    expect(src).toContain(
      'Future<void> aliasDefault(String newUserId, {Map<String, dynamic>? context})',
    );
    expect(src).toContain('_analytics.alias(');
    expect(src).not.toMatch(/class AliasDefault/);
    expect(src).not.toMatch(/aliasDefault\(.*properties/);
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
    const src = await renderFlutter([event]);
    expect(src).toContain(
      'Future<void> groupDefault(String groupId, {required GroupDefault traits, Map<String, dynamic>? context})',
    );
    expect(src).toContain('_analytics.group(');
    expect(src).toContain('GroupTraits.fromJson');
  });

  it('emits identify wrappers with optional userId and required traits', async () => {
    const src = await renderFlutter(eventsFromFixture('with-refs.json'));
    expect(src).toContain(
      'Future<void> identifyDefault({String? userId, required IdentifyDefault traits, Map<String, dynamic>? context})',
    );
    expect(src).toContain('UserTraits.fromJson');
    expect(src).toContain('_analytics.identify(');
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
    const src = await renderFlutter([event]);
    expect(src).toContain('_analytics.screen(');
    expect(src).toContain('"Home"');
    expect(src).not.toContain('_analytics.page(');
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
    const src = await renderFlutter([event]);
    expect(src).toContain('class ScreenDefault');
    expect(src).toContain(
      'Future<void> screenDefault(ScreenDefault properties, {Map<String, dynamic>? context})',
    );
    expect(src).toContain('_analytics.screen(');
    expect(src).toContain('"screen"');
  });

  it('emits a latest-version alias function', async () => {
    const src = await renderFlutter(eventsFromFixture('multi-version.json'));
    expect(src).toContain(
      'Future<void> trackOrderCompleted(TrackOrderCompletedV2 properties, {Map<String, dynamic>? context})',
    );
    expect(src).toContain(
      'return trackOrderCompletedV2(properties, context: context);',
    );
  });

  it('keeps original JSON keys in toMap for hyphenated and mixed spellings', async () => {
    const src = await renderFlutter(jsonKeyProbeHarnessEvents());
    expect(src).toContain('"order-id":');
    expect(src).toContain('"order_id":');
    expect(src).toContain('"OrderId":');
    expect(src).toContain('"orderId":');
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
    await expect(renderFlutter(events)).rejects.toThrow(
      /Identifier collision: "trackFoo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
