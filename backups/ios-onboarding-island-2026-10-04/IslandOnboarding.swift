import FamilyControls
import ManagedSettings
import SwiftUI
import UserNotifications

/// "Drop it in the island" (docs/ios-island-plan.md §4.3). Black screen, the Dynamic Island at the
/// top, light falling from it. You flick your name, your answers, your apps and your first session
/// up into the island; it swallows each one and answers. No Continue buttons between questions, and
/// nothing disappears on a timer: a reply stays until you touch the next thing.
struct IslandOnboarding: View {
    enum Step: Int {
        case noise, name, hours, pull, time, purpose
        case screenTime, apps, lockApps, notifications, first, running, account, done
    }

    /// What the expanded island shows.
    enum Showing: Hashable {
        case welcome
        case reply(symbol: String, title: String, detail: String)
        case countdown
        case daily(label: String)
    }

    private struct Chip: Identifiable {
        let id: String
        let face: ChipFace
        let onLand: () -> Void
    }

    private struct LockItem: Identifiable {
        let id: String
        let face: ChipFace
    }

    private struct Flyer: Identifiable {
        let id = UUID()
        let face: ChipFace
        let from: CGRect
    }

    @Environment(AppModel.self) private var model
    @AppStorage("onboarded") private var onboarded = false
    /// Where to pick up after leaving the app mid-flow (to see the island, say).
    @AppStorage("onboardingStep") private var savedStep = 0

    @State private var step: Step = .noise
    @State private var returning = false
    @State private var busy = false

    // The island
    @State private var islandMode: IslandMode = .resting
    @State private var showing: Showing = .welcome
    @State private var gulp = 0
    @State private var initial: String?
    @State private var collected: [String] = []
    @State private var lockedSoFar = 0
    @State private var light = 0.0

    // Chips and what's flying
    @State private var thrown: Set<String> = []
    @State private var flyers: [Flyer] = []
    @State private var landed: Set<UUID> = []
    @State private var chipFrames: [String: CGRect] = [:]
    @State private var lockItems: [LockItem] = []
    @State private var showHint = true

    // The noise at the start
    @State private var noiseShown = 0
    @State private var noiseGone = false
    @State private var headline = false

    // Name
    @State private var name = ""
    @State private var nameFrame: CGRect = .zero
    @FocusState private var nameFocused: Bool

    @State private var picking = false
    @State private var leaving = false
    @State private var tick = 0

    var body: some View {
        @Bindable var model = model
        GeometryReader { proxy in
            let full = CGSize(width: proxy.size.width, height: proxy.size.height + proxy.safeAreaInsets.top + proxy.safeAreaInsets.bottom)
            let island = IslandGeometry.make(width: full.width, safeTop: proxy.safeAreaInsets.top)
            // Includes the keyboard when it's up, so the bottom zone stays above it.
            let bottom = max(proxy.safeAreaInsets.bottom, 16) + 12

            ZStack(alignment: .topLeading) {
                Color.black
                IslandLight(origin: island.center, intensity: light)
                if step == .noise { noiseLayer(full: full) }
                stage(full: full, island: island, bottom: bottom)
                    .opacity(leaving ? 0 : 1)
                    .scaleEffect(leaving ? 1.04 : 1)
                ForEach(flyers) { flyer in
                    let arrived = landed.contains(flyer.id)
                    ChipFaceView(face: flyer.face)
                        .scaleEffect(arrived ? 0.2 : 1)
                        .opacity(arrived ? 0 : 1)
                        .position(arrived ? island.center : CGPoint(x: flyer.from.midX, y: flyer.from.midY))
                        .allowsHitTesting(false)
                }
                IslandView(geometry: island, mode: islandMode, stageWidth: full.width, gulp: gulp) {
                    leadingSlot
                } trailing: {
                    trailingSlot
                } expanded: {
                    expandedContent
                }
                .frame(width: full.width)
                .padding(.top, island.rect.minY)
            }
            .frame(width: full.width, height: full.height)
            .coordinateSpace(.named(IslandStage.space))
            .ignoresSafeArea()
        }
        .background(Color.black)
        .environment(\.colorScheme, .dark)
        .preferredColorScheme(.dark)
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
        .onChange(of: picking) { _, open in
            if !open { pickerClosed() }
        }
        .task { await begin() }
        .sensoryFeedback(.impact(weight: .medium), trigger: gulp)
        .sensoryFeedback(.impact(weight: .light, intensity: 0.5), trigger: noiseShown)
        .sensoryFeedback(.selection, trigger: tick)
    }

