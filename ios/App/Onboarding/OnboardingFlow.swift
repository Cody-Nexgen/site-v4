import AuthenticationServices
import SwiftUI

/// First launch. The Island onboarding (docs/ios-island-plan.md §4): answers, apps and your first
/// session get flicked up into the Dynamic Island. The v3 "Lighthouse" flow is in
/// `backups/ios-onboarding-v3-2026-10-04/`.
struct OnboardingFlow: View {
    var body: some View {
        IslandOnboarding()
    }
}

/// The questions and a reply for every single answer.
enum Asks {
    struct Option: Identifiable, Hashable {
        var id: String { title }
        let title: String
        let symbol: String
        let reply: String
        let detail: String
        /// The line this answer adds to "Your plan".
        let plan: String
        var value: Double = 0
    }

    struct Ask: Identifiable {
        let id: String
        let question: String
        var hint: String? = nil
        let options: [Option]
    }

    static let all: [Ask] = [
        Ask(id: "hours", question: "How long are you on your phone a day?", hint: "Best guess. Nobody's checking.", options: [
            Option(title: "Under 2 hours", symbol: "leaf", reply: "You're already ahead.", detail: "Most people spend over four. We'll keep the time you have pointed at what you care about.", plan: "", value: 1.5),
            Option(title: "2 to 4 hours", symbol: "circle.lefthalf.filled", reply: "Pretty balanced.", detail: "Trim just 30 minutes a day and that's about a week back every year.", plan: "", value: 3),
            Option(title: "4 to 6 hours", symbol: "briefcase", reply: "That's a part-time job.", detail: "Five hours a day is about 76 days a year. Let's win some of that back.", plan: "", value: 5),
            Option(title: "6 to 8 hours", symbol: "exclamationmark.circle", reply: "Okay, we've got work to do.", detail: "That's a whole school day on your phone. Blocking your top two apps usually does the most.", plan: "", value: 7),
            Option(title: "More than 8", symbol: "flame", reply: "Honest answer. Respect.", detail: "No judgement. We'll start small: one block during your hardest hour.", plan: "", value: 9),
        ]),
        Ask(id: "pull", question: "What pulls you away the most?", options: [
            Option(title: "Short videos", symbol: "play.square.stack", reply: "The scroll with no bottom.", detail: "Short videos are built so there's never a good place to stop. We'll give you one.", plan: "TikTok, Reels and Shorts"),
            Option(title: "Social media", symbol: "person.2", reply: "The feed never ends.", detail: "We'll hide it while you focus. Your friends will still be there after.", plan: "Instagram, Snapchat and X"),
            Option(title: "YouTube", symbol: "play.rectangle", reply: "One video becomes twelve.", detail: "We'll block it during sessions, and you can keep links for school if you need them.", plan: "YouTube"),
            Option(title: "Games", symbol: "gamecontroller", reply: "Just one more round.", detail: "Games can stay. Just not during homework. We'll fence them into your free time.", plan: "Games, until your session's done"),
            Option(title: "Group chats", symbol: "bubble.left.and.bubble.right", reply: "The buzz that never stops.", detail: "We'll hold notifications while you focus and let them all in when you're done.", plan: "Chats and their notifications"),
            Option(title: "Honestly, everything", symbol: "square.grid.3x3", reply: "Everything, all at once. Got it.", detail: "Then we'll block by category, so you don't have to pick app by app.", plan: "Social, video and games"),
        ]),
        Ask(id: "time", question: "When is it hardest to focus?", options: [
            Option(title: "Mornings", symbol: "sunrise", reply: "Rough starts.", detail: "We'll keep the first hour quiet so the day starts on your terms.", plan: "7:00 to 8:00 AM, phone quiet"),
            Option(title: "After school", symbol: "backpack", reply: "The 3 PM slump.", detail: "That's when homework loses to the couch. A short session right after school works wonders.", plan: "3:30 to 5:00 PM"),
            Option(title: "Evenings", symbol: "sunset", reply: "Prime scrolling hours.", detail: "We'll set an evening block for homework and let the fun back in after.", plan: "7:00 to 9:00 PM"),
            Option(title: "Late at night", symbol: "moon.stars", reply: "Bedtime scrolling.", detail: "Screens late at night wreck sleep. A wind-down from 10 PM fixes a lot.", plan: "Wind-down from 10:00 PM"),
        ]),
        Ask(id: "purpose", question: "What do you want more time for?", options: [
            Option(title: "School and studying", symbol: "book", reply: "Let's get those grades up.", detail: "Study sessions with breaks built in, and Coach can plan your exams with you.", plan: ""),
            Option(title: "Work", symbol: "laptopcomputer", reply: "Deep work, coming up.", detail: "Long, uninterrupted blocks, with your day laid out in Plan.", plan: ""),
            Option(title: "Making things", symbol: "paintbrush.pointed", reply: "Make more stuff.", detail: "Creative work needs long stretches. We'll protect them.", plan: ""),
            Option(title: "Sleep and health", symbol: "bed.double", reply: "Rest counts too.", detail: "We'll help you put the phone down at night and keep mornings calm.", plan: ""),
            Option(title: "All of it", symbol: "sparkles", reply: "Ambitious. We like it.", detail: "We'll balance your focus time across everything.", plan: ""),
        ]),
    ]

