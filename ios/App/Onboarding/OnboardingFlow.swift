import AuthenticationServices
import FamilyControls
import SwiftUI
import UserNotifications

/// First launch (spec §4.2–4.4): intro pages → account → name and goal → Screen Time → apps → notifications → done.
struct OnboardingFlow: View {
    enum Step: Int, CaseIterable {
        case intro, account, goal, screenTime, apps, notifications, done
    }

    @Environment(AppModel.self) private var model
    @AppStorage("onboarded") private var onboarded = false
    @State private var step: Step = .intro

    var body: some View {
        ZStack {
            SkyBackground(mood: mood)
                .animation(.easeInOut(duration: 0.8), value: step)

            Group {
                switch step {
                case .intro: IntroPager(next: { go(.account) })
                case .account: AccountView(back: { go(.intro) }, next: { go(.goal) })
                case .goal: GoalSetupView(next: { go(.screenTime) })
                case .screenTime: ScreenTimeSetupView(next: { go(.apps) })
                case .apps: AppsSetupView(next: { go(.notifications) })
                case .notifications: NotificationsSetupView(next: { go(.done) })
                case .done: SetupDoneView(finish: { onboarded = true })
                }
            }
            .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))
            .id(step)

            if (Step.goal.rawValue...Step.notifications.rawValue).contains(step.rawValue) {
                VStack {
                    SetupProgress(step: step.rawValue - Step.goal.rawValue, total: 4)
                        .padding(.horizontal, 24)
                        .padding(.top, 8)
                    Spacer()
                }
            }
        }
        .animation(.smooth(duration: 0.45), value: step)
    }

    private var mood: SkyMood {
        switch step {
        case .intro: .night
        case .account: .violet
        case .goal: .dawn
        case .screenTime, .apps: .dusk
        case .notifications: .day
        case .done: .violet
        }
    }

    private func go(_ next: Step) { step = next }
}

private struct SetupProgress: View {
    let step: Int
    let total: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<total, id: \.self) { index in
                Capsule()
                    .fill(index <= step ? AnyShapeStyle(Theme.beamGradient) : AnyShapeStyle(Color.fzLine))
                    .frame(height: 4)
            }
        }
    }
}

// MARK: Intro pages

private struct IntroPager: View {
    let next: () -> Void
    @State private var page = 0

    private let pages: [(title: String, body: String)] = [
        ("Your focus,\nmade visible.", "Every minute you focus fills the Beam. Watch it glow as your day comes together."),
        ("Block what\npulls you away.", "Pick the apps and sites that steal your time. FocuzNow shields them while you work."),
        ("Your plan and\npasswords, too.", "Lists, calendar, an AI coach and FocuzPass, all in one calm app that syncs with your browser."),
        ("Friends keep\nyou honest.", "Focus together in rooms, climb the weekly board, and grow a forest along the way."),
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                PageDots(count: pages.count, index: page)
                Spacer()
                Button("Skip", action: next)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.fzInk2)
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)

            TabView(selection: $page) {
                ForEach(pages.indices, id: \.self) { index in
                    VStack(spacing: 28) {
                        Spacer(minLength: 10)
                        IntroArt(page: index)
                            .frame(height: 320)
                        VStack(alignment: .leading, spacing: 12) {
                            Text(pages[index].title)
                                .font(.system(size: 36, weight: .bold))
                                .foregroundStyle(Color.fzInk)
                            Text(pages[index].body)
                                .font(.body)
                                .foregroundStyle(Color.fzInk2)
                        }
                        .frame(maxWidth: 520, alignment: .leading)
                        .padding(.horizontal, 28)
                        Spacer(minLength: 10)
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            Button(page == pages.count - 1 ? "Get started" : "Continue") {
                if page == pages.count - 1 { next() } else { withAnimation(.smooth) { page += 1 } }
            }
            .buttonStyle(.beam)
            .frame(maxWidth: 520)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
        }
    }
}

private struct PageDots: View {
    let count: Int
    let index: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<count, id: \.self) { i in
                Capsule()
                    .fill(i == index ? Color.fzInk : Color.fzInk3)
                    .frame(width: i == index ? 22 : 7, height: 7)
            }
        }
        .animation(.smooth, value: index)
    }
}

private struct IntroArt: View {
    let page: Int
    @State private var appear = false

