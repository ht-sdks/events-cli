package analytics

import (
	"testing"

	htevents "github.com/ht-sdks/events-sdk-go"
)

func str(s string) *string { return &s }

func f64(v float64) *float64 { return &v }

func enqueueAndRead(t *testing.T, run func(htevents.Client) error) map[string]interface{} {
	t.Helper()
	body, server := mockServer()
	defer server.Close()

	client, err := htevents.NewWithConfig("wk", htevents.Config{
		Endpoint:  server.URL,
		BatchSize: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = client.Close() }()

	if err := run(client); err != nil {
		t.Fatal(err)
	}

	payload := decodeBatch(<-body)
	if len(payload.Batch) != 1 {
		t.Fatalf("expected 1 message, got %d", len(payload.Batch))
	}
	return payload.Batch[0]
}

func asMap(t *testing.T, v interface{}) map[string]interface{} {
	t.Helper()
	m, ok := v.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", v)
	}
	return m
}

func TestTrackOrderCompletedEnqueues(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return TrackOrderCompleted(client, "user-1", TrackOrderCompletedV2Payload{
			OrderID: str("ord_1"),
			Total:   f64(2),
		})
	})
	if msg["type"] != "track" {
		t.Fatalf("type = %v", msg["type"])
	}
	if msg["event"] != "Order Completed" {
		t.Fatalf("event = %v", msg["event"])
	}
	if msg["userId"] != "user-1" {
		t.Fatalf("userId = %v", msg["userId"])
	}
	props := asMap(t, msg["properties"])
	if props["orderId"] != "ord_1" {
		t.Fatalf("orderId = %v", props["orderId"])
	}
	if props["total"] != 2.0 {
		t.Fatalf("total = %v", props["total"])
	}
}

func TestLatestAliasMatchesVersionedWrapper(t *testing.T) {
	versioned := enqueueAndRead(t, func(client htevents.Client) error {
		return TrackOrderCompletedV2(client, "user-1", TrackOrderCompletedV2Payload{
			OrderID: str("1"),
		})
	})
	aliased := enqueueAndRead(t, func(client htevents.Client) error {
		return TrackOrderCompleted(client, "user-1", TrackOrderCompletedV2Payload{
			OrderID: str("1"),
		})
	})
	if versioned["event"] != aliased["event"] {
		t.Fatalf("event mismatch: %v vs %v", versioned["event"], aliased["event"])
	}
}

func TestTrackInjectsContextSchemaVersion(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return TrackSignedUp(client, "user-1", TrackSignedUpDefaultPayload{
			Plan: str("pro"),
		}, CallOptions{
			Context: &htevents.Context{
				Locale: "en-US",
			},
		})
	})
	ctx := asMap(t, msg["context"])
	if ctx["locale"] != "en-US" {
		t.Fatalf("locale = %v", ctx["locale"])
	}
	protocols := asMap(t, ctx["protocols"])
	if protocols["schemaVersion"] != "default" {
		t.Fatalf("schemaVersion = %v", protocols["schemaVersion"])
	}
}

func TestTrackInjectsPropertiesSchemaVersion(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return TrackOrderCompletedPropsV1(client, "user-1", TrackOrderCompletedPropsV1Payload{
			OrderID: str("1"),
		})
	})
	props := asMap(t, msg["properties"])
	if props["orderId"] != "1" {
		t.Fatalf("orderId = %v", props["orderId"])
	}
	if props["apiVersion"] != "v1" {
		t.Fatalf("apiVersion = %v", props["apiVersion"])
	}
}

func TestIdentifyEnqueuesTraits(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return IdentifyDefault(client, "user_1", IdentifyDefaultPayload{
			Email: str("a@b.c"),
		})
	})
	if msg["type"] != "identify" {
		t.Fatalf("type = %v", msg["type"])
	}
	traits := asMap(t, msg["traits"])
	if traits["email"] != "a@b.c" {
		t.Fatalf("email = %v", traits["email"])
	}
}

func TestIdentifyInjectsTraitsSchemaVersion(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return IdentifyTraitsV1(client, "user_1", IdentifyTraitsV1Payload{
			Email: str("a@b.c"),
		})
	})
	traits := asMap(t, msg["traits"])
	if traits["apiVersion"] != "v1" {
		t.Fatalf("apiVersion = %v", traits["apiVersion"])
	}
}

