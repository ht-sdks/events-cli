// swift-tools-version:5.7

import PackageDescription

let package = Package(
    name: "AnalyticsHarness",
    platforms: [
        .macOS("10.15"),
        .iOS("13.0"),
        .tvOS("11.0"),
        .watchOS("7.1"),
    ],
    products: [
        .library(name: "Analytics", targets: ["Analytics"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ht-sdks/events-sdk-swift.git", from: "0.2.0"),
    ],
    targets: [
        .target(
            name: "Analytics",
            dependencies: [
                .product(name: "Hightouch", package: "events-sdk-swift"),
            ]
        ),
        .testTarget(
            name: "AnalyticsTests",
            dependencies: [
                "Analytics",
                .product(name: "Hightouch", package: "events-sdk-swift"),
            ]
        ),
    ]
)