    var body: some View {
        ZStack {
            switch page {
            case 0:
                BeamView(fill: appear ? 0.72 : 0.1, score: 8.4, active: true, width: 140, height: 270)
            case 1:
                ZStack {
                    ForEach(Array(DistractionApp.samples.prefix(5).enumerated()), id: \.offset) { index, app in
                        AppIcon(app: app, size: 64)
                            .offset(x: CGFloat(index - 2) * 58, y: CGFloat(abs(index - 2)) * 14)
                            .rotationEffect(.degrees(Double(index - 2) * 6))
                            .opacity(appear ? 0.25 : 1)
                            .blur(radius: appear ? 2 : 0)
                    }
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.system(size: 96, weight: .semibold))
                        .foregroundStyle(Theme.beamGradient)
                        .shadow(color: Theme.violet.opacity(0.6), radius: 24)
                        .scaleEffect(appear ? 1 : 0.6)
                        .opacity(appear ? 1 : 0)
                }
            case 2:
                ZStack {
                    BeamView(fill: 0.5, score: 6, width: 90, height: 170)
                    orbit("checklist", "Plan", angle: -150)
                    orbit("key.fill", "Pass", angle: -30)
                    orbit("sparkles", "Coach", angle: 90)
                }
            default:
                ZStack {
                    ForEach(Array(["Ava", "Leo", "Kai", "Zoe", "Noor"].enumerated()), id: \.offset) { index, name in
                        let angle = Double(index) / 5 * 2 * .pi - .pi / 2
                        Avatar(name: name, size: 62)
                            .offset(x: cos(angle) * 110, y: sin(angle) * 110)
                            .scaleEffect(appear ? 1 : 0.4)
                    }
                    Avatar(name: "Maya", size: 92)
                        .overlay(Circle().strokeBorder(Theme.beamGradient, lineWidth: 3).padding(-6))
                }
            }
        }
        .onAppear { withAnimation(.smooth(duration: 1.1).delay(0.15)) { appear = true } }
        .onDisappear { appear = false }
    }

    private func orbit(_ symbol: String, _ title: String, angle: Double) -> some View {
        let radians = angle * .pi / 180
        return Label(title, systemImage: symbol)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.fzInk)
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .fzGlass(in: Capsule())
            .offset(x: cos(radians) * 120 * (appear ? 1 : 0.5), y: sin(radians) * 120 * (appear ? 1 : 0.5))
            .opacity(appear ? 1 : 0)
    }
}

// MARK: Account

private struct AccountView: View {
    let back: () -> Void
    let next: () -> Void

    @Environment(\.colorScheme) private var scheme
    @State private var email = ""
    @State private var password = ""
    @State private var signingIn = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                GlassCircleButton(symbol: "chevron.left", size: 40, action: back)
                    .padding(.bottom, 8)
                Text(signingIn ? "Welcome back" : "Create your account")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(Color.fzInk)
                Text("Sync your focus, lists and FocuzPass with the FocuzNow extension.")
                    .foregroundStyle(Color.fzInk2)
                    .padding(.bottom, 8)

                SignInWithAppleButton(signingIn ? .signIn : .signUp) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { _ in
                    next()
                }
                .signInWithAppleButtonStyle(scheme == .dark ? .white : .black)
                .frame(height: 54)
                .clipShape(Capsule())

                Button(action: next) {
                    HStack(spacing: 10) {
                        Text("G").font(.system(size: 19, weight: .bold, design: .rounded))
                            .foregroundStyle(LinearGradient(colors: [Color(hex: 0x4285F4), Color(hex: 0xEA4335), Color(hex: 0xFBBC05), Color(hex: 0x34A853)], startPoint: .topLeading, endPoint: .bottomTrailing))
                        Text("Continue with Google")
                    }
                }
                .buttonStyle(.glassPill)

                HStack {
                    Rectangle().fill(Color.fzLine).frame(height: 1)
                    Text("or").font(.footnote).foregroundStyle(Color.fzInk3)
                    Rectangle().fill(Color.fzLine).frame(height: 1)
                }
                .padding(.vertical, 4)

                VStack(spacing: 0) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .padding(16)
                    Divider().overlay(Color.fzLine)
                    SecureField("Password", text: $password)
                        .textContentType(signingIn ? .password : .newPassword)
                        .padding(16)
                }
                .foregroundStyle(Color.fzInk)
                .fzSurface(cornerRadius: 18)

                Button(signingIn ? "Sign in" : "Create account", action: next)
                    .buttonStyle(.beam)
                    .padding(.top, 4)

                Button {
                    withAnimation(.smooth) { signingIn.toggle() }
                } label: {
                    Text(LocalizedStringKey(signingIn ? "New here? **Create an account**" : "Have an account? **Sign in**"))
                        .font(.footnote)
                        .foregroundStyle(Color.fzInk2)
                        .frame(maxWidth: .infinity)
                }
                .padding(.top, 4)
            }
            .frame(maxWidth: 520)
            .padding(24)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

// MARK: Setup steps

