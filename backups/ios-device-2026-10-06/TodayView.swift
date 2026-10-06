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
    /// Read only by the stage and the header, never by this view's body: scrolling then doesn't rebuild
    /// the cards and the chart on every frame.
    @State private var scroll = TodayScroll()
    @State private var showingStats = false

    /// How charged the orb is for a focus score (0–10).
    static func orbEnergy(_ score: Double) -> Double { min(1, max(0.08, score / 10)) }

    private var score: Int { Int((model.focusScore * 10).rounded()) }

    var body: some View {
        GeometryReader { outer in
            let top = outer.safeAreaInsets.top
            let layout = OrbStageLayout(width: outer.size.width, top: top)
            ScrollView {
                ZStack(alignment: .top) {
                    TodayStage(layout: layout, scroll: scroll, energy: Self.orbEnergy(model.focusScore), covered: covered)
                    // Pulled down, the header stays put with the scene (only the cards come down) and
                    // fades as the orb comes closer.
                    PulledHeader(scroll: scroll, content: header.padding(.top, top + 6))
                    content
                        .padding(.top, layout.baseY + 2)
                }
                .frame(width: outer.size.width)
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
            .onScrollGeometryChange(for: CGFloat.self) { geometry in
                // Held at the bottom of the stage once it's scrolled away: scrolling the cards further
                // changes nothing on screen but the cards.
                min(geometry.contentOffset.y + geometry.contentInsets.top, layout.height)
            } action: { _, y in
                scroll.update(y)
            }
        }
        .background(Color.black)
        .environment(\.colorScheme, .dark)
        .toolbarColorScheme(.dark, for: .tabBar)
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            shownScore = 0
            withAnimation(.smooth(duration: 1.2).delay(0.25)) { shownScore = score }
        }
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

    /// Everything under the orb is the same night, lit by its split light (`LitKit.swift`): the score on
    /// the ground in front of the pedestal, the ring button, one machined panel for today, friends with a
    /// lit ring, and the day as a line of light. No grey cards, no white button, no grey capitals.
    private var content: some View {
        VStack(spacing: 22) {
            scoreBlock
            startButton
                .padding(.bottom, 8)
            todayPanel
            friendsNow
            dayWave
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 40)
        .frame(maxWidth: 560)
        .navigationDestination(isPresented: $showingStats) { StatsView() }
    }

    /// The score on the ground in front of the pedestal: a number with depth, lit from above.
    private var scoreBlock: some View {
        let done = model.goalProgress >= 1
        return VStack(spacing: 4) {
            LitCaption("Focus score")
            DimensionalNumber(text: "\(shownScore)", size: 74, depth: 5, value: Double(shownScore))
            HStack(spacing: 8) {
                // The orb's word in its split light.
                Text(Theme.orbWord(model.focusScore))
                    .foregroundStyle(.fzPrismLine)
                Circle().fill(.white.opacity(0.3)).frame(width: 3, height: 3)
                Text("\(model.streakDays)-day streak")
                    .foregroundStyle(Color.fzNightInk.opacity(0.85))
                Image(systemName: "flame.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.fzRose)
            }
            .font(.fzDisplay(16, weight: .bold))
            .padding(.top, 6)
            LitGroove(progress: model.goalProgress)
                .padding(.top, 10)
            HStack {
                LitCaption("\(GoalDial.format(model.focusedMinutesToday)) focused today")
                Spacer()
                LitCaption(done ? "Goal done" : "\(GoalDial.format(max(0, model.goalMinutes - model.focusedMinutesToday))) to go",
                           color: done ? .fzMint : .fzViolet)
            }
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
        .buttonStyle(FZRingButtonStyle())
        .frame(maxWidth: 380)
        .riseIn(delay: 0.25)
    }

    // MARK: Today

    /// Today on one machined panel, four readouts cut apart by grooves: what's next, the top to-do,
    /// what's locked, and screen time.
    private var todayPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                LitHeading("Today")
                Spacer()
                Button { open(.plan) } label: {
                    HStack(spacing: 4) {
                        LitCaption("See plan", color: .fzAqua)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color.fzAqua)
                    }
                    .padding(.vertical, 6)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    nextCell
                    GrooveLine(vertical: true)
                    todoCell
                }
                .fixedSize(horizontal: false, vertical: true)
                GrooveLine()
                HStack(spacing: 0) {
                    lockedCell
                    GrooveLine(vertical: true)
                    screenTimeCell
                }
                .fixedSize(horizontal: false, vertical: true)
            }
            .fzPlate()
        }
        .riseIn(delay: 0.35)
    }

    private func cell<Content: View>(_ action: @escaping () -> Void, @ViewBuilder content: () -> Content) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                content()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(EdgeInsets(top: 16, leading: 16, bottom: 18, trailing: 14))
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressable)
    }

    private func cellTitle(_ text: String) -> some View {
        Text(text)
            .font(.fzDisplay(17, weight: .bold))
            .foregroundStyle(Color.fzNightInk)
            .lineLimit(2)
            .multilineTextAlignment(.leading)
    }

    private func cellDetail(_ text: String) -> some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(Color.fzNightInk.opacity(0.55))
            .lineLimit(1)
    }

    private var nextCell: some View {
        let event = model.events.first
        return cell({ open(.plan) }) {
            HStack(spacing: 4) {
                LitCaption("Next", color: .fzAqua)
                Spacer(minLength: 4)
                if let event {
                    LitCaption(PlanView.time(event.startHour), color: .fzAqua)
                }
            }
            cellTitle(event?.title ?? "Nothing planned")
            cellDetail(event.map(Self.detail) ?? "Your day is open")
        }
    }

    private var todoCell: some View {
        let todo = model.todos.first { !$0.done }
        return cell({ open(.plan) }) {
            LitCaption("To do", color: .fzRose)
            cellTitle(todo?.title ?? "All done")
            cellDetail(todo.map(Self.detail) ?? "Nothing left on your list")
        }
    }

    /// "Library · 1h".
    private static func detail(_ event: EventItem) -> String {
        var parts: [String] = []
        if let place = event.place { parts.append(place) }
        parts.append(GoalDial.format(Int(event.hours * 60)))
        return parts.joined(separator: " · ")
    }

    /// "Due today", or its list.
    private static func detail(_ todo: TodoItem) -> String {
        if let due = todo.due { return "Due \(due.lowercased())" }
        return todo.list
    }

    private var lockedCell: some View {
        cell({ open(.focus) }) {
            LitCaption("Locked", color: .fzViolet)
            AppStack(apps: model.blockedApps, size: 26, limit: 4)
                .padding(.vertical, 1)
            cellDetail(model.blockedCount == 1 ? "1 app" : "\(model.blockedCount) apps")
        }
    }

    private var screenTimeCell: some View {
        cell({ showingStats = true }) {
            LitCaption("Screen time", color: .fzPeri)
            cellTitle(GoalDial.format(model.screenTimeMinutes))
            cellDetail("Today so far")
        }
    }

    // MARK: Below the fold (Customize can turn these off)

    @ViewBuilder
    private var friendsNow: some View {
        let focusing = model.friends.filter { $0.focusingNow && !$0.isMe }
        if model.homeShowsFriends && !focusing.isEmpty {
            HStack(spacing: 14) {
                HStack(spacing: 8) {
                    ForEach(focusing) { friend in
                        Avatar(name: friend.name, size: 36)
                            .fzLiveRing()
                    }
                }
                .padding(.leading, 5)
                VStack(alignment: .leading, spacing: 3) {
                    Text(focusing.map(\.name).formatted(.list(type: .and)))
                        .font(.fzDisplay(15, weight: .bold))
                        .foregroundStyle(Color.fzNightInk)
                    LitCaption("Focusing right now", color: .fzMint)
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            .riseIn(delay: 0.45)
        }
    }

    @ViewBuilder
    private var dayWave: some View {
        if model.homeShowsWave {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    LitHeading("Your day")
                    Spacer()
                    LitCaption("Sharpest at \(DayWave.label(DayWave.peak(model.wave)))", color: .fzViolet)
                }
                DayWave(points: model.wave)
                    .frame(height: 104)
            }
            .padding(.top, 6)
            .riseIn(delay: 0.55)
        }
    }
}

