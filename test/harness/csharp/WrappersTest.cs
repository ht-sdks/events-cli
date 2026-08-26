using Hightouch.Events;
using Xunit;
using static Analytics.Support;

namespace Analytics
{
    public class WrappersTest
    {
        [Fact]
        public void TrackOrderCompletedEnqueues()
        {
            var track = SendAndRead<TrackEvent>((_, events) =>
            {
                events.TrackOrderCompleted(new TrackOrderCompletedV2 { orderId = "ord_1", total = 2.0 });
            });
            Assert.Equal("track", track.Type);
            Assert.Equal("Order Completed", track.Event);
            var props = AsMap(track.Properties);
            Assert.Equal("ord_1", AsString(props["orderId"]));
        }

        [Fact]
        public void LatestAliasMatchesVersionedWrapper()
        {
            var versioned = SendAndRead<TrackEvent>((_, events) =>
            {
                events.TrackOrderCompletedV2(new TrackOrderCompletedV2 { orderId = "1" });
            });
            var aliased = SendAndRead<TrackEvent>((_, events) =>
            {
                events.TrackOrderCompleted(new TrackOrderCompletedV2 { orderId = "1" });
            });
            Assert.Equal(versioned.Event, aliased.Event);
        }

        [Fact]
        public void TrackInjectsContextSchemaVersion()
        {
            var track = SendAndRead<TrackEvent>((_, events) =>
            {
                events.TrackSignedUp(new TrackSignedUpDefault { plan = "pro" });
            });
            var ctx = AsMap(track.Context);
            var protocols = Assert.IsType<System.Collections.Generic.Dictionary<string, object>>(ctx["protocols"]);
            Assert.Equal("default", AsString(protocols["schemaVersion"]));
            var props = AsMap(track.Properties);
            Assert.False(props.ContainsKey("apiVersion"));
        }

        [Fact]
        public void TrackInjectsPropertiesSchemaVersion()
        {
            var track = SendAndRead<TrackEvent>((_, events) =>
            {
                events.TrackOrderCompletedPropsV1(new TrackOrderCompletedPropsV1 { orderId = "1" });
            });
            var props = AsMap(track.Properties);
            Assert.Equal("1", AsString(props["orderId"]));
            Assert.Equal("v1", AsString(props["apiVersion"]));
        }

        [Fact]
        public void IdentifyEnqueuesTraits()
        {
            var identify = SendAndRead<IdentifyEvent>((_, events) =>
            {
                events.IdentifyDefault("user_1", new IdentifyDefault { email = "a@b.c" });
            });
            Assert.Equal("identify", identify.Type);
            Assert.Equal("user_1", identify.UserId);
            Assert.Equal("a@b.c", AsString(AsMap(identify.Traits)["email"]));
        }

        [Fact]
        public void IdentifyAcceptsTraitsWithoutUserId()
        {
            var identify = SendAndRead<IdentifyEvent>((_, events) =>
            {
                events.IdentifyDefault(new IdentifyDefault { email = "a@b.c" });
            });
            Assert.Equal("identify", identify.Type);
            Assert.Equal("a@b.c", AsString(AsMap(identify.Traits)["email"]));
        }

        [Fact]
        public void IdentifyInjectsTraitsSchemaVersion()
        {
            var identify = SendAndRead<IdentifyEvent>((_, events) =>
            {
                events.IdentifyTraitsV1("user_1", new IdentifyTraitsV1 { email = "a@b.c" });
            });
            Assert.Equal("v1", AsString(AsMap(identify.Traits)["apiVersion"]));
        }

        [Fact]
        public void IdentifyDoesNotInjectPropertiesPath()
        {
            var identify = SendAndRead<IdentifyEvent>((_, events) =>
            {
                events.IdentifyWrongEnvelopeV1("user_1", new IdentifyWrongEnvelopeV1 { email = "a@b.c" });
            });
            Assert.False(AsMap(identify.Traits).ContainsKey("apiVersion"));
        }

