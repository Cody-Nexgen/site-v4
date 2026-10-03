import FamilyControls
import Observation
import SwiftUI

/// Everything the screens show. Mock data until the backend phases wire it to Supabase and Screen Time.
@MainActor
@Observable
final class AppModel {
    // Profile and today
    var userName = "Maya"
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
    var scene: SceneKind = .nightLake
    var selection = FamilyActivitySelection()
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
    var chat: [ChatMessage] = [
        ChatMessage(role: .coach, text: "Hey Maya 👋 You focused **74 minutes** so far today, that's ahead of your usual Saturday. What should we tackle next?"),
    ]
    var friends: [Friend] = [
        Friend(name: "Ava", minutesThisWeek: 412, focusingNow: true),
        Friend(name: "Leo", minutesThisWeek: 368, focusingNow: false),
        Friend(name: "Maya", minutesThisWeek: 345, focusingNow: false, isMe: true),
        Friend(name: "Kai", minutesThisWeek: 290, focusingNow: true),
        Friend(name: "Zoe", minutesThisWeek: 214, focusingNow: false),
    ]
    var rooms: [FocusRoom] = [
        FocusRoom(name: "Study hall", people: ["Ava", "Kai", "Noor", "Eli"], minutesLeft: 32),
        FocusRoom(name: "Late night grind", people: ["Leo", "Sam"], minutesLeft: 48),
    ]
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
        // Phase 2: apply the ManagedSettings shield and schedule DeviceActivity.
    }

    func takeBreak() {
        guard var current = session, current.breakStartedAt == nil, current.difficulty != .lockedIn else { return }
        current.breakStartedAt = .now
        session = current
    }

    func endBreak() {
        guard var current = session, let started = current.breakStartedAt else { return }
        current.pausedTotal += Date.now.timeIntervalSince(started)
        current.breakStartedAt = nil
        session = current
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
    }

    /// Called every second by the root view.
    func tick() {
        guard let current = session else { return }
        if current.breakStartedAt != nil, current.breakRemaining(at: .now) <= 0 { endBreak() }
        if current.remaining(at: .now) <= 0 {
            endSession(completedFully: true)
            showSession = true
        }
    }

    // MARK: Coach (mock replies until Phase 4)

    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        chat.append(ChatMessage(role: .user, text: trimmed))
        try? await Task.sleep(for: .milliseconds(900))
        chat.append(ChatMessage(role: .coach, text: "Here's a plan for the next two hours:\n\n1. **Lab report** · 50 min deep work (I'll block TikTok and YouTube)\n2. 10 min break, stretch and water\n3. **Chapter 4** · 30 min reading\n\nWant me to start the first session?"))
    }
}