private struct SetupScaffold<Art: View, Extra: View>: View {
    let title: String
    let message: String
    let primary: String
    var secondary: String? = nil
    let onPrimary: () -> Void
    var onSecondary: (() -> Void)? = nil
    @ViewBuilder var art: Art
    @ViewBuilder var extra: Extra

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 40)
            art.frame(maxHeight: 300)
            Spacer(minLength: 20)
            VStack(alignment: .leading, spacing: 12) {
                Text(title)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(Color.fzInk)
                Text(message)
                    .foregroundStyle(Color.fzInk2)
                extra
            }
            .frame(maxWidth: 520, alignment: .leading)
            .padding(.horizontal, 28)
            Spacer(minLength: 20)
            VStack(spacing: 10) {
                Button(primary, action: onPrimary).buttonStyle(.beam)
                if let secondary, let onSecondary {
                    Button(secondary, action: onSecondary)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.fzInk2)
                        .padding(.vertical, 8)
                }
            }
            .frame(maxWidth: 520)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
        }
    }
}

private struct GoalSetupView: View {
    let next: () -> Void
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        SetupScaffold(
            title: "What's your daily goal?",
            message: "How much focused time feels right for a normal day. You can change it any time.",
            primary: "Continue",
            onPrimary: next
        ) {
            GoalDial(minutes: $model.goalMinutes)
        } extra: {
            TextField("Your name", text: $model.userName)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.fzInk)
                .padding(16)
                .fzSurface(cornerRadius: 16)
                .padding(.top, 8)
        }
    }
}

/// A Beam-styled dial: drag around the ring to set the goal (30 min to 8 h, 15-minute steps).
struct GoalDial: View {
    @Binding var minutes: Int
    let range = 30...480

    var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            let fraction = Double(minutes - range.lowerBound) / Double(range.upperBound - range.lowerBound)
            ZStack {
                Circle().stroke(Color.fzLine, lineWidth: 18)
                Circle()
                    .trim(from: 0, to: max(0.02, fraction))
                    .stroke(AngularGradient(colors: [Theme.indigo, Theme.violet, Theme.coral, Theme.indigo], center: .center), style: StrokeStyle(lineWidth: 18, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .shadow(color: Theme.violet.opacity(0.5), radius: 12)
                Circle()
                    .fill(.white)
                    .frame(width: 28, height: 28)
                    .shadow(radius: 4)
                    .offset(y: -side / 2 + 9)
                    .rotationEffect(.degrees(360 * fraction))
                VStack(spacing: 2) {
                    Text(Self.format(minutes))
                        .font(.fzHero(52))
                        .foregroundStyle(Color.fzInk)
                        .contentTransition(.numericText())
                    SectionLabel("a day")
                }
            }
            .frame(width: side - 20, height: side - 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Circle())
            .gesture(
                DragGesture(minimumDistance: 0).onChanged { drag in
                    let center = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2)
                    let dx = Double(drag.location.x - center.x)
                    let dy = Double(drag.location.y - center.y)
                    var angle = atan2(dx, -dy)
                    if angle < 0 { angle += 2 * .pi }
                    let raw = Double(range.lowerBound) + angle / (2 * .pi) * Double(range.upperBound - range.lowerBound)
                    let snapped = Int((raw / 15).rounded()) * 15
                    let value = min(range.upperBound, max(range.lowerBound, snapped))
                    if value != minutes {
                        withAnimation(.snappy) { minutes = value }
                    }
                }
            )
            .sensoryFeedback(.selection, trigger: minutes)
        }
        .frame(height: 280)
        .accessibilityElement()
        .accessibilityLabel("Daily goal")
        .accessibilityValue(Self.format(minutes))
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: minutes = min(range.upperBound, minutes + 15)
            case .decrement: minutes = max(range.lowerBound, minutes - 15)
            @unknown default: break
            }
        }
    }

    static func format(_ minutes: Int) -> String {
        let h = minutes / 60, m = minutes % 60
        if h == 0 { return "\(m)m" }
        return m == 0 ? "\(h)h" : "\(h)h \(m)m"
    }
}

private struct ScreenTimeSetupView: View {
    let next: () -> Void
    @State private var error: String?

    var body: some View {
        SetupScaffold(
            title: "Allow Screen Time",
            message: "FocuzNow uses Screen Time to block the apps you pick, only during your sessions. It never sees which apps you use or what you do in them.",
            primary: "Allow Screen Time",
            secondary: "Not now",
            onPrimary: { Task { await request() } },
            onSecondary: next
        ) {
            ZStack {
                RoundedRectangle(cornerRadius: 34, style: .continuous)
                    .fill(Color.fzSurface)
                    .overlay(RoundedRectangle(cornerRadius: 34, style: .continuous).strokeBorder(Color.fzLine))
                    .frame(width: 230, height: 230)
                Image(systemName: "hourglass")
                    .font(.system(size: 90, weight: .semibold))
                    .foregroundStyle(Theme.beamGradient)
                    .symbolEffect(.pulse)
            }
        } extra: {
            if let error {
                Text(error).font(.footnote).foregroundStyle(Theme.warn)
            }
        }
    }

