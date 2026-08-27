import 'package:hightouch_events/analytics.dart';
import 'package:hightouch_events/analytics_platform_interface.dart';
import 'package:hightouch_events/event.dart';
import 'package:hightouch_events/native_context.dart';
import 'package:hightouch_events/plugin.dart';
import 'package:hightouch_events/state.dart';
import 'package:hightouch_events/utils/store/store.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:analytics_harness/analytics/generated.dart';

class MemoryStore with Store {
  final Map<String, Map<String, dynamic>> _data;

  MemoryStore([Map<String, Map<String, dynamic>>? data]) : _data = data ?? {};

  @override
  Future<Map<String, dynamic>?> getPersisted(String key) async {
    final value = _data[key];
    return value == null ? null : Map<String, dynamic>.from(value);
  }

  @override
  Future<void> setPersisted(String key, Map<String, dynamic> value) async {
    _data[key] = Map<String, dynamic>.from(value);
  }

  @override
  Future<void> get ready => Future.value();

  @override
  void dispose() {}
}

class CapturePlugin extends PlatformPlugin {
  CapturePlugin() : super(PluginType.after);

  final List<RawEvent> events = [];

  @override
  Future<RawEvent?> execute(RawEvent event) async {
    events.add(event);
    return event;
  }
}

class TestPlatform extends AnalyticsPlatform {
  @override
  Future<NativeContext> getContext({bool collectDeviceId = false}) async {
    return NativeContext(
      app: NativeContextApp(),
      device: NativeContextDevice(),
      library: NativeContextLibrary(),
      network: NativeContextNetwork(),
      os: NativeContextOS(),
      screen: NativeContextScreen(),
    );
  }
}

Future<Analytics> createAnalytics(CapturePlugin output) async {
  AnalyticsPlatform.instance = TestPlatform();
  SharedPreferences.setMockInitialValues({});
  final analytics = Analytics(
    Configuration(
      'write-key',
      autoAddHightouchDestination: false,
      foregroundSessionTimeout: 0,
      backgroundSessionTimeout: 0,
      trackApplicationLifecycleEvents: false,
    ),
    MemoryStore(),
  );
  analytics.addPlugin(output);
  await analytics.state.ready;
  await Future<void>.delayed(Duration.zero);
  return analytics;
}

Future<T> sendAndRead<T extends RawEvent>(
  Future<void> Function(HtEvents events) run,
) async {
  final output = CapturePlugin();
  final analytics = await createAnalytics(output);
  try {
    await run(HtEvents(analytics));
    expectEvents(output.events, 1);
    return output.events.single as T;
  } finally {
    await analytics.cleanup();
  }
}

void expectEvents(List<RawEvent> events, int count) {
  if (events.length != count) {
    throw StateError('expected $count events, got ${events.length}');
  }
}

Map<String, dynamic> asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  throw StateError('expected a map, got ${value.runtimeType}');
}

String? schemaVersion(RawEvent event) {
  final protocols = event.context?.toJson()['protocols'];
  if (protocols is Map) {
    return protocols['schemaVersion'] as String?;
  }
  return null;
}
