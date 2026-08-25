using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using Hightouch.Events;
using Hightouch.Events.Serialization;
using Hightouch.Events.Utilities;
using Xunit;

namespace Analytics
{
    internal sealed class CapturePlugin : Plugin
    {
        public override PluginType Type => PluginType.After;

        public ConcurrentQueue<RawEvent> Events { get; } = new ConcurrentQueue<RawEvent>();

        public override RawEvent Execute(RawEvent incomingEvent)
        {
            Events.Enqueue(incomingEvent);
            return incomingEvent;
        }
    }

    internal sealed class ReadyPlugin : Plugin
    {
        public override PluginType Type => PluginType.After;

        private readonly ManualResetEventSlim _ready;

        public ReadyPlugin(ManualResetEventSlim ready)
        {
            _ready = ready;
        }

        public override RawEvent Execute(RawEvent incomingEvent)
        {
            if (incomingEvent is TrackEvent track && track.Event == "__ht_harness_ready")
            {
                _ready.Set();
            }
            return incomingEvent;
        }
    }

    internal static class Support
    {
        public static T SendAndRead<T>(Action<global::Hightouch.Events.Analytics, HtEvents> run)
            where T : RawEvent
        {
            var analytics = NewAnalytics();
            AwaitReady(analytics);
            var capture = new CapturePlugin();
            analytics.Add(capture);
            run(analytics, new HtEvents(analytics));
            var deadline = DateTime.UtcNow.AddSeconds(10);
            while (DateTime.UtcNow < deadline)
            {
                if (capture.Events.TryDequeue(out var payload) && payload is T typed)
                {
                    if (typed is TrackEvent leftover && leftover.Event == "__ht_harness_ready")
                    {
                        continue;
                    }
                    return typed;
                }
                Thread.Sleep(20);
            }
            throw new Xunit.Sdk.XunitException($"expected {typeof(T).Name} within 10s");
        }

        public static void IdentifyAndWait(global::Hightouch.Events.Analytics analytics, string userId)
        {
            var done = new ManualResetEventSlim(false);
            var plugin = new IdentifyWaitPlugin(userId, done);
            analytics.Add(plugin);
            try
            {
                analytics.Identify(userId);
                if (!done.Wait(TimeSpan.FromSeconds(10)))
                {
                    throw new Xunit.Sdk.XunitException($"identify({userId}) did not land");
                }
            }
            finally
            {
                analytics.Remove(plugin);
            }
        }

        public static Dictionary<string, object> AsMap(JsonObject obj)
        {
            var result = new Dictionary<string, object>();
            if (obj == null)
            {
                return result;
            }
            foreach (var entry in obj)
            {
                result[entry.Key] = Unwrap(entry.Value);
            }
            return result;
        }

        public static string AsString(object value)
        {
            return value == null ? null : Convert.ToString(value);
        }

        private static global::Hightouch.Events.Analytics NewAnalytics()
        {
            return new global::Hightouch.Events.Analytics(
                new Configuration(
                    Guid.NewGuid().ToString(),
                    flushAt: int.MaxValue,
                    flushInterval: int.MaxValue,
                    autoAddHightouchDestination: false,
                    useSynchronizeDispatcher: true,
                    apiHost: "http://127.0.0.1:1",
                    cdnHost: "http://127.0.0.1:1",
                    storageProvider: new InMemoryStorageProvider()
                )
            );
        }

        private static void AwaitReady(global::Hightouch.Events.Analytics analytics)
        {
            var ready = new ManualResetEventSlim(false);
            var plugin = new ReadyPlugin(ready);
            analytics.Add(plugin);
            try
            {
                var deadline = DateTime.UtcNow.AddSeconds(10);
                while (!ready.IsSet)
                {
                    if (DateTime.UtcNow > deadline)
                    {
                        throw new Xunit.Sdk.XunitException("analytics never left StartupQueue");
                    }
                    analytics.Track("__ht_harness_ready");
                    ready.Wait(TimeSpan.FromMilliseconds(100));
                }
            }
            finally
            {
                analytics.Remove(plugin);
            }
        }

        private static object Unwrap(JsonElement element)
        {
            if (element is JsonObject obj)
            {
                return AsMap(obj);
            }
            if (element is JsonPrimitive primitive)
            {
                if (primitive.IsString)
                {
                    return primitive.Content;
                }
                if (primitive.Content == "true")
                {
                    return true;
                }
                if (primitive.Content == "false")
                {
                    return false;
                }
                if (double.TryParse(primitive.Content, out var number))
                {
                    return number;
                }
                return primitive.Content;
            }
            return element == null ? null : element.ToString();
        }
    }

    internal sealed class IdentifyWaitPlugin : Plugin
    {
        public override PluginType Type => PluginType.After;

        private readonly string _userId;
        private readonly ManualResetEventSlim _done;

        public IdentifyWaitPlugin(string userId, ManualResetEventSlim done)
        {
            _userId = userId;
            _done = done;
        }

        public override RawEvent Execute(RawEvent incomingEvent)
        {
            if (incomingEvent is IdentifyEvent identify && identify.UserId == _userId)
            {
                _done.Set();
            }
            return incomingEvent;
        }
    }
}
