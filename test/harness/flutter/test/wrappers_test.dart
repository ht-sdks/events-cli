import 'package:flutter_test/flutter_test.dart';
import 'package:hightouch_events/event.dart';

import 'package:analytics_harness/analytics/generated.dart';

import 'support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('track order completed enqueues name and properties', () async {
    final track = await sendAndRead<TrackEvent>(
      (events) => events.trackOrderCompleted(
        TrackOrderCompletedV2(orderId: 'ord_1', total: 2.0),
      ),
    );
    expect(track.type, EventType.track);
    expect(track.event, 'Order Completed');
    final props = asMap(track.properties);
    expect(props['orderId'], 'ord_1');
    expect(props['total'], 2);
  });

  test('latest alias matches the versioned wrapper', () async {
    final versioned = await sendAndRead<TrackEvent>(
      (events) => events.trackOrderCompletedV2(
        TrackOrderCompletedV2(orderId: '1'),
      ),
    );
    final aliased = await sendAndRead<TrackEvent>(
      (events) => events.trackOrderCompleted(
        TrackOrderCompletedV2(orderId: '1'),
      ),
    );
    expect(versioned.event, aliased.event);
  });

  test('injects context.protocols.schemaVersion on track', () async {
    final track = await sendAndRead<TrackEvent>(
      (events) => events.trackSignedUp(
        TrackSignedUpDefault(plan: 'pro'),
        context: {'locale': 'en-US'},
      ),
    );
    final ctx = asMap(track.context!.toJson());
    expect(ctx['locale'], 'en-US');
    expect(schemaVersion(track), 'default');
  });

  test('injects properties.apiVersion on track', () async {
    final track = await sendAndRead<TrackEvent>(
      (events) => events.trackOrderCompletedPropsV1(
        TrackOrderCompletedPropsV1(orderId: '1'),
      ),
    );
    final props = asMap(track.properties);
    expect(props['orderId'], '1');
    expect(props['apiVersion'], 'v1');
  });

  test('identify posts traits', () async {
    final identify = await sendAndRead<IdentifyEvent>(
      (events) => events.identifyDefault(
        userId: 'user_1',
        traits: IdentifyDefault(email: 'a@b.c'),
      ),
    );
    expect(identify.type, EventType.identify);
    expect(identify.userId, 'user_1');
    expect(asMap(identify.traits!.toJson())['email'], 'a@b.c');
  });

  test('injects traits.apiVersion on identify', () async {
    final identify = await sendAndRead<IdentifyEvent>(
      (events) => events.identifyTraitsV1(
        userId: 'user_1',
        traits: IdentifyTraitsV1(email: 'a@b.c'),
      ),
    );
    expect(asMap(identify.traits!.toJson())['apiVersion'], 'v1');
  });

  test('does not inject properties.* on identify', () async {
    final identify = await sendAndRead<IdentifyEvent>(
      (events) => events.identifyWrongEnvelopeV1(
        userId: 'user_1',
        traits: IdentifyWrongEnvelopeV1(email: 'a@b.c'),
      ),
    );
    expect(asMap(identify.traits!.toJson()).containsKey('apiVersion'), isFalse);
  });

  test('does not inject traits.* on track', () async {
    final track = await sendAndRead<TrackEvent>(
      (events) => events.trackWrongEnvelopeV1(
        TrackWrongEnvelopeV1(orderId: '1'),
      ),
    );
    expect(asMap(track.properties).containsKey('apiVersion'), isFalse);
  });

  test('group posts groupId and traits', () async {
    final group = await sendAndRead<GroupEvent>(
      (events) => events.groupDefault('grp_1', traits: GroupDefault(name: 'Acme')),
    );
    expect(group.type, EventType.group);
    expect(group.groupId, 'grp_1');
    expect(asMap(group.traits!.toJson())['name'], 'Acme');
  });

  test('page maps to screen and unnamed screen is named screen', () async {
    final page = await sendAndRead<ScreenEvent>(
      (events) => events.pageHome(PageHomeDefault(path: '/')),
    );
    expect(page.type, EventType.screen);
    expect(page.name, 'Home');

    final screen = await sendAndRead<ScreenEvent>(
      (events) => events.screenHome(ScreenHomeDefault(path: '/')),
    );
    expect(screen.type, EventType.screen);
    expect(screen.name, 'Home');

    final unnamed = await sendAndRead<ScreenEvent>(
      (events) => events.screenDefault(ScreenDefault()),
    );
    expect(unnamed.name, 'screen');
  });

  test('alias posts without a properties object', () async {
    final alias = await sendAndRead<AliasEvent>(
      (events) => events.aliasDefault('user_new'),
    );
    expect(alias.type, EventType.alias);
    expect(alias.userId, 'user_new');
  });

  test('injects context.protocols.schemaVersion on alias', () async {
    final alias = await sendAndRead<AliasEvent>(
      (events) => events.aliasContextV1(
        'user_new',
        context: {'locale': 'en-US'},
      ),
    );
    expect(alias.type, EventType.alias);
    expect(schemaVersion(alias), 'v1');
  });

  test('does not inject properties.* on alias', () async {
    final alias = await sendAndRead<AliasEvent>(
      (events) => events.aliasPropsV1('user_new'),
    );
    expect(alias.userId, 'user_new');
    expect(schemaVersion(alias), isNull);
  });

  test('preserves JSON property names on cart viewed', () async {
    final track = await sendAndRead<TrackEvent>(
      (events) => events.trackCartViewedDefault(
        TrackCartViewedDefault(amount: 10.0, currency: 'USD', itemCount: 3.0),
      ),
    );
    expect(asMap(track.properties)['itemCount'], 3);
  });

  test('json key spellings are preserved on the wire', () async {
    final track = await sendAndRead<TrackEvent>(
      (events) => events.trackJsonKeyProbeDefault(
        TrackJsonKeyProbeDefault.fromMap({
          'order-id': 'hyphen',
          'order_id': 'snake',
          'OrderId': 'pascal',
          'orderId': 'camel',
        }),
      ),
    );
    final props = asMap(track.properties);
    expect(props['order-id'], 'hyphen');
    expect(props['order_id'], 'snake');
    expect(props['OrderId'], 'pascal');
    expect(props['orderId'], 'camel');
  });
}
