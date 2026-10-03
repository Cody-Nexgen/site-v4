import AuthenticationServices
import FamilyControls
import SwiftUI
import UserNotifications

/// First launch, "Into focus" (spec §4.1–4.4):
/// 1. The lens: everything is out of focus; each tap sharpens it until the lights gather into the Beam Z.
/// 2. A conversation: FocuzNow asks a few questions; older lines blur and drift up as new ones arrive.
/// 3. The payoff: what FocuzNow can give back, from the answers.
/// 4. Account, Screen Time, apps, notifications, said the same way, then into the app.
struct OnboardingFlow: View {
    enum Stage { case lens, talk, payoff }

    @State private var stage: Stage = .lens

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            switch stage {
            case .lens:
                LensIntro { withAnimation(.smooth(duration: 0.9)) { stage = .talk } }
                    .transition(.opacity)
            case .talk:
                TalkView(done: { withAnimation(.smooth(duration: 0.9)) { stage = .payoff } })
                    .transition(.blurRise)
            case .payoff:
                PayoffAndSetup()
                    .transition(.blurRise)
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: 1. The lens

private struct LensIntro: View {
    let next: () -> Void
    @State private var focus = 0.0
    @State private var step = 0

    private let lines = [
        "Everything's blurry when ten things are pulling at you.",
        "Notifications. Feeds. One more video.",
        "Let's bring it back into focus.",
    ]

    var body: some View {
        ZStack {
            FocusField(focus: focus)
                .ignoresSafeArea()

            VStack {
                Spacer()
                if step < lines.count {
                    Text(lines[step])
                        .font(.system(size: 26, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.white)
                        .blur(radius: (1 - focus) * 7)
                        .padding(.horizontal, 36)
                        .id(step)
                        .transition(.blurRise)
                } else {
                    VStack(spacing: 6) {
                        Text("FocuzNow")
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)
                        Text("Your time, in focus.")
                            .font(.headline)
                            .foregroundStyle(.white.opacity(0.6))
                    }
                    .offset(y: 170)
                    .transition(.blurRise)
                }
                Spacer()
                if step < lines.count {
                    (Text("TAP TO ").foregroundStyle(.white.opacity(0.8)) + Text("FOCUS").foregroundStyle(Theme.accent))
                        .font(.footnote.weight(.semibold))
                        .tracking(2)
                        .padding(.bottom, 26)
                        .transition(.opacity)
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { advance() }
        .sensoryFeedback(.impact(weight: .light), trigger: step)
    }

    private func advance() {
        guard step < lines.count else { return }
        withAnimation(.smooth(duration: 1.1)) {
            step += 1
            focus = step >= lines.count ? 1 : Double(step) * 0.34
        }
        if step >= lines.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) { next() }
        }
    }
}

// MARK: 2. The conversation

/// One thing said in the conversation.
private struct Line: Identifiable, Equatable {
    enum Who { case app, person }
    let id = UUID()
    let who: Who
    let text: String
}

/// Lines arrive by blur-rise; older ones dim and blur the further back they are.
private struct Transcript: View {
    let lines: [Line]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(lines.enumerated()), id: \.element.id) { index, line in
                let age = Double(lines.count - 1 - index)
                Text(line.text)
                    .font(.system(size: 21, weight: line.who == .person ? .semibold : .regular))
                    .foregroundStyle(line.who == .person ? Theme.accent : Color.white)
                    .opacity(age == 0 ? 1 : max(0.12, 0.55 - age * 0.12))
                    .blur(radius: min(6, age * 1.6))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.blurRise)
            }
        }
        .animation(.smooth(duration: 0.6), value: lines)
    }
}

private struct TalkView: View {
    let done: () -> Void

    enum Ask { case none, name, hours, pull, purpose, reviewing }

    @Environment(AppModel.self) private var model
    @State private var lines: [Line] = []
    @State private var ask: Ask = .none
    @State private var name = ""
    @State private var progress = 0.0
    @FocusState private var nameFocused: Bool

