import AuthenticationServices
import FamilyControls
import SwiftUI
import UserNotifications

/// First launch, "Lighthouse" (docs/ios-design-spec.md §4):
/// 1. Intro: the lamp switches on over the sea. "Everything else can wait."
/// 2. Questions: the lighthouse rises into a header; every answer gets its own reply and lights
///    the lamp a little more.
/// 3. Your plan, built from the answers. Hold to light the lamp (the commitment).
/// 4. Save it (account), Screen Time, apps, notifications.
/// 5. All set: the beam sweeps and the app opens out of the light.
struct OnboardingFlow: View {
    enum Stage: Int, Comparable {
        case intro, questions, plan, account, screenTime, apps, notifications, finale
        static func < (a: Stage, b: Stage) -> Bool { a.rawValue < b.rawValue }
    }

    @Environment(AppModel.self) private var model
    @AppStorage("onboarded") private var onboarded = false
    @State private var stage: Stage = .intro
    @State private var answered = 0
    @State private var holding = false
    @State private var flash = false
    @State private var lampOn = false
    @State private var picking = false
    @State private var leaving = false

    var body: some View {
        @Bindable var model = model
        GeometryReader { proxy in
            let full = stage == .intro || stage == .plan || stage == .finale
            let headerHeight = proxy.size.height * 0.36 + proxy.safeAreaInsets.top
            ZStack(alignment: .top) {
                Color.black
                LighthouseView(scene: scene)
                    .frame(height: full ? proxy.size.height + proxy.safeAreaInsets.top + proxy.safeAreaInsets.bottom : headerHeight)
                    .mask(
                        LinearGradient(stops: [.init(color: .black, location: full ? 0.9 : 0.62), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom)
                    )
                    .overlay {
                        // Keep text readable over the scene.
                        if full {
                            LinearGradient(stops: [.init(color: .clear, location: 0.45), .init(color: .black.opacity(0.75), location: 0.9)], startPoint: .top, endPoint: .bottom)
                        }
                    }
                    .ignoresSafeArea()

                Group {
                    switch stage {
                    case .intro: intro
                    case .questions:
                        QuestionsView(answered: $answered, topInset: headerHeight - proxy.safeAreaInsets.top - 24) { stage = .plan }
                    case .plan: plan
                    case .account: account
                    case .screenTime: screenTime
                    case .apps: apps
                    case .notifications: notifications
                    case .finale: finale
                    }
                }
                .id(stage)
                .transition(.blurRise)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
            }
            .scaleEffect(leaving ? 1.6 : 1)
            .opacity(leaving ? 0 : 1)
        }
        .animation(.spring(duration: 0.8, bounce: 0.08), value: stage)
        .environment(\.colorScheme, .dark)
        .preferredColorScheme(.dark)
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
        .onChange(of: picking) { _, open in
            if !open, !model.selection.applicationTokens.isEmpty || !model.selection.categoryTokens.isEmpty { stage = .notifications }
        }
        .task {
            try? await Task.sleep(for: .milliseconds(450))
            lampOn = true
        }
        .sensoryFeedback(.impact(weight: .medium), trigger: lampOn)
        .sensoryFeedback(.selection, trigger: answered)
    }

    /// One lighthouse for the whole flow; only its framing and brightness change.
    private var scene: LighthouseScene {
        var s: LighthouseScene
        switch stage {
        case .intro: s = .hero
        case .questions: s = .header
        case .plan: s = .hero
        case .finale: s = .hero
        default: s = .header
        }
        switch stage {
        case .intro: s.power = lampOn ? 1 : 0
        case .questions: s.power = 0.3 + 0.16 * Double(answered)
        case .plan: s.power = holding ? 1.35 : 0.55
        case .finale: s.power = 1.2; s.speed = 2.4
        default: s.power = 1
        }
        s.exposure = (flash ? 2.6 : 1) * (lampOn ? 1 : 0.7)
        return s
    }

    // MARK: 1. Intro

    private var intro: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                ZMark(size: 32)
                Text("FocuzNow").font(.fzDisplay(19, weight: .bold)).foregroundStyle(.white)
            }
            .padding(.top, 12)
            .riseIn(delay: 0.9)
            Spacer()
            Text("Everything\nelse can wait.")
                .font(.fzDisplay(54))
                .fzTight(54)
                .foregroundStyle(.white)
                .riseIn(delay: 1.1)
            Text("Block distractions, run focus sessions, and keep your plans and passwords in one place.")
                .font(.body)
                .foregroundStyle(.white.opacity(0.78))
                .padding(.top, 14)
                .riseIn(delay: 1.3)
            Button("Get started") { stage = .questions }
                .buttonStyle(.beam)
                .padding(.top, 30)
                .riseIn(delay: 1.5)
            Button("I already have an account") { stage = .account }
                .buttonStyle(.ghost)
                .padding(.bottom, 8)
                .riseIn(delay: 1.6)
        }
    }

    // MARK: 3. The plan

    private var plan: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            SectionLabel("Your plan").riseIn(delay: 0.2)
            Text("\(model.userName), here's how\nwe win your time back.")
                .font(.fzDisplay(32))
                .fzTight(32)
                .foregroundStyle(.white)
                .padding(.top, 8)
                .riseIn(delay: 0.3)
            VStack(spacing: 0) {
                planRow("target", "Daily focus", GoalDial.format(model.goalMinutes))
                Divider().overlay(Color.fzOnBone.opacity(0.1))
                planRow("shield.lefthalf.filled", "Blocked while you focus", Asks.planLine(for: model.distraction, fallback: "Your top distractions"))
                Divider().overlay(Color.fzOnBone.opacity(0.1))
                planRow("clock", "Your focus block", Asks.planLine(for: model.hardestTime, fallback: "When you need it most"))
                Divider().overlay(Color.fzOnBone.opacity(0.1))
                planRow("hourglass", "What it adds up to", "About \(model.daysBack) days a year")
            }
            .fzBoneCard(padding: 6)
            .padding(.top, 20)
            .riseIn(delay: 0.5)
            HoldButton(title: "Hold to light the lamp", holdingTitle: "Lighting it up…", symbol: "light.beacon.max", duration: 1.4, onPressingChanged: { holding = $0 }) {
                Task {
                    flash = true
                    try? await Task.sleep(for: .milliseconds(450))
                    flash = false
                    holding = false
                    stage = .account
                }
            }
            .padding(.top, 26)
            .riseIn(delay: 0.8)
            Text("Holding it is a promise to yourself. You can change any of this later.")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.5))
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .padding(.top, 12)
                .padding(.bottom, 10)
                .riseIn(delay: 0.9)
        }
    }

    private func planRow(_ symbol: String, _ title: String, _ value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.fzBone)
                .frame(width: 30, height: 30)
                .background(Color.fzOnBone, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.caption).foregroundStyle(Color.fzOnBone2)
                Text(value).font(.headline).foregroundStyle(Color.fzOnBone)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
    }

    // MARK: 4. Account and permissions

    private var account: some View {
        VStack(alignment: .leading, spacing: 12) {
            Spacer()
            Text("Save your plan")
                .font(.fzDisplay(34))
                .fzTight(34)
                .foregroundStyle(.white)
                .riseIn(delay: 0.1)
            Text("So your sessions, lists and FocuzPass follow you to every device.")
                .foregroundStyle(.white.opacity(0.7))
                .padding(.bottom, 14)
                .riseIn(delay: 0.2)
            AccountButtons { stage = .screenTime }
                .riseIn(delay: 0.35)
            Spacer().frame(height: 12)
        }
    }

    private var screenTime: some View {
        PermissionStep(
            title: "Let FocuzNow block apps",
            detail: "Blocking works through Apple's Screen Time. FocuzNow never sees which apps you use or what you do in them.",
            primary: "Allow Screen Time",
            secondary: "Not now"
        ) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: "hourglass").font(.title3.weight(.semibold)).foregroundStyle(Color.fzOnBone)
                    Text("Screen Time").font(.headline).foregroundStyle(Color.fzOnBone)
                    Spacer()
                    Image(systemName: "lock.fill").foregroundStyle(Color.fzOnBone2)
                }
                Text("“FocuzNow” would like to access Screen Time")
                    .font(.subheadline)
                    .foregroundStyle(Color.fzOnBone2)
            }
            .fzBoneCard(padding: 16)
        } onPrimary: {
            Task {
                try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                stage = .apps
            }
        } onSecondary: {
            stage = .apps
        }
    }

    private var apps: some View {
        PermissionStep(
            title: "Pick what pulls you away",
            detail: "Apps, whole categories, even websites. They stay blocked while you focus.",
            primary: "Choose apps",
            secondary: "Skip for now"
        ) {
            HStack {
                AppStack(apps: DistractionApp.samples, size: 44, limit: 5)
                Spacer()
                Image(systemName: "shield.lefthalf.filled").font(.title2).foregroundStyle(Color.fzOnBone)
            }
            .fzBoneCard(padding: 16)
        } onPrimary: {
            picking = true
        } onSecondary: {
            stage = .notifications
        }
    }

    private var notifications: some View {
        PermissionStep(
            title: "Last thing",
            detail: "A nudge when a session starts, and a heads-up when it's done. Nothing else.",
            primary: "Turn on notifications",
            secondary: "Not now"
        ) {
            HStack(alignment: .top, spacing: 12) {
                ZMark(size: 36).environment(\.colorScheme, .dark)
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text("FocuzNow").font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzOnBone)
                        Spacer()
                        Text("now").font(.caption).foregroundStyle(Color.fzOnBone2)
                    }
                    Text("50 minutes, done. The lamp stayed on the whole time.")
                        .font(.subheadline)
                        .foregroundStyle(Color.fzOnBone)
                }
            }
            .fzBoneCard(cornerRadius: 22, padding: 14)
        } onPrimary: {
            Task {
                _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
                stage = .finale
            }
        } onSecondary: {
            stage = .finale
        }
    }

    // MARK: 5. All set

    private var finale: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            Text("You're all set,\n\(model.userName).")
                .font(.fzDisplay(46))
                .fzTight(46)
                .foregroundStyle(.white)
                .riseIn(delay: 0.3)
            Text("Everything else can wait.")
                .font(.title3.weight(.medium))
                .foregroundStyle(.white.opacity(0.7))
                .padding(.top, 10)
                .riseIn(delay: 0.5)
            Button("Enter FocuzNow") {
                Task {
                    flash = true
                    withAnimation(.easeIn(duration: 0.55)) { leaving = true }
                    try? await Task.sleep(for: .milliseconds(450))
                    onboarded = true
                }
            }
            .buttonStyle(.beam)
            .padding(.top, 30)
            .padding(.bottom, 12)
            .riseIn(delay: 0.8)
        }
        .sensoryFeedback(.success, trigger: stage)
    }
}

