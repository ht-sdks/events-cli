import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HtEventsBrowser } from '@ht-sdks/events-sdk-js-browser';
import { mockServer, stubBrowserGlobals } from './mockserver';
import * as generated from './generated';

function asMap(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, 'object');
  assert.ok(value !== null);
  return value as Record<string, unknown>;
}

async function sendAndRead(
  run: () => Promise<unknown>,
): Promise<Record<string, unknown>> {
  stubBrowserGlobals();
  const server = await mockServer();
  try {
    const analytics = HtEventsBrowser.load(
      {
        writeKey: 'wk',
        cdnSettings: {
          integrations: {
            'Hightouch.io': {
              apiKey: 'wk',
              apiHost: server.host,
              protocol: 'http',
            },
          },
        },
      },
      {
        apiHost: server.host,
        protocol: 'http',
        disableClientPersistence: true,
      },
    );
    generated.setHtEvents(analytics);
    await analytics;
    await run();
    return (
      await Promise.race([
        server.next(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('timed out waiting for SDK POST')),
            5000,
          );
        }),
      ])
    ).body;
  } finally {
    await server.close();
  }
}

test('track order completed posts event name and properties', async () => {
  const msg = await sendAndRead(() =>
    generated.trackOrderCompleted({ orderId: 'ord_1', total: 2 }),
  );
  assert.equal(msg.type, 'track');
  assert.equal(msg.event, 'Order Completed');
  const props = asMap(msg.properties);
  assert.equal(props.orderId, 'ord_1');
  assert.equal(props.total, 2);
});

test('latest alias hits the same path as the versioned wrapper', async () => {
  const versioned = await sendAndRead(() =>
    generated.trackOrderCompletedV2({ orderId: '1' }),
  );
  const aliased = await sendAndRead(() =>
    generated.trackOrderCompleted({ orderId: '1' }),
  );
  assert.equal(versioned.event, aliased.event);
});

test('injects context.protocols.schemaVersion on track', async () => {
  const msg = await sendAndRead(() =>
    generated.trackSignedUp({ plan: 'pro' }, { context: { locale: 'en-US' } }),
  );
  const ctx = asMap(msg.context);
  assert.equal(ctx.locale, 'en-US');
  const protocols = asMap(ctx.protocols);
  assert.equal(protocols.schemaVersion, 'default');
});

test('injects properties.apiVersion on track', async () => {
  const msg = await sendAndRead(() =>
    generated.trackOrderCompletedPropsV1({ orderId: '1' }),
  );
  const props = asMap(msg.properties);
  assert.equal(props.orderId, '1');
  assert.equal(props.apiVersion, 'v1');
});

test('identify posts traits', async () => {
  const msg = await sendAndRead(() =>
    generated.identifyDefault('user_1', { email: 'a@b.c' }),
  );
  assert.equal(msg.type, 'identify');
  assert.equal(msg.userId, 'user_1');
  const traits = asMap(msg.traits);
  assert.equal(traits.email, 'a@b.c');
});

test('injects traits.apiVersion on identify', async () => {
  const msg = await sendAndRead(() =>
    generated.identifyTraitsV1('user_1', { email: 'a@b.c' }),
  );
  const traits = asMap(msg.traits);
  assert.equal(traits.apiVersion, 'v1');
});

test('does not inject properties.* on identify', async () => {
  const msg = await sendAndRead(() =>
    generated.identifyWrongEnvelopeV1('user_1', { email: 'a@b.c' }),
  );
  const traits = asMap(msg.traits);
  assert.equal('apiVersion' in traits, false);
});

test('does not inject traits.* on track', async () => {
  const msg = await sendAndRead(() =>
    generated.trackWrongEnvelopeV1({ orderId: '1' }),
  );
  const props = asMap(msg.properties);
  assert.equal('apiVersion' in props, false);
});

test('group posts groupId and traits', async () => {
  const msg = await sendAndRead(() =>
    generated.groupDefault('grp_1', { name: 'Acme' }),
  );
  assert.equal(msg.type, 'group');
  assert.equal(msg.groupId, 'grp_1');
  const traits = asMap(msg.traits);
  assert.equal(traits.name, 'Acme');
});

test('page and screen post names', async () => {
  const page = await sendAndRead(() => generated.pageHome({ path: '/' }));
  assert.equal(page.type, 'page');
  assert.equal(page.name, 'Home');

  const screen = await sendAndRead(() => generated.screenHome({ path: '/' }));
  assert.equal(screen.type, 'screen');
  assert.equal(screen.name, 'Home');
});

test('alias posts without a properties object', async () => {
  const msg = await sendAndRead(() =>
    generated.aliasDefault('user_new', 'user_old'),
  );
  assert.equal(msg.type, 'alias');
  assert.equal(msg.userId, 'user_new');
  assert.equal(msg.previousId, 'user_old');
  assert.equal('properties' in msg, false);
});

test('injects context.protocols.schemaVersion on alias', async () => {
  const msg = await sendAndRead(() =>
    generated.aliasContextV1('user_new', 'user_old', {
      context: { locale: 'en-US' },
    }),
  );
  assert.equal('properties' in msg, false);
  const ctx = asMap(msg.context);
  const protocols = asMap(ctx.protocols);
  assert.equal(protocols.schemaVersion, 'v1');
});

test('does not inject properties.* on alias', async () => {
  const msg = await sendAndRead(() =>
    generated.aliasPropsV1('user_new', 'user_old'),
  );
  assert.equal('properties' in msg, false);
});

test('preserves JSON property names on cart viewed', async () => {
  const msg = await sendAndRead(() =>
    generated.trackCartViewedDefault({
      amount: 10,
      currency: 'USD',
      itemCount: 3,
    }),
  );
  const props = asMap(msg.properties);
  assert.equal(props.itemCount, 3);
});
