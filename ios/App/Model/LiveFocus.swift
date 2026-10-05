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

    /// After a break starts or ends, or the session is extended. A break opens everything, or only
    /// `breakApps`; the monitor locks them again when it ends, since you're usually off using them.
    static func changed(_ session: FocusSession, selection: FamilyActivitySelection, breakApps: FamilyActivitySelection? = nil) {
        if let breakStart = session.breakStartedAt {
            if screenTimeApproved, let breakApps {
                Protections.lock(store, with: selection, except: breakApps)
            } else {
                store.clearAllSettings()
            }
            if screenTimeApproved {
                BlockList.scheduleBreakEnd(breakStart.addingTimeInterval(session.breakLength))
                // The clock stops for the break, so the session ends that much later.
                BlockList.scheduleSessionEnd(session.end.addingTimeInterval(session.breakLength))
            }
        } else if screenTimeApproved {
            BlockList.cancelBreakEnd()
            // An emergency pass running: it locks the session again when it's over.
            if EmergencyPass.activeUntil != nil {
                EmergencyPass.lockWhenOver("focus")
            } else {
                Protections.lock(store, with: selection)
            }
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
        BlockList.cancelBreakEnd()
        let state = FocusActivityAttributes.ContentState(phase: .done, start: .now, end: .now, locked: 0, minutes: minutes)
        let content = ActivityContent(state: state, staleDate: nil)
        let running = Activity<FocusActivityAttributes>.activities
        Task {
            for activity in running { await activity.end(content, dismissalPolicy: .after(.now.addingTimeInterval(4 * 60))) }
        }
    }

    /// At launch with no session to carry on: a lock or a Live Activity left behind by one comes off.
    /// (A session the app lost when it was closed, before sessions were saved, or an end the monitor
    /// missed.) The daily block and autofocus have their own stores and stay as they are.
    static func clearLeftovers() {
        if Protections.isLocked(store) {
            store.clearAllSettings()
        }
        BlockList.cancelSessionEnd()
        BlockList.cancelBreakEnd()
        // Not a "Done · 50 min" one: that stays its few minutes.
        let stale = Activity<FocusActivityAttributes>.activities.filter { $0.content.state.phase != .done }
        Task {
            for activity in stale { await activity.end(nil, dismissalPolicy: .immediate) }
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
