import DeviceActivity
import Foundation
import ManagedSettings

/// Turns blocking on and off on schedule, even when the app is closed. This extension gets very
/// little memory (a few MB): no networking, no big JSON, only small reads from the App Group.
class FocusMonitorExtension: DeviceActivityMonitor {
    private let store = ManagedSettingsStore(named: .focus)

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        // Phase 2: read the saved FamilyActivitySelection from the App Group and shield it.
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        store.clearAllSettings()
    }
}

extension ManagedSettingsStore.Name {
    static let focus = Self("focus")
}
