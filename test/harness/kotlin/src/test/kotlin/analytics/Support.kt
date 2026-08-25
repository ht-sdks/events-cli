package analytics

import com.hightouch.analytics.kotlin.core.Analytics
import com.hightouch.analytics.kotlin.core.BaseEvent
import com.hightouch.analytics.kotlin.core.IdentifyEvent
import com.hightouch.analytics.kotlin.core.Settings
import com.hightouch.analytics.kotlin.core.TrackEvent
import com.hightouch.analytics.kotlin.core.platform.Plugin
import com.hightouch.analytics.kotlin.core.utilities.toContent
import kotlinx.serialization.json.JsonObject
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.fail

internal object Support {
    /**
     * Events sit in StartupQueue until settings fetch finishes. Use HTTP to a
     * closed localhost port (the SDK only skips TLS for `localhost`) and wait
     * for a warmup track so tests do not race the queue.
     */
    private fun awaitReady(analytics: Analytics) {
        val ready = CountDownLatch(1)
        val plugin =
            object : Plugin {
                override val type = Plugin.Type.After
                override lateinit var analytics: Analytics

                override fun execute(event: BaseEvent): BaseEvent {
                    if (event is TrackEvent && event.event == "__ht_harness_ready") {
                        ready.countDown()
                    }
                    return event
                }
            }
        analytics.add(plugin)
        try {
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
            while (ready.count > 0L) {
                val remaining = deadline - System.nanoTime()
                if (remaining <= 0L) {
                    fail("analytics never left StartupQueue")
                }
                analytics.track("__ht_harness_ready")
                ready.await(
                    remaining.coerceAtMost(TimeUnit.MILLISECONDS.toNanos(100)),
                    TimeUnit.NANOSECONDS,
                )
            }
        } finally {
            analytics.remove(plugin)
        }
    }

    inline fun <reified T : BaseEvent> sendAndRead(
        crossinline block: (Analytics, HtEvents) -> Unit,
    ): T {
        val queue = LinkedBlockingQueue<BaseEvent>()
        val tag = UUID.randomUUID().toString()
        val analytics =
            Analytics("wk-$tag") {
                application = "n/a"
                collectDeviceId = false
                autoAddSegmentDestination = false
                trackApplicationLifecycleEvents = false
                flushAt = Int.MAX_VALUE
                flushInterval = Int.MAX_VALUE
                apiHost = "localhost:1"
                cdnHost = "localhost:1"
                defaultSettings = Settings()
            }
        awaitReady(analytics)
        analytics.add(
            object : Plugin {
                override val type = Plugin.Type.After
                override lateinit var analytics: Analytics

                override fun execute(event: BaseEvent): BaseEvent {
                    queue.offer(event)
                    return event
                }
            },
        )
        block(analytics, HtEvents(analytics))
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (true) {
            val remaining = deadline - System.nanoTime()
            if (remaining <= 0L) {
                fail("expected ${T::class.simpleName} within 10s")
            }
            val payload = queue.poll(remaining, TimeUnit.NANOSECONDS) ?: continue
            if (payload is T) {
                return payload
            }
        }
    }

    fun identifyAndWait(analytics: Analytics, userId: String) {
        val done = CountDownLatch(1)
        val plugin =
            object : Plugin {
                override val type = Plugin.Type.After
                override lateinit var analytics: Analytics

                override fun execute(event: BaseEvent): BaseEvent {
                    if (event is IdentifyEvent && event.userId == userId) {
                        done.countDown()
                    }
                    return event
                }
            }
        analytics.add(plugin)
        try {
            analytics.identify(userId)
            if (!done.await(10, TimeUnit.SECONDS)) {
                fail("identify($userId) did not land")
            }
        } finally {
            analytics.remove(plugin)
        }
    }

    fun asMap(value: Any?): Map<String, Any?> {
        if (value is JsonObject) {
            return value.toContent()
        }
        if (value is Map<*, *>) {
            @Suppress("UNCHECKED_CAST")
            return value as Map<String, Any?>
        }
        throw AssertionError(
            "expected map, got ${value?.javaClass?.name ?: "null"}",
        )
    }

    fun asDouble(value: Any?): Double? {
        if (value is Number) {
            return value.toDouble()
        }
        return null
    }
}