    /// The daily block for "When is it hardest to focus?" (the monitor needs at least 15 minutes and a
    /// window inside one day).
    static func blockWindow(for hardestTime: String) -> BlockList.Window? {
        switch hardestTime {
        case "Mornings": BlockList.Window(startHour: 7, startMinute: 0, endHour: 8, endMinute: 0)
        case "After school": BlockList.Window(startHour: 15, startMinute: 30, endHour: 17, endMinute: 0)
        case "Evenings": BlockList.Window(startHour: 19, startMinute: 0, endHour: 21, endMinute: 0)
        case "Late at night": BlockList.Window(startHour: 22, startMinute: 0, endHour: 23, endMinute: 59)
        default: nil
        }
    }

    /// The focus preset that fits "What do you want more time for?".
    static func presetID(for focusFor: String) -> String {
        switch focusFor {
        case "School and studying": "school"
        case "Sleep and health": "reading"
        default: "deep"
        }
    }

    static func planLine(for title: String, fallback: String) -> String {
        for ask in all {
            if let option = ask.options.first(where: { $0.title == title }), !option.plan.isEmpty { return option.plan }
        }
        return fallback
    }
}

// MARK: Shared pieces

/// Sign in with Apple, Google, or email.
struct AccountButtons: View {
    let done: () -> Void
    @State private var showEmail = false
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: 10) {
            SignInWithAppleButton(.continue) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { _ in
                done()
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            Button(action: done) {
                Label("Continue with Google", systemImage: "g.circle.fill")
            }
            .buttonStyle(.glassPill)
            if showEmail {
                VStack(spacing: 0) {
                    TextField("", text: $email, prompt: Text("Email").foregroundStyle(.white.opacity(0.35)))
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .padding(16)
                    Rectangle().fill(.white.opacity(0.1)).frame(height: 1)
                    SecureField("", text: $password, prompt: Text("Password (8+ characters)").foregroundStyle(.white.opacity(0.35)))
                        .textContentType(.newPassword)
                        .padding(16)
                }
                .foregroundStyle(.white)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(0.1)))
                .transition(.blurRise)
                Button("Continue", action: done)
                    .buttonStyle(.beam)
                    .disabled(!email.contains("@") || password.count < 8)
            } else {
                Button { withAnimation(.spring(duration: 0.5)) { showEmail = true } } label: {
                    Label("Continue with email", systemImage: "envelope")
                }
                .buttonStyle(.glassPill)
            }
        }
    }
}

/// Formats minutes as "2h 30m" (used across the app).
enum GoalDial {
    static func format(_ minutes: Int) -> String {
        let h = minutes / 60, m = minutes % 60
        if h == 0 { return "\(m)m" }
        return m == 0 ? "\(h)h" : "\(h)h \(m)m"
    }
}
