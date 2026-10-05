import AuthenticationServices
import FamilyControls
import SwiftUI
import UserNotifications

/// First launch (docs/ios-onboarding.md), all on one screen that never navigates:
/// 1. The bare Beam Z draws itself as a beam of light, fills, and flies up beside "FocuzNow", where it
///    becomes the logo. The focus chart draws, the sign-in buttons rise. Signing in draws the line away.
/// 2. "Hey, Avan" (the name from Apple, or the start of the email) and "Welcome to FocuzNow".
/// 3. The story (`OrbStage`): a wide shot of a cold, dark landscape with little lights scattered across
///    it ("Your focus is everywhere."). "Let's bring it back.": the lights stream to a far-off pedestal
///    and the camera flies in after them; the ring powers on, the light catches, lightning, and your
///    focus orb forms there, floating. "Touch it.": the lightning reaches for your finger.
/// 4. A glass button opens into a glass panel in place, and the questions are asked there. Every answer
///    has its own reply, sends a strike down, and wakes the world a little more (light, fog, rocks
///    lifting into the air).
/// 5. How many days a year that phone time adds up to (the world goes cold while it counts, then surges
///    back: "We can change that."), then the permissions in the same panel.
/// 6. The orb settles and Today builds around the same stage.
struct FocusOnboarding: View {
    enum Stage: Int, Comparable {
        case intro, welcome, email, leaving, hello, questions, stat, permissions, finishing
        static func < (a: Stage, b: Stage) -> Bool { a.rawValue < b.rawValue }
    }

    enum Permission { case screenTime, apps, notifications }

    @Environment(AppModel.self) private var model
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("onboarded") private var onboarded = false
    @Namespace private var markSpace

    @State private var stage: Stage = .intro

    // The welcome
    @State private var zDraw: CGFloat = 0
    @State private var zFill: CGFloat = 0
    @State private var bloom = false
    @State private var docked = false
    @State private var tileShown = false
    @State private var showWordmark = false
    @State private var showHeadline = false
    @State private var showGlow = false
    @State private var lineStart: CGFloat = 0
    @State private var lineEnd: CGFloat = 0
    @State private var nodes = [false, false, false]
    @State private var showButtons = false
    @State private var showFooter = false
    @State private var signUp = false
    @State private var welcomeGone = false

    // Email
    @State private var email = ""
    @State private var password = ""
    @FocusState private var emailFocused: Bool

    // Hello and the orb stage
    @State private var greeting = ""
    @State private var showHey = false
    @State private var showWelcomeLine = false
    @State private var stageState = OrbStageState.dark
    @State private var strike = 0
    @State private var gatherAt: Date?
    @State private var ringOn = false
    @State private var greetingGone = false
    /// The story's lines over the wide shot: 1 "Your focus is everywhere.", 2 "Scattered across a
    /// hundred things.", 3 "Let's bring it back.", 0 none.
    @State private var storyLine = 0
    @State private var showOrbLine = false
    /// "Touch it." Then, touched (or after a while), the rest of the line and the button.
    @State private var askTouch = false
    @State private var showGrowLine = false
    @State private var touchPoint: CGPoint?
    @State private var crackle = 0
    /// The world before the year in days dimmed it, so "We can change that." can bring it back.
    @State private var beforeStat = OrbStageState.dark
    @State private var showPanel = false
    @State private var panelOpen = false
    @State private var pulse = 0

    // Questions
    @State private var askIndex = 0
    @State private var picked: Asks.Option?

    // The year in days
    @State private var statStep = 0
    @State private var shownDays = 0

    // Permissions
    @State private var permission: Permission = .screenTime
    @State private var appsChosen = 0
    @State private var picking = false
    @State private var leaving = false

