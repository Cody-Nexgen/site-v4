import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import UserNotifications

// The extras on top of blocking, shared by the app and the Screen Time monitor extension (which runs
// them while the app is closed): autofocus, the emergency pass, uninstall protection and the adult
// site filter. Small reads from the App Group only (the monitor has a few MB of memory).

extension ManagedSettingsStore.Name {
    /// Shields autofocus puts up after too long in distracting apps.
    static let autofocus = Self("autofocus")
    /// The adult site filter, on all the time while it's switched on.
    static let filter = Self("filter")
}

extension DeviceActivityName {
    /// All day, every day, counting time in the block list for autofocus.
    static let autofocus = Self("autofocus")
    /// Autofocus's 15-minute lock ending.
    static let autofocusEnd = Self("autofocusEnd")
    /// An emergency pass running out: everything locks again.
    static let emergencyEnd = Self("emergencyEnd")
}

extension DeviceActivityEvent.Name {
    /// The block list used for longer than the autofocus limit today.
    static let distracted = Self("distracted")
}

/// The switches, saved in the App Group so the monitor can read them.
struct Protections: Codable, Equatable {
    var autofocus = false
    /// Minutes in distracting apps before autofocus steps in.
    var autofocusMinutes = 60
    /// Lock them for 15 minutes too, not just a nudge.
    var autofocusLocks = false
    /// While anything is locked, apps can't be deleted (only removed from the Home Screen).
    var uninstallProtection = false
    var adultFilter = false

    private static let defaults = UserDefaults(suiteName: "group.com.focuznow.shared") ?? .standard
    private static let key = "protections"

    static var current: Protections {
        get {
            guard let data = defaults.data(forKey: key), let value = try? JSONDecoder().decode(Protections.self, from: data) else { return Protections() }
            return value
        }
        set {
            if let data = try? JSONEncoder().encode(newValue) { defaults.set(data, forKey: key) }
        }
    }

    /// Locks `selection` in `store`, and stops apps being deleted while it's locked if that's on.
    static func lock(_ store: ManagedSettingsStore, with selection: FamilyActivitySelection) {
        BlockList.shield(store, with: selection)
        store.application.denyAppRemoval = current.uninstallProtection ? true : nil
    }

    /// The stores that lock apps (not the filter).
    static let lockStores: [ManagedSettingsStore.Name] = [.focus, .daily, .autofocus]

    static func isLocked(_ store: ManagedSettingsStore) -> Bool {
        store.shield.applications != nil || store.shield.applicationCategories != nil
            || store.shield.webDomains != nil || store.shield.webDomainCategories != nil
    }

    /// Anything locked right now: a session, the daily block or autofocus.
    static var isBlocking: Bool {
        lockStores.contains { isLocked(ManagedSettingsStore(named: $0)) }
    }

    /// After uninstall protection is switched on or off: every store that's locking now follows it.
    static func updateRemoval() {
        for name in lockStores {
            let store = ManagedSettingsStore(named: name)
            store.application.denyAppRemoval = isLocked(store) && current.uninstallProtection ? true : nil
        }
    }

    /// Puts the adult site filter on or takes it off (Apple's own filter, in Safari and apps).
    static func applyFilter() {
        let store = ManagedSettingsStore(named: .filter)
        store.webContent.blockedByFilter = current.adultFilter ? .auto() : nil
    }
}

// MARK: Autofocus

/// When the block list has been used for too long today, FocuzNow steps in: a nudge, and (if you
/// asked for it) 15 minutes locked.
enum Autofocus {
    /// Starts (or restarts) counting the block list's time for today, with the limit in `protections`.
    static func schedule(_ protections: Protections, selection: FamilyActivitySelection) {
        let center = DeviceActivityCenter()
        center.stopMonitoring([.autofocus])
        guard protections.autofocus, BlockList.count(selection) > 0 else { return }
        let event = DeviceActivityEvent(
            applications: selection.applicationTokens,
            categories: selection.categoryTokens,
            webDomains: selection.webDomainTokens,
            threshold: DateComponents(minute: protections.autofocusMinutes)
        )
        let day = DeviceActivitySchedule(intervalStart: DateComponents(hour: 0, minute: 0),
                                         intervalEnd: DateComponents(hour: 23, minute: 59), repeats: true)
        try? center.startMonitoring(.autofocus, during: day, events: [.distracted: event])
    }

    /// The limit was reached (the monitor calls this).
    static func stepIn() {
        let protections = Protections.current
        notify(minutes: protections.autofocusMinutes, locked: protections.autofocusLocks)
        guard protections.autofocusLocks, let selection = BlockList.load() else { return }
        Protections.lock(ManagedSettingsStore(named: .autofocus), with: selection)
        // Screen Time needs at least 15 minutes, which is exactly how long this lasts.
        let fields: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        let now = Date.now
        let schedule = DeviceActivitySchedule(
            intervalStart: Calendar.current.dateComponents(fields, from: now),
            intervalEnd: Calendar.current.dateComponents(fields, from: now.addingTimeInterval(15 * 60)),
            repeats: false
        )
        try? DeviceActivityCenter().startMonitoring(.autofocusEnd, during: schedule)
    }

