package analytics

import analytics.Support.asDouble
import analytics.Support.asMap
import analytics.Support.sendAndRead
import com.hightouch.analytics.kotlin.core.AliasEvent
import com.hightouch.analytics.kotlin.core.EventType
import com.hightouch.analytics.kotlin.core.GroupEvent
import com.hightouch.analytics.kotlin.core.IdentifyEvent
import com.hightouch.analytics.kotlin.core.ScreenEvent
import com.hightouch.analytics.kotlin.core.TrackEvent
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class WrappersTest {
    @Test
    fun trackOrderCompletedEnqueues() {
        val track =
            sendAndRead<TrackEvent> { _, events ->
                events.trackOrderCompleted(
                    HtEvents.TrackOrderCompletedV2(orderId = "ord_1", total = 2.0),
                )
            }
        assertEquals(EventType.Track, track.type)
        assertEquals("Order Completed", track.event)
        val props = asMap(track.properties)
        assertEquals("ord_1", props["orderId"])
        assertEquals(2.0, asDouble(props["total"]))
    }

    @Test
    fun latestAliasMatchesVersionedWrapper() {
        val versioned =
            sendAndRead<TrackEvent> { _, events ->
                events.trackOrderCompletedV2(HtEvents.TrackOrderCompletedV2(orderId = "1"))
            }
        val aliased =
            sendAndRead<TrackEvent> { _, events ->
                events.trackOrderCompleted(HtEvents.TrackOrderCompletedV2(orderId = "1"))
            }
        assertEquals(versioned.event, aliased.event)
    }

    @Test
    fun trackInjectsContextSchemaVersion() {
        val track =
            sendAndRead<TrackEvent> { _, events ->
                events.trackSignedUp(
                    HtEvents.TrackSignedUpDefault(plan = "pro"),
                    mapOf("locale" to "en-US"),
                )
            }
        val ctx = asMap(track.context)
        assertEquals("en-US", ctx["locale"])
        val protocols = asMap(ctx["protocols"])
        assertEquals("default", protocols["schemaVersion"])
    }

    @Test
    fun trackInjectsPropertiesSchemaVersion() {
        val track =
            sendAndRead<TrackEvent> { _, events ->
                events.trackOrderCompletedPropsV1(
                    HtEvents.TrackOrderCompletedPropsV1(orderId = "1"),
                )
            }
        val props = asMap(track.properties)
        assertEquals("1", props["orderId"].toString())
        assertEquals("v1", props["apiVersion"].toString())
    }

    @Test
    fun identifyEnqueuesTraits() {
        val identify =
            sendAndRead<IdentifyEvent> { _, events ->
                events.identifyDefault(
                    "user_1",
                    HtEvents.IdentifyDefault(email = "a@b.c"),
                )
            }
        assertEquals(EventType.Identify, identify.type)
        assertEquals("user_1", identify.userId)
        val body = asMap(identify.traits)
        assertEquals("a@b.c", body["email"])
    }

    @Test
    fun identifyInjectsTraitsSchemaVersion() {
        val identify =
            sendAndRead<IdentifyEvent> { _, events ->
                events.identifyTraitsV1(
                    "user_1",
                    HtEvents.IdentifyTraitsV1(email = "a@b.c"),
                )
            }
        val body = asMap(identify.traits)
        assertEquals("v1", body["apiVersion"])
    }

    @Test
    fun identifyDoesNotInjectPropertiesPath() {
        val identify =
            sendAndRead<IdentifyEvent> { _, events ->
                events.identifyWrongEnvelopeV1(
                    "user_1",
                    HtEvents.IdentifyWrongEnvelopeV1(email = "a@b.c"),
                )
            }
        val body = asMap(identify.traits)
        assertNull(body["apiVersion"])
    }

    @Test
    fun trackDoesNotInjectTraitsPath() {
        val track =
            sendAndRead<TrackEvent> { _, events ->
                events.trackWrongEnvelopeV1(
                    HtEvents.TrackWrongEnvelopeV1(orderId = "1"),
                )
            }
        val props = asMap(track.properties)
        assertNull(props["apiVersion"])
    }

    @Test
    fun groupEnqueues() {
        val group =
            sendAndRead<GroupEvent> { _, events ->
                events.groupDefault("grp_1", HtEvents.GroupDefault(name = "Acme"))
            }
        assertEquals(EventType.Group, group.type)
        assertEquals("grp_1", group.groupId)
        val body = asMap(group.traits)
        assertEquals("Acme", body["name"])
    }

    @Test
    fun pageAndScreenEnqueue() {
        val page =
            sendAndRead<ScreenEvent> { _, events ->
                events.pageHome(HtEvents.PageHomeDefault(path = "/"))
            }
        assertEquals(EventType.Screen, page.type)
        assertEquals("Home", page.name)

        val screen =
            sendAndRead<ScreenEvent> { _, events ->
                events.screenHome(HtEvents.ScreenHomeDefault(path = "/"))
            }
        assertEquals(EventType.Screen, screen.type)
        assertEquals("Home", screen.name)
    }

    @Test
    fun aliasEnqueuesWithoutProperties() {
        val alias =
            sendAndRead<AliasEvent> { analytics, events ->
                Support.identifyAndWait(analytics, "user_old")
                events.aliasDefault("user_new")
            }
        assertEquals(EventType.Alias, alias.type)
        assertEquals("user_new", alias.userId)
        assertEquals("user_old", alias.previousId)
    }

    @Test
    fun aliasInjectsContextSchemaVersion() {
        val alias =
            sendAndRead<AliasEvent> { analytics, events ->
                Support.identifyAndWait(analytics, "user_old")
                events.aliasContextV1("user_new", mapOf("locale" to "en-US"))
            }
        assertEquals(EventType.Alias, alias.type)
        val ctx = asMap(alias.context)
        val protocols = asMap(ctx["protocols"])
        assertEquals("v1", protocols["schemaVersion"])
    }

    @Test
    fun aliasDoesNotInjectPropertiesPath() {
        val alias =
            sendAndRead<AliasEvent> { analytics, events ->
                Support.identifyAndWait(analytics, "user_old")
                events.aliasPropsV1("user_new")
            }
        assertEquals(EventType.Alias, alias.type)
        assertEquals("user_new", alias.userId)
    }

    @Test
    fun cartViewedPreservesJSONKeys() {
        val track =
            sendAndRead<TrackEvent> { _, events ->
                events.trackCartViewedDefault(
                    HtEvents.TrackCartViewedDefault(
                        amount = 10.0,
                        currency = "USD",
                        itemCount = 3.0,
                    ),
                )
            }
        val props = asMap(track.properties)
        assertEquals(3.0, asDouble(props["itemCount"]))
    }

    @Test
    fun jsonKeySpellingsArePreservedOnTheWire() {
        val track =
            sendAndRead<TrackEvent> { _, events ->
                events.trackJsonKeyProbeDefault(
                    HtEvents.TrackJsonKeyProbeDefault(
                        orderid = "hyphen",
                        trackJsonKeyProbeDefaultOrderid = "snake",
                        orderId = "pascal",
                        trackJsonKeyProbeDefaultOrderId = "camel",
                    ),
                )
            }
        val props = asMap(track.properties)
        assertEquals("hyphen", props["order-id"])
        assertEquals("snake", props["order_id"])
        assertEquals("pascal", props["OrderId"])
        assertEquals("camel", props["orderId"])
    }
}
