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
    expect(src).toContain('TrackOrderCompletedDefault = Struct.new(:orderId');
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
    };
    const src = await renderRuby([event]);
    expect(src).toContain('def self.alias_default(');
    expect(src).toContain('previous_id');
    expect(src).toContain('client.alias(');
  });
});
