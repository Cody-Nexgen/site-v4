import FamilyControls
import SwiftUI
import UserNotifications

/// First launch as a film's opening titles (docs/ios-title-sequence.md).
///
/// It opens on AGAIN, the loop of things that keep getting another turn, and ends on
/// TEN MINUTES. YOUR CALL. You tap through it like a story. Your name becomes the opening credit,
/// each answer becomes a title with its own reply, and a small cut-paper figure moves through the
/// credits with you. The permissions are the real system ones.
struct TitleSequenceOnboarding: View {
    enum Beat: Int {
        case opening, name, credit, hours, pull, time, purpose, screenTime, apps, notifications, account, ending
    }

    /// Where the little figure is.
    enum Spot: Equatable { case offstage, behindName, besideName, wings, besideWord, besideGoal, center, bench }

    private struct Placement {
        var point: CGPoint
        var scale: CGFloat = 1
        var rotation: Double = 0
        var opacity: Double = 1
    }

    /// Sizes and positions for the current screen.
    private struct Layout {
        let size: CGSize
        let safeTop: CGFloat
        let safeBottom: CGFloat

        var w: CGFloat { size.width }
        var h: CGFloat { size.height }
        /// Titles are fitted to at most 640 pt, so iPad doesn't get giant type.
        var measure: CGFloat { min(w, 640) }
        var titleY: CGFloat { h * 0.34 }
        var againSize: CGFloat { min(w * 0.355, 210) }
        var figureHeight: CGFloat { min(max(w * 0.11, 40), 64) }

        func fit(_ text: String, _ fraction: CGFloat, _ limit: CGFloat, byWord: Bool = false) -> CGFloat {
            Reel.fit(text, width: measure * fraction, limit: limit, byWord: byWord)
        }
    }

    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var scheme
    @AppStorage("onboarded") private var onboarded = false

    @State private var beat: Beat = .opening
    @State private var returning = false
    @State private var waitingTap = false
    @State private var reply: Asks.Option?
    @State private var hoursTitle: String?
    @State private var word: String?
    @State private var alongside = false
    @State private var goal: String?
    @State private var light: ReelLight = .plain
    @State private var curtain = false
    @State private var canWait = false
    @State private var lockedCount = 0
    @State private var picking = false
    @State private var name = ""
    @FocusState private var nameFocused: Bool
    @State private var spot: Spot = .offstage
    @State private var pose: Silhouette.Pose = .stand
    @State private var facingLeft = false
    @State private var leaving = false
    @State private var tick = 0

    private var nameTitle: String {
        let typed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return (typed.isEmpty ? model.userName : typed).uppercased()
    }

    var body: some View {
        @Bindable var model = model
        let palette = ReelPalette.make(light, dark: scheme == .dark)
        GeometryReader { proxy in
            let layout = Layout(
                size: CGSize(width: proxy.size.width, height: proxy.size.height + proxy.safeAreaInsets.top + proxy.safeAreaInsets.bottom),
                safeTop: proxy.safeAreaInsets.top,
                safeBottom: max(proxy.safeAreaInsets.bottom, 16)
            )
            ZStack(alignment: .topLeading) {
                ReelPaper(palette: palette)
                againLayer(layout, palette)
                figureLayer(layout, palette)
                nameLayer(layout, palette)
                presentsLayer(layout, palette)
                hoursLayer(layout, palette)
                wordLayer(layout, palette)
                goalLayer(layout, palette)
                curtainLayer(layout, palette)
                sessionLayer(layout, palette)
                endingLayer(layout, palette)
                creditLayer(layout, palette)
                nameFieldLayer(layout, palette)
                bottomZone(layout, palette)
                    .frame(width: layout.w, height: layout.h, alignment: .bottom)
            }
            .frame(width: layout.w, height: layout.h)
            .contentShape(Rectangle())
            .onTapGesture(perform: advance)
            .scaleEffect(leaving ? 1.08 : 1)
            .opacity(leaving ? 0 : 1)
            .ignoresSafeArea()
        }
        .background(palette.paper.ignoresSafeArea())
        .animation(.easeInOut(duration: 1.1), value: light)
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
        .onChange(of: picking) { _, open in
            if !open { pickerClosed() }
        }
        .task {
            try? await Task.sleep(for: .seconds(1.6))
            if beat == .opening { waitingTap = true }
        }
        .sensoryFeedback(.selection, trigger: tick)
        .sensoryFeedback(.impact(weight: .light), trigger: beat)
        .accessibilityAction(named: "Continue", advance)
    }

