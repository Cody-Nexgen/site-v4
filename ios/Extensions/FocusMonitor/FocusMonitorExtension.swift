import DeviceActivity
import Foundation
import ManagedSettings

/// Turns blocking on and off on schedule, even when the app is closed. This extension gets very
/// little memory (a few MB): no networking, no big JSON, only small reads from the App Group.
class FocusMonitorExtension: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        guard activity == .dailyBlock, let selection = BlockList.load() else { return }
        Protections.lock(ManagedSettingsStore(named: .daily), with: selection)
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        switch activity {
        case .dailyBlock: ManagedSettingsStore(named: .daily).clearAllSettings()
        // A session ended while the app wasn't running: unlock what it locked.
        case .sessionEnd: ManagedSettingsStore(named: .focus).clearAllSettings()
        // Autofocus's 15 minutes are up.
        case .autofocusEnd: ManagedSettingsStore(named: .autofocus).clearAllSettings()
        // The emergency pass ran out: lock again whatever should be locked.
        case .emergencyEnd: EmergencyPass.relock()
        default: break
        }
    }

    override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
        super.eventDidReachThreshold(event, activity: activity)
        guard activity == .autofocus, event == .distracted else { return }
        Autofocus.stepIn()
    }
}
