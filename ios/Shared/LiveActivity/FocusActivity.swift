import ActivityKit
import AppIntents
import Foundation

// Compiled into the app and the widget extension (see `ios/project.yml`), so both agree on what a
// focus Live Activity holds.

/// A running focus session in the Dynamic Island and on the Lock Screen.
struct FocusActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        enum Phase: String, Codable, Hashable {
            case focusing, onBreak, done
        }

        var phase: Phase
        /// When the current stretch started and ends: the session while focusing, the break while on
        /// a break. `Text(timerInterval:)` counts it down with no updates from the app.
        var start: Date
        var end: Date
        /// How many apps and categories are locked right now.
        var locked: Int
        /// Minutes focused, shown when the session is done.
        var minutes: Int = 0
    }

    /// "School", "Deep work".
    var title: String
    /// The session's SF Symbol.
    var symbol: String
}

// MARK: Buttons in the expanded island and on the Lock Screen

/// What the Live Activity's buttons ask the app to do.
enum FocusIntentAction: Sendable {
    case end, addFive
}

/// The app sets `handler` at launch. A `LiveActivityIntent` runs in the app's process, so the
/// widget extension's copy of these types never calls it.
@MainActor
enum FocusIntentBridge {
    static var handler: ((FocusIntentAction) -> Void)?
}

struct EndFocusIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "End focus"
    static var description = IntentDescription("Ends the FocuzNow session that's running.")

    func perform() async throws -> some IntentResult {
        await MainActor.run { FocusIntentBridge.handler?(.end) }
        return .result()
    }
}

struct AddFiveMinutesIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Add 5 minutes"
    static var description = IntentDescription("Adds five minutes to the FocuzNow session that's running.")

    func perform() async throws -> some IntentResult {
        await MainActor.run { FocusIntentBridge.handler?(.addFive) }
        return .result()
    }
}
