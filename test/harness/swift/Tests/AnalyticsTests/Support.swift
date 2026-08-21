import Foundation
import Hightouch
import XCTest

final class OutputReaderPlugin: Plugin {
    let type: PluginType = .after
    var analytics: Analytics?
    private(set) var lastEvent: RawEvent?

    func execute<T: RawEvent>(event: T?) -> T? {
        lastEvent = event
        return event
    }
}

func sendAndRead(_ run: (Analytics) -> Void) -> RawEvent {
    let writeKey = "wk-\(UUID().uuidString)"
    let analytics = Analytics(configuration: Configuration(writeKey: writeKey)
        .trackApplicationLifecycleEvents(false)
        .autoAddSegmentDestination(false)
        .flushAt(10_000)
        .flushInterval(10_000))
    let reader = OutputReaderPlugin()
    analytics.add(plugin: reader)
    analytics.waitUntilStarted()
    run(analytics)
    guard let event = reader.lastEvent else {
        XCTFail("expected an event")
        preconditionFailure("expected an event")
    }
    return event
}

func asMap(_ json: JSON?) -> [String: Any] {
    json?.dictionaryValue ?? [:]
}

func asMap(_ value: Any?) -> [String: Any] {
    value as? [String: Any] ?? [:]
}

func asDouble(_ value: Any?) -> Double? {
    if let number = value as? Double {
        return number
    }
    if let number = value as? NSNumber {
        return number.doubleValue
    }
    if let decimal = value as? Decimal {
        return NSDecimalNumber(decimal: decimal).doubleValue
    }
    return nil
}