    // MARK: Layout

    private func stage(full: CGSize, island: IslandGeometry, bottom: CGFloat) -> some View {
        let top = max(full.height * 0.29, island.rect.maxY + 170)
        return VStack(alignment: .leading, spacing: 0) {
            question
                .id(step)
                .transition(.blurRise)
            Spacer(minLength: 16)
            bottomZone(island: island)
                .id(step)
                .transition(.blurRise)
        }
        .padding(.horizontal, 24)
        .padding(.top, top)
        .padding(.bottom, bottom)
        .frame(maxWidth: 560)
        .frame(width: full.width, height: full.height, alignment: .top)
    }

    // MARK: The question (top half)

    @ViewBuilder
    private var question: some View {
        switch step {
        case .noise:
            if headline {
                Text("Everything else\ncan wait.")
                    .font(.fzDisplay(46))
                    .fzTight(46)
                    .foregroundStyle(.white)
                    .transition(.blurRise)
            }
        case .name:
            VStack(alignment: .leading, spacing: 14) {
                title("First, what should I call you?")
                nameField
                Button("Have an account? Sign in") {
                    returning = true
                    nameFocused = false
                    go(.account)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white.opacity(0.55))
                .padding(.top, 4)
            }
        case .hours, .pull, .time, .purpose:
            let ask = Asks.all[step.rawValue - Step.hours.rawValue]
            prompt(ask.question, ask.hint)
        case .screenTime:
            prompt("To lock apps away, I need Screen Time.", "Apple keeps it private. I never see which apps you use or what you do in them.")
        case .apps:
            prompt("Now pick what pulls you away.", "Apps, whole categories, even websites.")
        case .lockApps:
            prompt("Flick them into the island.", "Or tap All in.")
        case .notifications:
            prompt("Want a tap when time's up?", "A nudge when a session starts and when it's done. Nothing else.")
        case .first:
            prompt("Want to try it right now?", "Ten minutes is enough to feel it.")
        case .running:
            if isDaily {
                prompt("It's set.", "It locks on its own every day, even with FocuzNow closed.")
            } else {
                prompt("It's running.", runningHint)
            }
        case .account:
            prompt("Keep this on all your devices.", "Your sessions, lists and FocuzPass follow you.")
        case .done:
            VStack(alignment: .leading, spacing: 10) {
                Text("You're all set,\n\(model.userName).")
                    .font(.fzDisplay(42))
                    .fzTight(42)
                    .foregroundStyle(.white)
                Text("Everything else can wait.")
                    .font(.title3.weight(.medium))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
    }

    private var isDaily: Bool {
        if case .daily = showing { return true }
        return false
    }

    private var runningHint: String {
        if !LiveFocus.activitiesEnabled {
            return "Live Activities are off for FocuzNow in Settings, so it shows here in the app."
        }
        return IslandGeometry.deviceHasIsland
            ? "Swipe up to go home. It's in your Dynamic Island now."
            : "Lock your phone. It's on your Lock Screen now."
    }

    private func title(_ text: String) -> some View {
        Text(text)
            .font(.fzDisplay(34))
            .fzTight(34)
            .foregroundStyle(.white)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func prompt(_ text: String, _ hint: String?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            title(text)
            if let hint {
                Text(hint)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// v2's name field, with the arrow pointing up at the island.
    private var nameField: some View {
        let empty = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return HStack(spacing: 12) {
            TextField("", text: $name, prompt: Text("Your first name").foregroundStyle(.white.opacity(0.3)))
                .font(.fzDisplay(28, weight: .bold))
                .foregroundStyle(.white)
                .textContentType(.givenName)
                .submitLabel(.continue)
                .focused($nameFocused)
                .onSubmit(submitName)
                .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(IslandStage.space)) } action: { nameFrame = $0 }
            Button(action: submitName) {
                Image(systemName: "arrow.up")
                    .font(.headline)
                    .foregroundStyle(.black)
                    .frame(width: 44, height: 44)
                    .background(.white, in: Circle())
            }
            .disabled(empty)
            .opacity(empty ? 0.3 : 1)
            .accessibilityLabel("Continue")
        }
        .padding(.vertical, 8)
        .overlay(alignment: .bottom) { Rectangle().fill(.white.opacity(0.18)).frame(height: 1) }
        .opacity(thrown.contains("name") ? 0 : 1)
    }

    // MARK: The bottom zone (chips, buttons)

    @ViewBuilder
    private func bottomZone(island: IslandGeometry) -> some View {
        switch step {
        case .noise, .name, .done:
            EmptyView()
        case .lockApps:
            VStack(alignment: .leading, spacing: 16) {
                FlowLayout(spacing: 12) {
                    ForEach(Array(lockItems.filter { !thrown.contains($0.id) }.enumerated()), id: \.element.id) { index, item in
                        ThrowChip(target: island.center, drift: 1.8 + Double(index % 5) * 0.2, onDragStart: dragStarted, onDragCancel: settle) { frame in
                            throwLock(item.id, item.face, from: frame)
                        } face: {
                            ChipFaceView(face: item.face)
                        }
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(IslandStage.space)) } action: { chipFrames[item.id] = $0 }
                        .riseIn(delay: 0.1 + 0.05 * Double(index))
                    }
                }
                let more = BlockList.count(model.selection) - lockItems.count
                HStack {
                    Button(action: allIn) {
                        ChipFaceView(face: .primary(symbol: "tray.and.arrow.up.fill", title: "All in"))
                    }
                    .buttonStyle(.pressable)
                    if more > 0 {
                        Text("+ \(more) more")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                }
                .riseIn(delay: 0.3)
            }
        case .running:
            VStack(alignment: .leading, spacing: 18) {
                if let session = model.session, showing == .countdown {
                    lockScreenPreview(session)
                        .riseIn(delay: 0.5)
                }
                Button("Keep going") { go(.account) }
                    .buttonStyle(.beam)
                    .riseIn(delay: 0.7)
            }
        case .account:
            VStack(spacing: 6) {
                AccountButtons { accountDone() }
                Button("Not now") { accountDone() }
                    .buttonStyle(.ghost)
            }
            .riseIn(delay: 0.2)
        default:
            VStack(alignment: .leading, spacing: 14) {
                FlowLayout(spacing: 10) {
                    ForEach(Array(chips.enumerated()), id: \.element.id) { index, chip in
                        chipView(chip, index: index, island: island)
                            .riseIn(delay: 0.12 + 0.06 * Double(index))
                    }
                }
                if step == .hours, showHint {
                    Label("Flick it up, or tap", systemImage: "arrow.up")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.45))
                        .transition(.opacity)
                        .riseIn(delay: 0.6)
                }
            }
        }
    }

