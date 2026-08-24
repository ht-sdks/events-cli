import {
  renderAndroid,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/android';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderAndroid', () => {
  defineRendererContractTests({
    render: renderAndroid,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `public void ${wrapperName}(`,
  });

  it('emits package analytics and class HtEvents by default', async () => {
    const src = await renderAndroid(eventsFromFixture('simple-track.json'));
    expect(src).toContain('package analytics;');
    expect(src).toContain('import com.hightouch.analytics.Analytics;');
    expect(src).toContain('public final class HtEvents');
    expect(src).toContain('analytics.track(');
  });

  it('derives package and class from a custom output path', async () => {
    const src = await renderAndroid(
      eventsFromFixture('simple-track.json'),
      './src/main/java/com/example/events/Generated.java',
    );
    expect(src).toContain('package com.example.events;');
    expect(src).toContain('public final class Generated');
    expect(src).not.toContain('package analytics;');
  });

  it('emits camelCase methods and PascalCase payload types', async () => {
    const src = await renderAndroid(eventsFromFixture('simple-track.json'));
    expect(src).toMatch(/public static final class TrackOrderCompletedDefault/);
    expect(src).toMatch(
      /public void trackOrderCompletedDefault\(TrackOrderCompletedDefault properties, Options options\)/,
    );
    expect(src).toContain('analytics.track(');
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
    const src = await renderAndroid([event]);
    expect(src).toMatch(/public static final class TrackOrderCompletedV1/);
    expect(src).not.toMatch(/class WrongTitle/);
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
    const src = await renderAndroid([event]);
    expect(src).toContain(
      'public void aliasDefault(String newId, Options options)',
    );
    expect(src).toContain('analytics.alias(newId, injected.options);');
    expect(src).not.toMatch(/void aliasDefault\([^)]*properties/);
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
    const src = await renderAndroid([event]);
    expect(src).toContain('analytics.screen(null, "Home"');
    expect(src).not.toMatch(/analytics\.page\(/);
    expect(src).not.toContain('analytics.track("Home"');
  });

  it('emits a latest-version alias function', async () => {
    const src = await renderAndroid(eventsFromFixture('multi-version.json'));
    expect(src).toContain(
      'public void trackOrderCompleted(TrackOrderCompletedV2 properties, Options options)',
    );
    expect(src).toContain('trackOrderCompletedV2(properties, options);');
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
    await expect(renderAndroid(events)).rejects.toThrow(
      /Identifier collision: "trackFoo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
