import ActivityKit
import FamilyControls
import Foundation
import ManagedSettings

/// What a running session does outside the app: the Live Activity in the Dynamic Island and on the
/// Lock Screen, and the Screen Time shields on the block list.
@MainActor
enum LiveFocus {
    private static let store = ManagedSettingsStore(named: .focus)

    /// Live Activities can be turned off in Settings → FocuzNow.
    static var activitiesEnabled: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    static var screenTimeApproved: Bool { AuthorizationCenter.shared.authorizationStatus == .approved }

    // MARK: Session lifecycle

    static func started(_ session: FocusSession, selection: FamilyActivitySelection) {
        if screenTimeApproved {
            Protections.lock(store, with: selection)
            BlockList.scheduleSessionEnd(session.end)
        }
        endAllActivities()
        guard activitiesEnabled else { return }
        let attributes = FocusActivityAttributes(title: session.title, symbol: session.symbol)
        _ = try? Activity<FocusActivityAttributes>.request(
            attributes: attributes,
            content: ActivityContent(state: state(for: session, locked: locked(selection), at: .now), staleDate: session.end.addingTimeInterval(60))
        )
    }

    /// After a break starts or ends, or the session is extended. Apps unlock during a break.
    static func changed(_ session: FocusSession, selection: FamilyActivitySelection) {
        if session.breakStartedAt != nil {
            store.clearAllSettings()
        } else if screenTimeApproved {
            Protections.lock(store, with: selection)
            BlockList.scheduleSessionEnd(session.end)
        }
        let content = ActivityContent(state: state(for: session, locked: locked(selection), at: .now), staleDate: session.end.addingTimeInterval(60))
        let running = Activity<FocusActivityAttributes>.activities
        Task {
            for activity in running { await activity.update(content) }
        }
    }

    /// Clears the shields and leaves "Done · 50 min" up for a few minutes.
    static func ended(minutes: Int) {
        store.clearAllSettings()
        BlockList.cancelSessionEnd()
        let state = FocusActivityAttributes.ContentState(phase: .done, start: .now, end: .now, locked: 0, minutes: minutes)
        let content = ActivityContent(state: state, staleDate: nil)
        let running = Activity<FocusActivityAttributes>.activities
        Task {
            for activity in running { await activity.end(content, dismissalPolicy: .after(.now.addingTimeInterval(4 * 60))) }
        }
    }

    /// Captured before the new activity is requested, so only older ones end.
    private static func endAllActivities() {
        let old = Activity<FocusActivityAttributes>.activities
        Task {
            for activity in old { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }

    /// Only what's really locked: nothing without Screen Time.
    private static func locked(_ selection: FamilyActivitySelection) -> Int {
        screenTimeApproved ? BlockList.count(selection) : 0
    }

    private static func state(for session: FocusSession, locked: Int, at date: Date) -> FocusActivityAttributes.ContentState {
        if let breakStart = session.breakStartedAt {
            return .init(phase: .onBreak, start: breakStart, end: breakStart.addingTimeInterval(session.breakLength), locked: 0)
        }
        // The countdown runs from now to the end; `start` only sets where the progress bar begins.
        let shownStart = session.end.addingTimeInterval(-session.duration)
        return .init(phase: .focusing, start: min(shownStart, date), end: session.end, locked: locked)
    }
}