    // MARK: Titles

    /// AGAIN, with the looping words passing through it (they flip to paper colour where they cross
    /// the letters). On the name beat the letters part to make room for your name.
    private func againLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let size = l.againSize
        let gap: CGFloat = beat == .name ? min(l.w * 0.62, 260) : size * 0.03
        let spread: CGFloat = beat.rawValue >= Beat.credit.rawValue ? l.w : 0
        let loopOpacity: Double = beat == .opening ? 1 : 0
        return TimelineView(.animation(paused: beat != .opening)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            ZStack {
                LoopingWords(t: t, size: l.size, centerY: l.titleY, titleSize: size, color: p.ink.opacity(0.45))
                    .opacity(loopOpacity)
                againTitle(l, size, gap, spread, p.ink)
                LoopingWords(t: t, size: l.size, centerY: l.titleY, titleSize: size, color: p.paper)
                    .opacity(loopOpacity)
                    .mask { againTitle(l, size, gap, spread, .black) }
            }
        }
        .opacity(beat.rawValue <= Beat.credit.rawValue ? 1 : 0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func againTitle(_ l: Layout, _ size: CGFloat, _ gap: CGFloat, _ spread: CGFloat, _ color: Color) -> some View {
        HStack(spacing: gap) {
            Text("AG").offset(x: -spread)
            Text("AIN").offset(x: spread)
        }
        .font(Reel.title(size))
        .foregroundStyle(color)
        .fixedSize()
        .position(x: l.w / 2, y: l.titleY)
        .frame(width: l.w, height: l.h)
    }

    /// Your name: the opening credit, then a header, then sharing the frame with your answers, then
    /// along the margin while the setup runs.
    private func nameLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let base = nameSize(l)
        let place = namePlacement(l, base)
        return Text(nameTitle)
            .font(Reel.title(base))
            .foregroundStyle(p.ink)
            .fixedSize()
            .scaleEffect(place.scale)
            .rotationEffect(.degrees(place.rotation))
            .opacity(place.opacity)
            .position(place.point)
            .frame(width: l.w, height: l.h)
            .allowsHitTesting(false)
    }

    private func nameSize(_ l: Layout) -> CGFloat { l.fit(nameTitle, 0.86, min(l.w * 0.34, 190)) }

    private func namePlacement(_ l: Layout, _ base: CGFloat) -> Placement {
        let header = Placement(point: CGPoint(x: l.w / 2, y: l.safeTop + 40), scale: 26 / base)
        // Signing straight in skips the name, so there's nothing to show in the margin.
        let margin = Placement(point: CGPoint(x: 30, y: l.h * 0.42), scale: 24 / base, rotation: -90, opacity: returning ? 0 : 0.85)
        switch beat {
        case .opening, .name:
            return Placement(point: CGPoint(x: l.w / 2, y: l.titleY), scale: 0.9, opacity: 0)
        case .credit:
            return Placement(point: CGPoint(x: l.w / 2, y: l.titleY))
        case .hours, .time:
            return header
        case .pull:
            guard alongside, let word else { return header }
            let shared = min(l.fit(nameTitle, 0.86, 120), l.fit(word, 0.86, 120))
            return Placement(point: CGPoint(x: l.w / 2, y: l.titleY - shared * 0.5), scale: shared / base)
        case .purpose:
            guard let goal else { return header }
            let goalSize = l.fit(goal, 0.86, min(l.w * 0.3, 170), byWord: true)
            let lines = CGFloat(goal.split(separator: " ").count)
            let shown = min(goalSize * 0.5, base)
            return Placement(point: CGPoint(x: l.w / 2, y: l.titleY - goalSize * lines * 0.48 - shown * 0.45), scale: shown / base)
        case .screenTime, .apps, .notifications, .account:
            return margin
        case .ending:
            var gone = margin
            gone.opacity = 0
            return gone
        }
    }