    @ViewBuilder
    private func chipView(_ chip: Chip, index: Int, island: IslandGeometry) -> some View {
        let isThrown = thrown.contains(chip.id)
        Group {
            if chip.face.isQuiet {
                Button {
                    guard !busy else { return }
                    busy = true
                    tick += 1
                    chip.onLand()
                } label: {
                    ChipFaceView(face: chip.face)
                }
                .buttonStyle(.pressable)
            } else {
                ThrowChip(target: island.center, drift: 1.9 + Double(index % 4) * 0.23, onDragStart: dragStarted, onDragCancel: settle) { frame in
                    throwChip(chip, from: frame)
                } face: {
                    ChipFaceView(face: chip.face)
                }
            }
        }
        // Once one is picked, the others step aside.
        .opacity(isThrown ? 0 : busy ? 0.25 : 1)
        .allowsHitTesting(!busy)
        .animation(.easeOut(duration: 0.25), value: busy)
    }

    /// The choices on each step.
    private var chips: [Chip] {
        switch step {
        case .hours, .pull, .time, .purpose:
            let ask = Asks.all[step.rawValue - Step.hours.rawValue]
            return ask.options.map { option in
                Chip(id: option.title, face: .option(symbol: option.symbol, title: option.title)) { answer(option, in: ask) }
            }
        case .screenTime:
            return [
                Chip(id: "allow", face: .primary(symbol: "hourglass", title: "Allow Screen Time")) { requestScreenTime() },
                Chip(id: "skip", face: .quiet(title: "Not now")) { skipScreenTime() },
            ]
        case .apps:
            return [
                Chip(id: "choose", face: .primary(symbol: "square.grid.2x2.fill", title: "Choose apps")) { picking = true },
                Chip(id: "skip", face: .quiet(title: "Skip")) { go(.notifications) },
            ]
        case .notifications:
            return [
                Chip(id: "allow", face: .primary(symbol: "bell.fill", title: "Turn on")) { requestNotifications() },
                Chip(id: "skip", face: .quiet(title: "Not now")) { notificationsDone(granted: nil) },
            ]
        case .first:
            var list = [
                Chip(id: "f10", face: .primary(symbol: "play.fill", title: "Focus 10 min")) { startFirst(minutes: 10) },
                Chip(id: "f25", face: .option(symbol: "play", title: "25 min")) { startFirst(minutes: 25) },
            ]
            if LiveFocus.screenTimeApproved, BlockList.count(model.selection) > 0, let window = Asks.blockWindow(for: model.hardestTime) {
                list.append(Chip(id: "daily", face: .option(symbol: "lock.fill", title: "Block \(window.label) daily")) { startDaily(window) })
            }
            list.append(Chip(id: "later", face: .quiet(title: "Later")) { skipFirst() })
            return list
        default:
            return []
        }
    }

