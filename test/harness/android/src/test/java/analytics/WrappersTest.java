package analytics;

import static analytics.Support.asDouble;
import static analytics.Support.asMap;
import static analytics.Support.sendAndRead;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.hightouch.analytics.Options;
import com.hightouch.analytics.integrations.AliasPayload;
import com.hightouch.analytics.integrations.GroupPayload;
import com.hightouch.analytics.integrations.IdentifyPayload;
import com.hightouch.analytics.integrations.ScreenPayload;
import com.hightouch.analytics.integrations.TrackPayload;
import java.util.Map;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 28)
public class WrappersTest {

    @Test
    public void trackOrderCompletedEnqueues() throws Exception {
        HtEvents.TrackOrderCompletedV2 properties = new HtEvents.TrackOrderCompletedV2();
        properties.setOrderId("ord_1");
        properties.setTotal(2.0);
        TrackPayload track =
                sendAndRead(
                        TrackPayload.class,
                        (analytics, events) -> events.trackOrderCompleted(properties));
        assertEquals("track", track.type().toString());
        assertEquals("Order Completed", track.event());
        Map<String, Object> props = asMap(track.properties());
        assertEquals("ord_1", props.get("orderId"));
        assertEquals(Double.valueOf(2.0), asDouble(props.get("total")));
    }

    @Test
    public void latestAliasMatchesVersionedWrapper() throws Exception {
        HtEvents.TrackOrderCompletedV2 versionedProps = new HtEvents.TrackOrderCompletedV2();
        versionedProps.setOrderId("1");
        TrackPayload versioned =
                sendAndRead(
                        TrackPayload.class,
                        (analytics, events) -> events.trackOrderCompletedV2(versionedProps));
        HtEvents.TrackOrderCompletedV2 aliasedProps = new HtEvents.TrackOrderCompletedV2();
        aliasedProps.setOrderId("1");
        TrackPayload aliased =
                sendAndRead(
                        TrackPayload.class,
                        (analytics, events) -> events.trackOrderCompleted(aliasedProps));
        assertEquals(versioned.event(), aliased.event());
    }

    @Test
    public void trackInjectsContextSchemaVersion() throws Exception {
        HtEvents.TrackSignedUpDefault properties = new HtEvents.TrackSignedUpDefault();
        properties.setPlan("pro");
        Options options = new Options().putContext("locale", "en-US");
        TrackPayload track =
                sendAndRead(
                        TrackPayload.class,
                        (analytics, events) -> events.trackSignedUp(properties, options));
        Map<String, Object> ctx = asMap(track.context());
        assertEquals("en-US", ctx.get("locale"));
        Map<String, Object> protocols = asMap(ctx.get("protocols"));
        assertEquals("default", protocols.get("schemaVersion"));
    }

    @Test
    public void trackInjectsPropertiesSchemaVersion() throws Exception {
        HtEvents.TrackOrderCompletedPropsV1 properties = new HtEvents.TrackOrderCompletedPropsV1();
        properties.setOrderId("1");
        TrackPayload track =
                sendAndRead(
                        TrackPayload.class,
                        (analytics, events) -> events.trackOrderCompletedPropsV1(properties));
        Map<String, Object> props = asMap(track.properties());
        assertEquals("1", props.get("orderId"));
        assertEquals("v1", props.get("apiVersion"));
    }

    @Test
    public void identifyEnqueuesTraits() throws Exception {
        HtEvents.IdentifyDefault traits = new HtEvents.IdentifyDefault();
        traits.setEmail("a@b.c");
        IdentifyPayload identify =
                sendAndRead(
                        IdentifyPayload.class,
                        (analytics, events) -> events.identifyDefault("user_1", traits));
        assertEquals("identify", identify.type().toString());
        assertEquals("user_1", identify.userId());
        Map<String, Object> body = asMap(identify.traits());
        assertEquals("a@b.c", body.get("email"));
    }

    @Test
    public void identifyInjectsTraitsSchemaVersion() throws Exception {
        HtEvents.IdentifyTraitsV1 traits = new HtEvents.IdentifyTraitsV1();
        traits.setEmail("a@b.c");
        IdentifyPayload identify =
                sendAndRead(
                        IdentifyPayload.class,
                        (analytics, events) -> events.identifyTraitsV1("user_1", traits));
        Map<String, Object> body = asMap(identify.traits());
        assertEquals("v1", body.get("apiVersion"));
    }

