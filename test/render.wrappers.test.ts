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
  alias: jest.Mock;
};

function mockAnalytics(): MockAnalytics {
  return {
    track: jest.fn().mockResolvedValue(undefined),
    identify: jest.fn().mockResolvedValue(undefined),
    page: jest.fn().mockResolvedValue(undefined),
    screen: jest.fn().mockResolvedValue(undefined),
    group: jest.fn().mockResolvedValue(undefined),
    alias: jest.fn().mockResolvedValue(undefined),
  };
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

  it('calls identify with userId and traits', async () => {
    const source = await renderBrowserTs(eventsFromFixture('with-refs.json'));
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.identifyDefault as (
        userId: string,
        traits: object,
      ) => Promise<unknown>
    )('user_1', { email: 'a@b.c' });

    expect(analytics.identify).toHaveBeenCalledWith(
      'user_1',
      { email: 'a@b.c' },
      undefined,
    );
  });

  it('calls identify with traits only when no userId is passed', async () => {
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

  it('calls group with groupId and traits', async () => {
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
    const source = await renderBrowserTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.groupDefault as (
        groupId: string,
        traits: object,
      ) => Promise<unknown>
    )('grp_1', { name: 'Acme' });

    expect(analytics.group).toHaveBeenCalledWith(
      'grp_1',
      { name: 'Acme' },
      undefined,
    );
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
    const source = await renderBrowserTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.identifyV1 as (
        userId: string,
        traits: Record<string, unknown>,
      ) => Promise<unknown>
    )('user_1', { email: 'a@b.c' });

    expect(analytics.identify).toHaveBeenCalledWith(
      'user_1',
      { email: 'a@b.c' },
      undefined,
    );
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
    const source = await renderBrowserTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.identifyV1 as (
        userId: string,
        traits: Record<string, unknown>,
      ) => Promise<unknown>
    )('user_1', { email: 'a@b.c' });

    expect(analytics.identify).toHaveBeenCalledWith(
      'user_1',
      { email: 'a@b.c', apiVersion: 'v1' },
      undefined,
    );
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
      { orderId: '1' },
      undefined,
    );
  });

  it('calls alias with to and optional from', async () => {
    const source = await renderBrowserTs([aliasEvent()]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.aliasDefault as (
        to: string,
        from?: string,
        options?: object,
      ) => Promise<unknown>
    )('user_new', 'user_old');

    expect(analytics.alias).toHaveBeenCalledWith(
      'user_new',
      'user_old',
      undefined,
    );
  });

  it('calls alias with to and options when from is omitted', async () => {
    const source = await renderBrowserTs([aliasEvent()]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.aliasDefault as (
        to: string,
        options?: object,
      ) => Promise<unknown>
    )('user_new', { anonymousId: 'anon_1' });

    expect(analytics.alias).toHaveBeenCalledWith('user_new', undefined, {
      anonymousId: 'anon_1',
    });
  });

  it('injects alias schema version into options.context, not a properties payload', async () => {
    const source = await renderBrowserTs([
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
        to: string,
        from?: string,
        options?: { context?: Record<string, unknown> },
      ) => Promise<unknown>
    )('user_new', 'user_old', { context: { ip: '1.1.1.1' } });

    expect(analytics.alias).toHaveBeenCalledWith('user_new', 'user_old', {
      context: {
        ip: '1.1.1.1',
        protocols: { schemaVersion: 'v1' },
      },
    });
  });

  it('does not pass a properties object to alias', async () => {
    const source = await renderBrowserTs([
      aliasEvent({
        version: 'v1',
        wrapperName: 'aliasV1',
        schemaVersionPath: ['properties', 'apiVersion'],
      }),
    ]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    await (
      generated.aliasV1 as (to: string, from?: string) => Promise<unknown>
    )('user_new', 'user_old');

    expect(analytics.alias).toHaveBeenCalledWith(
      'user_new',
      'user_old',
      undefined,
    );
  });
});
