package analytics;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.hightouch.analytics.messages.AliasMessage;
import com.hightouch.analytics.messages.GroupMessage;
import com.hightouch.analytics.messages.IdentifyMessage;
import com.hightouch.analytics.messages.Message;
import com.hightouch.analytics.messages.PageMessage;
import com.hightouch.analytics.messages.ScreenMessage;
import com.hightouch.analytics.messages.TrackMessage;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.Test;

public class WrappersTest {
  @Test
  public void trackOrderCompletedEnqueues() {
    HtEvents.TrackOrderCompletedV2 properties = new HtEvents.TrackOrderCompletedV2();
    properties.setOrderId("ord_1");
    properties.setTotal(2.0);

    TrackMessage track =
        Support.sendAndRead(
            TrackMessage.class,
            (analytics, events) -> events.trackOrderCompleted("user_1", properties));

    assertEquals(Message.Type.track, track.type());
    assertEquals("Order Completed", track.event());
    assertEquals("user_1", track.userId());
    Map<String, Object> props = Support.asMap(track.properties());
    assertEquals("ord_1", props.get("orderId"));
    assertEquals(2.0, Support.asDouble(props.get("total")), 0.0);
  }

  @Test
  public void latestAliasMatchesVersionedWrapper() {
    HtEvents.TrackOrderCompletedV2 versionedProps = new HtEvents.TrackOrderCompletedV2();
    versionedProps.setOrderId("1");
    TrackMessage versioned =
        Support.sendAndRead(
            TrackMessage.class,
            (analytics, events) -> events.trackOrderCompletedV2("user_1", versionedProps));

    HtEvents.TrackOrderCompletedV2 aliasedProps = new HtEvents.TrackOrderCompletedV2();
    aliasedProps.setOrderId("1");
    TrackMessage aliased =
        Support.sendAndRead(
            TrackMessage.class,
            (analytics, events) -> events.trackOrderCompleted("user_1", aliasedProps));

    assertEquals(versioned.event(), aliased.event());
  }

  @Test
  public void trackInjectsContextSchemaVersion() {
    HtEvents.TrackSignedUpDefault properties = new HtEvents.TrackSignedUpDefault();
    properties.setPlan("pro");
    Map<String, Object> context = new LinkedHashMap<>();
    context.put("locale", "en-US");

    TrackMessage track =
        Support.sendAndRead(
            TrackMessage.class,
            (analytics, events) -> events.trackSignedUp("user_1", properties, context));

    Map<String, Object> ctx = Support.asMap(track.context());
    assertEquals("en-US", ctx.get("locale"));
    Map<String, Object> protocols = Support.asMap(ctx.get("protocols"));
    assertEquals("default", protocols.get("schemaVersion"));
  }

  @Test
  public void trackInjectsPropertiesSchemaVersion() {
    HtEvents.TrackOrderCompletedPropsV1 properties = new HtEvents.TrackOrderCompletedPropsV1();
    properties.setOrderId("1");

    TrackMessage track =
        Support.sendAndRead(
            TrackMessage.class,
            (analytics, events) -> events.trackOrderCompletedPropsV1("user_1", properties));

    Map<String, Object> props = Support.asMap(track.properties());
    assertEquals("1", String.valueOf(props.get("orderId")));
    assertEquals("v1", String.valueOf(props.get("apiVersion")));
  }

  @Test
  public void identifyEnqueuesTraits() {
    HtEvents.IdentifyDefault traits = new HtEvents.IdentifyDefault();
    traits.setEmail("a@b.c");

    IdentifyMessage identify =
        Support.sendAndRead(
            IdentifyMessage.class,
            (analytics, events) -> events.identifyDefault("user_1", traits));

    assertEquals(Message.Type.identify, identify.type());
    assertEquals("user_1", identify.userId());
    Map<String, Object> body = Support.asMap(identify.traits());
    assertEquals("a@b.c", body.get("email"));
  }

  @Test
  public void identifyInjectsTraitsSchemaVersion() {
    HtEvents.IdentifyTraitsV1 traits = new HtEvents.IdentifyTraitsV1();
    traits.setEmail("a@b.c");

    IdentifyMessage identify =
        Support.sendAndRead(
            IdentifyMessage.class,
            (analytics, events) -> events.identifyTraitsV1("user_1", traits));

    Map<String, Object> body = Support.asMap(identify.traits());
    assertEquals("v1", body.get("apiVersion"));
  }