    var body: some View {
        ZStack(alignment: .top) {
            SkyBackground(mood: .night)
            VStack(spacing: 0) {
                FocusField(focus: 1, lights: 30, markScale: 0.5)
                    .frame(width: 120, height: 120)
                    .padding(.top, 12)
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 22) {
                            Transcript(lines: lines)
                            answers
                                .id("answers")
                        }
                        .padding(.horizontal, 28)
                        .padding(.top, 20)
                        .padding(.bottom, 40)
                        .frame(maxWidth: 560)
                        .frame(maxWidth: .infinity)
                    }
                    .scrollIndicators(.hidden)
                    .defaultScrollAnchor(.bottom)
                    .onChange(of: lines.count) {
                        withAnimation(.smooth) { proxy.scrollTo("answers", anchor: .bottom) }
                    }
                }
            }
        }
        .task { await opening() }
    }

    @ViewBuilder
    private var answers: some View {
        switch ask {
        case .none:
            EmptyView()
        case .name:
            HStack {
                TextField("", text: $name, prompt: Text("Your name").foregroundStyle(.white.opacity(0.35)))
                    .font(.system(size: 21, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .textContentType(.givenName)
                    .submitLabel(.continue)
                    .focused($nameFocused)
                    .onSubmit { Task { await answeredName() } }
                Button { Task { await answeredName() } } label: {
                    Image(systemName: "arrow.right")
                        .font(.headline)
                        .foregroundStyle(.black)
                        .frame(width: 40, height: 40)
                        .background(.white, in: Circle())
                }
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                .opacity(name.trimmingCharacters(in: .whitespaces).isEmpty ? 0.3 : 1)
            }
            .padding(.vertical, 6)
            .transition(.blurRise)
            .onAppear { nameFocused = true }
        case .hours:
            Choices(options: ["Under 2 hours", "2–4 hours", "4–6 hours", "6–8 hours", "8+ hours"]) { choice in
                Task { await answeredHours(choice) }
            }
        case .pull:
            Choices(options: ["Social media", "Short videos", "Games", "Messages", "Honestly, everything"]) { choice in
                Task { await answeredPull(choice) }
            }
        case .purpose:
            Choices(options: ["School and studying", "Work", "Creative projects", "All of it"]) { choice in
                Task { await answeredPurpose(choice) }
            }
        case .reviewing:
            VStack(alignment: .leading, spacing: 12) {
                Text("Building your setup…")
                    .font(.system(size: 21))
                    .foregroundStyle(.white)
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.12))
                        Capsule().fill(Theme.accent).frame(width: max(8, proxy.size.width * progress))
                    }
                }
                .frame(height: 6)
            }
            .transition(.blurRise)
        }
    }

    // MARK: Script

    private func say(_ text: String, pause: Double = 0.9) async {
        withAnimation(.smooth(duration: 0.6)) { lines.append(Line(who: .app, text: text)) }
        try? await Task.sleep(for: .seconds(pause))
    }

    private func echo(_ text: String) {
        withAnimation(.smooth(duration: 0.5)) {
            ask = .none
            lines.append(Line(who: .person, text: text))
        }
    }

    private func opening() async {
        guard lines.isEmpty else { return }
        try? await Task.sleep(for: .seconds(0.4))
        await say("Hey. I'm FocuzNow.")
        await say("I'll ask you a few quick questions. No need to overthink it.", pause: 1.3)
        await say("First, what should I call you?", pause: 0.4)
        withAnimation(.smooth) { ask = .name }
    }

    private func answeredName() async {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        nameFocused = false
        model.userName = trimmed
        echo(trimmed)
        try? await Task.sleep(for: .seconds(0.6))
        await say("Nice to meet you, \(trimmed).")
        await say("How much time do you spend on your phone a day? Best guess is fine.", pause: 0.4)
        withAnimation(.smooth) { ask = .hours }
    }

    private func answeredHours(_ choice: String) async {
        let hours: [String: Double] = ["Under 2 hours": 1.5, "2–4 hours": 3, "4–6 hours": 5, "6–8 hours": 7, "8+ hours": 9]
        model.phoneHoursGuess = hours[choice] ?? 5
        echo(choice)
        try? await Task.sleep(for: .seconds(0.6))
        switch model.phoneHoursGuess {
        case ..<2: await say("Honestly? That's already good. Let's make it count.")
        case ..<6: await say("That's pretty normal. And pretty normal is a lot.")
        default: await say("Okay… we should talk.")
        }
        await say("What pulls you away the most?", pause: 0.4)
        withAnimation(.smooth) { ask = .pull }
    }

    private func answeredPull(_ choice: String) async {
        model.distraction = choice
        echo(choice)
        try? await Task.sleep(for: .seconds(0.6))
        await say(choice == "Honestly, everything" ? "Respect for being honest. We can work with that." : "Got it. That one's built to be hard to put down.")
        await say("And what do you want more time for?", pause: 0.4)
        withAnimation(.smooth) { ask = .purpose }
    }

    private func answeredPurpose(_ choice: String) async {
        model.focusFor = choice
        echo(choice)
        try? await Task.sleep(for: .seconds(0.6))
        await say("Perfect. Give me a second.", pause: 0.5)
        withAnimation(.smooth) { ask = .reviewing }
        withAnimation(.easeInOut(duration: 2.6)) { progress = 1 }
        try? await Task.sleep(for: .seconds(2.9))
        done()
    }
}

