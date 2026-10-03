import SwiftUI

struct FocusPreset: Identifiable, Hashable {
    let id: String
    var title: String
    var symbol: String
    var minutes: Int
    var breakEvery: Int?
    var breakMinutes: Int

    static let samples: [FocusPreset] = [
        FocusPreset(id: "deep", title: "Deep work", symbol: "laptopcomputer", minutes: 50, breakEvery: 50, breakMinutes: 10),
        FocusPreset(id: "school", title: "School", symbol: "book.fill", minutes: 45, breakEvery: nil, breakMinutes: 5),
        FocusPreset(id: "reading", title: "Reading", symbol: "book.closed.fill", minutes: 30, breakEvery: nil, breakMinutes: 5),
        FocusPreset(id: "sprint", title: "Sprint", symbol: "bolt.fill", minutes: 25, breakEvery: 25, breakMinutes: 5),
    ]
}

enum Difficulty: String, CaseIterable, Identifiable {
    case easy, normal, lockedIn

    var id: String { rawValue }
    var title: String {
        switch self {
        case .easy: "Easy"
        case .normal: "Normal"
        case .lockedIn: "Locked in"
        }
    }
    var symbol: String {
        switch self {
        case .easy: "leaf"
        case .normal: "shield"
        case .lockedIn: "lock.shield.fill"
        }
    }
    var detail: String {
        switch self {
        case .easy: "Breaks and ending early any time."
        case .normal: "A 10-second pause before a break or ending early."
        case .lockedIn: "No breaks, no ending early. You've got this."
        }
    }
}

struct FocusSession: Identifiable, Equatable {
    let id = UUID()
    var title: String
    var symbol: String
    var start: Date
    var duration: TimeInterval
    var difficulty: Difficulty
    var blockedCount: Int
    var breakStartedAt: Date?
    var breakLength: TimeInterval = 5 * 60
    var pausedTotal: TimeInterval = 0

    var end: Date { start.addingTimeInterval(duration + pausedTotal) }

    func isOnBreak(at date: Date) -> Bool { breakStartedAt != nil }

    func elapsed(at date: Date) -> TimeInterval {
        let current = breakStartedAt.map { date.timeIntervalSince($0) } ?? 0
        return max(0, date.timeIntervalSince(start) - pausedTotal - current)
    }

    func remaining(at date: Date) -> TimeInterval { max(0, duration - elapsed(at: date)) }
    func progress(at date: Date) -> Double { min(1, elapsed(at: date) / duration) }

    func breakRemaining(at date: Date) -> TimeInterval {
        guard let breakStartedAt else { return 0 }
        return max(0, breakLength - date.timeIntervalSince(breakStartedAt))
    }

    static func clock(_ interval: TimeInterval) -> String {
        let total = Int(interval.rounded(.up))
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
    }
}

struct CompletedSession: Identifiable {
    let id = UUID()
    let title: String
    let minutes: Int
    let coins: Int
    let scoreBefore: Double
    let scoreAfter: Double
}

struct DistractionApp: Identifiable, Hashable {
    let id: String
    let name: String
    let symbol: String
    let color: Color
    var minutesToday: Int

    static let samples: [DistractionApp] = [
        DistractionApp(id: "ig", name: "Instagram", symbol: "camera.fill", color: Color(hex: 0xE1306C), minutesToday: 64),
        DistractionApp(id: "tt", name: "TikTok", symbol: "music.note", color: Color(hex: 0x222233), minutesToday: 51),
        DistractionApp(id: "yt", name: "YouTube", symbol: "play.rectangle.fill", color: Color(hex: 0xFF3B30), minutesToday: 38),
        DistractionApp(id: "sc", name: "Snapchat", symbol: "bubble.left.fill", color: Color(hex: 0xF5C400), minutesToday: 22),
        DistractionApp(id: "dc", name: "Discord", symbol: "gamecontroller.fill", color: Color(hex: 0x5865F2), minutesToday: 17),
        DistractionApp(id: "rd", name: "Reddit", symbol: "text.bubble.fill", color: Color(hex: 0xFF5700), minutesToday: 9),
    ]
}

struct TodoItem: Identifiable, Hashable {
    let id = UUID()
    var title: String
    var list: String
    var done = false
    var due: String?
}

struct EventItem: Identifiable, Hashable {
    let id = UUID()
    var title: String
    var startHour: Double
    var hours: Double
    var color: Color
    var place: String?
}

struct VaultEntry: Identifiable, Hashable {
    enum Kind: String { case login, card, wifi, passkey }

    let id = UUID()
    var title: String
    var kind: Kind
    var username: String
    var secret: String
    var website: String?
    var strength: Double
    var favorite = false
    var vault: String

    static let samples: [VaultEntry] = [
        VaultEntry(title: "GitHub", kind: .login, username: "maya@focuznow.com", secret: "Gh-Secret!42-leaf", website: "github.com", strength: 0.92, favorite: true, vault: "Work"),
        VaultEntry(title: "Linear", kind: .login, username: "maya", secret: "linear-pass-9000", website: "linear.app", strength: 0.55, vault: "Work"),
        VaultEntry(title: "Notion", kind: .login, username: "maya@focuznow.com", secret: "n0tion·Blue·Kite", website: "notion.so", strength: 0.8, vault: "Personal"),
        VaultEntry(title: "Amex Gold", kind: .card, username: "•••• 0005", secret: "3782 822463 10005", website: nil, strength: 1, vault: "Personal"),
        VaultEntry(title: "Home Wi-Fi", kind: .wifi, username: "FocuzHouse_5G", secret: "netpw-99-orbit", website: nil, strength: 0.62, vault: "Personal"),
        VaultEntry(title: "Google", kind: .passkey, username: "maya@gmail.com", secret: "", website: "accounts.google.com", strength: 1, favorite: true, vault: "Personal"),
    ]
}

struct ChatMessage: Identifiable, Hashable {
    enum Role { case user, coach }
    let id = UUID()
    let role: Role
    var text: String
}

struct Friend: Identifiable, Hashable {
    let id = UUID()
    let name: String
    var minutesThisWeek: Int
    var focusingNow: Bool
    var isMe = false
}

struct ForestTree: Identifiable, Hashable {
    let id = UUID()
    let minutes: Int
    let kind: Int
}

struct ShopItem: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let detail: String
    let price: Int
    let scene: SceneKind?
    var owned = false
}

struct Conversation: Identifiable, Hashable {
    let id = UUID()
    var title: String
    var messages: [ChatMessage]
    var updated: Date
}

enum CoachModel: String, CaseIterable, Identifiable {
    case flash, pro

    var id: String { rawValue }
    var title: String { self == .flash ? "Flash" : "Pro" }
    var detail: String { self == .flash ? "Fast answers for everyday questions" : "Thinks deeper on hard problems and plans" }
    var symbol: String { self == .flash ? "bolt.fill" : "brain.head.profile" }
    var needsPro: Bool { self == .pro }
}

/// What's behind a running session: one of your photos, or a drawn scene.
enum SessionBackground: Hashable {
    case photo
    case scene(SceneKind)
}

enum TimerStyle: String, CaseIterable, Identifiable {
    case big, minimal, ring

    var id: String { rawValue }
    var title: String {
        switch self {
        case .big: "Big clock"
        case .minimal: "Minimal"
        case .ring: "Ring"
        }
    }
}
