import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as generated from './generated.ts';

type JsonMap = Record<string, unknown>;
type Enrichment = (event: { context?: JsonMap }) => { context?: JsonMap };

type Captured = {
  method: string;
  args: unknown[];
  event: JsonMap;
};

function asMap(value: unknown): JsonMap {
  assert.equal(typeof value, 'object');
  assert.ok(value !== null);
  return value as JsonMap;
}

function mockClient(captured: Captured[]) {
  function run(
    method: string,
    args: unknown[],
    event: JsonMap,
    enrichment?: Enrichment,
  ): Promise<void> {
    const next = enrichment === undefined ? event : enrichment(event);
    captured.push({ method, args, event: next });
    return Promise.resolve();
  }

  return {
    track(name: string, properties?: JsonMap, enrichment?: Enrichment) {
      return run(
        'track',
        [name, properties],
        { type: 'track', event: name, properties, context: {} },
        enrichment,
      );
    },
    screen(name: string, properties?: JsonMap, enrichment?: Enrichment) {
      return run(
        'screen',
        [name, properties],
        { type: 'screen', name, properties, context: {} },
        enrichment,
      );
    },
    identify(userId?: string, traits?: JsonMap, enrichment?: Enrichment) {
      return run(
        'identify',
        [userId, traits],
        { type: 'identify', userId, traits, context: {} },
        enrichment,
      );
    },
    group(groupId: string, traits?: JsonMap, enrichment?: Enrichment) {
      return run(
        'group',
        [groupId, traits],
        { type: 'group', groupId, traits, context: {} },
        enrichment,
      );
    },
    alias(newUserId: string, enrichment?: Enrichment) {
      return run(
        'alias',
        [newUserId],
        { type: 'alias', userId: newUserId, context: {} },
        enrichment,
      );
    },
  };
}

async function sendAndRead(run: () => Promise<unknown>): Promise<Captured> {
  const captured: Captured[] = [];
  generated.setHtEvents(mockClient(captured));
  await run();
  assert.equal(captured.length, 1);
  return captured[0];
}

test('track order completed posts event name and properties', async () => {
  const { event } = await sendAndRead(() =>
    generated.trackOrderCompleted({ orderId: 'ord_1', total: 2 }),
  );
  assert.equal(event.type, 'track');
  assert.equal(event.event, 'Order Completed');
  const props = asMap(event.properties);
  assert.equal(props.orderId, 'ord_1');
  assert.equal(props.total, 2);
});

test('latest alias hits the same path as the versioned wrapper', async () => {
  const versioned = await sendAndRead(() =>
    generated.trackOrderCompletedPropsV1({ orderId: '1' }),
  );
  const aliased = await sendAndRead(() =>
    generated.trackOrderCompletedProps({ orderId: '1' }),
  );
  assert.equal(versioned.event.event, aliased.event.event);
  assert.equal(asMap(versioned.event.properties).apiVersion, 'v1');
  assert.equal(asMap(aliased.event.properties).apiVersion, 'v1');
});

test('injects context.protocols.schemaVersion on track', async () => {
  const { event } = await sendAndRead(() =>
    generated.trackSignedUp({ plan: 'pro' }, { locale: 'en-US' }),
  );
  const ctx = asMap(event.context);
  assert.equal(ctx.locale, 'en-US');
  const protocols = asMap(ctx.protocols);
  assert.equal(protocols.schemaVersion, 'default');
});

test('injects properties.apiVersion on track', async () => {
  const { event } = await sendAndRead(() =>
    generated.trackOrderCompletedPropsV1({ orderId: '1' }),
  );
  const props = asMap(event.properties);
  assert.equal(props.orderId, '1');
  assert.equal(props.apiVersion, 'v1');
});

test('identify posts traits', async () => {
  const { event } = await sendAndRead(() =>
    generated.identifyDefault('user_1', { email: 'a@b.c' }),
  );
  assert.equal(event.type, 'identify');
  assert.equal(event.userId, 'user_1');
  const traits = asMap(event.traits);
  assert.equal(traits.email, 'a@b.c');
});

test('injects traits.apiVersion on identify', async () => {
  const { event } = await sendAndRead(() =>
    generated.identifyTraitsV1('user_1', { email: 'a@b.c' }),
  );
  const traits = asMap(event.traits);
  assert.equal(traits.apiVersion, 'v1');
});

test('does not inject properties.* on identify', async () => {
  const { event } = await sendAndRead(() =>
    generated.identifyWrongEnvelopeV1('user_1', { email: 'a@b.c' }),
  );
  const traits = asMap(event.traits);
  assert.equal('apiVersion' in traits, false);
});

test('does not inject traits.* on track', async () => {
  const { event } = await sendAndRead(() =>
    generated.trackWrongEnvelopeV1({ orderId: '1' }),
  );
  const props = asMap(event.properties);
  assert.equal('apiVersion' in props, false);
});

test('group posts groupId and traits', async () => {
  const { event } = await sendAndRead(() =>
    generated.groupDefault('grp_1', { name: 'Acme' }),
  );
  assert.equal(event.type, 'group');
  assert.equal(event.groupId, 'grp_1');
  const traits = asMap(event.traits);
  assert.equal(traits.name, 'Acme');
});

test('page maps to screen and unnamed screen is named screen', async () => {
  const page = await sendAndRead(() => generated.pageHome({ path: '/' }));
  assert.equal(page.method, 'screen');
  assert.equal(page.event.type, 'screen');
  assert.equal(page.event.name, 'Home');

  const screen = await sendAndRead(() => generated.screenHome({ path: '/' }));
  assert.equal(screen.method, 'screen');
  assert.equal(screen.event.name, 'Home');

  const unnamed = await sendAndRead(() => generated.screenDefault({}));
  assert.equal(unnamed.event.name, 'screen');
});

test('alias posts without a properties object', async () => {
  const { args, event } = await sendAndRead(() =>
    generated.aliasDefault('user_new'),
  );
  assert.equal(event.type, 'alias');
  assert.equal(event.userId, 'user_new');
  assert.equal('properties' in event, false);
  assert.deepEqual(args, ['user_new']);
});

test('injects context.protocols.schemaVersion on alias', async () => {
  const { event } = await sendAndRead(() =>
    generated.aliasContextV1('user_new', { locale: 'en-US' }),
  );
  assert.equal('properties' in event, false);
  const ctx = asMap(event.context);
  const protocols = asMap(ctx.protocols);
  assert.equal(protocols.schemaVersion, 'v1');
});

test('does not inject properties.* on alias', async () => {
  const { event } = await sendAndRead(() => generated.aliasPropsV1('user_new'));
  assert.equal('properties' in event, false);
  const ctx = asMap(event.context);
  assert.equal('protocols' in ctx, false);
});

test('preserves JSON property names on cart viewed', async () => {
  const { event } = await sendAndRead(() =>
    generated.trackCartViewedDefault({
      amount: 10,
      currency: 'USD',
      itemCount: 3,
    }),
  );
  const props = asMap(event.properties);
  assert.equal(props.itemCount, 3);
});

test('json key spellings are preserved on the wire', async () => {
  const { event } = await sendAndRead(() =>
    generated.trackJsonKeyProbeDefault({
      'order-id': 'hyphen',
      order_id: 'snake',
      OrderId: 'pascal',
      orderId: 'camel',
    }),
  );
  const props = asMap(event.properties);
  assert.equal(props['order-id'], 'hyphen');
  assert.equal(props.order_id, 'snake');
  assert.equal(props.OrderId, 'pascal');
  assert.equal(props.orderId, 'camel');
});
