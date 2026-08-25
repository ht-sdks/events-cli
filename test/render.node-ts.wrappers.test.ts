import ts from 'typescript';
import { renderNodeTs } from '../src/render/node-ts';
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
    track: jest.fn(),
    identify: jest.fn(),
    page: jest.fn(),
    screen: jest.fn(),
    group: jest.fn(),
    alias: jest.fn(),
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

describe('generated node-ts SDK wrappers', () => {
  it('throws before setHtEvents', async () => {
    const source = await renderNodeTs(eventsFromFixture('simple-track.json'));
    const generated = loadGenerated(source);
    const track = generated.trackOrderCompletedDefault as (
      userId: string,
      props: unknown,
    ) => unknown;
    expect(() => track('user_1', { orderId: '1' })).toThrow(/setHtEvents/);
  });

  it('calls track with a params object and context version', async () => {
    const source = await renderNodeTs(eventsFromFixture('simple-track.json'));
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (
      generated.trackOrderCompletedDefault as (
        userId: string,
        props: { orderId: string },
        options?: { context?: Record<string, unknown> },
      ) => void
    )('user_1', { orderId: 'ord_1' }, { context: { ip: '1.1.1.1' } });

    expect(analytics.track).toHaveBeenCalledWith({
      event: 'Order Completed',
      userId: 'user_1',
      properties: { orderId: 'ord_1' },
      context: {
        ip: '1.1.1.1',
        protocols: { schemaVersion: 'default' },
      },
    });
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
    const source = await renderNodeTs(events);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (generated.trackOrderCompleted as (userId: string, props: object) => void)(
      'user_1',
      { orderId: '1' },
    );

    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'Order Completed',
        userId: 'user_1',
        properties: { orderId: '1', apiVersion: 'v2' },
      }),
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
    const source = await renderNodeTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (
      generated.trackOrderCompletedV1 as (
        userId: string,
        props: Record<string, unknown>,
      ) => void
    )('user_1', { orderId: '1' });

    expect(analytics.track).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: { orderId: '1', apiVersion: 'v1' },
      }),
    );
  });

  it('calls identify with userId and traits', async () => {
    const source = await renderNodeTs(eventsFromFixture('with-refs.json'));
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (generated.identifyDefault as (userId: string, traits: object) => void)(
      'user_1',
      { email: 'a@b.c' },
    );

    expect(analytics.identify).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        traits: { email: 'a@b.c' },
      }),
    );
  });

  it('calls group with groupId, userId, and traits', async () => {
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
    const source = await renderNodeTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (
      generated.groupDefault as (
        groupId: string,
        userId: string,
        traits: object,
      ) => void
    )('grp_1', 'user_1', { name: 'Acme' });

    expect(analytics.group).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'grp_1',
        userId: 'user_1',
        traits: { name: 'Acme' },
      }),
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
    const source = await renderNodeTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (
      generated.identifyV1 as (
        userId: string,
        traits: Record<string, unknown>,
      ) => void
    )('user_1', { email: 'a@b.c' });

    expect(analytics.identify).toHaveBeenCalledWith(
      expect.objectContaining({
        traits: { email: 'a@b.c' },
      }),
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
    const source = await renderNodeTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (
      generated.identifyV1 as (
        userId: string,
        traits: Record<string, unknown>,
      ) => void
    )('user_1', { email: 'a@b.c' });

    expect(analytics.identify).toHaveBeenCalledWith(
      expect.objectContaining({
        traits: { email: 'a@b.c', apiVersion: 'v1' },
      }),
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
    const source = await renderNodeTs([event]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (
      generated.trackOrderCompletedV1 as (
        userId: string,
        props: Record<string, unknown>,
      ) => void
    )('user_1', { orderId: '1' });

    expect(analytics.track).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: { orderId: '1' },
      }),
    );
  });

  it('calls alias with userId and previousId', async () => {
    const source = await renderNodeTs([aliasEvent()]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (generated.aliasDefault as (userId: string, previousId: string) => void)(
      'user_new',
      'user_old',
    );

    expect(analytics.alias).toHaveBeenCalledWith({
      userId: 'user_new',
      previousId: 'user_old',
    });
  });

  it('injects alias schema version into options.context, not a properties payload', async () => {
    const source = await renderNodeTs([
      aliasEvent({
        version: 'v1',
        wrapperName: 'aliasV1',
        schemaVersionPath: ['context', 'protocols', 'schemaVersion'],
      }),
    ]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (
      generated.aliasV1 as (
        userId: string,
        previousId: string,
        options?: { context?: Record<string, unknown> },
      ) => void
    )('user_new', 'user_old', { context: { ip: '1.1.1.1' } });

    expect(analytics.alias).toHaveBeenCalledWith({
      userId: 'user_new',
      previousId: 'user_old',
      context: {
        ip: '1.1.1.1',
        protocols: { schemaVersion: 'v1' },
      },
    });
  });

  it('does not pass a properties object to alias', async () => {
    const source = await renderNodeTs([
      aliasEvent({
        version: 'v1',
        wrapperName: 'aliasV1',
        schemaVersionPath: ['properties', 'apiVersion'],
      }),
    ]);
    const generated = loadGenerated(source);
    const analytics = mockAnalytics();
    (generated.setHtEvents as (instance: MockAnalytics) => void)(analytics);

    (generated.aliasV1 as (userId: string, previousId: string) => void)(
      'user_new',
      'user_old',
    );

    expect(analytics.alias).toHaveBeenCalledWith({
      userId: 'user_new',
      previousId: 'user_old',
    });
  });
});
