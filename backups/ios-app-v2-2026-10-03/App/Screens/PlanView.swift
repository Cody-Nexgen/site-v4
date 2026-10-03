import SwiftUI

/// Lists and calendar (spec §4.9). iPhone: a segmented switch. iPad: both side by side.
struct PlanView: View {
    enum Mode: String, CaseIterable { case today = "Today", lists = "Lists" }

    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var mode: Mode = .today
    @State private var day = Calendar.current.startOfDay(for: .now)
    @State private var adding = false
    @State private var newTitle = ""

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            SkyBackground(mood: .day)
            if sizeClass == .regular {
                HStack(alignment: .top, spacing: 24) {
                    lists.frame(maxWidth: 380)
                    calendar
                }
                .padding(24)
            } else {
                VStack(spacing: 14) {
                    header
                    if mode == .today { calendar } else { lists }
                }
                .padding(.horizontal, 20)
            }
            GlassCircleButton(symbol: "plus", size: 58) { adding = true }
                .padding(.trailing, 22)
                .padding(.bottom, 24)
        }
        .toolbar(.hidden, for: .navigationBar)
        .alert("New to-do", isPresented: $adding) {
            TextField("What needs doing?", text: $newTitle)
            Button("Add") {
                if !newTitle.isEmpty { model.todos.insert(TodoItem(title: newTitle, list: "School", due: "Today"), at: 0) }
                newTitle = ""
            }
            Button("Cancel", role: .cancel) { newTitle = "" }
        }
    }

    private var header: some View {
        HStack {
            Text("Plan").font(.system(size: 34, weight: .bold)).foregroundStyle(Color.fzInk)
            Spacer()
            Picker("View", selection: $mode) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(width: 170)
        }
        .padding(.top, 8)
    }

    private var calendar: some View {
        VStack(spacing: 14) {
            WeekStrip(selected: $day)
            ScrollView {
                DayTimeline(events: model.events)
                    .padding(.bottom, 100)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var lists: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 12) {
                    listTile("School", symbol: "graduationcap.fill", color: Theme.indigo)
                    listTile("Home", symbol: "house.fill", color: Theme.coral)
                }
                ForEach(["School", "Home"], id: \.self) { list in
                    VStack(alignment: .leading, spacing: 10) {
                        SectionLabel(list)
                        VStack(spacing: 0) {
                            ForEach(model.todos.filter { $0.list == list }) { todo in
                                TodoRow(todo: todo)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 12)
                            }
                        }
                        .fzSurface()
                    }
                }
            }
            .padding(.bottom, 110)
        }
        .scrollIndicators(.hidden)
    }

    private func listTile(_ title: String, symbol: String, color: Color) -> some View {
        let open = model.todos.filter { $0.list == title && !$0.done }.count
        return VStack(alignment: .leading, spacing: 14) {
            Image(systemName: symbol)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(color.gradient, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline).foregroundStyle(Color.fzInk)
                Text("\(open) to do").font(.caption).foregroundStyle(Color.fzInk3)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .fzSurface()
    }

    static func time(_ hour: Double) -> String {
        let h = Int(hour), m = Int((hour - Double(h)) * 60)
        let display = h % 12 == 0 ? 12 : h % 12
        return m == 0 ? "\(display) \(h < 12 ? "AM" : "PM")" : String(format: "%d:%02d %@", display, m, h < 12 ? "AM" : "PM")
    }
}

struct WeekStrip: View {
    @Binding var selected: Date

    var body: some View {
        let calendar = Calendar.current
        let start = calendar.dateInterval(of: .weekOfYear, for: selected)?.start ?? selected
        HStack(spacing: 6) {
            ForEach(0..<7, id: \.self) { offset in
                let date = calendar.date(byAdding: .day, value: offset, to: start) ?? start
                let isSelected = calendar.isDate(date, inSameDayAs: selected)
                let isToday = calendar.isDateInToday(date)
                Button { withAnimation(.smooth) { selected = date } } label: {
                    VStack(spacing: 6) {
                        Text(date.formatted(.dateTime.weekday(.narrow)))
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(isSelected ? Color.fzBg.opacity(0.75) : Color.fzInk3)
                        Text(date.formatted(.dateTime.day()))
                            .font(.fzNumber(17, weight: .semibold))
                            .foregroundStyle(isSelected ? Color.fzBg : Color.fzInk)
                        Circle()
                            .fill(isToday ? (isSelected ? Color.fzBg : Theme.accent) : Color.clear)
                            .frame(width: 5, height: 5)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background {
                        if isSelected {
                            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.fzInk)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .fzSurface(cornerRadius: 22)
    }
}

/// The day from 7 AM to 10 PM, events as coloured blocks, and a "now" line.
struct DayTimeline: View {
    let events: [EventItem]
    private let first = 7.0
    private let last = 22.0
    private let hourHeight: CGFloat = 64

    var body: some View {
        let now = Double(Calendar.current.component(.hour, from: .now)) + Double(Calendar.current.component(.minute, from: .now)) / 60
        ZStack(alignment: .topLeading) {
            VStack(spacing: 0) {
                ForEach(Int(first)..<Int(last), id: \.self) { hour in
                    HStack(alignment: .top, spacing: 10) {
                        Text(PlanView.time(Double(hour)))
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Color.fzInk3)
                            .frame(width: 44, alignment: .trailing)
                            .offset(y: -6)
                        Rectangle().fill(Color.fzLine).frame(height: 1)
                    }
                    .frame(height: hourHeight, alignment: .top)
                }
            }
            ForEach(events) { event in
                VStack(alignment: .leading, spacing: 2) {
                    Text(event.title).font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzInk)
                    if let place = event.place {
                        Text("\(PlanView.time(event.startHour)) · \(place)").font(.caption).foregroundStyle(Color.fzInk2)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .frame(height: max(36, CGFloat(event.hours) * hourHeight - 4), alignment: .topLeading)
                .background(event.color.opacity(0.22), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2).fill(event.color).frame(width: 4).padding(.vertical, 6)
                }
                .padding(.leading, 58)
                .offset(y: CGFloat(event.startHour - first) * hourHeight + 2)
            }
            if now >= first && now <= last {
                HStack(spacing: 0) {
                    Circle().fill(Theme.coral).frame(width: 9, height: 9)
                    Rectangle().fill(Theme.coral).frame(height: 2)
                }
                .padding(.leading, 50)
                .offset(y: CGFloat(now - first) * hourHeight - 4)
            }
        }
        .frame(height: CGFloat(last - first) * hourHeight, alignment: .top)
    }
}
