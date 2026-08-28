import ts from 'typescript';
import { renderReactNative } from '../src/render/react-native';
import { eventsFromFixture } from './helpers/fixtures';
import type { NormalizedEvent } from '../src/normalize/types';

type Enrichment = (event: { context?: Record<string, unknown> }) => {
  context?: Record<string, unknown>;
};

type MockAnalytics = {
  track: jest.Mock;
  identify: jest.Mock;
  screen: jest.Mock;
  group: jest.Mock;
  alias: jest.Mock;
};

function mockAnalytics(): MockAnalytics {
  return {
    track: jest.fn(async () => undefined),
    identify: jest.fn(async () => undefined),
    screen: jest.fn(async () => undefined),
    group: jest.fn(async () => undefined),
    alias: jest.fn(async () => undefined),
  };
}

function applyEnrichment(
  enrichment: Enrichment | undefined,
  context: Record<string, unknown> = {},
): Record<string, unknown> | undefined {
  if (enrichment === undefined) {
    return undefined;
  }
  return enrichment({ context }).context;
}

function aliasEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    type: 'alias',
    version: 'default',
    domainName: 'Users',
    envelopeKey: 'properties',
    schema: { type: 'object' },
    wrapperName: 'aliasDefault',
    ...overrides,
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

describe('generated react-native SDK wrappers', () => {
  it('throws before setHtEvents', async () => {
    const source = await renderReactNative(
      eventsFromFixture('simple-track.json'),
    );
    const generated = loadGenerated(source);
    const track = generated.trackOrderCompletedDefault as (
      props: unknown,
    ) => unknown;
    expect(() => track({ orderId: '1' })).toThrow(/setHtEvents/);
  });

  it('calls track with name, properties, and a context enrichment', async () => {
    const source = await renderReactNative(
      eventsFromFixture('simple-track.json'),
    );
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    const callerContext = { ip: '1.1.1.1' };
    await (
      generated.trackOrderCompletedDefault as (
        props: { orderId: string },
        context?: Record<string, unknown>,
      ) => Promise<void>
    )({ orderId: 'ord_1' }, callerContext);

    expect(analytics.track).toHaveBeenCalledTimes(1);
    const [name, properties, enrichment] = analytics.track.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Enrichment,
    ];
    expect(name).toBe('Order Completed');
    expect(properties).toEqual({ orderId: 'ord_1' });
    expect(applyEnrichment(enrichment, { locale: 'en-US' })).toEqual({
      locale: 'en-US',
      ip: '1.1.1.1',
      protocols: { schemaVersion: 'default' },
    });
    expect(callerContext).toEqual({ ip: '1.1.1.1' });
  });

  it('does not mutate caller properties when injecting a properties path', async () => {
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
    const source = await renderReactNative([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    const props = { orderId: '1' };
    await (
      generated.trackOrderCompletedV1 as (
        props: Record<string, unknown>,
      ) => Promise<void>
    )(props);

    const [, properties, enrichment] = analytics.track.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Enrichment | undefined,
    ];
    expect(properties).toEqual({ orderId: '1', apiVersion: 'v1' });
    expect(props).toEqual({ orderId: '1' });
    expect(enrichment).toBeUndefined();
  });

  it('latest alias invokes the same wrapper as the versioned name', async () => {
    const events: NormalizedEvent[] = [
      {
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
      },
      {
        type: 'track',
        name: 'Order Completed',
        version: 'v2',
        domainName: 'Orders',
        envelopeKey: 'properties',
        schemaVersionPath: ['properties', 'apiVersion'],
        schema: {
          type: 'object',
          properties: { orderId: { type: 'string' } },
        },
        wrapperName: 'trackOrderCompletedV2',
        latestAlias: 'trackOrderCompleted',
      },
    ];
    const source = await renderReactNative(events);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (generated.trackOrderCompleted as (props: object) => Promise<void>)({
      orderId: '1',
    });

    expect(analytics.track).toHaveBeenCalledTimes(1);
    const [name, properties] = analytics.track.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe('Order Completed');
    expect(properties).toEqual({ orderId: '1', apiVersion: 'v2' });
  });

  it('calls identify with userId and traits, or traits only', async () => {
    const source = await renderReactNative(eventsFromFixture('with-refs.json'));
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.identifyDefault as (
        userId: string,
        traits: object,
      ) => Promise<void>
    )('user_1', { email: 'a@b.c' });
    await (generated.identifyDefault as (traits: object) => Promise<void>)({
      email: 'b@c.d',
    });

    expect(analytics.identify.mock.calls[0]?.slice(0, 2)).toEqual([
      'user_1',
      { email: 'a@b.c' },
    ]);
    expect(analytics.identify.mock.calls[1]?.slice(0, 2)).toEqual([
      undefined,
      { email: 'b@c.d' },
    ]);
  });

  it('calls group with groupId and traits, not userId', async () => {
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
    const source = await renderReactNative([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.groupDefault as (
        groupId: string,
        traits: object,
      ) => Promise<void>
    )('grp_1', { name: 'Acme' });

    expect(analytics.group.mock.calls[0]?.slice(0, 2)).toEqual([
      'grp_1',
      { name: 'Acme' },
    ]);
  });

  it('does not inject a properties.* version into identify traits', async () => {
    const event: NormalizedEvent = {
      type: 'identify',
      version: 'v1',
      domainName: 'Users',
      envelopeKey: 'traits',
      schemaVersionPath: ['properties', 'apiVersion'],
      schema: {
        type: 'object',
        properties: { email: { type: 'string' } },
      },
      wrapperName: 'identifyV1',
    };
    const source = await renderReactNative([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.identifyV1 as (
        userId: string,
        traits: Record<string, unknown>,
      ) => Promise<void>
    )('user_1', { email: 'a@b.c' });

    expect(analytics.identify.mock.calls[0]?.[1]).toEqual({ email: 'a@b.c' });
  });

  it('injects version into traits when schemaVersionPath starts with traits', async () => {
    const event: NormalizedEvent = {
      type: 'identify',
      version: 'v1',
      domainName: 'Users',
      envelopeKey: 'traits',
      schemaVersionPath: ['traits', 'apiVersion'],
      schema: {
        type: 'object',
        properties: { email: { type: 'string' } },
      },
      wrapperName: 'identifyV1',
    };
    const source = await renderReactNative([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.identifyV1 as (
        userId: string,
        traits: Record<string, unknown>,
      ) => Promise<void>
    )('user_1', { email: 'a@b.c' });

    expect(analytics.identify.mock.calls[0]?.[1]).toEqual({
      email: 'a@b.c',
      apiVersion: 'v1',
    });
  });

  it('does not inject a traits.* version into track properties', async () => {
    const event: NormalizedEvent = {
      type: 'track',
      name: 'Order Completed',
      version: 'v1',
      domainName: 'Orders',
      envelopeKey: 'properties',
      schemaVersionPath: ['traits', 'apiVersion'],
      schema: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
      },
      wrapperName: 'trackOrderCompletedV1',
    };
    const source = await renderReactNative([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.trackOrderCompletedV1 as (
        props: Record<string, unknown>,
      ) => Promise<void>
    )({ orderId: '1' });

    expect(analytics.track.mock.calls[0]?.[1]).toEqual({ orderId: '1' });
  });

  it('maps page to screen and unnamed screen to "screen"', async () => {
    const source = await renderReactNative([
      {
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
      },
      {
        type: 'screen',
        version: 'default',
        domainName: 'Mobile',
        envelopeKey: 'properties',
        schema: { type: 'object' },
        wrapperName: 'screenDefault',
      },
    ]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (generated.pageHomeDefault as (props: object) => Promise<void>)({
      path: '/',
    });
    await (generated.screenDefault as (props: object) => Promise<void>)({});

    expect(analytics.screen.mock.calls[0]?.slice(0, 2)).toEqual([
      'Home',
      { path: '/' },
    ]);
    expect(analytics.screen.mock.calls[1]?.slice(0, 2)).toEqual(['screen', {}]);
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('calls alias with newUserId and injects context via enrichment', async () => {
    const source = await renderReactNative([
      aliasEvent({
        version: 'v1',
        wrapperName: 'aliasV1',
        schemaVersionPath: ['context', 'protocols', 'schemaVersion'],
      }),
    ]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.aliasV1 as (
        newUserId: string,
        context?: Record<string, unknown>,
      ) => Promise<void>
    )('user_new', { ip: '1.1.1.1' });

    const [newUserId, enrichment] = analytics.alias.mock.calls[0] as [
      string,
      Enrichment,
    ];
    expect(newUserId).toBe('user_new');
    expect(applyEnrichment(enrichment)).toEqual({
      ip: '1.1.1.1',
      protocols: { schemaVersion: 'v1' },
    });
  });

  it('does not pass a properties object or enrichment for alias properties.*', async () => {
    const source = await renderReactNative([
      aliasEvent({
        version: 'v1',
        wrapperName: 'aliasV1',
        schemaVersionPath: ['properties', 'apiVersion'],
      }),
    ]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (generated.aliasV1 as (newUserId: string) => Promise<void>)(
      'user_new',
    );

    expect(analytics.alias).toHaveBeenCalledWith('user_new', undefined);
  });
});
