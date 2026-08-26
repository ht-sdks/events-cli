import {
  renderRuby,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/ruby';
import { snakeName } from '../src/render/ruby/names';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderRuby', () => {
  defineRendererContractTests({
    render: renderRuby,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) =>
      `def self.${snakeName(wrapperName)}(`,
  });

  it('emits snake_case wrappers and Struct types with JSON keys', async () => {
    const src = await renderRuby(eventsFromFixture('simple-track.json'));
    expect(src).toContain("require 'hightouch/analytics'");
    expect(src).toContain(
      'TrackOrderCompletedDefault = Struct.new(:orderId, :total, keyword_init: true)',
    );
    expect(src).toContain('module HtEvents');
    expect(src).toContain('def self.track_order_completed_default(');
    expect(src).toContain('client.track(');
  });

  it('emits alias wrappers with user_id and previous_id', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
      latestAlias: 'alias',
    };
    const src = await renderRuby([event]);
    expect(src).toContain('def self.alias_default(');
    expect(src).toContain('previous_id');
    expect(src).toContain('client.alias(');
    expect(src).toContain('define_singleton_method(:alias) do |*args, **opts|');
    expect(src).not.toContain('def self.alias_(');
    expect(src).not.toContain('class AliasDefault');
  });

  it('quotes hyphenated struct members so the wire key is unchanged', async () => {
    const src = await renderRuby([
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
    expect(src).toContain(":'order-id'");
    expect(src).toContain(':order_id');
    expect(src).toContain(':OrderId');
    expect(src).toContain(':orderId');
    expect(src).toContain('out[key.to_s] =');
  });

  it('emits an unnamed screen wrapper without a name argument', async () => {
    const event: NormalizedEvent = {
      type: 'screen',
      name: '',
      version: 'default',
      domainName: 'Mobile',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'screenDefault',
    };
    const src = await renderRuby([event]);
    expect(src).toContain('def self.screen_default(client, user_id, properties = {}, **opts)');
    expect(src).toContain('client.screen(');
    expect(src).not.toContain('    name:');
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
    await expect(renderRuby(events)).rejects.toThrow(
      /Identifier collision: "track_foo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