    /// What the Lock Screen shows, under the island, so you see both places it lives.
    private func lockScreenPreview(_ session: FocusSession) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ON YOUR LOCK SCREEN")
                .font(.caption2.weight(.semibold))
                .tracking(1.3)
                .foregroundStyle(.white.opacity(0.45))
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: session.symbol)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.fzOnBone)
                        .frame(width: 34, height: 34)
                        .background(Color.fzBone, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    VStack(alignment: .leading, spacing: 0) {
                        Text("FOCUSING · \(session.title.uppercased())")
                            .font(.caption2.weight(.semibold))
                            .tracking(1.2)
                            .foregroundStyle(.white.opacity(0.55))
                        Text(timerInterval: session.start...session.end, countsDown: true)
                            .font(.fzDisplay(30))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                    }
                    Spacer(minLength: 0)
                    if lockedSoFar > 0 {
                        Label("\(lockedSoFar)", systemImage: "lock.fill")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(.white.opacity(0.12), in: Capsule())
                    }
                }
                ProgressView(timerInterval: session.start...session.end, countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .tint(Color.fzBone)
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Color(white: 0.1)))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(.white.opacity(0.08)))
        }
    }

    // MARK: The noise at the start

    private static let noiseCards: [(symbol: String, title: String, body: String, x: CGFloat, y: CGFloat, turn: Double)] = [
        ("bubble.left.and.bubble.right.fill", "Group chat", "47 unread messages", -10, -150, -2.5),
        ("dot.radiowaves.left.and.right", "Live now", "Someone you follow just went live", 14, -86, 2),
        ("heart.fill", "12 new likes", "and 3 new followers", -16, -22, -1.5),
        ("sparkles", "You might like this", "Picked for you, based on last night", 10, 42, 2.5),
        ("play.tv.fill", "Just one more episode?", "The next one starts in 5", -6, 106, -2),
    ]

    private func noiseLayer(full: CGSize) -> some View {
        ZStack {
            ForEach(Array(Self.noiseCards.enumerated()), id: \.offset) { index, card in
                if index < noiseShown {
                    HStack(spacing: 12) {
                        Image(systemName: card.symbol)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 38, height: 38)
                            .background(.white.opacity(0.16), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                        VStack(alignment: .leading, spacing: 1) {
                            HStack {
                                Text(card.title).font(.subheadline.weight(.semibold))
                                Spacer(minLength: 8)
                                Text("now").font(.caption).foregroundStyle(.white.opacity(0.5))
                            }
                            Text(card.body)
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.7))
                                .lineLimit(1)
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(white: 0.13)))
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(.white.opacity(0.06)))
                    .rotationEffect(.degrees(noiseGone ? card.turn * 6 : card.turn))
                    .offset(x: card.x, y: noiseGone ? card.y + full.height : card.y)
                    .opacity(noiseGone ? 0 : 1)
                    .animation(.easeIn(duration: 0.55).delay(Double(index) * 0.05), value: noiseGone)
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
                }
            }
        }
        .frame(width: min(full.width - 40, 420))
        .position(x: full.width / 2, y: full.height * 0.5)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: The island's content

    private var hasCompact: Bool { initial != nil || !collected.isEmpty || lockedSoFar > 0 }

    @ViewBuilder
    private var leadingSlot: some View {
        if let initial {
            Text(initial)
                .font(.fzDisplay(12, weight: .bold))
                .foregroundStyle(Color.fzOnBone)
                .frame(width: 22, height: 22)
                .background(Color.fzBone, in: Circle())
        }
    }

    @ViewBuilder
    private var trailingSlot: some View {
        if lockedSoFar > 0 {
            HStack(spacing: 3) {
                Image(systemName: "lock.fill").font(.system(size: 10, weight: .bold))
                Text("\(lockedSoFar)")
                    .font(.caption.weight(.bold))
                    .contentTransition(.numericText(value: Double(lockedSoFar)))
            }
        } else if let last = collected.last {
            Image(systemName: last)
                .font(.system(size: 13, weight: .semibold))
                .contentTransition(.symbolEffect(.replace))
        }
    }

    @ViewBuilder
    private var expandedContent: some View {
        Group {
            switch showing {
            case .welcome:
                HStack(spacing: 12) {
                    Text("Z")
                        .font(.fzDisplay(19))
                        .foregroundStyle(Color.fzOnBone)
                        .frame(width: 36, height: 36)
                        .background(Color.fzBone, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text("FocuzNow").font(.fzDisplay(20, weight: .bold))
                        Text("I live up here.").font(.subheadline).foregroundStyle(.white.opacity(0.7))
                    }
                }
            case let .reply(symbol, title, detail):
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: symbol)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.fzOnBone)
                        .frame(width: 34, height: 34)
                        .background(Color.fzBone, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title)
                            .font(.fzDisplay(19, weight: .bold))
                            .fzTight(19)
                        Text(detail)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.72))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            case .countdown:
                if let session = model.session {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Label(session.title, systemImage: session.symbol)
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            if lockedSoFar > 0 {
                                Label("\(lockedSoFar) locked", systemImage: "lock.fill")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.white.opacity(0.7))
                            }
                        }
                        Text(timerInterval: session.start...session.end, countsDown: true)
                            .font(.fzDisplay(44))
                            .fzTight(44)
                            .monospacedDigit()
                        ProgressView(timerInterval: session.start...session.end, countsDown: false) {
                            EmptyView()
                        } currentValueLabel: {
                            EmptyView()
                        }
                        .tint(Color.fzBone)
                    }
                } else {
                    Label("Done. \(model.completed?.minutes ?? 0) minutes, all yours.", systemImage: "checkmark")
                        .font(.fzDisplay(19, weight: .bold))
                }
            case let .daily(label):
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.fzOnBone)
                        .frame(width: 34, height: 34)
                        .background(Color.fzBone, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Every day, \(label)")
                            .font(.fzDisplay(19, weight: .bold))
                            .fzTight(19)
                        Text("Your apps wait until it's over.")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.72))
                    }
                }
            }
        }
        .id(showing)
        .transition(.opacity.animation(.easeInOut(duration: 0.2)))
    }

    // MARK: Flow

    private func begin() async {
        // Back after leaving mid-flow (going home to see the island, say).
        if let saved = Step(rawValue: savedStep), saved == .running || saved == .account {
            initial = model.userName.first.map { String($0).uppercased() }
            light = 0.6
            // If iOS closed the app in the meantime, the session isn't in memory any more.
            step = saved == .running && model.session == nil && BlockList.dailyWindow == nil ? .account : saved
            if step == .running, model.session == nil, let window = BlockList.dailyWindow {
                showing = .daily(label: window.label)
                islandMode = .expanded
                return
            }
            if saved == .running, model.session != nil {
                showing = .countdown
                islandMode = .expanded
            } else {
                islandMode = hasCompact ? .compact : .resting
            }
            return
        }
        guard step == .noise, noiseShown == 0 else { return }

        try? await Task.sleep(for: .milliseconds(350))
        for index in 1...Self.noiseCards.count {
            withAnimation(.spring(duration: 0.4, bounce: 0.3)) { noiseShown = index }
            try? await Task.sleep(for: .milliseconds(170))
        }
        try? await Task.sleep(for: .milliseconds(450))

        // The island wakes and its light sweeps the noise away.
        showing = .welcome
        withAnimation(.spring(duration: 0.5, bounce: 0.28)) { islandMode = .expanded }
        gulp += 1
        withAnimation(.easeOut(duration: 0.45)) { light = 1 }
        noiseGone = true
        try? await Task.sleep(for: .milliseconds(500))
        withAnimation(.spring(duration: 0.7)) { headline = true }
        withAnimation(.easeInOut(duration: 1.2)) { light = 0.35 }
        try? await Task.sleep(for: .milliseconds(1100))
        withAnimation(.spring(duration: 0.5, bounce: 0.28)) { islandMode = .resting }
        try? await Task.sleep(for: .milliseconds(1100))
        go(.name)
    }

    private func go(_ next: Step) {
        withAnimation(.spring(duration: 0.6, bounce: 0.12)) {
            step = next
            busy = false
        }
        if next == .running || next == .account { savedStep = next.rawValue }
        if next == .name {
            later(0.45) { nameFocused = true }
        }
    }

    private func later(_ seconds: Double, _ action: @escaping () -> Void) {
        Task {
            try? await Task.sleep(for: .seconds(seconds))
            action()
        }
    }

    /// The island answers.
    private func say(_ symbol: String, _ title: String, _ detail: String) {
        withAnimation(.easeInOut(duration: 0.2)) { showing = .reply(symbol: symbol, title: title, detail: detail) }
        withAnimation(.spring(duration: 0.5, bounce: 0.28)) { islandMode = .expanded }
    }

    /// Back to resting, or compact with what it's holding.
    private func settle() {
        withAnimation(.spring(duration: 0.5, bounce: 0.28)) { islandMode = hasCompact ? .compact : .resting }
    }

    private func dragStarted() {
        showHint = false
        tick += 1
        withAnimation(.spring(duration: 0.4, bounce: 0.3)) { islandMode = .catching }
    }

    /// Sends a copy of the chip up into the island; `arrive` runs as it's swallowed.
    private func fly(_ face: ChipFace, from frame: CGRect, then arrive: @escaping () -> Void) {
        let flyer = Flyer(face: face, from: frame)
        flyers.append(flyer)
        withAnimation(.spring(duration: 0.4, bounce: 0.3)) { islandMode = .catching }
        Task {
            try? await Task.sleep(for: .milliseconds(20))
            withAnimation(.spring(duration: 0.42, bounce: 0.1)) { _ = landed.insert(flyer.id) }
            try? await Task.sleep(for: .milliseconds(400))
            flyers.removeAll { $0.id == flyer.id }
            landed.remove(flyer.id)
            gulp += 1
            settle()
            arrive()
        }
    }

    private func throwChip(_ chip: Chip, from frame: CGRect) {
        guard !busy else { return }
        busy = true
        thrown.insert(chip.id)
        fly(chip.face, from: frame, then: chip.onLand)
    }

    // MARK: Steps

    private func submitName() {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !thrown.contains("name") else { return }
        nameFocused = false
        model.userName = trimmed
        thrown.insert("name")
        // Start the flight from where the typed name actually is (it's left-aligned in the field).
        let width = min(nameFrame.width, CGFloat(trimmed.count) * 16 + 10)
        let from = CGRect(x: nameFrame.minX, y: nameFrame.minY, width: width, height: nameFrame.height)
        fly(.word(trimmed), from: from) {
            initial = String(trimmed.prefix(1)).uppercased()
            settle()
            say("hand.wave", "Nice to meet you, \(trimmed).", "Four quick ones. Flick your answer up into the island, or just tap it.")
            withAnimation(.easeInOut(duration: 0.8)) { light = 0.45 }
            later(0.9) { go(.hours) }
        }
    }

    private func answer(_ option: Asks.Option, in ask: Asks.Ask) {
        switch ask.id {
        case "hours":
            model.phoneHoursGuess = option.value
            model.goalMinutes = option.value < 2 ? 60 : option.value < 6 ? 90 : 120
        case "pull": model.distraction = option.title
        case "time": model.hardestTime = option.title
        default: model.focusFor = option.title
        }
        withAnimation(.spring(duration: 0.4)) { collected.append(option.symbol) }
        say(option.symbol, option.reply, option.detail)
        withAnimation(.easeInOut(duration: 0.8)) { light = min(0.85, light + 0.1) }
        let next: Step = switch step {
        case .hours: .pull
        case .pull: .time
        case .time: .purpose
        default: LiveFocus.screenTimeApproved ? .apps : .screenTime
        }
        later(0.9) { go(next) }
    }

    private func requestScreenTime() {
        Task {
            try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            if LiveFocus.screenTimeApproved {
                say("checkmark.shield.fill", "Screen Time's on.", "Next, the apps that pull you away. I only ever see what you pick.")
                later(0.9) { go(.apps) }
            } else {
                skipScreenTime()
            }
        }
    }

    private func skipScreenTime() {
        say("hourglass", "No problem.", "Sessions still work without it. You can turn it on in Settings any time.")
        later(0.9) { go(.notifications) }
    }

    private func pickerClosed() {
        let selection = model.selection
        guard BlockList.count(selection) > 0 else {
            // Closed without picking: bring the chip back.
            thrown.remove("choose")
            busy = false
            settle()
            return
        }
        var items: [LockItem] = []
        for (index, token) in selection.applicationTokens.prefix(10).enumerated() {
            items.append(LockItem(id: "app-\(index)", face: .app(token)))
        }
        for (index, token) in selection.categoryTokens.prefix(max(0, 10 - items.count)).enumerated() {
            items.append(LockItem(id: "category-\(index)", face: .category(token)))
        }
        lockItems = items
        lockedSoFar = 0
        say("square.grid.2x2.fill", "Got them.", "Now put them away.")
        later(0.6) { go(.lockApps) }
    }

    private func throwLock(_ id: String, _ face: ChipFace, from frame: CGRect) {
        guard !thrown.contains(id) else { return }
        withAnimation(.spring(duration: 0.4)) { _ = thrown.insert(id) }
        fly(face, from: frame) {
            withAnimation(.spring(duration: 0.3)) { lockedSoFar += 1 }
            settle()
            if lockItems.allSatisfy({ thrown.contains($0.id) }) { finishLocking() }
        }
    }

    private func allIn() {
        let remaining = lockItems.filter { !thrown.contains($0.id) }
        for (index, item) in remaining.enumerated() {
            later(Double(index) * 0.09) {
                throwLock(item.id, item.face, from: chipFrames[item.id] ?? .zero)
            }
        }
    }

    private func finishLocking() {
        guard step == .lockApps, !busy else { return }
        busy = true
        let total = BlockList.count(model.selection)
        withAnimation(.spring(duration: 0.3)) { lockedSoFar = total }
        say("lock.fill", "Locked away.", total == 1 ? "It waits while you focus." : "All \(total) wait while you focus.")
        later(1.0) { go(.notifications) }
    }

    private func requestNotifications() {
        Task {
            let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            notificationsDone(granted: granted)
        }
    }

    private func notificationsDone(granted: Bool?) {
        switch granted {
        case true?: say("bell.fill", "I'll tap you when time's up.", "A nudge when a session starts and when it's done. Nothing else.")
        case false?: say("bell.slash.fill", "Okay, no taps.", "You can turn them on in Settings later.")
        case nil: say("bell.slash", "No taps, then.", "You can turn them on in Settings later.")
        }
        later(0.9) {
            if returning { finish() } else { go(.first) }
        }
    }

    private func startFirst(minutes: Int) {
        let preset = model.presets.first { $0.id == Asks.presetID(for: model.focusFor) } ?? model.selectedPreset
        model.choose(preset)
        model.sessionMinutes = minutes
        model.startSession()
        // Land on Today with the session bar when onboarding ends, not on the session screen.
        model.showSession = false
        if lockedSoFar == 0, LiveFocus.screenTimeApproved { lockedSoFar = BlockList.count(model.selection) }
        withAnimation(.easeInOut(duration: 0.2)) { showing = .countdown }
        withAnimation(.spring(duration: 0.55, bounce: 0.25)) { islandMode = .expanded }
        withAnimation(.easeOut(duration: 0.4)) { light = 1 }
        withAnimation(.easeInOut(duration: 1.4).delay(0.4)) { light = 0.6 }
        go(.running)
    }

    private func startDaily(_ window: BlockList.Window) {
        do {
            try BlockList.scheduleDaily(window)
            withAnimation(.easeInOut(duration: 0.2)) { showing = .daily(label: window.label) }
            withAnimation(.spring(duration: 0.55, bounce: 0.25)) { islandMode = .expanded }
            go(.running)
        } catch {
            say("exclamationmark.triangle.fill", "Screen Time said no.", "You can set a daily block from Focus later.")
            later(1.2) { go(.account) }
        }
    }

    private func skipFirst() {
        say("light.beacon.max.fill", "Whenever you're ready.", "Start a session from Focus and it'll live up here.")
        later(0.9) { go(.account) }
    }

    private func accountDone() {
        guard !busy else { return }
        if returning {
            go(LiveFocus.screenTimeApproved ? .apps : .screenTime)
        } else {
            finish()
        }
    }

    private func finish() {
        go(.done)
        savedStep = 0
        withAnimation(.spring(duration: 0.5, bounce: 0.28)) { islandMode = .resting }
        later(1.6) {
            withAnimation(.easeIn(duration: 0.6)) {
                light = 1
                leaving = true
            }
            later(0.55) { onboarded = true }
        }
    }
}