    @MainActor
    private func request() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            next()
        } catch {
            self.error = "Screen Time didn't turn on (it only works on a real iPhone or iPad). You can try again in Settings."
        }
    }
}

private struct AppsSetupView: View {
    let next: () -> Void
    @Environment(AppModel.self) private var model
    @State private var picking = false

    var body: some View {
        @Bindable var model = model
        SetupScaffold(
            title: "What distracts you?",
            message: "Choose the apps, categories and sites FocuzNow should block during focus sessions.",
            primary: model.selection.applicationTokens.isEmpty && model.selection.categoryTokens.isEmpty ? "Choose apps" : "Continue",
            secondary: "Skip for now",
            onPrimary: {
                if model.selection.applicationTokens.isEmpty && model.selection.categoryTokens.isEmpty { picking = true } else { next() }
            },
            onSecondary: next
        ) {
            VStack(spacing: 18) {
                if model.selection.applicationTokens.isEmpty {
                    AppStack(apps: DistractionApp.samples, size: 70, limit: 4)
                } else {
                    HStack(spacing: -14) {
                        ForEach(Array(model.selection.applicationTokens.prefix(5)), id: \.self) { token in
                            Label(token)
                                .labelStyle(.iconOnly)
                                .scaleEffect(2.2)
                                .frame(width: 70, height: 70)
                        }
                    }
                    Text("\(model.selection.applicationTokens.count) apps · \(model.selection.categoryTokens.count) categories · \(model.selection.webDomainTokens.count) sites")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.fzInk2)
                }
            }
        } extra: {
            EmptyView()
        }
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
    }
}

private struct NotificationsSetupView: View {
    let next: () -> Void

    var body: some View {
        SetupScaffold(
            title: "Stay on track",
            message: "Get a gentle nudge when a planned session starts, and a cheer when you finish one.",
            primary: "Turn on notifications",
            secondary: "Not now",
            onPrimary: {
                Task {
                    _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
                    await MainActor.run { next() }
                }
            },
            onSecondary: next
        ) {
            VStack(spacing: 10) {
                notification("Time to focus", "Deep work starts in 5 minutes", "bolt.fill")
                notification("Session complete 🎉", "50 minutes · your Beam is 80% full", "checkmark.seal.fill")
                    .scaleEffect(0.94)
                    .opacity(0.8)
            }
            .padding(.horizontal, 28)
        } extra: {
            EmptyView()
        }
    }

    private func notification(_ title: String, _ body: String, _ symbol: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(Theme.beamGradient, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzInk)
                Text(body).font(.footnote).foregroundStyle(Color.fzInk2)
            }
            Spacer()
            Text("now").font(.caption2).foregroundStyle(Color.fzInk3)
        }
        .padding(14)
        .frame(maxWidth: 420)
        .fzGlass(in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

private struct SetupDoneView: View {
    let finish: () -> Void
    @Environment(AppModel.self) private var model
    @State private var fill = 0.05
    @State private var burst = false

    var body: some View {
        VStack(spacing: 26) {
            Spacer()
            ZStack {
                ForEach(0..<14, id: \.self) { index in
                    let angle = Double(index) / 14 * 2 * .pi
                    Circle()
                        .fill(index.isMultiple(of: 2) ? Theme.coral : Theme.violet)
                        .frame(width: 8, height: 8)
                        .offset(x: cos(angle) * (burst ? 160 : 10), y: sin(angle) * (burst ? 160 : 10))
                        .opacity(burst ? 0 : 1)
                }
                BeamView(fill: fill, score: 9.2, active: true)
            }
            VStack(spacing: 8) {
                Text("You're set, \(model.userName.isEmpty ? "friend" : model.userName).")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(Color.fzInk)
                Text("Your goal is \(GoalDial.format(model.goalMinutes)) a day. Let's fill the Beam.")
                    .foregroundStyle(Color.fzInk2)
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, 28)
            Spacer()
            Button("Let's focus", action: finish)
                .buttonStyle(.beam)
                .frame(maxWidth: 520)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
        }
        .sensoryFeedback(.success, trigger: burst)
        .onAppear {
            withAnimation(.smooth(duration: 1.4)) { fill = 0.85 }
            withAnimation(.easeOut(duration: 1.2).delay(0.5)) { burst = true }
        }
    }
}
