import DeviceActivity
import FamilyControls
import ManagedSettings
import Observation
import SwiftUI
import UIKit

/// Everything the screens show. Mock data until the backend phases wire it to Supabase and Screen Time.
@MainActor
@Observable
final class AppModel {
    // Profile (saved on this iPhone until accounts sync) and today
    var profile = UserProfile.load() {
        didSet { profile.save() }
    }
    var profilePhoto: UIImage?
    var userName: String {
        get { profile.name }
        set { profile.name = newValue }
    }
    var goalMinutes = 120
    var focusedMinutesToday = 74
    var focusScore = 8.2
    var lastHourDelta = 0.4
    var screenTimeMinutes = 197
    var pickups = 123
    var streakDays = 6
    var coins = 340
    var isPro = false

    // Focus
    var presets = FocusPreset.samples
    var selectedPresetID = FocusPreset.samples[0].id
    var sessionMinutes = 50
    var difficulty: Difficulty = .normal
    var breaksOn = true
    /// What gets locked. Saved to the App Group so the Screen Time monitor can lock it on schedule.
    var selection = BlockList.load() ?? FamilyActivitySelection() {
        didSet {
            BlockList.save(selection)
            Autofocus.schedule(protections, selection: selection)
        }
    }
    /// Autofocus, uninstall protection, the adult site filter. Saved to the App Group for the monitor.
    var protections = Protections.current {
        didSet {
            guard protections != oldValue else { return }
            Protections.current = protections
            if protections.autofocus != oldValue.autofocus || protections.autofocusMinutes != oldValue.autofocusMinutes {
                Autofocus.schedule(protections, selection: selection)
            }
            if protections.adultFilter != oldValue.adultFilter { Protections.applyFilter() }
            if protections.uninstallProtection != oldValue.uninstallProtection { Protections.updateRemoval() }
        }
    }
    var blockedApps = Array(DistractionApp.samples.prefix(5))
    var session: FocusSession?
    var showSession = false
    var completed: CompletedSession?

    // Plan, Pass, Coach, You
    var todos: [TodoItem] = [
        TodoItem(title: "Finish lab report", list: "School", due: "Today"),
        TodoItem(title: "Read chapter 4", list: "School", due: "Today"),
        TodoItem(title: "Email Ms. K about the project", list: "School", done: true),
        TodoItem(title: "Practice piano · 20 min", list: "Home"),
        TodoItem(title: "Clean desk", list: "Home"),
    ]
    var events: [EventItem] = [
        EventItem(title: "Bio study", startHour: 10, hours: 1, color: Color(hex: 0x5BE3A6), place: "Library"),
        EventItem(title: "Lunch", startHour: 12, hours: 0.75, color: Color(hex: 0xFFC25B)),
        EventItem(title: "Math tutoring", startHour: 15.5, hours: 1, color: Color(hex: 0x8F6BFF), place: "Zoom"),
        EventItem(title: "Soccer", startHour: 17.25, hours: 1.5, color: Color(hex: 0xFF7A6B), place: "Field 2"),
    ]
    var vault = VaultEntry.samples
    var vaultUnlocked = false
    var conversations: [Conversation] = [
        Conversation(title: "Study plan for finals", messages: [
            ChatMessage(role: .user, text: "Make me a study plan for finals"),
            ChatMessage(role: .coach, text: "Here's a two-week plan: **mornings** for math, **afternoons** for bio flashcards, and one rest day each week."),
        ], updated: .now.addingTimeInterval(-3600 * 20)),
        Conversation(title: "Why I can't stop scrolling", messages: [
            ChatMessage(role: .user, text: "Why can't I stop scrolling at night?"),
            ChatMessage(role: .coach, text: "Late-night scrolling is mostly about **winding down**. Let's swap it for something just as easy."),
        ], updated: .now.addingTimeInterval(-3600 * 72)),
    ]
    var currentConversationID: Conversation.ID?
    var coachModel: CoachModel = .flash
    var friends: [Friend] = [
        Friend(name: "Ava", minutesThisWeek: 412, focusingNow: true),
        Friend(name: "Leo", minutesThisWeek: 368, focusingNow: false),
        Friend(name: "Maya", minutesThisWeek: 345, focusingNow: false, isMe: true),
        Friend(name: "Kai", minutesThisWeek: 290, focusingNow: true),
        Friend(name: "Zoe", minutesThisWeek: 214, focusingNow: false),
    ]
    // Customize
    var sessionBackground: SessionBackground = .lighthouse
    var backgroundPhoto: UIImage?
    var timerStyle: TimerStyle = .big
    var showQuote = true
    var homeShowsFriends = true
    var homeShowsWave = true

