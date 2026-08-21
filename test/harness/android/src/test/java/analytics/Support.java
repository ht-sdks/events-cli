package analytics;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.fail;

import android.Manifest;
import android.app.Application;
import com.hightouch.analytics.Analytics;
import com.hightouch.analytics.ValueMap;
import com.hightouch.analytics.integrations.BasePayload;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;

final class Support {
    private Support() {}

    interface Run {
        void invoke(Analytics analytics, HtEvents events);
    }

    /**
     * Run {@code run} and wait until a payload of {@code type} is captured. Earlier events
     * (identify before alias, lifecycle) are skipped so CI cannot lose a race on a short drain.
     */
    static <T extends BasePayload> T sendAndRead(Class<T> type, Run run) throws Exception {
        BlockingQueue<BasePayload> queue = new LinkedBlockingQueue<>();
        String tag = UUID.randomUUID().toString();
        Application app = RuntimeEnvironment.getApplication();
        Shadows.shadowOf(app).grantPermissions(Manifest.permission.INTERNET);
        Analytics analytics =
                new Analytics.Builder(app, "wk-" + tag)
                        .tag(tag)
                        .collectDeviceId(false)
                        .experimentalUseNewLifecycleMethods(false)
                        .defaultProjectSettings(new ValueMap())
                        .flushInterval(365, TimeUnit.DAYS)
                        .useSourceMiddleware(
                                chain -> {
                                    queue.offer(chain.payload());
                                    chain.proceed(chain.payload());
                                })
                        .build();
        try {
            run.invoke(analytics, new HtEvents(analytics));
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (true) {
                long remaining = deadline - System.nanoTime();
                if (remaining <= 0) {
                    fail("expected " + type.getSimpleName() + " within 5s");
                }
                BasePayload payload = queue.poll(remaining, TimeUnit.NANOSECONDS);
                assertNotNull("expected " + type.getSimpleName(), payload);
                if (type.isInstance(payload)) {
                    return type.cast(payload);
                }
            }
        } finally {
            analytics.shutdown();
        }
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> asMap(Object value) {
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        throw new AssertionError("expected map, got " + (value == null ? "null" : value.getClass()));
    }

    static Double asDouble(Object value) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return null;
    }
}