func TestIdentifyDoesNotInjectPropertiesPath(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return IdentifyWrongEnvelopeV1(client, "user_1", IdentifyWrongEnvelopeV1Payload{
			Email: str("a@b.c"),
		})
	})
	traits := asMap(t, msg["traits"])
	if _, ok := traits["apiVersion"]; ok {
		t.Fatalf("did not expect apiVersion on traits: %v", traits)
	}
}

func TestTrackDoesNotInjectTraitsPath(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return TrackWrongEnvelopeV1(client, "user-1", TrackWrongEnvelopeV1Payload{
			OrderID: str("1"),
		})
	})
	props := asMap(t, msg["properties"])
	if _, ok := props["apiVersion"]; ok {
		t.Fatalf("did not expect apiVersion on properties: %v", props)
	}
}

func TestGroupEnqueues(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return GroupDefault(client, "grp_1", "user-1", GroupDefaultPayload{
			Name: str("Acme"),
		})
	})
	if msg["type"] != "group" {
		t.Fatalf("type = %v", msg["type"])
	}
	if msg["groupId"] != "grp_1" {
		t.Fatalf("groupId = %v", msg["groupId"])
	}
	traits := asMap(t, msg["traits"])
	if traits["name"] != "Acme" {
		t.Fatalf("name = %v", traits["name"])
	}
}

func TestPageAndScreenEnqueue(t *testing.T) {
	page := enqueueAndRead(t, func(client htevents.Client) error {
		return PageHome(client, "user-1", PageHomeDefaultPayload{Path: str("/")})
	})
	if page["type"] != "page" {
		t.Fatalf("page type = %v", page["type"])
	}
	if page["name"] != "Home" {
		t.Fatalf("page name = %v", page["name"])
	}

	screen := enqueueAndRead(t, func(client htevents.Client) error {
		return ScreenHome(client, "user-1", ScreenHomeDefaultPayload{Path: str("/")})
	})
	if screen["type"] != "screen" {
		t.Fatalf("screen type = %v", screen["type"])
	}
	if screen["name"] != "Home" {
		t.Fatalf("screen name = %v", screen["name"])
	}
}

func TestAliasEnqueuesWithoutProperties(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return AliasDefault(client, "user_new", "user_old")
	})
	if msg["type"] != "alias" {
		t.Fatalf("type = %v", msg["type"])
	}
	if msg["userId"] != "user_new" {
		t.Fatalf("userId = %v", msg["userId"])
	}
	if msg["previousId"] != "user_old" {
		t.Fatalf("previousId = %v", msg["previousId"])
	}
	if _, ok := msg["properties"]; ok {
		t.Fatalf("alias should not have properties: %v", msg)
	}
}

func TestAliasInjectsContextSchemaVersion(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return AliasContextV1(client, "user_new", "user_old", CallOptions{
			Context: &htevents.Context{Locale: "en-US"},
		})
	})
	if _, ok := msg["properties"]; ok {
		t.Fatalf("alias should not have properties: %v", msg)
	}
	ctx := asMap(t, msg["context"])
	protocols := asMap(t, ctx["protocols"])
	if protocols["schemaVersion"] != "v1" {
		t.Fatalf("schemaVersion = %v", protocols["schemaVersion"])
	}
}

func TestAliasDoesNotInjectPropertiesPath(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		return AliasPropsV1(client, "user_new", "user_old")
	})
	if _, ok := msg["properties"]; ok {
		t.Fatalf("alias should not have properties: %v", msg)
	}
}

func TestCartViewedPreservesJSONKeys(t *testing.T) {
	msg := enqueueAndRead(t, func(client htevents.Client) error {
		itemCount := 3.0
		return TrackCartViewedDefault(client, "user-1", TrackCartViewedDefaultPayload{
			Amount:    10,
			Currency:  "USD",
			ItemCount: &itemCount,
		})
	})
	props := asMap(t, msg["properties"])
	if props["itemCount"] != 3.0 {
		t.Fatalf("itemCount = %v", props["itemCount"])
	}
}