// MARK: Questions

/// One question at a time. Pick an answer and the others step aside; a reply written for that exact
/// answer rises in, then Continue.
private struct QuestionsView: View {
    @Binding var answered: Int
    let topInset: CGFloat
    let done: () -> Void

    @Environment(AppModel.self) private var model
    @State private var index = 0
    @State private var name = ""
    @State private var picked: Asks.Option?
    @FocusState private var nameFocused: Bool

    private var total: Int { Asks.all.count + 1 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                progress
                    .padding(.bottom, 22)
                Group {
                    if index == 0 { nameStep } else { askStep(Asks.all[index - 1]) }
                }
                .id(index)
                .transition(.blurRise)
            }
            .padding(.top, topInset)
            .padding(.bottom, 30)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize)
        .animation(.spring(duration: 0.55, bounce: 0.12), value: index)
        .animation(.spring(duration: 0.55, bounce: 0.12), value: picked)
    }

    private var progress: some View {
        HStack(spacing: 6) {
            ForEach(0..<total, id: \.self) { step in
                Capsule()
                    .fill(step < answered ? Color.white : step == index ? Color.white.opacity(0.45) : Color.white.opacity(0.14))
                    .frame(height: 4)
            }
        }
        .animation(.spring(duration: 0.5), value: answered)
    }

    // Name

    private var nameStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("First, what should we call you?")
                .font(.fzDisplay(32))
                .fzTight(32)
                .foregroundStyle(.white)
            if picked == nil {
                TextField("", text: $name, prompt: Text("Your first name").foregroundStyle(.white.opacity(0.3)))
                    .font(.fzDisplay(28, weight: .bold))
                    .foregroundStyle(.white)
                    .textContentType(.givenName)
                    .submitLabel(.continue)
                    .focused($nameFocused)
                    .onSubmit(submitName)
                    .padding(.vertical, 12)
                    .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.2)).frame(height: 1) }
                    .onAppear { nameFocused = true }
                Button("Continue", action: submitName)
                    .buttonStyle(.beam)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                    .padding(.top, 10)
            } else {
                reply(
                    Asks.Option(title: name, symbol: "hand.wave", reply: "Nice to meet you, \(model.userName).", detail: "Four quick questions and your plan is ready. Takes about a minute.", plan: ""),
                    next: { index = 1; picked = nil }
                )
            }
        }
    }

    private func submitName() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        nameFocused = false
        model.userName = trimmed
        picked = Asks.Option(title: trimmed, symbol: "", reply: "", detail: "", plan: "")
        answered = max(answered, 1)
    }

    // Options

    private func askStep(_ ask: Asks.Ask) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(ask.question)
                .font(.fzDisplay(32))
                .fzTight(32)
                .foregroundStyle(.white)
            if let hint = ask.hint {
                Text(hint).font(.subheadline).foregroundStyle(.white.opacity(0.55))
            }
            Spacer().frame(height: 8)
            ForEach(Array(ask.options.enumerated()), id: \.element.id) { offset, option in
                if picked == nil || picked == option {
                    Button { choose(option, in: ask) } label: { optionRow(option, selected: picked == option) }
                        .buttonStyle(.pressable)
                        .disabled(picked != nil)
                        .riseIn(delay: 0.05 * Double(offset))
                        .transition(.asymmetric(insertion: .identity, removal: .opacity.combined(with: .scale(scale: 0.96))))
                }
            }
            if let picked {
                reply(picked, next: {
                    if index < Asks.all.count {
                        index += 1
                        self.picked = nil
                    } else {
                        done()
                    }
                })
                .padding(.top, 6)
            }
        }
    }

    private func optionRow(_ option: Asks.Option, selected: Bool) -> some View {
        HStack(spacing: 14) {
            Image(systemName: option.symbol)
                .font(.system(size: 15, weight: .semibold))
                .frame(width: 34, height: 34)
                .background((selected ? Color.black : Color.white).opacity(0.08), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            Text(option.title).font(.headline)
            Spacer()
            if selected { Image(systemName: "checkmark").font(.subheadline.weight(.bold)) }
        }
        .foregroundStyle(selected ? Color.black : Color.white)
        .padding(12)
        .background(selected ? Color.white : Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(selected ? 0 : 0.1)))
    }

    private func choose(_ option: Asks.Option, in ask: Asks.Ask) {
        picked = option
        answered = max(answered, index + 1)
        switch ask.id {
        case "hours":
            model.phoneHoursGuess = option.value
            model.goalMinutes = option.value < 2 ? 60 : option.value < 6 ? 90 : 120
        case "pull": model.distraction = option.title
        case "time": model.hardestTime = option.title
        default: model.focusFor = option.title
        }
    }

    /// The reply for that exact answer, on the website's bone card.
    private func reply(_ option: Asks.Option, next: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
                Text(option.reply)
                    .font(.fzDisplay(24))
                    .fzTight(24)
                    .foregroundStyle(Color.fzOnBone)
                Text(option.detail)
                    .font(.subheadline)
                    .foregroundStyle(Color.fzOnBone2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .fzBoneCard(cornerRadius: 22, padding: 18)
            .riseIn(delay: 0.15)
            Button("Continue", action: next)
                .buttonStyle(.beam)
                .riseIn(delay: 0.35)
        }
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

/// A setup step: a title, why, a small picture of what happens, then the action.
private struct PermissionStep<Picture: View>: View {
    let title: String
    let detail: String
    let primary: String
    let secondary: String
    @ViewBuilder let picture: Picture
    let onPrimary: () -> Void
    let onSecondary: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            Text(title)
                .font(.fzDisplay(34))
                .fzTight(34)
                .foregroundStyle(.white)
                .riseIn(delay: 0.1)
            Text(detail)
                .foregroundStyle(.white.opacity(0.7))
                .padding(.top, 10)
                .riseIn(delay: 0.2)
            picture
                .padding(.top, 24)
                .riseIn(delay: 0.35)
            Spacer()
            Button(primary, action: onPrimary)
                .buttonStyle(.beam)
                .riseIn(delay: 0.5)
            Button(secondary, action: onSecondary)
                .buttonStyle(.ghost)
                .padding(.bottom, 4)
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
