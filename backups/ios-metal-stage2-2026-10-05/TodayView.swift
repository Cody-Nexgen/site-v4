import SwiftUI

/// Home, from the owner's mockup: your focus orb floating over its pedestal, then the score, Start, and
/// what's on today. Its world follows your focus score: a low score is a cold, foggy, still world; a
/// high one is lit, with rocks floating round the orb. Touch the orb and the lightning reaches for your
/// finger. The stage is the same one the onboarding builds (same `OrbStageLayout`), so the onboarding
/// hands over to this screen without a cut. It's a night scene, so Today stays dark in light mode too.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    let openCoach: () -> Void
    let startFocus: () -> Void
    let open: (AppTab) -> Void
    /// Something covers Today (Coach's sheet, a session): the stage stops drawing.
    var covered = false
    @State private var shownScore = 0
    @State private var touchPoint: CGPoint?
    @State private var strike = 0
    @State private var crackle = 0
    /// How far the page has scrolled (negative while pulled down past the top).
    @State private var scrollY: CGFloat = 0

    /// How charged the orb is for a focus score (0–10).
    static func orbEnergy(_ score: Double) -> Double { min(1, max(0.08, score / 10)) }

    private var score: Int { Int((model.focusScore * 10).rounded()) }

    var body: some View {
        GeometryReader { outer in
            let top = outer.safeAreaInsets.top
            let layout = OrbStageLayout(width: outer.size.width, top: top)
            ScrollView {
                ZStack(alignment: .top) {
                    stage(layout)
                    // Pulled down, the header stays put with the scene (only the cards come down) and
                    // fades as the orb comes closer.
                    header
                        .padding(.top, top + 6)
                        .offset(y: min(scrollY, 0))
                        .opacity(1 - 0.85 * Double(pullProgress))
                    content
                        .padding(.top, layout.baseY + 2)
                }
                .frame(width: outer.size.width)
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            .onScrollGeometryChange(for: CGFloat.self) { geometry in
                // Held at the bottom of the stage once it's scrolled away, so scrolling the cards
                // further doesn't rebuild the page on every frame.
                min(geometry.contentOffset.y + geometry.contentInsets.top, layout.height)
            } action: { _, y in
                scrollY = y
            }
        }
        .background(Color.black)
        .environment(\.colorScheme, .dark)
        .toolbarColorScheme(.dark, for: .tabBar)
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.45), trigger: crackle)
        .sensoryFeedback(.impact(weight: .medium), trigger: strike)
        .task(id: touchPoint != nil) {
            while touchPoint != nil, !Task.isCancelled {
                crackle += 1
                try? await Task.sleep(for: .milliseconds(110))
            }
        }
        .onAppear {
            shownScore = 0
            withAnimation(.smooth(duration: 1.2).delay(0.25)) { shownScore = score }
        }
    }

    /// How far the page is pulled down past the top, 0 to 1 (eased, like a rubber band).
    private var pullProgress: CGFloat { 1 - exp(-max(0, -scrollY) / 150) }

    /// The orb's world, with depth as you scroll. Scrolled up, it drifts away at half speed (its camera
    /// tilting a little) while the cards slide over it. Pulled down, it stays where it is and the
    /// camera pushes in: the pedestal and the orb grow, the far rocks and the sky barely move, and the
    /// cards come down to show more of the ground.
    private func stage(_ layout: OrbStageLayout) -> some View {
        let look = CGSize(width: 0, height: scrollY > 0 ? -scrollY * 0.12 : 0)
        return ZStack(alignment: .topLeading) {
            OrbStage(layout: layout, state: .settled(Self.orbEnergy(model.focusScore)), strike: strike, touch: touchPoint,
                     look: look, push: 0.28 * pullProgress, paused: covered || scrollY >= layout.height * 0.9)
            orbTouchArea(layout)
        }
        .frame(width: layout.width, height: layout.height, alignment: .topLeading)
        .coordinateSpace(.named("today"))
        .offset(y: scrollY < 0 ? scrollY : scrollY * 0.5)
    }

    /// Touch the orb: a strike, and the lightning follows your finger while you hold it.
    private func orbTouchArea(_ layout: OrbStageLayout) -> some View {
        Circle()
            .fill(.clear)
            .contentShape(Circle())
            .frame(width: layout.sphereRadius * 2.4, height: layout.sphereRadius * 2.4)
            .position(layout.orbCenter)
            .frame(width: layout.width, height: layout.height)
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named("today"))
                    .onChanged { value in
                        if touchPoint == nil { strike += 1 }
                        touchPoint = value.location
                    }
                    .onEnded { _ in touchPoint = nil }
            )
            .accessibilityHidden(true)
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                BeamZMark(size: 34)
                Text("FocuzNow")
                    .font(.fzDisplay(19, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button(action: openCoach) {
                    // Not Liquid Glass here: glass over the moving scene re-renders every frame.
                    Image(systemName: "sparkles")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(Color.black.opacity(0.35)))
                        .overlay(Circle().strokeBorder(.white.opacity(0.16)))
                }
                .buttonStyle(.pressable)
                .accessibilityLabel("Coach")
                Button { open(.you) } label: { Avatar(name: model.userName, size: 40, image: model.profilePhoto) }
                    .buttonStyle(.pressable)
                    .accessibilityLabel("You")
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(greeting)
                    .font(.fzDisplay(30, weight: .bold))
                    .foregroundStyle(.white)
                Text(Self.focusLine(model.focusScore))
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.62))
            }
            .riseIn(delay: 0.05)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: 980)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening"
        return "\(part), \(model.userName)"
    }

    static func focusLine(_ score: Double) -> String {
        switch score {
        case ..<2: "Start a session to charge it up."
        case ..<6: "Your focus is warming up."
        case ..<9: "Your focus is building."
        default: "Fully charged today."
        }
    }

    // MARK: Under the stage

    private var content: some View {
        VStack(spacing: 22) {
            scoreBlock
            startButton
            todayCard
            friendsNow
            dayWave
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 40)
        .frame(maxWidth: 560)
    }

    /// The score on the ground in front of the pedestal, lit by the orb above it: part of the scene,
    /// not a card on top of it.
    private var scoreBlock: some View {
        VStack(spacing: 4) {
            Text("FOCUS SCORE")
                .font(.caption2.weight(.semibold))
                .tracking(2.4)
                .foregroundStyle(.white.opacity(0.55))
            Text("\(shownScore)")
                .font(.fzDisplay(66, weight: .black))
                .fzTight(66)
                .monospacedDigit()
                .foregroundStyle(LinearGradient(colors: [.white, Color(hex: 0xCFF5DE)], startPoint: .top, endPoint: .bottom))
                .contentTransition(.numericText(value: Double(shownScore)))
                // The orb's light on it: a gradient behind, not a shadow (a shadow is a blur, redone
                // every frame over the moving scene).
                .background {
                    Rectangle()
                        .fill(EllipticalGradient(colors: [Color.fzMint.opacity(0.2), Color.fzMint.opacity(0)],
                                                 center: .center, startRadiusFraction: 0, endRadiusFraction: 0.5))
                        .frame(width: 190, height: 110)
                        .allowsHitTesting(false)
                }
            HStack(spacing: 7) {
                Text(Theme.orbWord(model.focusScore))
                    .foregroundStyle(Color.fzMint)
                Circle().fill(.white.opacity(0.3)).frame(width: 3, height: 3)
                Label("\(model.streakDays)-day streak", systemImage: "flame.fill")
                    .labelStyle(TrailingIconLabelStyle())
                    .foregroundStyle(.white.opacity(0.75))
            }
            .font(.subheadline.weight(.semibold))
            HStack(spacing: 10) {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.1))
                        Capsule()
                            .fill(Color.fzMint)
                            .frame(width: max(4, proxy.size.width * min(1, model.goalProgress)))
                            .shadow(color: Color.fzMint.opacity(0.6), radius: 5)
                    }
                }
                .frame(width: 84, height: 4)
                Text(model.goalProgress >= 1 ? "Goal done. The orb is showing off." : "\(GoalDial.format(max(0, model.goalMinutes - model.focusedMinutesToday))) to today's goal")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.5))
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .riseIn(delay: 0.15)
    }

    private var startButton: some View {
        Button {
            if model.session != nil { model.showSession = true } else { startFocus() }
        } label: {
            Label(model.session != nil ? "Back to your session" : "Start \(GoalDial.format(model.selectedPreset.minutes)) focus",
                  systemImage: model.session != nil ? "timer" : "play.fill")
        }
        .buttonStyle(FZPrimaryButtonStyle(height: 58))
        .frame(maxWidth: 360)
        .riseIn(delay: 0.25)
    }

    // MARK: Today card

    private var todayCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Today")
                    .font(.fzDisplay(21, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Button { open(.plan) } label: {
                    HStack(spacing: 4) {
                        Text("See all")
                        Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                    }
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.55))
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 6)

            if let event = model.events.first {
                Button { open(.plan) } label: {
                    TodayRow(symbol: "book", title: event.title, detail: "\(PlanView.time(event.startHour))\(event.place.map { " · \($0)" } ?? "")")
                }
                .buttonStyle(.pressable)
                rowDivider
            }
            if let todo = model.todos.first(where: { !$0.done }) {
                Button { open(.plan) } label: {
                    TodayRow(symbol: "checkmark.square", title: todo.title, detail: todo.due.map { "Due \($0.lowercased())" } ?? todo.list)
                }
                .buttonStyle(.pressable)
                rowDivider
            }
            Button { open(.focus) } label: {
                TodayRow(symbol: "shield.lefthalf.filled", title: model.blockedCount == 1 ? "1 app blocked" : "\(model.blockedCount) apps blocked", detail: "Distracting apps")
            }
            .buttonStyle(.pressable)
            rowDivider
            NavigationLink { StatsView() } label: {
                TodayRow(symbol: "chart.bar.fill", title: GoalDial.format(model.screenTimeMinutes), detail: "Screen time today")
            }
            .buttonStyle(.pressable)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Color(hex: 0x111214).opacity(0.88)))
        .fzEdgeLight(cornerRadius: 24)
        .riseIn(delay: 0.35)
    }

    private var rowDivider: some View {
        Rectangle()
            .fill(.white.opacity(0.08))
            .frame(height: 1)
            .padding(.leading, 60)
    }

    // MARK: Below the fold (Customize can turn these off)

    @ViewBuilder
    private var friendsNow: some View {
        let focusing = model.friends.filter { $0.focusingNow && !$0.isMe }
        if model.homeShowsFriends && !focusing.isEmpty {
            HStack(spacing: 12) {
                HStack(spacing: -10) {
                    ForEach(focusing) { friend in
                        Avatar(name: friend.name, size: 38)
                            .overlay(Circle().strokeBorder(Color.black, lineWidth: 2.5))
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(focusing.map(\.name).formatted(.list(type: .and)))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                    Text("focusing right now")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.55))
                }
                Spacer()
                Circle().fill(Color.fzMint).frame(width: 7, height: 7)
                    .phaseAnimator([0.3, 1.0]) { dot, phase in dot.opacity(phase) } animation: { _ in .easeInOut(duration: 1.1) }
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color(hex: 0x111214).opacity(0.88)))
            .fzEdgeLight(cornerRadius: 20)
            .riseIn(delay: 0.45)
        }
    }

    @ViewBuilder
    private var dayWave: some View {
        if model.homeShowsWave {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel("Focus through the day")
                DayWave(points: model.wave)
                    .frame(height: 110)
            }
            .padding(16)
            .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color(hex: 0x111214).opacity(0.88)))
            .fzEdgeLight(cornerRadius: 22)
            .riseIn(delay: 0.55)
        }
    }
}

