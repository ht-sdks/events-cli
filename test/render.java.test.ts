import {
  renderJava,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/java';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderJava', () => {
  defineRendererContractTests({
    render: renderJava,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `public void ${wrapperName}(`,
  });

  it('emits package analytics and class HtEvents by default', async () => {
    const src = await renderJava(eventsFromFixture('simple-track.json'));
    expect(src).toContain('package analytics;');
    expect(src).toContain('public final class HtEvents');
    expect(src).toContain('analytics.enqueue(');
  });

  it('derives package and class from a custom output path', async () => {
    const src = await renderJava(
      eventsFromFixture('simple-track.json'),
      './src/main/java/com/example/events/Generated.java',
    );
    expect(src).toContain('package com.example.events;');
    expect(src).toContain('public final class Generated');
    expect(src).toContain('public Generated(Analytics analytics)');
    expect(src).toContain(
      'if (value.getClass().getEnclosingClass() == Generated.class)',
    );
    expect(src).not.toContain('package analytics;');
    expect(src).not.toContain('class HtEvents');
  });

  it('emits camelCase methods and PascalCase payload types', async () => {
    const src = await renderJava(eventsFromFixture('simple-track.json'));
    expect(src).toMatch(/public static final class TrackOrderCompletedDefault/);
    expect(src).toMatch(
      /public void trackOrderCompletedDefault\(String userId, TrackOrderCompletedDefault properties/,
    );
    expect(src).toContain('TrackMessage.builder(');
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
    const src = await renderJava([event]);
    expect(src).toMatch(/public static final class TrackOrderCompletedV1/);
    expect(src).not.toMatch(/class WrongTitle/);
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
    const src = await renderJava([event]);
    expect(src).toContain(
      'public void aliasDefault(String userId, String previousId, Map<String, ?> context)',
    );
    expect(src).toContain('AliasMessage.builder(previousId).userId(userId)');
    expect(src).not.toMatch(/aliasDefault\(.*properties/);
  });

  it('keeps page as PageMessage', async () => {
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
    const src = await renderJava([event]);
    expect(src).toContain('PageMessage.builder("Home")');
    expect(src).not.toContain('ScreenMessage.builder("Home")');
  });

  it('emits a latest-version alias method', async () => {
    const src = await renderJava(eventsFromFixture('multi-version.json'));
    expect(src).toContain(
      'public void trackOrderCompleted(String userId, TrackOrderCompletedV2 properties, Map<String, ?> context)',
    );
    expect(src).toContain(
      'trackOrderCompletedV2(userId, properties, context);',
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
    await expect(renderJava(events)).rejects.toThrow(
      /Identifier collision: "trackFoo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