    // Onboarding answers
    /// "How long are you on your phone a day?": the screen time you started with.
    var phoneHoursGuess: Double {
        get { profile.phoneHours }
        set { profile.phoneHours = newValue }
    }
    var distraction = ""
    var focusFor = ""
    var hardestTime = ""

    var trees: [ForestTree] = (0..<17).map { index in ForestTree(minutes: [25, 50, 30, 45, 90, 25, 60][index % 7], kind: index % 3) }
    var shop: [ShopItem] = [
        ShopItem(title: "Night Lake", detail: "Moonlit water", price: 0, scene: .nightLake, owned: true),
        ShopItem(title: "Dawn Ridge", detail: "First light", price: 120, scene: .dawnRidge),
        ShopItem(title: "Desert Dusk", detail: "Warm sunset", price: 180, scene: .desertDusk),
        ShopItem(title: "Aurora", detail: "Northern lights", price: 260, scene: .aurora),
    ]

    let wave: [WavePoint] = stride(from: 6.0, through: 24.0, by: 0.5).map { hour in
        let bump: Double = hour > 13 && hour < 16 ? 1.6 : 0
        let base: Double = 5 + 2.2 * sin(hour / 2.1) + 1.4 * sin(hour / 0.9 + 1) + bump
        return WavePoint(hour: hour, value: min(9.6, max(1.2, base)))
    }

    var goalProgress: Double { min(1, Double(focusedMinutesToday) / Double(max(1, goalMinutes))) }
    var selectedPreset: FocusPreset { presets.first { $0.id == selectedPresetID } ?? presets[0] }
    var blockedCount: Int { max(blockedApps.count, selection.applicationTokens.count + selection.categoryTokens.count) }

    // MARK: Sessions

    func choose(_ preset: FocusPreset) {
        selectedPresetID = preset.id
        sessionMinutes = preset.minutes
    }

    func startSession() {
        let preset = selectedPreset
        session = FocusSession(
            title: preset.title,
            symbol: preset.symbol,
            start: .now,
            duration: TimeInterval(sessionMinutes * 60),
            difficulty: difficulty,
            blockedCount: blockedCount,
            breakLength: TimeInterval(preset.breakMinutes * 60)
        )
        completed = nil
        showSession = true
        if let session { LiveFocus.started(session, selection: selection) }
    }

    /// The Live Activity's End and +5 buttons (`FocusIntentBridge`).
    func handle(_ action: FocusIntentAction) {
        switch action {
        case .end: endSession(completedFully: false)
        case .addFive: extendSession(minutes: 5)
        }
    }

    func extendSession(minutes: Int) {
        guard var current = session else { return }
        current.duration += TimeInterval(minutes * 60)
        session = current
        LiveFocus.changed(current, selection: selection)
    }

    func setBreakLength(minutes: Int) {
        guard var current = session, current.difficulty != .lockedIn else { return }
        current.breakLength = TimeInterval(minutes * 60)
        session = current
    }

    // MARK: Customize

    private static var photoURL: URL {
        URL.documentsDirectory.appending(path: "session-background.jpg")
    }

    private static var profilePhotoURL: URL {
        URL.documentsDirectory.appending(path: "profile-photo.jpg")
    }