/// Answer options, arriving one after another.
private struct Choices: View {
    let options: [String]
    let pick: (String) -> Void
    @State private var picked: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(options.enumerated()), id: \.element) { index, option in
                Button {
                    guard picked == nil else { return }
                    picked = option
                    pick(option)
                } label: {
                    Text(option)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 13)
                        .fzGlass(in: Capsule(), interactive: true)
                }
                .buttonStyle(.plain)
                .riseIn(delay: 0.08 * Double(index))
            }
        }
        .sensoryFeedback(.selection, trigger: picked)
    }
}

// MARK: 3. Payoff and setup

private struct PayoffAndSetup: View {
    enum Step { case payoff, account, screenTime, apps, notifications, finale }

    @Environment(AppModel.self) private var model
    @AppStorage("onboarded") private var onboarded = false
    @State private var step: Step = .payoff
    @State private var count = 0
    @State private var picking = false
    @State private var showEmail = false
    @State private var email = ""
    @State private var password = ""
    @State private var focus = 0.6

    var body: some View {
        @Bindable var model = model
        ZStack {
            SkyBackground(mood: .night, intensity: step == .finale ? 1.6 : 1)
            VStack(spacing: 0) {
                FocusField(focus: step == .finale ? 1 : focus, lights: 30, markScale: 0.5)
                    .frame(width: step == .finale ? 260 : 120, height: step == .finale ? 260 : 120)
                    .padding(.top, step == .finale ? 80 : 12)
                Group {
                    switch step {
                    case .payoff: payoff
                    case .account: account
                    case .screenTime: screenTime
                    case .apps: apps
                    case .notifications: notifications
                    case .finale: finale
                    }
                }
                .id(step)
                .transition(.blurRise)
                .frame(maxWidth: 560)
                .padding(.horizontal, 28)
            }
        }
        .animation(.smooth(duration: 0.8), value: step)
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
        .onChange(of: picking) { _, open in
            if !open, !model.selection.applicationTokens.isEmpty || !model.selection.categoryTokens.isEmpty { step = .notifications }
        }
    }