        [Fact]
        public void TrackDoesNotInjectTraitsPath()
        {
            var track = SendAndRead<TrackEvent>((_, events) =>
            {
                events.TrackWrongEnvelopeV1(new TrackWrongEnvelopeV1 { orderId = "1" });
            });
            Assert.False(AsMap(track.Properties).ContainsKey("apiVersion"));
        }

        [Fact]
        public void GroupEnqueuesTraits()
        {
            var group = SendAndRead<GroupEvent>((_, events) =>
            {
                events.GroupDefault("grp_1", new GroupDefault { name = "Acme" });
            });
            Assert.Equal("group", group.Type);
            Assert.Equal("grp_1", group.GroupId);
            Assert.Equal("Acme", AsString(AsMap(group.Traits)["name"]));
        }

        [Fact]
        public void PageAndScreenPostNames()
        {
            var page = SendAndRead<PageEvent>((_, events) =>
            {
                events.PageHome(new PageHomeDefault { path = "/" });
            });
            Assert.Equal("page", page.Type);
            Assert.Equal("Home", page.Name);
            var screen = SendAndRead<ScreenEvent>((_, events) =>
            {
                events.ScreenHome(new ScreenHomeDefault { path = "/" });
            });
            Assert.Equal("screen", screen.Type);
            Assert.Equal("Home", screen.Name);
        }

        [Fact]
        public void AliasPostsWithoutProperties()
        {
            var alias = SendAndRead<AliasEvent>((analytics, events) =>
            {
                IdentifyAndWait(analytics, "user_old");
                events.AliasDefault("user_new");
            });
            Assert.Equal("alias", alias.Type);
            Assert.Equal("user_new", alias.UserId);
            Assert.Equal("user_old", alias.PreviousId);
        }

        [Fact]
        public void AliasInjectsContextSchemaVersion()
        {
            var alias = SendAndRead<AliasEvent>((analytics, events) =>
            {
                IdentifyAndWait(analytics, "user_old");
                events.AliasContextV1("user_new");
            });
            var protocols = Assert.IsType<System.Collections.Generic.Dictionary<string, object>>(
                AsMap(alias.Context)["protocols"]);
            Assert.Equal("v1", AsString(protocols["schemaVersion"]));
        }

        [Fact]
        public void AliasDoesNotInjectPropertiesPath()
        {
            var alias = SendAndRead<AliasEvent>((analytics, events) =>
            {
                IdentifyAndWait(analytics, "user_old");
                events.AliasPropsV1("user_new");
            });
            Assert.Equal("alias", alias.Type);
            Assert.Equal("user_new", alias.UserId);
        }

        [Fact]
        public void CartViewedPreservesJsonKeys()
        {
            var track = SendAndRead<TrackEvent>((_, events) =>
            {
                events.TrackCartViewedDefault(new TrackCartViewedDefault
                {
                    amount = 10,
                    currency = "USD",
                    itemCount = 3,
                });
            });
            var props = AsMap(track.Properties);
            Assert.Equal(3.0, Assert.IsType<double>(props["itemCount"]));
        }

        [Fact]
        public void JsonKeyProbeRoundTripsLegalKeys()
        {
            var track = SendAndRead<TrackEvent>((_, events) =>
            {
                events.TrackJsonKeyProbeDefault(new TrackJsonKeyProbeDefault
                {
                    orderid = "hyphen",
                    order_id = "snake",
                    OrderId = "pascal",
                    orderId = "camel",
                });
            });
            var props = AsMap(track.Properties);
            Assert.Equal("hyphen", AsString(props["order-id"]));
            Assert.Equal("snake", AsString(props["order_id"]));
            Assert.Equal("pascal", AsString(props["OrderId"]));
            Assert.Equal("camel", AsString(props["orderId"]));
        }
    }
}