    init() {
        if let data = try? Data(contentsOf: Self.photoURL), let image = UIImage(data: data) {
            backgroundPhoto = image
            sessionBackground = .photo
        }
        if let data = try? Data(contentsOf: Self.profilePhotoURL) {
            profilePhoto = UIImage(data: data)
        }
    }

    /// Square, 600 pt at most: it's only ever shown small.
    func setProfilePhoto(_ data: Data) {
        guard let image = UIImage(data: data) else { return }
        let side = min(image.size.width, image.size.height)
        let crop = CGRect(x: (image.size.width - side) / 2, y: (image.size.height - side) / 2, width: side, height: side)
        let target = CGSize(width: min(600, side), height: min(600, side))
        let square = UIGraphicsImageRenderer(size: target).image { _ in
            image.draw(in: CGRect(x: -crop.minX * target.width / side, y: -crop.minY * target.height / side,
                                  width: image.size.width * target.width / side, height: image.size.height * target.height / side))
        }
        profilePhoto = square
        if let jpeg = square.jpegData(compressionQuality: 0.85) { try? jpeg.write(to: Self.profilePhotoURL, options: .atomic) }
    }

    func removeProfilePhoto() {
        profilePhoto = nil
        try? FileManager.default.removeItem(at: Self.profilePhotoURL)
    }

    func setBackgroundPhoto(_ data: Data) {
        guard let image = UIImage(data: data) else { return }
        backgroundPhoto = image
        sessionBackground = .photo
        if let jpeg = image.jpegData(compressionQuality: 0.85) { try? jpeg.write(to: Self.photoURL, options: .atomic) }
    }

    func takeBreak() {
        guard var current = session, current.breakStartedAt == nil, current.difficulty != .lockedIn else { return }
        current.breakStartedAt = .now
        session = current
        LiveFocus.changed(current, selection: selection)
    }

    func endBreak() {
        guard var current = session, let started = current.breakStartedAt else { return }
        current.pausedTotal += Date.now.timeIntervalSince(started)
        current.breakStartedAt = nil
        session = current
        LiveFocus.changed(current, selection: selection)
    }

    func endSession(completedFully: Bool) {
        guard let current = session else { return }
        let minutes = Int(current.elapsed(at: .now) / 60)
        let before = focusScore
        focusedMinutesToday += minutes
        if completedFully {
            coins += max(5, minutes / 4)
            focusScore = min(10, focusScore + Double(minutes) / 60)
            trees.append(ForestTree(minutes: minutes, kind: trees.count % 3))
        }
        completed = CompletedSession(title: current.title, minutes: minutes, coins: completedFully ? max(5, minutes / 4) : 0, scoreBefore: before, scoreAfter: focusScore)
        session = nil
        LiveFocus.ended(minutes: minutes)
    }

    /// Called every second by the root view.
    func tick() {
        // The monitor relocks after an emergency pass; this is the backup while the app is open.
        EmergencyPass.relockIfDue()
        guard let current = session else { return }
        if current.breakStartedAt != nil, current.breakRemaining(at: .now) <= 0 { endBreak() }
        if current.remaining(at: .now) <= 0 {
            endSession(completedFully: true)
            showSession = true
        }
    }

    // MARK: Coach (mock replies until Phase 4)

    var currentConversation: Conversation? {
        conversations.first { $0.id == currentConversationID }
    }