    var body: some View {
        @Bindable var model = model
        GeometryReader { proxy in
            let size = CGSize(width: proxy.size.width, height: proxy.size.height + proxy.safeAreaInsets.top + proxy.safeAreaInsets.bottom)
            let top = proxy.safeAreaInsets.top
            let bottom = max(proxy.safeAreaInsets.bottom, 16)
            ZStack(alignment: .top) {
                backdrop(size)
                if stage < .hello {
                    welcomeLayer(size, top: top, bottom: bottom)
                } else {
                    journeyLayer(size, top: top, bottom: bottom)
                }
                introMark(size)
            }
            .frame(width: size.width, height: size.height)
            .ignoresSafeArea()
        }
        .background(Color.black)
        .environment(\.colorScheme, .dark)
        .preferredColorScheme(.dark)
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
        .onChange(of: picking) { _, open in
            if !open { pickerClosed() }
        }
        .task { await playIntro() }
        .task { await FocusOrb.prepare() }
        .sensoryFeedback(.impact(weight: .medium), trigger: pulse)
        .sensoryFeedback(.impact(weight: .light), trigger: ringOn)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.45), trigger: crackle)
        .task(id: touchPoint != nil) {
            // A crackle in your hand while you touch the orb.
            while touchPoint != nil, !Task.isCancelled {
                crackle += 1
                try? await Task.sleep(for: .milliseconds(110))
            }
        }
        .sensoryFeedback(.selection, trigger: askIndex)
    }

    // MARK: Backdrop

    /// Black, with a mint glow behind the welcome's focus line.
    private func backdrop(_ size: CGSize) -> some View {
        ZStack {
            Color.black
            RadialGradient(
                colors: [Color.fzMint.opacity(0.2), Color(hex: 0x1C3A2E).opacity(0.22), .clear],
                center: UnitPoint(x: 0.5, y: 0.46),
                startRadius: 0,
                endRadius: size.width * 0.8
            )
            .opacity(stage < .hello && showGlow && !welcomeGone ? 1 : 0)
            .animation(.easeInOut(duration: 1.2), value: showGlow)
            .animation(.easeInOut(duration: 1.2), value: welcomeGone)
        }
        .allowsHitTesting(false)
    }

    // MARK: 1. The welcome

    /// The splash: the bare Z drawing itself in the middle, before it flies up next to "FocuzNow".
    /// No tile here; it only gets one when it lands in the header as the logo.
    @ViewBuilder
    private func introMark(_ size: CGSize) -> some View {
        if !docked, stage < .hello {
            BeamZDrawing(size: 184, draw: zDraw, fill: zFill)
                .matchedGeometryEffect(id: "mark", in: markSpace)
                .shadow(color: Color.fzMint.opacity(bloom ? 0.55 : 0), radius: 44)
                .position(x: size.width / 2, y: size.height * 0.44)
        }
    }

    private func welcomeLayer(_ size: CGSize, top: CGFloat, bottom: CGFloat) -> some View {
        let small = size.height < 720
        return VStack(spacing: 0) {
            HStack(spacing: 14) {
                if docked {
                    BeamZMark(size: 44, tile: tileShown ? 1 : 0)
                        .matchedGeometryEffect(id: "mark", in: markSpace)
                } else {
                    Color.clear.frame(width: 44, height: 44)
                }
                Text("FocuzNow")
                    .font(.fzDisplay(26, weight: .bold))
                    .foregroundStyle(.white)
                    .blurReveal(showWordmark)
            }
            .padding(.top, top + 14)

            Spacer(minLength: 16).frame(maxHeight: small ? 24 : 48)

            VStack(spacing: 10) {
                Text(stage == .email ? "Continue with email" : signUp ? "Let's get you focused" : "Welcome back")
                    .font(.fzDisplay(small ? 34 : 40, weight: .bold))
                    .foregroundStyle(.white)
                    .contentTransition(.opacity)
                Text(signUp ? "Make an account so your focus follows you to every device." : "Sign in to keep your focus synced across devices.")
                    .font(.system(size: small ? 16 : 18))
                    .foregroundStyle(.white.opacity(0.72))
                    .contentTransition(.opacity)
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .blurReveal(showHeadline)
            .animation(.easeInOut(duration: 0.3), value: signUp)

            if stage == .email {
                emailForm
                    .padding(.top, 28)
                    .transition(.blurReplace)
                Spacer(minLength: 0)
            } else {
                chart(height: min(size.height * (small ? 0.2 : 0.3), 300))
                    .padding(.horizontal, -24)
                    .padding(.top, small ? 8 : 18)
                    .transition(.blurReplace)
                Spacer(minLength: 12)
                signInButtons(small: small)
                footer
                    .padding(.top, small ? 16 : 26)
                    .padding(.bottom, bottom + 4)
                    .blurReveal(showFooter)
            }
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: 560)
        .frame(width: size.width, height: size.height, alignment: .top)
        .opacity(welcomeGone ? 0 : 1)
        .blur(radius: welcomeGone ? 14 : 0)
    }

    /// The focus line: it draws in left to right, and draws itself away when you sign in.
    private func chart(height: CGFloat) -> some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let points = FocusCurve.shape.map { CGPoint(x: $0.x * w, y: $0.y * h) }
            ZStack(alignment: .topLeading) {
                ForEach(FocusCurve.nodes.indices, id: \.self) { i in
                    Rectangle()
                        .fill(.white.opacity(0.05))
                        .frame(width: 1, height: h * 1.3)
                        .position(x: points[FocusCurve.nodes[i].index].x, y: h * 0.5)
                }
                .opacity(lineEnd > 0 && lineStart < 1 ? 1 : 0)
                .animation(.easeInOut(duration: 0.6), value: lineStart)

                FocusCurve()
                    .trim(from: lineStart, to: lineEnd)
                    .stroke(Color.fzMint.opacity(0.8), style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .blur(radius: 7)
                FocusCurve()
                    .trim(from: lineStart, to: lineEnd)
                    .stroke(Color.fzMint, style: StrokeStyle(lineWidth: 2, lineCap: .round))

                ForEach(FocusCurve.nodes.indices, id: \.self) { i in
                    node(i, at: points[FocusCurve.nodes[i].index], width: w)
                }
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }

    private func node(_ i: Int, at point: CGPoint, width: CGFloat) -> some View {
        let info = FocusCurve.nodes[i]
        let shown = nodes[i]
        let pillX = min(max(point.x + info.dx, 96), width - 96)
        return ZStack {
            Circle()
                .fill(Color.fzMint)
                .frame(width: 13, height: 13)
                .background(Circle().fill(Color.fzMint.opacity(0.4)).frame(width: 30, height: 30).blur(radius: 7))
                .overlay(Circle().strokeBorder(.white.opacity(0.3), lineWidth: 1).frame(width: 23, height: 23))
                .scaleEffect(shown ? 1 : 0.2)
                .opacity(shown ? 1 : 0)
                .animation(.spring(duration: 0.5, bounce: 0.45), value: shown)
                .position(point)
            HStack(spacing: 6) {
                if let symbol = info.symbol {
                    Image(systemName: symbol).foregroundStyle(Color.fzMint)
                }
                if let label = info.label {
                    Text(label).foregroundStyle(.white.opacity(0.7))
                }
                Text(info.value).fontWeight(.bold).foregroundStyle(.white)
            }
            .font(.system(size: 16))
            .padding(.horizontal, 17)
            .padding(.vertical, 11)
            .background(Capsule().fill(.white.opacity(0.06)))
            .overlay(Capsule().strokeBorder(.white.opacity(0.13)))
            .fzGlass(in: Capsule())
            .fixedSize()
            .blurReveal(shown, delay: 0.12)
            .position(x: pillX, y: point.y + 46)
        }
    }

    private func signInButtons(small: Bool) -> some View {
        let height: CGFloat = small ? 54 : 60
        return VStack(spacing: 12) {
            SignInWithAppleButton(signUp ? .signUp : .continue) { request in
                request.requestedScopes = [.fullName, .email]
            } onCompletion: { result in
                appleFinished(result)
            }
            .signInWithAppleButtonStyle(.white)
            .frame(height: height)
            .clipShape(Capsule())
            .blurReveal(showButtons)

            Button { signedIn(name: nil) } label: {
                SignInLabel(title: "Continue with Google") { GoogleMark() }
            }
            .buttonStyle(GlassCapsuleButtonStyle(height: height))
            .blurReveal(showButtons, delay: 0.08)

            Button {
                withAnimation(.spring(duration: 0.6, bounce: 0.12)) { stage = .email }
                later(0.45) { emailFocused = true }
            } label: {
                SignInLabel(title: "Continue with Email") { Image(systemName: "envelope").font(.title3) }
            }
            .buttonStyle(GlassCapsuleButtonStyle(height: height))
            .blurReveal(showButtons, delay: 0.16)

            HStack(spacing: 5) {
                Text(signUp ? "Already have an account?" : "Don't have an account?")
                    .foregroundStyle(.white.opacity(0.55))
                Button(signUp ? "Sign in" : "Sign up") {
                    withAnimation(.easeInOut(duration: 0.3)) { signUp.toggle() }
                }
                .fontWeight(.semibold)
                .foregroundStyle(Color.fzMint)
            }
            .font(.subheadline)
            .padding(.top, small ? 8 : 14)
            .blurReveal(showButtons, delay: 0.24)
        }
    }

    private var footer: some View {
        Text("By continuing, you agree to our [Terms of Service](https://www.focuznow.com/terms.html) and [Privacy Policy](https://www.focuznow.com/privacy.html).")
            .font(.footnote)
            .foregroundStyle(.white.opacity(0.45))
            .tint(.white.opacity(0.85))
            .multilineTextAlignment(.center)
    }

    private var emailValid: Bool { email.contains("@") && email.contains(".") && password.count >= 8 }

    private var emailForm: some View {
        VStack(spacing: 14) {
            VStack(spacing: 0) {
                TextField("", text: $email, prompt: Text("Email").foregroundStyle(.white.opacity(0.35)))
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.next)
                    .focused($emailFocused)
                    .padding(18)
                Rectangle().fill(.white.opacity(0.1)).frame(height: 1)
                SecureField("", text: $password, prompt: Text(signUp ? "Create a password (8+ characters)" : "Password").foregroundStyle(.white.opacity(0.35)))
                    .textContentType(signUp ? .newPassword : .password)
                    .submitLabel(.go)
                    .onSubmit(emailContinue)
                    .padding(18)
            }
            .font(.system(size: 18))
            .foregroundStyle(.white)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(.white.opacity(0.05)))
            .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(.white.opacity(0.12)))
            .fzGlass(in: RoundedRectangle(cornerRadius: 22, style: .continuous))

            HStack(spacing: 10) {
                Button("Back") {
                    emailFocused = false
                    withAnimation(.spring(duration: 0.6, bounce: 0.12)) { stage = .welcome }
                }
                .buttonStyle(GlassCapsuleButtonStyle(height: 56))
                .frame(width: 112)
                Button(signUp ? "Create account" : "Sign in", action: emailContinue)
                    .buttonStyle(WhiteCapsuleButtonStyle(height: 56))
                    .disabled(!emailValid)
            }
        }
    }

    // MARK: 2–6. Hello, the orb stage, questions, the year, permissions

    private func isCompact() -> Bool {
        stage == .questions || stage == .stat || stage == .permissions || stage == .finishing || panelOpen
    }

    /// The stage stays put from here to Today; only the words and the panel come and go over it.
    private func journeyLayer(_ size: CGSize, top: CGFloat, bottom: CGFloat) -> some View {
        let layout = OrbStageLayout(width: size.width, top: top, screenHeight: size.height)
        let compact = isCompact()
        let small = size.height < 720
        return ZStack(alignment: .top) {
            OrbStage(layout: layout, state: stageState, strike: strike, gatherAt: gatherAt, touch: touchPoint, hint: askTouch)
                .frame(width: size.width, height: size.height, alignment: .top)

            // Touch the orb: the lightning reaches for your finger, wherever you drag it.
            Circle()
                .fill(.clear)
                .contentShape(Circle())
                .frame(width: layout.sphereRadius * 3, height: layout.sphereRadius * 3)
                .position(layout.orbCenter)
                .gesture(
                    DragGesture(minimumDistance: 0, coordinateSpace: .named("journey"))
                        .onChanged { value in
                            if touchPoint == nil { touchBegan() }
                            touchPoint = value.location
                        }
                        .onEnded { _ in touchPoint = nil }
                )
                .allowsHitTesting(stageState.formed > 0.9 && stage != .finishing)
                .accessibilityLabel("Your focus orb")
                .accessibilityAddTraits(.isButton)

            VStack(spacing: 8) {
                Text(greeting.isEmpty ? "Hey there" : "Hey, \(greeting)")
                    .font(.fzDisplay(small ? 34 : 40, weight: .bold))
                    .blurReveal(showHey)
                Text("Welcome to FocuzNow")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.white.opacity(0.7))
                    .blurReveal(showWelcomeLine)
            }
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 24)
            .padding(.top, top + (small ? 12 : 22))
            .opacity(compact || leaving || greetingGone ? 0 : 1)
            .blur(radius: compact || greetingGone ? 12 : 0)
            .animation(.easeInOut(duration: 0.8), value: greetingGone)

            // The story, over the wide shot.
            ZStack {
                storyText("Your focus is everywhere.", shown: storyLine == 1, small: small)
                storyText("Scattered across a hundred things.", shown: storyLine == 2, small: small)
                storyText("Let's bring it back.", shown: storyLine == 3, small: small)
            }
            .padding(.horizontal, 32)
            .position(x: size.width / 2, y: top + size.height * 0.16)
            .frame(width: size.width, height: size.height)
            .allowsHitTesting(false)

            VStack(spacing: 8) {
                Text("This is your focus orb.")
                    .font(.fzDisplay(small ? 23 : 26, weight: .bold))
                    .blurReveal(showOrbLine)
                ZStack {
                    Text("Touch it.")
                        .blurReveal(showOrbLine && !showGrowLine, delay: 0.3)
                    Text("It's barely charged. Answer a few questions and it grows.")
                        .blurReveal(showGrowLine)
                }
                .font(small ? .subheadline : .body)
                .foregroundStyle(.white.opacity(0.7))
            }
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
            .position(x: size.width / 2, y: layout.baseY + (small ? 40 : 56))
            .frame(width: size.width, height: size.height)
            .opacity(compact ? 0 : 1)
            .allowsHitTesting(false)

            statView(size, below: layout.baseY, small: small)
                .opacity(stage == .stat ? 1 : 0)

            panel(size)
                .padding(.horizontal, 16)
                .padding(.bottom, bottom + 8)
                .frame(width: size.width, height: size.height, alignment: .bottom)
                .opacity(leaving ? 0 : 1)
        }
        .frame(width: size.width, height: size.height)
        .coordinateSpace(.named("journey"))
        .animation(.spring(duration: 0.85, bounce: 0.12), value: compact)
        .animation(.spring(duration: 0.85, bounce: 0.12), value: stage)
    }

    private func storyText(_ text: String, shown: Bool, small: Bool) -> some View {
        Text(text)
            .font(.fzDisplay(small ? 28 : 32, weight: .bold))
            .foregroundStyle(.white)
            .multilineTextAlignment(.center)
            .blurReveal(shown)
    }

    /// The glass button that opens into the glass panel where everything is asked.
    private func panel(_ size: CGSize) -> some View {
        let shape = RoundedRectangle(cornerRadius: panelOpen ? 32 : 30, style: .continuous)
        return VStack(alignment: .leading, spacing: 0) {
            panelContent(size)
        }
        .padding(panelOpen ? 20 : 0)
        .frame(maxWidth: 560)
        .background(shape.fill(.white.opacity(0.05)))
        .overlay(shape.strokeBorder(.white.opacity(0.13)))
        .fzGlass(in: shape)
        .fzBottomGlow(strength: panelOpen ? 0 : 0.6)
        .opacity(showPanel ? 1 : 0)
        .offset(y: showPanel ? 0 : 50)
        .allowsHitTesting(showPanel)
    }

    @ViewBuilder
    private func panelContent(_ size: CGSize) -> some View {
        switch stage {
        case .hello:
            panelButton("Make it grow", action: openQuestions)
                .disabled(!showGrowLine)
        case .questions:
            if let picked {
                replyCard(picked)
            } else {
                questionCard(Asks.all[askIndex], twoColumns: Asks.all[askIndex].options.count >= 6 || size.height < 760)
            }
        case .stat:
            panelButton("Let's change that", action: openPermissions)
        case .permissions:
            permissionCard
        default:
            EmptyView()
        }
    }

    private func panelButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 60)
                .contentShape(Rectangle())
        }
        .buttonStyle(.pressable)
        .transition(.blurReplace)
    }

    private func questionCard(_ ask: Asks.Ask, twoColumns: Bool) -> some View {
        let columns = twoColumns ? [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)] : [GridItem(.flexible())]
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 6) {
                Text("\(askIndex + 1) of \(Asks.all.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.5))
                Spacer()
                ForEach(0..<Asks.all.count, id: \.self) { i in
                    Capsule()
                        .fill(i <= askIndex ? Color.fzMint : .white.opacity(0.15))
                        .frame(width: i == askIndex ? 18 : 6, height: 6)
                }
            }
            Text(ask.question)
                .font(.fzDisplay(23, weight: .bold))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            if let hint = ask.hint {
                Text(hint).font(.subheadline).foregroundStyle(.white.opacity(0.55))
            }
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(Array(ask.options.enumerated()), id: \.element.id) { index, option in
                    Button { choose(option, in: ask) } label: {
                        OptionRow(option: option)
                    }
                    .buttonStyle(.pressable)
                    .riseIn(delay: 0.05 * Double(index))
                }
            }
        }
        .id("question-\(askIndex)")
        .transition(.blurReplace)
    }

    private func replyCard(_ option: Asks.Option) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: option.symbol)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.black)
                    .frame(width: 42, height: 42)
                    .background(Color.fzMint, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                VStack(alignment: .leading, spacing: 6) {
                    Text(option.reply)
                        .font(.fzDisplay(22, weight: .bold))
                        .foregroundStyle(.white)
                    Text(option.detail)
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.72))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Button(askIndex + 1 < Asks.all.count ? "Next question" : "Continue", action: nextQuestion)
                .buttonStyle(WhiteCapsuleButtonStyle(height: 54))
        }
        .id("reply-\(askIndex)")
        .transition(.blurReplace)
    }

    /// Under the pedestal, over the dark ground.
    private func statView(_ size: CGSize, below baseY: CGFloat, small: Bool) -> some View {
        VStack(spacing: small ? 4 : 8) {
            Text("This year, you're on track to spend")
                .font(.title3.weight(.medium))
                .foregroundStyle(.white.opacity(0.72))
                .blurReveal(statStep >= 1)
            Text("\(shownDays) days")
                .font(.fzDisplay(small ? 60 : 80, weight: .black))
                .foregroundStyle(.white)
                .monospacedDigit()
                .contentTransition(.numericText(value: Double(shownDays)))
                .blurReveal(statStep >= 2)
            Text("on your phone.")
                .font(.title3.weight(.medium))
                .foregroundStyle(.white.opacity(0.72))
                .blurReveal(statStep >= 3)
            Text("We can change that.")
                .font(.fzDisplay(small ? 24 : 28, weight: .bold))
                .foregroundStyle(Color.fzMint)
                .padding(.top, small ? 8 : 16)
                .blurReveal(statStep >= 4)
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 24)
        .position(x: size.width / 2, y: baseY + (small ? 104 : 140))
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
    }

    private var permissionCard: some View {
        let info = permissionInfo
        return VStack(alignment: .leading, spacing: 14) {
            Image(systemName: info.symbol)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.black)
                .frame(width: 52, height: 52)
                .background(Color.fzMint, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            Text(info.title)
                .font(.fzDisplay(24, weight: .bold))
                .foregroundStyle(.white)
            Text(info.body)
                .font(.body)
                .foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true)
            Button(info.primary, action: permissionPrimary)
                .buttonStyle(WhiteCapsuleButtonStyle(height: 56))
                .padding(.top, 4)
            Button(info.secondary, action: permissionSecondary)
                .buttonStyle(QuietCapsuleButtonStyle())
        }
        .id(info.title)
        .transition(.blurReplace)
    }

    private var permissionInfo: (symbol: String, title: String, body: String, primary: String, secondary: String) {
        switch permission {
        case .screenTime:
            ("hourglass", "Block what pulls you away", "FocuzNow uses Apple's Screen Time to keep apps out of your way. Apple keeps it private: we never see what you do in your apps.", "Allow app blocking", "Not now")
        case .apps where appsChosen > 0:
            ("checkmark.shield.fill", appsChosen == 1 ? "1 app will wait" : "\(appsChosen) apps will wait", "They stay locked while you focus, and come back when you're done.", "Continue", "Change")
        case .apps:
            ("square.grid.2x2.fill", "Choose what can wait", "Pick the apps, categories and websites to lock while you focus.", "Choose apps", "Skip for now")
        case .notifications:
            ("bell.badge.fill", "Get a nudge when it's time", "A heads-up when a session starts and when it's done. Nothing else.", "Allow notifications", "Not now")
        }
    }

    // MARK: Flow

    private func playIntro() async {
        guard stage == .intro else { return }
        if reduceMotion {
            zDraw = 1; zFill = 1; docked = true; tileShown = true
            showWordmark = true; showHeadline = true; showGlow = true
            lineEnd = 1; nodes = [true, true, true]
            showButtons = true; showFooter = true
            stage = .welcome
            return
        }
        // The beam runs round the Z, the fill sweeps in, one soft glow, then it flies up.
        await wait(0.3)
        withAnimation(.easeInOut(duration: 1.25)) { zDraw = 1 }
        await wait(1.15)
        withAnimation(.easeInOut(duration: 0.5)) { zFill = 1 }
        await wait(0.4)
        withAnimation(.easeOut(duration: 0.3)) { bloom = true }
        pulse += 1
        await wait(0.4)
        withAnimation(.easeInOut(duration: 0.6)) { bloom = false }
        withAnimation(.spring(duration: 0.85, bounce: 0.16)) { docked = true }
        later(0.55) { withAnimation(.easeInOut(duration: 0.5)) { tileShown = true } }
        await wait(0.3)
        showWordmark = true
        await wait(0.25)
        showHeadline = true
        await wait(0.4)
        withAnimation(.easeOut(duration: 1.2)) { showGlow = true }
        let drawTime = 1.6
        withAnimation(.easeInOut(duration: drawTime)) { lineEnd = 1 }
        for (i, node) in FocusCurve.nodes.enumerated() {
            later(drawTime * Double(FocusCurve.shape[node.index].x)) { nodes[i] = true }
        }
        await wait(1.0)
        showButtons = true
        await wait(0.45)
        showFooter = true
        stage = .welcome
    }

    private func wait(_ seconds: Double) async {
        try? await Task.sleep(for: .seconds(seconds))
    }

    private func later(_ seconds: Double, _ action: @escaping () -> Void) {
        Task {
            try? await Task.sleep(for: .seconds(seconds))
            action()
        }
    }

    private func appleFinished(_ result: Result<ASAuthorization, Error>) {
        // Cancelled or failed: stay on the welcome.
        guard case let .success(authorization) = result else { return }
        let credential = authorization.credential as? ASAuthorizationAppleIDCredential
        signedIn(name: Self.greetingName(given: credential?.fullName?.givenName, email: credential?.email))
    }

    private func emailContinue() {
        guard emailValid else { return }
        emailFocused = false
        signedIn(name: Self.greetingName(given: nil, email: email))
    }

    /// The name for "Hey, …": the first name from Apple, or the letters at the start of the email
    /// (avan.k@… becomes "Avan"). Nothing for Apple's private relay addresses.
    static func greetingName(given: String?, email: String?) -> String? {
        if let given = given?.trimmingCharacters(in: .whitespaces), !given.isEmpty { return given }
        guard let email, let at = email.firstIndex(of: "@") else { return nil }
        if email[at...].contains("privaterelay.appleid.com") { return nil }
        let letters = email[..<at].prefix { $0.isLetter }
        guard letters.count >= 2 else { return nil }
        return letters.prefix(1).uppercased() + letters.dropFirst().lowercased()
    }

    /// Signed in (or signed up): the line draws itself away and everything fades, then hello.
    private func signedIn(name: String?) {
        guard stage == .welcome || stage == .email else { return }
        emailFocused = false
        if let name {
            model.userName = name
            greeting = name
        }
        stage = .leaving
        pulse += 1
        withAnimation(.easeInOut(duration: 0.8)) { lineStart = 1 }
        nodes = [false, false, false]
        later(0.35) { withAnimation(.easeInOut(duration: 0.6)) { welcomeGone = true } }
        later(1.15) { startHello() }
    }

    /// Hello, then the story: your focus scattered across a dark world, brought back to the pedestal,
    /// the camera flying in after it, and the orb forming. Then "Touch it."
    private func startHello() {
        withAnimation(.easeInOut(duration: 0.4)) { stage = .hello }
        later(0.15) { showHey = true }
        later(0.6) { showWelcomeLine = true }
        if reduceMotion {
            later(0.9) { withAnimation(.easeInOut(duration: 0.8)) { stageState = .settled(0.12) } }
            later(1.6) { showOrbLine = true }
            later(2.2) { revealGrow() }
            return
        }
        // The wide shot comes up, dark and cold, drifting in very slowly.
        later(1.4) {
            withAnimation(.easeInOut(duration: 2.4)) { stageState.scene = 1 }
            withAnimation(.easeInOut(duration: 6)) { stageState.dolly = 0.06 }
        }
        later(2.7) { greetingGone = true }
        later(3.2) {
            storyLine = 1
            withAnimation(.easeInOut(duration: 1.8)) { stageState.scatter = 1 }
        }
        later(5.0) { storyLine = 2 }
        later(7.0) { storyLine = 3 }
        // "Let's bring it back": the lights set off and the camera flies in after them.
        later(7.8) {
            gatherAt = .now
            withAnimation(.easeInOut(duration: 3.0)) { stageState.dolly = 1 }
        }
        later(9.4) { storyLine = 0 }
        // They catch into a white-hot point; the pedestal powers on.
        later(10.4) {
            withAnimation(.easeOut(duration: 0.4)) { stageState.spark = 1 }
            pulse += 1
        }
        later(10.6) {
            withAnimation(.easeInOut(duration: 1.2)) { stageState.ring = 1 }
            withAnimation(.easeInOut(duration: 2)) {
                stageState.beam = 1
                stageState.awake = 0.18
            }
            ringOn = true
        }
        // Lightning jumps up from the ring and the orb forms around the light.
        later(11.5) {
            withAnimation(.easeOut(duration: 0.2)) { stageState.arcs = 1 }
            strike += 1
        }
        later(11.7) {
            withAnimation(.spring(duration: 1.5, bounce: 0.18)) { stageState.formed = 1 }
            pulse += 1
        }
        later(12.1) {
            withAnimation(.easeOut(duration: 1)) {
                stageState.spark = 0
                stageState.scatter = 0
            }
        }
        later(13.0) {
            gatherAt = nil
            showOrbLine = true
        }
        later(13.6) { askTouch = true }
        // Not everyone will touch it: carry on anyway.
        later(20) { revealGrow() }
    }

    /// The first touch on the orb (and every touch after): a strike, and it wakes a little.
    private func touchBegan() {
        strike += 1
        pulse += 1
        if askTouch {
            askTouch = false
            withAnimation(.easeInOut(duration: 1.2)) {
                stageState.energy = min(1, stageState.energy + 0.06)
                stageState.awake = min(1, stageState.awake + 0.12)
            }
            later(1.0) { revealGrow() }
        }
    }

    /// "It's barely charged. Answer a few questions and it grows." and the button.
    private func revealGrow() {
        guard stage == .hello, !showGrowLine else { return }
        askTouch = false
        showGrowLine = true
        later(0.8) { withAnimation(.spring(duration: 0.7, bounce: 0.15)) { showPanel = true } }
    }

    private func openQuestions() {
        withAnimation(.spring(duration: 0.8, bounce: 0.14)) {
            stage = .questions
            panelOpen = true
            askIndex = 0
            picked = nil
        }
    }

    private func choose(_ option: Asks.Option, in ask: Asks.Ask) {
        guard picked == nil else { return }
        switch ask.id {
        case "hours":
            model.phoneHoursGuess = option.value
            model.goalMinutes = option.value < 2 ? 60 : option.value < 6 ? 90 : 120
        case "pull": model.distraction = option.title
        case "time": model.hardestTime = option.title
        default: model.focusFor = option.title
        }
        withAnimation(.spring(duration: 0.6, bounce: 0.15)) { picked = option }
        grow(by: 0.16)
    }

    private func nextQuestion() {
        if askIndex + 1 < Asks.all.count {
            withAnimation(.spring(duration: 0.6, bounce: 0.12)) {
                picked = nil
                askIndex += 1
            }
        } else {
            startStat()
        }
    }

    /// A strike comes down the lightning, the orb charges up, and the world wakes a little more: the
    /// light reaches further, the fog thins, another rock lifts off.
    private func grow(by amount: Double) {
        withAnimation(.easeInOut(duration: 1.2)) {
            stageState.energy = min(1, stageState.energy + amount)
            stageState.awake = min(1, stageState.awake + amount * 0.9)
            stageState.lift = min(1, stageState.lift + amount * 1.3)
        }
        strike += 1
        pulse += 1
    }

    /// "This year, you're on track to spend 76 days on your phone. We can change that."
    private func startStat() {
        withAnimation(.spring(duration: 0.6)) { showPanel = false }
        later(0.35) {
            withAnimation(.spring(duration: 0.9, bounce: 0.12)) {
                stage = .stat
                panelOpen = false
                picked = nil
            }
        }
        later(1.0) { statStep = 1 }
        later(1.6) {
            statStep = 2
            countDays(to: Int((model.phoneHoursGuess * 365 / 24).rounded()))
            // While the days count up, the world goes cold: the orb dims, the rocks sink.
            beforeStat = stageState
            withAnimation(.easeInOut(duration: 2.2)) {
                stageState.energy = 0.08
                stageState.awake = 0.04
                stageState.lift = max(0, stageState.lift - 0.6)
                stageState.beam = 0.35
            }
        }
        later(3.0) { statStep = 3 }
        later(3.7) {
            statStep = 4
            // "We can change that.": it all comes back, brighter.
            let back = beforeStat
            withAnimation(.spring(duration: 1.3, bounce: 0.2)) {
                stageState.energy = min(1, back.energy + 0.1)
                stageState.awake = min(1, back.awake + 0.12)
                stageState.lift = min(1, back.lift + 0.15)
                stageState.beam = 1
            }
            strike += 1
            pulse += 1
        }
        later(4.5) { withAnimation(.spring(duration: 0.7, bounce: 0.15)) { showPanel = true } }
    }

    private func countDays(to target: Int) {
        let steps = 24
        for i in 0...steps {
            later(Double(i) * 0.045) {
                withAnimation(.snappy(duration: 0.2)) { shownDays = Int((Double(target) * Double(i) / Double(steps)).rounded()) }
            }
        }
    }

    private func openPermissions() {
        withAnimation(.spring(duration: 0.8, bounce: 0.12)) {
            permission = LiveFocus.screenTimeApproved ? .apps : .screenTime
            stage = .permissions
            panelOpen = true
        }
    }

    private func show(_ next: Permission) {
        withAnimation(.spring(duration: 0.6, bounce: 0.12)) { permission = next }
    }

    private func permissionPrimary() {
        switch permission {
        case .screenTime:
            Task {
                try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                if LiveFocus.screenTimeApproved {
                    grow(by: 0.08)
                    show(.apps)
                } else {
                    show(.notifications)
                }
            }
        case .apps:
            if appsChosen > 0 { show(.notifications) } else { picking = true }
        case .notifications:
            Task {
                let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
                if granted { grow(by: 0.08) }
                finish()
            }
        }
    }

    private func permissionSecondary() {
        switch permission {
        case .screenTime: show(.notifications)
        case .apps: if appsChosen > 0 { picking = true } else { show(.notifications) }
        case .notifications: finish()
        }
    }

    private func pickerClosed() {
        let count = BlockList.count(model.selection)
        guard count > 0 else { return }
        withAnimation(.spring(duration: 0.6, bounce: 0.12)) { appsChosen = count }
        grow(by: 0.08)
    }

    /// One last strike, the orb settles to today's charge, and Today builds around the same stage
    /// (it's laid out with the same `OrbStageLayout`, so nothing on it moves).
    private func finish() {
        guard stage != .finishing else { return }
        withAnimation(.easeInOut(duration: 0.5)) {
            showPanel = false
            stage = .finishing
        }
        strike += 1
        pulse += 1
        let today = OrbStageState.settled(TodayView.orbEnergy(model.focusScore))
        withAnimation(.easeInOut(duration: 1.2)) {
            stageState.energy = today.energy
            stageState.awake = today.awake
            stageState.lift = today.lift
        }
        later(0.6) { withAnimation(.easeIn(duration: 0.4)) { leaving = true } }
        later(1.3) { onboarded = true }
    }
}