/// How far Today has scrolled (negative while pulled down past the top), outside the view's own state.
@MainActor
@Observable
final class TodayScroll {
    private(set) var y: CGFloat = 0
    /// Only what the header needs: how far it's pulled down (0 while scrolling up), so scrolling the
    /// page normally doesn't touch the header at all.
    private(set) var pulled: CGFloat = 0

    func update(_ value: CGFloat) {
        if y != value { y = value }
        let down = min(value, 0)
        if pulled != down { pulled = down }
    }

    /// How far the page is pulled down past the top, 0 to 1 (eased, like a rubber band).
    static func pull(_ pulled: CGFloat) -> CGFloat { 1 - exp(-max(0, -pulled) / 150) }
}

/// The header, held in place while the page is pulled down and fading as the orb comes closer.
private struct PulledHeader<Content: View>: View {
    let scroll: TodayScroll
    let content: Content

    var body: some View {
        let pulled = scroll.pulled
        content
            .offset(y: pulled)
            .opacity(1 - 0.85 * Double(TodayScroll.pull(pulled)))
    }
}

/// The orb's world, with depth as you scroll: the only part of Today that changes while you scroll or
/// touch the orb. Scrolled up, it drifts away at half speed (its camera tilting a little) while the
/// cards slide over it. Pulled down, it stays where it is and the camera pushes in: the pedestal and
/// the orb grow, the far rocks and the sky barely move, and the cards come down to show more ground.
private struct TodayStage: View {
    let layout: OrbStageLayout
    let scroll: TodayScroll
    let energy: Double
    let covered: Bool
    @State private var touchPoint: CGPoint?
    @State private var strike = 0
    @State private var crackle = 0

    var body: some View {
        let y = scroll.y
        let look = CGSize(width: 0, height: y > 0 ? -y * 0.12 : 0)
        ZStack(alignment: .topLeading) {
            OrbStage(layout: layout, state: .settled(energy), strike: strike, touch: touchPoint,
                     look: look, push: 0.28 * TodayScroll.pull(y), paused: covered || y >= layout.height * 0.9)
            touchArea
        }
        .frame(width: layout.width, height: layout.height, alignment: .topLeading)
        .coordinateSpace(.named("today"))
        .offset(y: y < 0 ? y : y * 0.5)
        .sensoryFeedback(.impact(flexibility: .rigid, intensity: 0.45), trigger: crackle)
        .sensoryFeedback(.impact(weight: .medium), trigger: strike)
        .task(id: touchPoint != nil) {
            while touchPoint != nil, !Task.isCancelled {
                crackle += 1
                try? await Task.sleep(for: .milliseconds(110))
            }
        }
    }

    /// Touch the orb: a strike, and the lightning follows your finger while you hold it.
    private var touchArea: some View {
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