    func newChat() { currentConversationID = nil }

    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let id: Conversation.ID
        if let current = currentConversationID, conversations.contains(where: { $0.id == current }) {
            id = current
        } else {
            let title = trimmed.count > 34 ? String(trimmed.prefix(34)) + "…" : trimmed
            let conversation = Conversation(title: title, messages: [], updated: .now)
            conversations.insert(conversation, at: 0)
            id = conversation.id
            currentConversationID = id
        }
        append(ChatMessage(role: .user, text: trimmed), to: id)
        try? await Task.sleep(for: .milliseconds(1100))
        append(ChatMessage(role: .coach, text: "Here's a plan for the next two hours:\n\n1. **Lab report** · 50 min deep work (I'll block TikTok and YouTube)\n2. 10 min break, stretch and water\n3. **Chapter 4** · 30 min reading\n\nWant me to start the first session?"), to: id)
    }

    private func append(_ message: ChatMessage, to id: Conversation.ID) {
        guard let index = conversations.firstIndex(where: { $0.id == id }) else { return }
        conversations[index].messages.append(message)
        conversations[index].updated = .now
    }

    /// Days a year FocuzNow could give back, from the onboarding answers (30% less phone time).
    var daysBack: Int { Int((phoneHoursGuess * 0.3 * 365 / 24).rounded()) }

    // MARK: Account

    /// Puts the locks, schedules and filter back the way they should be, for when something looks
    /// stuck (You → Support → Reload). Leaves a running emergency pass alone.
    func reloadProtections() {
        EmergencyPass.relockIfDue()
        guard LiveFocus.screenTimeApproved else { return }
        if EmergencyPass.activeUntil == nil {
            if let session, session.breakStartedAt == nil { LiveFocus.changed(session, selection: selection) }
            if let window = BlockList.dailyWindow {
                try? BlockList.scheduleDaily(window)
                if window.contains(.now) { Protections.lock(ManagedSettingsStore(named: .daily), with: selection) }
            }
        }
        Autofocus.schedule(protections, selection: selection)
        Protections.applyFilter()
        Protections.updateRemoval()
    }

    /// Stops everything FocuzNow runs on this phone: sessions, the daily block, autofocus, the filter.
    private func stopEverything() {
        if session != nil { endSession(completedFully: false) }
        BlockList.cancelDaily()
        DeviceActivityCenter().stopMonitoring()
        for name in Protections.lockStores + [.filter] {
            ManagedSettingsStore(named: name).clearAllSettings()
        }
        BlockList.cancelSessionEnd()
    }

    /// Back to the start. Your profile, PIN and settings stay on this iPhone; the blocks stop until
    /// you're signed in again (they'd have nobody to answer to).
    func signOut() {
        stopEverything()
        profile.appleLinked = false
        profile.googleLinked = false
        var stopped = protections
        stopped.autofocus = false
        stopped.adultFilter = false
        protections = stopped
        UserDefaults.standard.set(0, forKey: "onboardingStep")
        UserDefaults.standard.set(false, forKey: "onboarded")
    }

    /// Everything on this iPhone: profile, photo, PIN, protections, block list, settings. (There's
    /// no cloud account to delete yet; when sign-in reaches Supabase this also deletes that.)
    func deleteAccount() {
        stopEverything()
        PinLock.clear()
        EmergencyPass.reset()
        removeProfilePhoto()
        profile = UserProfile()
        protections = Protections()
        selection = FamilyActivitySelection()
        if let id = Bundle.main.bundleIdentifier { UserDefaults.standard.removePersistentDomain(forName: id) }
        UserDefaults(suiteName: "group.com.focuznow.shared")?.removePersistentDomain(forName: "group.com.focuznow.shared")
        UserDefaults.standard.set(false, forKey: "onboarded")
    }
}

/// Who you are, as the You tab shows it. Saved as one small JSON in this app's defaults.
struct UserProfile: Codable, Equatable {
    var name = "Maya"
    /// Without the @. Empty until you pick one (we suggest one from your name).
    var username = ""
    var occupation = ""
    var age: Int?
    /// Hours a day on your phone when you started (the onboarding's first question).
    var phoneHours = 5.0
    var memberSince = Date.now
    var appleLinked = false
    var googleLinked = false

    private static let key = "profile"

    /// "@maya", the username or one made from the name.
    var handle: String {
        let base = username.isEmpty ? name.lowercased().filter { $0.isLetter || $0.isNumber } : username
        return "@" + (base.isEmpty ? "you" : base)
    }

    static func load() -> UserProfile {
        guard let data = UserDefaults.standard.data(forKey: key),
              let profile = try? JSONDecoder().decode(UserProfile.self, from: data) else { return UserProfile() }
        return profile
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) { UserDefaults.standard.set(data, forKey: Self.key) }
    }
}