  @Test
  public void identifyDoesNotInjectPropertiesPath() {
    HtEvents.IdentifyWrongEnvelopeV1 traits = new HtEvents.IdentifyWrongEnvelopeV1();
    traits.setEmail("a@b.c");

    IdentifyMessage identify =
        Support.sendAndRead(
            IdentifyMessage.class,
            (analytics, events) -> events.identifyWrongEnvelopeV1("user_1", traits));

    Map<String, Object> body = Support.asMap(identify.traits());
    assertNull(body.get("apiVersion"));
  }

  @Test
  public void trackDoesNotInjectTraitsPath() {
    HtEvents.TrackWrongEnvelopeV1 properties = new HtEvents.TrackWrongEnvelopeV1();
    properties.setOrderId("1");

    TrackMessage track =
        Support.sendAndRead(
            TrackMessage.class,
            (analytics, events) -> events.trackWrongEnvelopeV1("user_1", properties));

    Map<String, Object> props = Support.asMap(track.properties());
    assertNull(props.get("apiVersion"));
  }

  @Test
  public void groupEnqueues() {
    HtEvents.GroupDefault traits = new HtEvents.GroupDefault();
    traits.setName("Acme");

    GroupMessage group =
        Support.sendAndRead(
            GroupMessage.class,
            (analytics, events) -> events.groupDefault("grp_1", "user_1", traits));

    assertEquals(Message.Type.group, group.type());
    assertEquals("grp_1", group.groupId());
    assertEquals("user_1", group.userId());
    Map<String, Object> body = Support.asMap(group.traits());
    assertEquals("Acme", body.get("name"));
  }

  @Test
  public void pageAndScreenEnqueue() {
    HtEvents.PageHomeDefault pageProps = new HtEvents.PageHomeDefault();
    pageProps.setPath("/");
    PageMessage page =
        Support.sendAndRead(
            PageMessage.class, (analytics, events) -> events.pageHome("user_1", pageProps));
    assertEquals(Message.Type.page, page.type());
    assertEquals("Home", page.name());

    HtEvents.ScreenHomeDefault screenProps = new HtEvents.ScreenHomeDefault();
    screenProps.setPath("/");
    ScreenMessage screen =
        Support.sendAndRead(
            ScreenMessage.class, (analytics, events) -> events.screenHome("user_1", screenProps));
    assertEquals(Message.Type.screen, screen.type());
    assertEquals("Home", screen.name());
  }

  @Test
  public void aliasEnqueuesWithoutProperties() {
    AliasMessage alias =
        Support.sendAndRead(
            AliasMessage.class,
            (analytics, events) -> events.aliasDefault("user_new", "user_old"));
    assertEquals(Message.Type.alias, alias.type());
    assertEquals("user_new", alias.userId());
    assertEquals("user_old", alias.previousId());
  }

  @Test
  public void aliasInjectsContextSchemaVersion() {
    Map<String, Object> context = new LinkedHashMap<>();
    context.put("locale", "en-US");
    AliasMessage alias =
        Support.sendAndRead(
            AliasMessage.class,
            (analytics, events) -> events.aliasContextV1("user_new", "user_old", context));
    assertEquals(Message.Type.alias, alias.type());
    Map<String, Object> ctx = Support.asMap(alias.context());
    Map<String, Object> protocols = Support.asMap(ctx.get("protocols"));
    assertEquals("v1", protocols.get("schemaVersion"));
  }

  @Test
  public void aliasDoesNotInjectPropertiesPath() {
    AliasMessage alias =
        Support.sendAndRead(
            AliasMessage.class,
            (analytics, events) -> events.aliasPropsV1("user_new", "user_old"));
    assertEquals(Message.Type.alias, alias.type());
    assertEquals("user_new", alias.userId());
    assertEquals("user_old", alias.previousId());
  }

  @Test
  public void cartViewedPreservesJSONKeys() {
    HtEvents.TrackCartViewedDefault properties = new HtEvents.TrackCartViewedDefault();
    properties.setAmount(10.0);
    properties.setCurrency("USD");
    properties.setItemCount(3.0);

    TrackMessage track =
        Support.sendAndRead(
            TrackMessage.class,
            (analytics, events) -> events.trackCartViewedDefault("user_1", properties));

    Map<String, Object> props = Support.asMap(track.properties());
    assertEquals(3.0, Support.asDouble(props.get("itemCount")), 0.0);
  }
}