/// One line of the Today card: an icon tile, a title and a detail, and a chevron.
private struct TodayRow: View {
    let symbol: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(.white)
                .frame(width: 46, height: 46)
                .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(.white.opacity(0.06)))
                .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).strokeBorder(.white.opacity(0.1)))
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.55))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white.opacity(0.4))
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
    }
}

/// A thin track toward today's goal that fills on appear.
struct GoalTrack: View {
    let progress: Double
    @State private var shown = 0.0

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.fzLine)
                Capsule().fill(Color.fzInk).frame(width: max(4, proxy.size.width * shown))
            }
        }
        .frame(height: 4)
        .onAppear { withAnimation(.spring(duration: 1.2).delay(0.4)) { shown = min(1, max(0, progress)) } }
        .accessibilityElement()
        .accessibilityLabel("Today's goal")
        .accessibilityValue("\(Int(progress * 100)) percent")
    }
}

struct TodoRow: View {
    @Environment(AppModel.self) private var model
    let todo: TodoItem

    var body: some View {
        Button {
            if let index = model.todos.firstIndex(where: { $0.id == todo.id }) {
                withAnimation(.spring(duration: 0.4)) { model.todos[index].done.toggle() }
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: todo.done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(todo.done ? Color.fzInk : Color.fzInk3)
                    .contentTransition(.symbolEffect(.replace))
                Text(todo.title)
                    .strikethrough(todo.done)
                    .foregroundStyle(todo.done ? Color.fzInk3 : Color.fzInk)
                Spacer()
                if let due = todo.due, !todo.done {
                    Text(due).font(.caption).foregroundStyle(Color.fzInk3)
                }
            }
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.success, trigger: todo.done)
    }
}

/// "6-day streak 🔥" with the icon after the text.
private struct TrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.title
            configuration.icon.foregroundStyle(Color.fzMint)
        }
    }
}