    private func presentsLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        Text("FocuzNow presents")
            .font(Reel.smallCaps(19))
            .tracking(1.5)
            .foregroundStyle(p.ink2)
            .opacity(beat == .credit ? 1 : 0)
            .position(x: l.w / 2, y: l.titleY - nameSize(l) * 0.72)
            .frame(width: l.w, height: l.h)
            .allowsHitTesting(false)
    }

    /// "with 4 TO 6 HOURS", the supporting credit.
    private func hoursLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let text = hoursTitle ?? ""
        let shown = beat == .hours && hoursTitle != nil
        return VStack(spacing: 2) {
            Text("with").font(Reel.credit(24)).foregroundStyle(p.ink2)
            Text(text).font(Reel.title(l.fit(text, 0.8, 110))).foregroundStyle(p.ink).fixedSize()
        }
        .scaleEffect(shown ? 1 : 0.92)
        .opacity(shown ? 1 : 0)
        .position(x: l.w / 2, y: l.titleY)
        .frame(width: l.w, height: l.h)
        .allowsHitTesting(false)
    }

    /// The distraction (and later the hardest time) as a big title.
    private func wordLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let text = word ?? ""
        let big = l.fit(text, 0.86, min(l.w * 0.32, 180))
        let shown = (beat == .pull || beat == .time) && word != nil
        var scale: CGFloat = 1
        var y = l.titleY
        if beat == .pull, alongside {
            let shared = min(l.fit(nameTitle, 0.86, 120), l.fit(text, 0.86, 120))
            scale = shared / big
            y = l.titleY + shared * 0.5
        }
        return ZStack {
            if shown {
                Text(text)
                    .font(Reel.title(big))
                    .foregroundStyle(p.ink)
                    .fixedSize()
                    .scaleEffect(scale)
                    .position(x: l.w / 2, y: y)
                    .id(text)
                    .transition(.asymmetric(insertion: .scale(scale: 1.18).combined(with: .opacity), removal: .opacity))
            }
        }
        .frame(width: l.w, height: l.h)
        .allowsHitTesting(false)
    }

    /// What deserves more of your attention, as the largest title.
    private func goalLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let text = goal ?? ""
        let size = l.fit(text, 0.86, min(l.w * 0.3, 170), byWord: true)
        return ZStack {
            if beat == .purpose, goal != nil {
                // One word per line, set tight like a title card: MAKING / THINGS.
                VStack(spacing: -size * 0.16) {
                    ForEach(Array(text.split(separator: " ").enumerated()), id: \.offset) { _, part in
                        Text(String(part))
                    }
                }
                .font(Reel.title(size))
                .foregroundStyle(p.ink)
                .fixedSize()
                .position(x: l.w / 2, y: l.titleY + size * 0.1)
                .transition(.scale(scale: 1.15).combined(with: .opacity))
            }
        }
        .frame(width: l.w, height: l.h)
        .allowsHitTesting(false)
    }

    /// EVERYTHING / ELSE close like a curtain while Apple's picker is up; CAN WAIT. lands after.
    private func curtainLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let size = l.fit("EVERYTHING", 0.9, 160)
        let on = beat == .apps && curtain
        return ZStack {
            Text("EVERYTHING")
                .font(Reel.title(size)).fixedSize()
                .offset(x: on ? 0 : -l.w * 1.2)
                .position(x: l.w / 2, y: l.titleY - size * 0.55)
            Text("ELSE")
                .font(Reel.title(size)).fixedSize()
                .offset(x: on ? 0 : l.w * 1.2)
                .position(x: l.w / 2, y: l.titleY + size * 0.4)
            Text("CAN WAIT.")
                .font(Reel.title(size * 0.62)).fixedSize()
                .scaleEffect(on && canWait ? 1 : 1.3)
                .opacity(on && canWait ? 1 : 0)
                .position(x: l.w / 2, y: l.titleY + size * 1.25)
        }
        .foregroundStyle(p.ink)
        .frame(width: l.w, height: l.h)
        .allowsHitTesting(false)
    }

    private func sessionLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let size = l.fit("COMPLETE", 0.72, 130)
        let on = beat == .notifications
        return VStack(spacing: -size * 0.16) {
            Text("SESSION")
            Text("COMPLETE")
        }
        .font(Reel.title(size))
        .foregroundStyle(p.ink)
        .fixedSize()
        .scaleEffect(on ? 1 : 0.9)
        .opacity(on ? 1 : 0)
        .position(x: l.w / 2, y: l.titleY)
        .frame(width: l.w, height: l.h)
        .allowsHitTesting(false)
    }

    /// TEN MINUTES. YOUR CALL., with a rule underneath for the figure to sit on.
    private func endingLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let size = endingSize(l)
        let on = beat == .ending
        return ZStack {
            VStack(spacing: -size * 0.16) {
                Text("TEN MINUTES.")
                Text("YOUR CALL.")
            }
            .font(Reel.title(size))
            .fixedSize()
            .position(x: l.w / 2, y: l.titleY)
            Capsule()
                .frame(width: l.measure * 0.56, height: 2.5)
                .position(x: l.w / 2, y: benchY(l))
        }
        .foregroundStyle(p.ink)
        .scaleEffect(on ? 1 : 0.92)
        .opacity(on ? 1 : 0)
        .frame(width: l.w, height: l.h)
        .allowsHitTesting(false)
    }

    private func endingSize(_ l: Layout) -> CGFloat { l.fit("TEN MINUTES.", 0.86, 140) }
    private func benchY(_ l: Layout) -> CGFloat { l.titleY + endingSize(l) * 1.05 + 10 }

    /// The narrator's line in the middle of the frame.
    private func creditLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let line: (text: String, y: CGFloat)? = switch beat {
        case .opening: ("Some things keep getting another turn.", l.titleY + l.againSize * 0.74)
        case .name: ("Your turn. What's your name?", l.titleY + l.againSize * 0.74)
        case .credit: ("A little more say in what happens next.", l.titleY + nameSize(l) * 0.8)
        case .screenTime: ("Let's make a little space around that.", l.titleY - 44)
        case .apps where !curtain: ("Choose what can wait.", l.titleY - 44)
        case .account: ("Your setup, saved.", l.titleY - 56)
        default: nil
        }
        return ZStack {
            if let line {
                Text(line.text)
                    .font(Reel.credit(beat == .account ? 34 : 24))
                    .foregroundStyle(p.ink)
                    .multilineTextAlignment(.center)
                    .frame(width: min(l.w - 48, 440))
                    .position(x: l.w / 2, y: line.y)
                    .id(line.text)
                    .transition(.opacity.combined(with: .offset(y: 8)))
            }
        }
        .frame(width: l.w, height: l.h)
        .allowsHitTesting(false)
    }

    /// The name field sits in the opening between AG and AIN.
    private func nameFieldLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let width = min(l.w * 0.62, 260) - 12
        let empty = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let on = beat == .name
        return ZStack {
            HStack(spacing: 8) {
                TextField("", text: $name, prompt: Text("Your name").foregroundStyle(p.ink.opacity(0.3)))
                    .font(Reel.title(min(l.againSize * 0.4, 52)))
                    .foregroundStyle(p.ink)
                    .multilineTextAlignment(.center)
                    .textContentType(.givenName)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.continue)
                    .focused($nameFocused)
                    .onSubmit(submitName)
                Button(action: submitName) {
                    Image(systemName: "arrow.right")
                        .font(.headline)
                        .foregroundStyle(p.paper)
                        .frame(width: 40, height: 40)
                        .background(p.ink, in: Circle())
                }
                .disabled(empty)
                .opacity(empty ? 0.25 : 1)
                .accessibilityLabel("Continue")
            }
            .padding(.leading, 10)
            .frame(width: width)
            .overlay(alignment: .bottom) {
                Rectangle().fill(p.ink.opacity(0.25)).frame(height: 1.5).offset(y: 6)
            }
            .position(x: l.w / 2, y: l.titleY)

            Button("Have an account? Sign in") {
                returning = true
                nameFocused = false
                go(.account)
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(p.ink2)
            .position(x: l.w / 2, y: l.titleY + l.againSize * 0.74 + 48)
        }
        .opacity(on ? 1 : 0)
        .allowsHitTesting(on)
        .frame(width: l.w, height: l.h)
    }

    // MARK: The figure

    private func figureLayer(_ l: Layout, _ p: ReelPalette) -> some View {
        let place = figurePlacement(l)
        return Silhouette(pose: pose, height: l.figureHeight, color: p.ink)
            .scaleEffect(x: facingLeft ? -1 : 1, y: 1)
            .opacity(place.opacity)
            .position(place.point)
            .frame(width: l.w, height: l.h)
            .allowsHitTesting(false)
    }

    private func figurePlacement(_ l: Layout) -> Placement {
        let h = l.figureHeight
        let base = nameSize(l)
        let nameWidth = min(Reel.width(nameTitle, size: base), l.measure * 0.9)
        let nameFoot = l.titleY + base * 0.34
        switch spot {
        case .offstage:
            return Placement(point: CGPoint(x: -h, y: l.titleY), opacity: 0)
        case .behindName:
            return Placement(point: CGPoint(x: l.w / 2 - nameWidth / 2 + base * 0.22, y: nameFoot - h / 2))
        case .besideName:
            return Placement(point: CGPoint(x: l.w / 2 - nameWidth / 2 - h * 0.45, y: nameFoot - h / 2))
        case .wings:
            return Placement(point: CGPoint(x: max(28, (l.w - l.measure) / 2 + 28), y: l.titleY + h * 0.4))
        case .besideWord:
            let text = word ?? ""
            let size = l.fit(text, 0.86, min(l.w * 0.32, 180))
            let x = min(l.w / 2 + Reel.width(text, size: size) / 2 + h * 0.45, l.w - h * 0.5)
            return Placement(point: CGPoint(x: x, y: l.titleY + size * 0.34 - h / 2))
        case .besideGoal:
            return Placement(point: CGPoint(x: min(l.w / 2 + l.measure * 0.4, l.w - h * 0.5), y: l.titleY + h * 1.4))
        case .center:
            return Placement(point: CGPoint(x: l.w / 2, y: l.titleY + h * 0.9))
        case .bench:
            // Sitting: the hips (at 56% of the figure) rest on the rule.
            return Placement(point: CGPoint(x: l.w / 2 + l.measure * 0.12, y: benchY(l) - h * 0.06))
        }
    }

    private func walk(to target: Spot, duration: Double = 1.0, facingLeft left: Bool = false, end: Silhouette.Pose = .stand) {
        facingLeft = left
        pose = .walk
        withAnimation(.easeInOut(duration: duration)) { spot = target }
        later(duration) {
            if spot == target { pose = end }
        }
    }

    // MARK: The bottom of the frame

    private func bottomZone(_ l: Layout, _ p: ReelPalette) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            bottomContent(p)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, l.safeBottom + 12)
        .frame(maxWidth: 560)
        .id("\(beat.rawValue)-\(reply?.reply ?? "")-\(canWait)")
        .transition(.blurRise)
    }

    @ViewBuilder
    private func bottomContent(_ p: ReelPalette) -> some View {
        switch beat {
        case .opening, .credit:
            if waitingTap { TapHint(palette: p) }
        case .name:
            EmptyView()
        case .hours, .pull, .time, .purpose:
            if let reply {
                replyView(reply, p)
            } else {
                askView(p)
            }
        case .screenTime:
            if let reply {
                replyView(reply, p)
            } else {
                screenTimeView(p)
            }
        case .apps:
            if canWait {
                replyView(Asks.Option(title: "", symbol: "", reply: lockedCount == 1 ? "One app, waiting." : "\(lockedCount) apps, waiting.", detail: "They stay locked while you focus, and come back when you're done.", plan: ""), p)
            } else {
                appsView(p)
            }
        case .notifications:
            notificationsView(p)
        case .account:
            VStack(spacing: 6) {
                AccountButtons { accountDone() }
                Button("Not now") { accountDone() }
                    .buttonStyle(ReelQuietButtonStyle(palette: p))
            }
            .riseIn(delay: 0.3)
        case .ending:
            endingButtons(p)
        }
    }

    private var currentAsk: Asks.Ask? {
        switch beat {
        case .hours: Asks.all[0]
        case .pull: Asks.all[1]
        case .time: Asks.all[2]
        case .purpose: Asks.all[3]
        default: nil
        }
    }

    private var question: String {
        switch beat {
        case .hours: "How much phone time on a usual day?"
        case .pull: "What keeps stealing the scene?"
        case .time: "When does it usually happen?"
        default: "What deserves more of your attention?"
        }
    }

    @ViewBuilder
    private func askView(_ p: ReelPalette) -> some View {
        if let ask = currentAsk {
            VStack(alignment: .leading, spacing: 18) {
                Text(question)
                    .font(Reel.credit(30))
                    .foregroundStyle(p.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .riseIn(delay: 0.1)
                FlowLayout(spacing: 10) {
                    ForEach(Array(ask.options.enumerated()), id: \.element.id) { index, option in
                        Button { pick(option, in: ask) } label: {
                            ReelChip(symbol: option.symbol, title: option.title, palette: p)
                        }
                        .buttonStyle(.pressable)
                        .modifier(EnterFrom(edge: entryEdge(index), delay: 0.15 + 0.06 * Double(index)))
                    }
                }
            }
        }
    }

    /// The distraction answers come in from every side; the others rise from below.
    private func entryEdge(_ index: Int) -> Edge {
        guard beat == .pull else { return .bottom }
        return [Edge.leading, .trailing, .top, .bottom][index % 4]
    }

    private func replyView(_ option: Asks.Option, _ p: ReelPalette) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(option.reply)
                .font(Reel.credit(31))
                .foregroundStyle(p.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(option.detail)
                .font(.body)
                .foregroundStyle(p.ink2)
                .fixedSize(horizontal: false, vertical: true)
            if waitingTap {
                TapHint(palette: p).padding(.top, 14)
            }
        }
        .riseIn(delay: 0.25)
    }

    private func screenTimeView(_ p: ReelPalette) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("FocuzNow keeps apps out of your way with Apple's Screen Time. Apple keeps it private: FocuzNow never sees what you do in your apps.")
                .font(.body)
                .foregroundStyle(p.ink2)
                .fixedSize(horizontal: false, vertical: true)
            Button("Enable app blocking", action: requestScreenTime)
                .buttonStyle(ReelButtonStyle(palette: p))
            Button("Not now") { go(.notifications) }
                .buttonStyle(ReelQuietButtonStyle(palette: p))
        }
        .riseIn(delay: 0.5)
    }

    private func appsView(_ p: ReelPalette) -> some View {
        VStack(spacing: 6) {
            Button("Choose apps", action: openPicker)
                .buttonStyle(ReelButtonStyle(palette: p))
            Button("Skip for now") { go(.notifications) }
                .buttonStyle(ReelQuietButtonStyle(palette: p))
        }
        .riseIn(delay: 0.4)
    }

    private func notificationsView(_ p: ReelPalette) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Want a reminder when you're done?")
                .font(Reel.credit(30))
                .foregroundStyle(p.ink)
                .fixedSize(horizontal: false, vertical: true)
            Button("Turn on reminders", action: requestNotifications)
                .buttonStyle(ReelButtonStyle(palette: p))
            Button("Not now") { go(returning ? .ending : .account) }
                .buttonStyle(ReelQuietButtonStyle(palette: p))
        }
        .riseIn(delay: 0.4)
    }

    private func endingButtons(_ p: ReelPalette) -> some View {
        VStack(spacing: 8) {
            Button("Start 10 minutes") { finish(focusMinutes: 10) }
                .buttonStyle(ReelButtonStyle(palette: p))
            if LiveFocus.screenTimeApproved, BlockList.count(model.selection) > 0, let window = Asks.blockWindow(for: model.hardestTime) {
                Button("Block \(window.label) daily") {
                    try? BlockList.scheduleDaily(window)
                    finish(focusMinutes: nil)
                }
                .buttonStyle(ReelButtonStyle(palette: p, primary: false))
            }
            Button("Explore first") { finish(focusMinutes: nil) }
                .buttonStyle(ReelQuietButtonStyle(palette: p))
        }
        .riseIn(delay: 0.7)
    }

    // MARK: Flow

    private func advance() {
        guard waitingTap else { return }
        waitingTap = false
        tick += 1
        switch beat {
        case .opening: go(.name)
        case .credit: go(.hours)
        case .hours: go(.pull)
        case .pull: go(.time)
        case .time: go(.purpose)
        case .purpose: go(LiveFocus.screenTimeApproved ? .apps : .screenTime)
        case .screenTime, .apps: go(.notifications)
        default: break
        }
    }

    private func go(_ next: Beat) {
        waitingTap = false
        withAnimation(.spring(duration: 0.9, bounce: 0.12)) {
            beat = next
            reply = nil
            if next == .time { word = nil }
            if next.rawValue >= Beat.screenTime.rawValue { light = .plain }
        }
        switch next {
        case .name:
            later(0.6) { nameFocused = true }
        case .credit:
            // The figure starts hidden behind the first letter of your name and steps out.
            // Placed once the name has faded in over it, so it really comes out from behind.
            later(0.5) {
                var instant = Transaction()
                instant.disablesAnimations = true
                withTransaction(instant) {
                    spot = .behindName
                    pose = .stand
                }
            }
            later(1.0) { walk(to: .besideName, duration: 0.9, facingLeft: true) }
            later(2.0) { if beat == .credit { waitingTap = true } }
        case .hours, .purpose:
            walk(to: .wings, duration: 1.1, facingLeft: true)
        case .screenTime, .apps:
            walk(to: .center, duration: 1.0)
        case .ending:
            walk(to: .bench, duration: 1.2, end: .sit)
        default:
            break
        }
    }

    private func later(_ seconds: Double, _ action: @escaping () -> Void) {
        Task {
            try? await Task.sleep(for: .seconds(seconds))
            action()
        }
    }

    private func submitName() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, beat == .name else { return }
        nameFocused = false
        model.userName = trimmed
        tick += 1
        go(.credit)
    }

    private func pick(_ option: Asks.Option, in ask: Asks.Ask) {
        guard reply == nil else { return }
        tick += 1
        let title = Asks.titleWord(for: option.title)
        let spring = Animation.spring(duration: 0.8, bounce: 0.15)
        switch ask.id {
        case "hours":
            model.phoneHoursGuess = option.value
            model.goalMinutes = option.value < 2 ? 60 : option.value < 6 ? 90 : 120
            withAnimation(spring) {
                hoursTitle = title
                reply = option
            }
        case "pull":
            model.distraction = option.title
            withAnimation(spring) {
                alongside = false
                word = title
                reply = option
            }
            // The distraction takes the screen for a moment, then your name moves in beside it.
            later(1.0) { withAnimation(.spring(duration: 0.9, bounce: 0.1)) { alongside = true } }
        case "time":
            model.hardestTime = option.title
            withAnimation(spring) {
                word = title
                reply = option
            }
            light = ReelLight.forHardestTime(option.title)
            later(0.4) { walk(to: .besideWord, duration: 1.1) }
        default:
            model.focusFor = option.title
            withAnimation(spring) {
                goal = title
                reply = option
            }
            later(0.4) { walk(to: .besideGoal, duration: 1.0) }
        }
        later(0.9) { waitingTap = true }
    }

    private func requestScreenTime() {
        Task {
            try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            if LiveFocus.screenTimeApproved {
                go(.apps)
            } else {
                withAnimation(.spring(duration: 0.6)) {
                    reply = Asks.Option(title: "", symbol: "", reply: "No problem.", detail: "Sessions still work without it. You can turn on app blocking in Settings any time.", plan: "")
                }
                later(0.6) { waitingTap = true }
            }
        }
    }

    private func openPicker() {
        tick += 1
        withAnimation(.spring(duration: 0.75, bounce: 0.1)) { curtain = true }
        later(0.5) { picking = true }
    }

    private func pickerClosed() {
        let count = BlockList.count(model.selection)
        guard count > 0 else {
            withAnimation(.spring(duration: 0.7)) { curtain = false }
            return
        }
        lockedCount = count
        withAnimation(.spring(duration: 0.8, bounce: 0.2)) { canWait = true }
        later(0.9) { waitingTap = true }
    }

    private func requestNotifications() {
        Task {
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
            go(returning ? .ending : .account)
        }
    }

    private func accountDone() {
        if returning {
            go(LiveFocus.screenTimeApproved ? .apps : .screenTime)
        } else {
            go(.ending)
        }
    }

    /// Optionally starts the first session, then the titles push in and the app appears.
    private func finish(focusMinutes: Int?) {
        tick += 1
        if let focusMinutes {
            let preset = model.presets.first { $0.id == Asks.presetID(for: model.focusFor) } ?? model.selectedPreset
            model.choose(preset)
            model.sessionMinutes = focusMinutes
            model.startSession()
            // Land on Today with the session running, not on the session screen.
            model.showSession = false
        }
        withAnimation(.easeIn(duration: 0.6)) { leaving = true }
        later(0.55) { onboarded = true }
    }
}