// MARK: The focus line on the welcome

/// A smooth line through a few points (Catmull-Rom), in a unit box scaled to the rect.
struct FocusCurve: Shape {
    static let shape: [CGPoint] = [
        CGPoint(x: 0, y: 0.08), CGPoint(x: 0.14, y: 0.16), CGPoint(x: 0.3, y: 0.42),
        CGPoint(x: 0.5, y: 0.6), CGPoint(x: 0.66, y: 0.56), CGPoint(x: 0.86, y: 0.86), CGPoint(x: 1, y: 0.88),
    ]

    /// The dots on the line and their glass labels (example numbers, it's an illustration).
    static let nodes: [(index: Int, label: String?, value: String, symbol: String?, dx: CGFloat)] = [
        (1, "Today", "4h 18m", nil, 34),
        (3, "Focus goal", "5h", nil, 26),
        (5, nil, "Deep work", "leaf.fill", -10),
    ]

    func path(in rect: CGRect) -> Path {
        let p = Self.shape.map { CGPoint(x: rect.minX + $0.x * rect.width, y: rect.minY + $0.y * rect.height) }
        var path = Path()
        guard let first = p.first else { return path }
        path.move(to: first)
        for i in 0..<(p.count - 1) {
            let p0 = i > 0 ? p[i - 1] : p[i]
            let p1 = p[i]
            let p2 = p[i + 1]
            let p3 = i + 2 < p.count ? p[i + 2] : p2
            let c1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6)
            let c2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6)
            path.addCurve(to: p2, control1: c1, control2: c2)
        }
        return path
    }
}

