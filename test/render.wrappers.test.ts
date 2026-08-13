import ts from 'typescript';
import { renderBrowserTs } from '../src/render/browser-ts';
import { eventsFromFixture } from './helpers/fixtures';
import type { NormalizedEvent } from '../src/normalize/types';

type MockAnalytics = {
  track: jest.Mock;
  identify: jest.Mock;
  page: jest.Mock;
  screen: jest.Mock;
  group: jest.Mock;
};

function mockAnalytics(): MockAnalytics {
  return {
    track: jest.fn().mockResolvedValue(undefined),
    identify: jest.fn().mockResolvedValue(undefined),
    page: jest.fn().mockResolvedValue(undefined),
    screen: jest.fn().mockResolvedValue(undefined),
    group: jest.fn().mockResolvedValue(undefined),
  };
}

function loadGenerated(source: string): Record<string, unknown> {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} as Record<string, unknown> };
  const fn = new Function('module', 'exports', outputText);
  fn(module, module.exports);
  return module.exports;
}

describe('generated SDK wrappers', () => {
  it('throws before setHtEvents', async () => {
    const source = await renderBrowserTs(
      eventsFromFixture('simple-track.json'),
    );
    const generated = loadGenerated(source);
    const track = generated.trackOrderCompletedDefault as (
      props: unknown,
    ) => unknown;
    expect(() => track({ orderId: '1' })).toThrow(/setHtEvents/);
  });

  it('calls track with event name, properties, and context version', async () => {
    const source = await renderBrowserTs(
      eventsFromFixture('simple-track.json'),
    );
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.trackOrderCompletedDefault as (
        props: { orderId: string },
        options?: { context?: Record<string, unknown> },
      ) => Promise<unknown>
    )({ orderId: 'ord_1' }, { context: { ip: '1.1.1.1' } });

    expect(analytics.track).toHaveBeenCalledWith(
      'Order Completed',
      { orderId: 'ord_1' },
      {
        context: {
          ip: '1.1.1.1',
          protocols: { schemaVersion: 'default' },
        },
      },
    );
  });

  it('latest alias invokes the same wrapper as the versioned name', async () => {
    const source = await renderBrowserTs(
      eventsFromFixture('multi-version.json'),
    );
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.trackOrderCompleted as (props: object) => Promise<unknown>
    )({ orderId: '1', total: 2 });

    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith(
      'Order Completed',
      { orderId: '1', total: 2 },
      undefined,
    );
  });

  it('injects version into properties when schemaVersionPath starts with properties', async () => {
    const event: NormalizedEvent = {
      type: 'track',
      name: 'Order Completed',
      version: 'v1',
      domainName: 'Orders',
      envelopeKey: 'properties',
      schemaVersionPath: ['properties', 'apiVersion'],
      schema: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
      },
      wrapperName: 'trackOrderCompletedV1',
    };
    const source = await renderBrowserTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.trackOrderCompletedV1 as (
        props: Record<string, unknown>,
      ) => Promise<unknown>
    )({ orderId: '1' });

    expect(analytics.track).toHaveBeenCalledWith(
      'Order Completed',
      { orderId: '1', apiVersion: 'v1' },
      undefined,
    );
  });

  it('calls identify with traits', async () => {
    const source = await renderBrowserTs(eventsFromFixture('with-refs.json'));
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (generated.identifyDefault as (traits: object) => Promise<unknown>)({
      email: 'a@b.c',
    });

    expect(analytics.identify).toHaveBeenCalledWith(
      { email: 'a@b.c' },
      undefined,
    );
  });
});