    // "Maya, FocuzNow can give you back 23 days this year."
    private var payoff: some View {
        VStack(alignment: .leading, spacing: 26) {
            Spacer(minLength: 20)
            (Text("\(model.userName),\nFocuzNow can give you back\n") + Text("\(count) days").foregroundStyle(Theme.accent) + Text(" this year."))
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white)
                .contentTransition(.numericText())
            VStack(alignment: .leading, spacing: 20) {
                benefit("hourglass", "30% less screen time", "About \(GoalDial.format(Int(model.phoneHoursGuess * 0.7 * 60))) a day instead of \(GoalDial.format(Int(model.phoneHoursGuess * 60))).")
                    .riseIn(delay: 0.5)
                benefit("scope", "Deeper focus", "\(model.distraction.isEmpty ? "Distractions" : model.distraction) stay blocked while you work.")
                    .riseIn(delay: 0.8)
                benefit("sparkles", "More time for what matters", model.focusFor.isEmpty ? "Your goals, not your feed." : "\(model.focusFor), with your full attention.")
                    .riseIn(delay: 1.1)
            }
            Spacer()
            Text("Let's make it official.")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.5))
                .frame(maxWidth: .infinity)
            Button("Let's do it") { step = .account }
                .buttonStyle(.beam)
                .padding(.bottom, 12)
        }
        .onAppear {
            let target = model.daysBack
            for i in 0...target {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3 + Double(i) * (1.1 / Double(max(1, target)))) {
                    withAnimation(.snappy) { count = i }
                }
            }
        }
    }

    private func benefit(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(Theme.accent)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline).foregroundStyle(.white)
                Text(detail).font(.subheadline).foregroundStyle(.white.opacity(0.6))
            }
        }
    }

    private var account: some View {
        VStack(alignment: .leading, spacing: 14) {
            Spacer(minLength: 20)
            Text("Quick check, have we met before?")
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.bottom, 10)
            SignInWithAppleButton(.continue) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { _ in
                step = .screenTime
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: 54)
            .clipShape(Capsule())
            HStack {
                Rectangle().fill(.white.opacity(0.12)).frame(height: 1)
                Text("or").font(.footnote).foregroundStyle(.white.opacity(0.4))
                Rectangle().fill(.white.opacity(0.12)).frame(height: 1)
            }
            .padding(.vertical, 4)
            Button { step = .screenTime } label: {
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
                    SecureField("", text: $password, prompt: Text("Password").foregroundStyle(.white.opacity(0.35)))
                        .textContentType(.newPassword)
                        .padding(16)
                }
                .foregroundStyle(.white)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .transition(.blurRise)
                Button("Continue") { step = .screenTime }
                    .buttonStyle(.beam)
                    .disabled(email.isEmpty || password.count < 8)
            } else {
                Button { withAnimation(.smooth) { showEmail = true } } label: {
                    Label("Sign up with email", systemImage: "envelope.fill")
                }
                .buttonStyle(.glassPill)
            }
            Spacer()
        }
    }

    private var screenTime: some View {
        setupStep(
            lines: ["To block what pulls you away, I need Screen Time.", "I never see which apps you use or what you do in them."],
            primary: "Allow Screen Time",
            secondary: "Not now"
        ) {
            Task {
                try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                step = .apps
            }
        } onSecondary: {
            step = .apps
        }
    }

    private var apps: some View {
        setupStep(
            lines: ["Now pick what pulls you away.", "Apps, whole categories, even websites."],
            primary: "Choose apps",
            secondary: "Skip for now"
        ) {
            picking = true
        } onSecondary: {
            step = .notifications
        }
    }

    private var notifications: some View {
        setupStep(
            lines: ["Last thing.", "Can I nudge you when a session starts, and cheer when you finish one?"],
            primary: "Turn on notifications",
            secondary: "Not now"
        ) {
            Task {
                _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
                step = .finale
            }
        } onSecondary: {
            step = .finale
        }
    }

    private var finale: some View {
        VStack(spacing: 10) {
            Spacer(minLength: 30)
            Text("You're in focus, \(model.userName).")
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text("Let's get some time back.")
                .font(.headline)
                .foregroundStyle(.white.opacity(0.6))
            Spacer()
            Button("Start") { onboarded = true }
                .buttonStyle(.beam)
                .padding(.bottom, 12)
        }
        .sensoryFeedback(.success, trigger: step)
    }

    private func setupStep(lines: [String], primary: String, secondary: String, onPrimary: @escaping () -> Void, onSecondary: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Spacer(minLength: 30)
            ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                Text(line)
                    .font(.system(size: index == 0 ? 26 : 19, weight: index == 0 ? .semibold : .regular))
                    .foregroundStyle(index == 0 ? Color.white : Color.white.opacity(0.6))
                    .riseIn(delay: 0.2 + 0.35 * Double(index))
            }
            Spacer()
            Button(primary, action: onPrimary).buttonStyle(.beam)
            Button(secondary, action: onSecondary)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.55))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
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
