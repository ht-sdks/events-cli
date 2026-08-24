import {
  renderPython,
  MIN_SDK_PACKAGE,
  MIN_SDK_VERSION,
} from '../src/render/python';
import { snakeName } from '../src/render/python/names';
import { eventsFromFixture } from './helpers/fixtures';
import { defineRendererContractTests } from './helpers/renderer-contract';
import type { NormalizedEvent } from '../src/normalize/types';

describe('renderPython', () => {
  defineRendererContractTests({
    render: renderPython,
    peerPackage: MIN_SDK_PACKAGE,
    peerVersion: MIN_SDK_VERSION,
    sortedWrapperSnippet: (wrapperName) => `def ${snakeName(wrapperName)}(`,
  });

  it('emits snake_case wrappers and PascalCase dataclasses', async () => {
    const src = await renderPython(eventsFromFixture('simple-track.json'));
    expect(src).toContain('from hightouch.htevents.client import Client');
    expect(src).toMatch(/class TrackOrderCompletedDefault:/);
    expect(src).toContain('def track_order_completed_default(');
    expect(src).toContain('orderId');
    expect(src).toContain('client.track(');
  });

  it('emits alias wrappers with user_id and previous_id, not a properties payload', async () => {
    const event: NormalizedEvent = {
      type: 'alias',
      version: 'default',
      domainName: 'Users',
      envelopeKey: 'properties',
      schema: { type: 'object' },
      wrapperName: 'aliasDefault',
    };
    const src = await renderPython([event]);
    expect(src).toContain('def alias_default(');
    expect(src).toContain('previous_id: str,');
    expect(src).toContain('client.alias(');
    expect(src).not.toMatch(
      /def alias_default\(\n {4}client: Client,\n {4}user_id: str,\n {4}properties:/,
    );
  });

  it('emits a latest-version alias binding', async () => {
    const src = await renderPython(eventsFromFixture('multi-version.json'));
    expect(src).toContain('track_order_completed = track_order_completed_v2');
  });
});
