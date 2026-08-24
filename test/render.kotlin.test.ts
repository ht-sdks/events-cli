import {
  renderKotlin,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/kotlin';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderKotlin', () => {
  defineRendererContractTests({
    render: renderKotlin,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `fun ${wrapperName}(`,
  });

  it('emits package analytics and class HtEvents by default', async () => {
    const src = await renderKotlin(eventsFromFixture('simple-track.json'));
    expect(src).toContain('package analytics');
    expect(src).toContain('class HtEvents');
    expect(src).toContain('analytics.track(');
  });

  it('derives package and class from a custom output path', async () => {
    const src = await renderKotlin(
      eventsFromFixture('simple-track.json'),
      './src/main/kotlin/com/example/events/Generated.kt',
    );
    expect(src).toContain('package com.example.events');
    expect(src).toContain('class Generated');
    expect(src).toContain(
      'if (value::class.java.enclosingClass == Generated::class.java)',
    );
    expect(src).not.toContain('package analytics\n');
    expect(src).not.toContain('class HtEvents');
  });

  it('emits camelCase methods and PascalCase payload types', async () => {
    const src = await renderKotlin(eventsFromFixture('simple-track.json'));
    expect(src).toMatch(/class TrackOrderCompletedDefault/);
    expect(src).toMatch(
      /fun trackOrderCompletedDefault\(properties: TrackOrderCompletedDefault/,
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
    const src = await renderKotlin([event]);
    expect(src).toMatch(/class TrackOrderCompletedV1/);
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
    const src = await renderKotlin([event]);
    expect(src).toContain(
      'fun aliasDefault(newId: String, context: Map<String, Any>? = null)',
    );
    expect(src).toContain(
      'analytics.alias(newId, contextEnrichment(injected.context))',
    );
    expect(src).not.toMatch(/fun aliasDefault\(.*properties/);
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
    const src = await renderKotlin([event]);
    expect(src).toContain('analytics.screen("Home"');
    expect(src).not.toContain('analytics.page(');
  });

  it('emits a latest-version alias function', async () => {
    const src = await renderKotlin(eventsFromFixture('multi-version.json'));
    expect(src).toContain(
      'fun trackOrderCompleted(properties: TrackOrderCompletedV2, context: Map<String, Any>? = null)',
    );
    expect(src).toContain('trackOrderCompletedV2(properties, context)');
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
    await expect(renderKotlin(events)).rejects.toThrow(
      /Identifier collision: "trackFoo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