// MARK: Pieces

private struct OptionRow: View {
    let option: Asks.Option

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: option.symbol)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.fzMint)
                .frame(width: 36, height: 36)
                .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            Text(option.title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(0.06)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(.white.opacity(0.08)))
        .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct SignInLabel<Icon: View>: View {
    let title: String
    @ViewBuilder let icon: Icon

    var body: some View {
        HStack(spacing: 12) {
            icon.frame(width: 28)
            Text(title)
        }
    }
}

/// A stand-in for Google's "G" until the Google Sign-In SDK (with its official logo) is added.
struct GoogleMark: View {
    var body: some View {
        Text("G")
            .font(.system(size: 22, weight: .bold, design: .rounded))
            .foregroundStyle(AngularGradient(
                colors: [Color(hex: 0xEA4335), Color(hex: 0xFBBC05), Color(hex: 0x34A853), Color(hex: 0x4285F4), Color(hex: 0xEA4335)],
                center: .center
            ))
    }
}

/// Dark glass capsule (Google, Email, Back).
private struct GlassCapsuleButtonStyle: ButtonStyle {
    var height: CGFloat = 60

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 19, weight: .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Capsule().fill(.white.opacity(configuration.isPressed ? 0.1 : 0.05)))
            .overlay(Capsule().strokeBorder(.white.opacity(0.13)))
            .fzGlass(in: Capsule(), interactive: true)
            .fzPressGlow(configuration.isPressed, rest: 0.1)
            .contentShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// The main action: a white capsule with black text.
private struct WhiteCapsuleButtonStyle: ButtonStyle {
    var height: CGFloat = 60
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Capsule().fill(Color(hex: 0xF3F5F0)))
            .fzPressGlow(configuration.isPressed, rest: enabled ? 0.18 : 0)
            .opacity(enabled ? 1 : 0.35)
            .contentShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// "Not now", "Skip for now".
private struct QuietCapsuleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.medium))
            .foregroundStyle(.white.opacity(0.6))
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .contentShape(Rectangle())
            .opacity(configuration.isPressed ? 0.5 : 1)
    }
}
