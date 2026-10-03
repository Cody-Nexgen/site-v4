import SwiftUI

/// Home (spec §4.5): the Beam and Focus Score up top, the day's stats and wave, then what's next.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Binding var showYou: Bool
    let startFocus: () -> Void

    var body: some View {
        ScrollView {
            if sizeClass == .regular {
                HStack(alignment: .top, spacing: 28) {
                    hero.frame(maxWidth: .infinity)
                    VStack(spacing: 24) { stats; upNext; friendsNow }
                        .frame(maxWidth: .infinity)
                }
                .padding(28)
            } else {
                VStack(spacing: 26) { hero; stats; upNext; friendsNow }
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
                    Label("Start focus", systemImage: "bolt.fill")
                }
                .buttonStyle(.beam)
                .frame(maxWidth: 420)
                .padding(.horizontal, 24)
                .padding(.bottom, 12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }

    private var header: some View {
        HStack {
            Text("FocuzNow")
                .font(.system(size: 26, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.fzInk)
            Spacer()
            Button { showYou = true } label: {
                HStack(spacing: 8) {
                    Text(model.userName).font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzInk)
                    Avatar(name: model.userName, size: 34)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("You")
        }
        .padding(.horizontal, 20)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    private var hero: some View {
        VStack(spacing: 6) {
            BeamView(fill: model.goalProgress, score: model.focusScore, active: model.session != nil)
                .padding(.top, 8)
                .padding(.bottom, 14)
            SectionLabel("Now")
            Text(model.focusScore, format: .number.precision(.fractionLength(1)))
                .font(.fzHero(76))
                .foregroundStyle(Color.fzInk)
                .contentTransition(.numericText())
            Text(Theme.scoreWord(model.focusScore))
                .font(.headline)
                .foregroundStyle(Color.fzInk2)
            Text("\(GoalDial.format(model.focusedMinutesToday)) of \(GoalDial.format(model.goalMinutes)) · 🔥 \(model.streakDays)-day streak")
                .font(.footnote)
                .foregroundStyle(Color.fzInk3)
                .padding(.top, 2)
        }
    }

    private var stats: some View {
        VStack(spacing: 18) {
            StatTrio(items: [
                .init(label: "Last hour", value: String(format: "%.1f", abs(model.lastHourDelta)), trend: model.lastHourDelta),
                .init(label: "Screen time", value: GoalDial.format(model.screenTimeMinutes)),
                .init(label: "Pickups", value: "\(model.pickups)"),
            ])
            DayWave(points: model.wave)
                .frame(height: 130)
        }
    }

    private var upNext: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Up next")
            VStack(spacing: 0) {
                if let event = model.events.first {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 2).fill(event.color).frame(width: 4, height: 34)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.title).font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzInk)
                            Text("\(PlanView.time(event.startHour)) · \(event.place ?? "")").font(.caption).foregroundStyle(Color.fzInk3)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(Color.fzInk3)
                    }
                    .padding(14)
                    Divider().overlay(Color.fzLine)
                }
                ForEach(model.todos.filter { !$0.done }.prefix(3)) { todo in
                    TodoRow(todo: todo)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                }
            }
            .fzSurface()
        }
    }

    private var friendsNow: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionLabel("Focusing now")
            ScrollView(.horizontal) {
                HStack(spacing: 14) {
                    ForEach(model.friends.filter { $0.focusingNow }) { friend in
                        VStack(spacing: 6) {
                            Avatar(name: friend.name, size: 50)
                                .overlay(Circle().strokeBorder(Theme.good, lineWidth: 2).padding(-4))
                            Text(friend.name).font(.caption.weight(.semibold)).foregroundStyle(Color.fzInk2)
                        }
                    }
                    ForEach(model.rooms) { room in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(room.name).font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzInk)
                            Text("\(room.people.count) focusing · \(room.minutesLeft) min left").font(.caption).foregroundStyle(Color.fzInk3)
                        }
                        .padding(14)
                        .fzSurface(cornerRadius: 18)
                    }
                }
            }
            .scrollIndicators(.hidden)
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
                    .foregroundStyle(todo.done ? AnyShapeStyle(Theme.beamGradient) : AnyShapeStyle(Color.fzInk3))
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
