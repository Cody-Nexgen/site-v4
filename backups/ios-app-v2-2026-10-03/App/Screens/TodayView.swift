import SwiftUI

/// Home (spec §4.5). The hero is your focus, literally: scattered and blurry when your score is
/// low, sharp and gathered into the Beam Z when it's high.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Binding var showYou: Bool
    let startFocus: () -> Void
    @State private var fieldFocus = 0.0

    var body: some View {
        ScrollView {
            if sizeClass == .regular {
                HStack(alignment: .top, spacing: 32) {
                    hero.frame(maxWidth: .infinity)
                    VStack(spacing: 28) { stats; upNext; friendsNow }
                        .frame(maxWidth: .infinity)
                }
                .padding(28)
            } else {
                VStack(spacing: 30) { hero; stats; upNext; friendsNow }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 110)
            }
        }
        .scrollIndicators(.hidden)
        .background { SkyBackground() }
        .safeAreaInset(edge: .top) { header }
        .overlay(alignment: .bottom) {
            if model.session == nil {
                Button(action: startFocus) {
                    Label("Start focus", systemImage: "scope")
                }
                .buttonStyle(.beam)
                .frame(maxWidth: 420)
                .padding(.horizontal, 24)
                .padding(.bottom, 12)
                .transition(.blurRise)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear {
            fieldFocus = 0
            withAnimation(.smooth(duration: 1.8).delay(0.2)) { fieldFocus = model.focusScore / 10 }
        }
    }

    private var header: some View {
        HStack {
            Text(greeting)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color.fzInk)
            Spacer()
            Button { showYou = true } label: { Avatar(name: model.userName, size: 36) }
                .buttonStyle(.plain)
                .accessibilityLabel("You")
        }
        .padding(.horizontal, 20)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening"
        return "\(part), \(model.userName)"
    }

    private var hero: some View {
        VStack(spacing: 4) {
            FocusField(focus: fieldFocus)
                .frame(height: 300)
                .overlay(alignment: .bottom) {
                    VStack(spacing: 2) {
                        SectionLabel("Now")
                        Text(model.focusScore, format: .number.precision(.fractionLength(1)))
                            .font(.fzHero(72))
                            .foregroundStyle(Color.fzInk)
                            .contentTransition(.numericText())
                    }
                    .offset(y: 70)
                }
                .padding(.bottom, 64)
            Text(Theme.scoreWord(model.focusScore))
                .font(.headline)
                .foregroundStyle(Color.fzInk2)
                .riseIn(delay: 0.6)
            (Text(GoalDial.format(model.focusedMinutesToday)).foregroundStyle(Theme.accent) + Text(" of \(GoalDial.format(model.goalMinutes)) today · \(model.streakDays)-day streak").foregroundStyle(Color.fzInk3))
                .font(.footnote)
                .padding(.top, 2)
                .riseIn(delay: 0.75)
        }
    }

    private var stats: some View {
        VStack(spacing: 18) {
            StatTrio(items: [
                .init(label: "Last hour", value: String(format: "%.1f", abs(model.lastHourDelta)), trend: model.lastHourDelta),
                .init(label: "Screen time", value: GoalDial.format(model.screenTimeMinutes)),
                .init(label: "Pickups", value: "\(model.pickups)"),
            ])
            if model.homeShowsWave {
                DayWave(points: model.wave)
                    .frame(height: 120)
            }
        }
        .riseIn(delay: 0.9)
    }

    private var upNext: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Up next")
            VStack(spacing: 0) {
                if let event = model.events.first {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 2).fill(event.color).frame(width: 3, height: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.title).font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzInk)
                            Text("\(PlanView.time(event.startHour)) · \(event.place ?? "")").font(.caption).foregroundStyle(Color.fzInk3)
                        }
                        Spacer()
                    }
                    .padding(14)
                    Divider().overlay(Color.fzLine)
                }
                ForEach(model.todos.filter { !$0.done }.prefix(3)) { todo in
                    TodoRow(todo: todo)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                }
            }
            .fzSurface()
        }
        .riseIn(delay: 1.0)
    }

    @ViewBuilder
    private var friendsNow: some View {
        let focusing = model.friends.filter { $0.focusingNow && !$0.isMe }
        if model.homeShowsFriends && !focusing.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                SectionLabel("Focusing now")
                HStack(spacing: 16) {
                    ForEach(focusing) { friend in
                        VStack(spacing: 6) {
                            Avatar(name: friend.name, size: 48)
                                .overlay(Circle().strokeBorder(Theme.accent, lineWidth: 2).padding(-4))
                            Text(friend.name).font(.caption.weight(.semibold)).foregroundStyle(Color.fzInk2)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .riseIn(delay: 1.1)
        }
    }
}

struct TodoRow: View {
    @Environment(AppModel.self) private var model
    let todo: TodoItem

    var body: some View {
        Button {
            if let index = model.todos.firstIndex(where: { $0.id == todo.id }) {
                withAnimation(.smooth) { model.todos[index].done.toggle() }
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: todo.done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(todo.done ? Theme.accent : Color.fzInk3)
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
