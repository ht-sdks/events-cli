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

  it('legalizes hyphenated keys and records the original JSON name', async () => {
    const src = await renderPython([
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
    expect(src).toContain(
      'orderid: Optional[str] = field(default=None, metadata={"json": "order-id"})',
    );
    expect(src).toContain('order_id: Optional[str] = field(default=None)');
    expect(src).toContain('OrderId: Optional[str] = field(default=None)');
    expect(src).toContain('orderId: Optional[str] = field(default=None)');
    expect(src).toContain('key = item.metadata.get("json", item.name)');
  });

  it('omits anonymous_id from alias wrappers', async () => {
    const src = await renderPython([
      {
        type: 'alias',
        version: 'default',
        domainName: 'Users',
        envelopeKey: 'properties',
        schema: { type: 'object' },
        wrapperName: 'aliasDefault',
      },
    ]);
    expect(src).toContain('def alias_default(');
    expect(src).not.toMatch(/def alias_default\([\s\S]*?anonymous_id/);
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
    await expect(renderPython(events)).rejects.toThrow(
      /Identifier collision: "track_foo" is produced by both method trackFoo and latest alias trackFoo/,
    );
  });
});