    static func notify(minutes: Int, locked: Bool, after delay: TimeInterval = 1) {
        let line = lines(minutes: minutes, locked: locked).randomElement() ?? (title: "Hey", body: "That's enough for now.")
        let content = UNMutableNotificationContent()
        content.title = line.title
        content.body = line.body
        content.sound = .default
        let request = UNNotificationRequest(identifier: "autofocus-\(UUID().uuidString)", content: content,
                                            trigger: UNTimeIntervalNotificationTrigger(timeInterval: max(1, delay), repeats: false))
        UNUserNotificationCenter.current().add(request)
    }

    /// What autofocus says. A person wrote these; keep it that way.
    static func lines(minutes: Int, locked: Bool) -> [(title: String, body: String)] {
        let time = minutes % 60 == 0 ? (minutes == 60 ? "an hour" : "\(minutes / 60) hours") : "\(minutes) minutes"
        let after = locked ? " They're locked for 15 minutes. Go do one real thing." : " Maybe go do one real thing?"
        return [
            ("You've used distracting apps for \(time) already!!!", "Your thumb has run a small marathon." + after),
            ("\(time.prefix(1).uppercased() + time.dropFirst()). Gone. Poof.", "Impressive. Concerning, but impressive." + after),
            ("Your orb is getting dusty", "That's \(time) of scrolling today." + after),
            ("Okay, that's \(time)", "We're not mad. We're just a little disappointed." + after),
            ("Plot twist: it's been \(time)", "The feed will still be there. You might not have the time later." + after),
        ]
    }
}

// MARK: The emergency pass

/// Three a week: everything unlocks for 5 minutes, then the monitor locks it all again.
enum EmergencyPass {
    static let perWeek = 3
    static let minutes = 5
    private static let defaults = UserDefaults(suiteName: "group.com.focuznow.shared") ?? .standard
    private static let usedKey = "emergencyPassesUsed"
    private static let untilKey = "emergencyPassUntil"
    private static let unlockedKey = "emergencyPassUnlocked"

    /// Passes used in the last 7 days, oldest first.
    static var usedThisWeek: [Date] {
        let all = (defaults.array(forKey: usedKey) as? [Date]) ?? []
        return all.filter { $0 > Date.now.addingTimeInterval(-7 * 24 * 3600) }.sorted()
    }

    static var left: Int { max(0, perWeek - usedThisWeek.count) }

    /// When the oldest pass used this week comes back.
    static var nextBack: Date? { left < perWeek ? usedThisWeek.first?.addingTimeInterval(7 * 24 * 3600) : nil }

    /// While a pass is running, when it ends.
    static var activeUntil: Date? {
        guard let until = defaults.object(forKey: untilKey) as? Date, until > .now else { return nil }
        return until
    }

    /// Unlocks everything for 5 minutes. Returns when it locks again, or nil if none are left.
    @discardableResult
    static func use() -> Date? {
        guard left > 0 else { return nil }
        defaults.set(usedThisWeek + [.now], forKey: usedKey)
        // Remember what was locked, so only that locks again (not a session that's on a break).
        var unlocked: [String] = []
        if Protections.isLocked(ManagedSettingsStore(named: .focus)) { unlocked.append("focus") }
        if Protections.isLocked(ManagedSettingsStore(named: .daily)) { unlocked.append("daily") }
        defaults.set(unlocked, forKey: unlockedKey)
        // Autofocus's 15 minutes just end: the pass covers them.
        for name in Protections.lockStores {
            ManagedSettingsStore(named: name).clearAllSettings()
        }
        let end = Date.now.addingTimeInterval(TimeInterval(minutes * 60))
        defaults.set(end, forKey: untilKey)
        // At least 15 minutes for Screen Time, so it "started" a while ago.
        let fields: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
        let schedule = DeviceActivitySchedule(
            intervalStart: Calendar.current.dateComponents(fields, from: end.addingTimeInterval(-16 * 60)),
            intervalEnd: Calendar.current.dateComponents(fields, from: end),
            repeats: false
        )
        let center = DeviceActivityCenter()
        center.stopMonitoring([.emergencyEnd])
        try? center.startMonitoring(.emergencyEnd, during: schedule)
        return end
    }

    /// Time's up (the monitor calls this; the app too, as a backup): lock again what the pass
    /// unlocked, if it should still be locked.
    static func relock() {
        let unlocked = (defaults.array(forKey: unlockedKey) as? [String]) ?? []
        defaults.removeObject(forKey: untilKey)
        defaults.removeObject(forKey: unlockedKey)
        guard let selection = BlockList.load() else { return }
        if unlocked.contains("focus"), let end = defaults.object(forKey: BlockList.sessionEndKey) as? Date, end > .now {
            Protections.lock(ManagedSettingsStore(named: .focus), with: selection)
        }
        if unlocked.contains("daily"), let window = BlockList.dailyWindow, window.contains(.now) {
            Protections.lock(ManagedSettingsStore(named: .daily), with: selection)
        }
    }

    /// The app's backup for the monitor: relocks once the pass's time has passed.
    static func relockIfDue() {
        guard let until = defaults.object(forKey: untilKey) as? Date, until <= .now else { return }
        relock()
    }

    /// Delete account: forget the passes too.
    static func reset() {
        for key in [usedKey, untilKey, unlockedKey] { defaults.removeObject(forKey: key) }
        DeviceActivityCenter().stopMonitoring([.emergencyEnd])
    }
}

extension BlockList.Window {
    func contains(_ date: Date) -> Bool {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        let now = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
        let start = startHour * 60 + startMinute
        let end = endHour * 60 + endMinute
        return start <= end ? (now >= start && now < end) : (now >= start || now < end)
    }
}
