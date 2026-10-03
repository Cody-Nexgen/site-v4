import SwiftUI

/// Home. The lighthouse at the top shines as bright as your focus today: a dim lamp at a low score,
/// the full beam at a high one. Pull down and the sea stretches; scroll and it drifts behind.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Binding var showYou: Bool
    let startFocus: () -> Void
    @State private var shownScore = 0.0

    var body: some View {
        GeometryReader { outer in
            let top = outer.safeAreaInsets.top
            ScrollView {
                VStack(spacing: 0) {
                    hero(top: top)
                    Group {
                        if sizeClass == .regular {
                            HStack(alignment: .top, spacing: 28) {
                                VStack(spacing: 26) { score; stats }.frame(maxWidth: .infinity)
                                VStack(spacing: 26) { upNext; friendsNow }.frame(maxWidth: .infinity)
                            }
                        } else {
                            VStack(spacing: 26) { score; upNext; stats; friendsNow }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, -28)
                    .padding(.bottom, 120)
                    .frame(maxWidth: 980)
                }
            }
            .scrollIndicators(.hidden)
            .ignoresSafeArea(edges: .top)
        }
        .background(Color.fzBg)
        .overlay(alignment: .bottom) {
            if model.session == nil {
                Button(action: startFocus) {
                    Label("Start \(GoalDial.format(model.selectedPreset.minutes)) focus", systemImage: "play.fill")
                }
                .buttonStyle(.beam)
                .frame(maxWidth: 420)
                .padding(.horizontal, 22)
                .padding(.bottom, 12)
                .transition(.blurRise)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            shownScore = 0
            withAnimation(.spring(duration: 1.4).delay(0.3)) { shownScore = model.focusScore }
        }
    }

    // MARK: Hero

    private func hero(top: CGFloat) -> some View {
        let height = 300 + top
        return GeometryReader { proxy in
            let minY = proxy.frame(in: .scrollView).minY
            LighthouseView(scene: LighthouseScene.header.with(power: Theme.lampPower(model.focusScore)))
                .frame(height: height + max(0, minY))
                .offset(y: minY > 0 ? -minY : -minY * 0.45)
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.7), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                .overlay(alignment: .top) {
                    header
                        .padding(.top, top + 6)
                        .offset(y: minY > 0 ? -minY : 0)
                }
        }
        .frame(height: height)
    }

    private var header: some View {
        HStack {
            Text(greeting)
                .font(.fzDisplay(22, weight: .bold))
                .foregroundStyle(.white)
            Spacer()
            Button { showYou = true } label: { Avatar(name: model.userName, size: 36) }
                .buttonStyle(.pressable)
                .accessibilityLabel("You")
        }
        .padding(.horizontal, 20)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening"
        return "\(part), \(model.userName)"
    }

    // MARK: Score

    private var score: some View {
        VStack(alignment: .leading, spacing: 2) {
            SectionLabel("Focus score")
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(shownScore, format: .number.precision(.fractionLength(1)))
                    .font(.fzDisplay(84))
                    .fzTight(84)
                    .foregroundStyle(Color.fzInk)
                    .contentTransition(.numericText(value: shownScore))
                Text(Theme.scoreWord(model.focusScore))
                    .font(.title3.weight(.medium))
                    .foregroundStyle(Color.fzInk2)
            }
            Text("\(GoalDial.format(model.focusedMinutesToday)) of \(GoalDial.format(model.goalMinutes)) today · \(model.streakDays)-day streak")
                .font(.subheadline)
                .foregroundStyle(Color.fzInk3)
            GoalTrack(progress: model.goalProgress)
                .padding(.top, 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .riseIn(delay: 0.15)
    }

    // MARK: Up next (the website's bone card)

    private var upNext: some View {
        VStack(spacing: 10) {
            Text("Up next")
                .font(.footnote.weight(.medium))
                .foregroundStyle(Color.fzOnBone2)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                if let event = model.events.first {
                    BoneTile(symbol: "clock", title: event.title, detail: "\(PlanView.time(event.startHour))\(event.place.map { " · \($0)" } ?? "")")
                }
                if let todo = model.todos.first(where: { !$0.done }) {
                    BoneTile(symbol: "checkmark.square", title: todo.title, detail: todo.due.map { "Due \($0.lowercased())" } ?? todo.list)
                }
                BoneTile(symbol: "shield.lefthalf.filled", title: "\(model.blockedCount) blocked", detail: "while you focus")
                BoneTile(symbol: "iphone", title: GoalDial.format(model.screenTimeMinutes), detail: "screen time today")
            }
        }
        .fzBoneCard()
        .riseIn(delay: 0.3)
    }

    // MARK: Stats

    private var stats: some View {
        VStack(alignment: .leading, spacing: 16) {
            StatTrio(items: [
                .init(label: "Last hour", value: String(format: "%+.1f", model.lastHourDelta), trend: model.lastHourDelta),
                .init(label: "Pickups", value: "\(model.pickups)"),
                .init(label: "Coins", value: "\(model.coins)"),
            ])
            if model.homeShowsWave {
                VStack(alignment: .leading, spacing: 8) {
                    SectionLabel("Focus through the day")
                    DayWave(points: model.wave)
                        .frame(height: 110)
                }
            }
        }
        .padding(16)
        .fzSurface(cornerRadius: 22)
        .riseIn(delay: 0.45)
    }

    @ViewBuilder
    private var friendsNow: some View {
        let focusing = model.friends.filter { $0.focusingNow && !$0.isMe }
        if model.homeShowsFriends && !focusing.isEmpty {
            HStack(spacing: 12) {
                HStack(spacing: -10) {
                    ForEach(focusing) { friend in
                        Avatar(name: friend.name, size: 38)
                            .overlay(Circle().strokeBorder(Color.fzBg, lineWidth: 2.5))
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(focusing.map(\.name).formatted(.list(type: .and)))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.fzInk)
                    Text("focusing right now")
                        .font(.caption)
                        .foregroundStyle(Color.fzInk3)
                }
                Spacer()
                Circle().fill(Color.fzInk).frame(width: 7, height: 7)
                    .phaseAnimator([0.3, 1.0]) { dot, phase in dot.opacity(phase) } animation: { _ in .easeInOut(duration: 1.1) }
            }
            .padding(14)
            .fzSurface(cornerRadius: 20)
            .riseIn(delay: 0.6)
        }
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
