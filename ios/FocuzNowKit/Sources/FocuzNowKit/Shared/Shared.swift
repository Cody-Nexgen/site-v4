import Foundation

/// Identifiers shared by the app and its extensions. They must match `ios/project.yml`.
public enum FocuzShared {
    public static let appGroup = "group.com.focuznow.shared"
    public static let bundleID = "com.focuznow.app"

    /// The App Group's settings, readable from every extension (the Screen Time monitor only gets a
    /// few MB of memory, so keep what it reads here small).
    public static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? .standard
    }
}
