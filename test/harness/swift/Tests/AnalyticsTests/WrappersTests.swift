import Analytics
import Hightouch
import XCTest

final class WrappersTests: XCTestCase {
    func testTrackOrderCompletedEnqueues() {
        let event = sendAndRead { analytics in
            analytics.trackOrderCompleted(TrackOrderCompletedV2(orderID: "ord_1", total: 2))
        }
        let track = event as! TrackEvent
        XCTAssertEqual(track.type, "track")
        XCTAssertEqual(track.event, "Order Completed")
        let props = asMap(track.properties)
        XCTAssertEqual(props["orderId"] as? String, "ord_1")
        XCTAssertEqual(asDouble(props["total"]), 2)
    }

    func testLatestAliasMatchesVersionedWrapper() {
        let versioned = sendAndRead { analytics in
            analytics.trackOrderCompletedV2(TrackOrderCompletedV2(orderID: "1", total: nil))
        } as! TrackEvent
        let aliased = sendAndRead { analytics in
            analytics.trackOrderCompleted(TrackOrderCompletedV2(orderID: "1", total: nil))
        } as! TrackEvent
        XCTAssertEqual(versioned.event, aliased.event)
    }

    func testTrackInjectsContextSchemaVersion() {
        let event = sendAndRead { analytics in
            analytics.trackSignedUp(
                TrackSignedUpDefault(plan: "pro"),
                context: ["locale": "en-US"]
            )
        }
        let ctx = asMap(event.context)
        XCTAssertEqual(ctx["locale"] as? String, "en-US")
        let protocols = asMap(ctx["protocols"])
        XCTAssertEqual(protocols["schemaVersion"] as? String, "default")
    }

    func testTrackInjectsPropertiesSchemaVersion() {
        let event = sendAndRead { analytics in
            analytics.trackOrderCompletedPropsV1(
                TrackOrderCompletedPropsV1(orderID: "1")
            )
        } as! TrackEvent
        let props = asMap(event.properties)
        XCTAssertEqual(props["orderId"] as? String, "1")
        XCTAssertEqual(props["apiVersion"] as? String, "v1")
    }

    func testIdentifyEnqueuesTraits() {
        let event = sendAndRead { analytics in
            analytics.identifyDefault(userId: "user_1", traits: IdentifyDefault(email: "a@b.c"))
        } as! IdentifyEvent
        XCTAssertEqual(event.type, "identify")
        XCTAssertEqual(event.userId, "user_1")
        let traits = asMap(event.traits)
        XCTAssertEqual(traits["email"] as? String, "a@b.c")
    }

    func testIdentifyInjectsTraitsSchemaVersion() {
        let event = sendAndRead { analytics in
            analytics.identifyTraitsV1(
                userId: "user_1",
                traits: IdentifyTraitsV1(email: "a@b.c")
            )
        } as! IdentifyEvent
        let traits = asMap(event.traits)
        XCTAssertEqual(traits["apiVersion"] as? String, "v1")
    }

    func testIdentifyDoesNotInjectPropertiesPath() {
        let event = sendAndRead { analytics in
            analytics.identifyWrongEnvelopeV1(
                userId: "user_1",
                traits: IdentifyWrongEnvelopeV1(email: "a@b.c")
            )
        } as! IdentifyEvent
        let traits = asMap(event.traits)
        XCTAssertNil(traits["apiVersion"])
    }

    func testTrackDoesNotInjectTraitsPath() {
        let event = sendAndRead { analytics in
            analytics.trackWrongEnvelopeV1(TrackWrongEnvelopeV1(orderID: "1"))
        } as! TrackEvent
        let props = asMap(event.properties)
        XCTAssertNil(props["apiVersion"])
    }

    func testGroupEnqueues() {
        let event = sendAndRead { analytics in
            analytics.groupDefault(groupId: "grp_1", traits: GroupDefault(name: "Acme"))
        } as! GroupEvent
        XCTAssertEqual(event.type, "group")
        XCTAssertEqual(event.groupId, "grp_1")
        let traits = asMap(event.traits)
        XCTAssertEqual(traits["name"] as? String, "Acme")
    }

    func testPageAndScreenEnqueue() {
        let page = sendAndRead { analytics in
            analytics.pageHome(PageHomeDefault(path: "/"))
        } as! ScreenEvent
        XCTAssertEqual(page.type, "screen")
        XCTAssertEqual(page.name, "Home")

        let screen = sendAndRead { analytics in
            analytics.screenHome(ScreenHomeDefault(path: "/"))
        } as! ScreenEvent
        XCTAssertEqual(screen.type, "screen")
        XCTAssertEqual(screen.name, "Home")
    }

    func testAliasEnqueuesWithoutProperties() {
        let event = sendAndRead { analytics in
            analytics.identify(userId: "user_old")
            analytics.aliasDefault(newId: "user_new")
        } as! AliasEvent
        XCTAssertEqual(event.type, "alias")
        XCTAssertEqual(event.userId, "user_new")
        XCTAssertEqual(event.previousId, "user_old")
    }

    func testAliasInjectsContextSchemaVersion() {
        let event = sendAndRead { analytics in
            analytics.identify(userId: "user_old")
            analytics.aliasContextV1(newId: "user_new", context: ["locale": "en-US"])
        } as! AliasEvent
        XCTAssertEqual(event.type, "alias")
        let ctx = asMap(event.context)
        let protocols = asMap(ctx["protocols"])
        XCTAssertEqual(protocols["schemaVersion"] as? String, "v1")
    }

    func testAliasDoesNotInjectPropertiesPath() {
        let event = sendAndRead { analytics in
            analytics.identify(userId: "user_old")
            analytics.aliasPropsV1(newId: "user_new")
        } as! AliasEvent
        XCTAssertEqual(event.type, "alias")
        XCTAssertEqual(event.userId, "user_new")
    }

    func testCartViewedPreservesJSONKeys() {
        let event = sendAndRead { analytics in
            analytics.trackCartViewedDefault(
                TrackCartViewedDefault(amount: 10, currency: "USD", itemCount: 3)
            )
        } as! TrackEvent
        let props = asMap(event.properties)
        XCTAssertEqual(asDouble(props["itemCount"]), 3)
    }
}
