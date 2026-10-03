// swift-tools-version: 6.0
import PackageDescription

// Shared by the app and its extensions. Foundation-only (no SwiftUI/UIKit), so `swift test`
// runs on the Mac directly: `cd ios/FocuzNowKit && swift test`.
let package = Package(
    name: "FocuzNowKit",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [
        .library(name: "FocuzNowKit", targets: ["FocuzNowKit"]),
    ],
    targets: [
        .target(
            name: "FocuzNowKit",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .testTarget(
            name: "FocuzNowKitTests",
            dependencies: ["FocuzNowKit"],
            resources: [.copy("Fixtures")],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