    @Test
    public void identifyDoesNotInjectPropertiesPath() throws Exception {
        HtEvents.IdentifyWrongEnvelopeV1 traits = new HtEvents.IdentifyWrongEnvelopeV1();
        traits.setEmail("a@b.c");
        IdentifyPayload identify =
                sendAndRead(
                        IdentifyPayload.class,
                        (analytics, events) -> events.identifyWrongEnvelopeV1("user_1", traits));
        Map<String, Object> body = asMap(identify.traits());
        assertNull(body.get("apiVersion"));
    }

    @Test
    public void trackDoesNotInjectTraitsPath() throws Exception {
        HtEvents.TrackWrongEnvelopeV1 properties = new HtEvents.TrackWrongEnvelopeV1();
        properties.setOrderId("1");
        TrackPayload track =
                sendAndRead(
                        TrackPayload.class,
                        (analytics, events) -> events.trackWrongEnvelopeV1(properties));
        Map<String, Object> props = asMap(track.properties());
        assertNull(props.get("apiVersion"));
    }

    @Test
    public void groupEnqueues() throws Exception {
        HtEvents.GroupDefault traits = new HtEvents.GroupDefault();
        traits.setName("Acme");
        GroupPayload group =
                sendAndRead(
                        GroupPayload.class,
                        (analytics, events) -> events.groupDefault("grp_1", traits));
        assertEquals("group", group.type().toString());
        assertEquals("grp_1", group.groupId());
        Map<String, Object> body = asMap(group.traits());
        assertEquals("Acme", body.get("name"));
    }

    @Test
    public void pageAndScreenEnqueue() throws Exception {
        HtEvents.PageHomeDefault pageProps = new HtEvents.PageHomeDefault();
        pageProps.setPath("/");
        ScreenPayload page =
                sendAndRead(ScreenPayload.class, (analytics, events) -> events.pageHome(pageProps));
        assertEquals("screen", page.type().toString());
        assertEquals("Home", page.name());

        HtEvents.ScreenHomeDefault screenProps = new HtEvents.ScreenHomeDefault();
        screenProps.setPath("/");
        ScreenPayload screen =
                sendAndRead(
                        ScreenPayload.class, (analytics, events) -> events.screenHome(screenProps));
        assertEquals("screen", screen.type().toString());
        assertEquals("Home", screen.name());
    }

    @Test
    public void aliasEnqueuesWithoutProperties() throws Exception {
        AliasPayload alias =
                sendAndRead(
                        AliasPayload.class,
                        (analytics, events) -> {
                            analytics.identify("user_old");
                            events.aliasDefault("user_new");
                        });
        assertEquals("alias", alias.type().toString());
        assertEquals("user_new", alias.userId());
        assertEquals("user_old", alias.previousId());
        assertNull(alias.get("properties"));
    }

    @Test
    public void aliasInjectsContextSchemaVersion() throws Exception {
        Options options = new Options().putContext("locale", "en-US");
        AliasPayload alias =
                sendAndRead(
                        AliasPayload.class,
                        (analytics, events) -> {
                            analytics.identify("user_old");
                            events.aliasContextV1("user_new", options);
                        });
        assertEquals("alias", alias.type().toString());
        Map<String, Object> ctx = asMap(alias.context());
        Map<String, Object> protocols = asMap(ctx.get("protocols"));
        assertEquals("v1", protocols.get("schemaVersion"));
    }

    @Test
    public void aliasDoesNotInjectPropertiesPath() throws Exception {
        AliasPayload alias =
                sendAndRead(
                        AliasPayload.class,
                        (analytics, events) -> {
                            analytics.identify("user_old");
                            events.aliasPropsV1("user_new");
                        });
        assertEquals("alias", alias.type().toString());
        assertEquals("user_new", alias.userId());
        assertNull(alias.get("properties"));
    }

    @Test
    public void cartViewedPreservesJSONKeys() throws Exception {
        HtEvents.TrackCartViewedDefault properties = new HtEvents.TrackCartViewedDefault();
        properties.setAmount(10.0);
        properties.setCurrency("USD");
        properties.setItemCount(3.0);
        TrackPayload track =
                sendAndRead(
                        TrackPayload.class,
                        (analytics, events) -> events.trackCartViewedDefault(properties));
        Map<String, Object> props = asMap(track.properties());
        assertEquals(Double.valueOf(3.0), asDouble(props.get("itemCount")));
    }
}
