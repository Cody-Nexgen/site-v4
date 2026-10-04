import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

// Compiled into the app and the Screen Time monitor extension (see `ios/project.yml`). The monitor
// gets only a few MB of memory, so this stays small: one JSON blob in the App Group, no networking.

extension ManagedSettingsStore.Name {
    /// Shields applied by a running session (the app sets and clears it).
    static let focus = Self("focus")
    /// Shields applied by the daily block (the monitor sets and clears it on schedule).
    static let daily = Self("daily")
}

extension DeviceActivityName {
    static let dailyBlock = Self("dailyBlock")
    /// A running session's end, so its shields come off on time with the app closed.
    static let sessionEnd = Self("sessionEnd")
}

/// What gets locked: the apps, categories and sites picked in the FamilyActivityPicker.
enum BlockList {
    /// Must match `FocuzShared.appGroup` in FocuzNowKit (the monitor doesn't link the Kit).
    private static let defaults = UserDefaults(suiteName: "group.com.focuznow.shared") ?? .standard
    private static let selectionKey = "blockSelection"
    private static let dailyKey = "dailyBlock"

    static func save(_ selection: FamilyActivitySelection) {
        guard let data = try? JSONEncoder().encode(selection) else { return }
        defaults.set(data, forKey: selectionKey)
    }

    static func load() -> FamilyActivitySelection? {
        guard let data = defaults.data(forKey: selectionKey) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    static func count(_ selection: FamilyActivitySelection) -> Int {
        selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count
    }

    /// Locks everything in `selection` in `store`, or nothing if it's empty.
    static func shield(_ store: ManagedSettingsStore, with selection: FamilyActivitySelection) {
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
        store.shield.applicationCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
        store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
        store.shield.webDomainCategories = selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    }

    // MARK: A running session's end

    /// The app locks apps when a session starts, but it may not be running when the session ends.
    /// This asks Screen Time to wake the monitor at `end`, which unlocks them (`intervalDidEnd`).
    /// Screen Time needs an interval of at least 15 minutes, so a short session's interval simply
    /// starts in the past.
    static func scheduleSessionEnd(_ end: Date) {
        let start = min(Date.now, end.addingTimeInterval(-16 * 60))
        let fields: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        let schedule = DeviceActivitySchedule(
            intervalStart: Calendar.current.dateComponents(fields, from: start),
            intervalEnd: Calendar.current.dateComponents(fields, from: end),
            repeats: false
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([.sessionEnd])
        try? center.startMonitoring(.sessionEnd, during: schedule)
        defaults.set(end, forKey: sessionEndKey)
    }

    static func cancelSessionEnd() {
        DeviceActivityCenter().stopMonitoring([.sessionEnd])
        defaults.removeObject(forKey: sessionEndKey)
    }

    /// When the running session ends, for the shield's "It's back at 3:45 PM." The shield extension
    /// reads the same App Group key (it doesn't compile this file).
    static let sessionEndKey = "sessionEnd"

    // MARK: The daily block

    /// A daily window, like 15:30 to 17:00.
    struct Window: Codable, Equatable {
        var startHour: Int
        var startMinute: Int
        var endHour: Int
        var endMinute: Int

        /// "3:30 to 5:00 PM".
        var label: String {
            func time(_ hour: Int, _ minute: Int) -> Date {
                Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: .now) ?? .now
            }
            let start = time(startHour, startMinute).formatted(date: .omitted, time: .shortened)
            let end = time(endHour, endMinute).formatted(date: .omitted, time: .shortened)
            return "\(start) to \(end)"
        }
    }

    static var dailyWindow: Window? {
        guard let data = defaults.data(forKey: dailyKey) else { return nil }
        return try? JSONDecoder().decode(Window.self, from: data)
    }

    /// Locks the block list every day during `window`, even when the app is closed (the monitor
    /// extension does the locking).
    static func scheduleDaily(_ window: Window) throws {
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: window.startHour, minute: window.startMinute),
            intervalEnd: DateComponents(hour: window.endHour, minute: window.endMinute),
            repeats: true
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([.dailyBlock])
        try center.startMonitoring(.dailyBlock, during: schedule)
        if let data = try? JSONEncoder().encode(window) { defaults.set(data, forKey: dailyKey) }
    }

    static func cancelDaily() {
        DeviceActivityCenter().stopMonitoring([.dailyBlock])
        ManagedSettingsStore(named: .daily).clearAllSettings()
        defaults.removeObject(forKey: dailyKey)
    }
}
