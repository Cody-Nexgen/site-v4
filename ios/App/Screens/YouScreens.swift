import Charts
import SwiftUI

// MARK: Stats (spec §4.12)

struct StatsView: View {
    @Environment(AppModel.self) private var model
    private let week: [(day: String, minutes: Int)] = [("Mon", 95), ("Tue", 140), ("Wed", 60), ("Thu", 125), ("Fri", 170), ("Sat", 74), ("Sun", 0)]
    private let hourLevels: [Double] = [0.1, 0.2, 0.6, 0.9, 0.8, 0.5, 0.3, 0.4, 0.7, 0.95, 0.85, 0.6, 0.3, 0.2, 0.45, 0.6, 0.3, 0.15]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack(spacing: 22) {
                    ScoreRing(score: model.focusScore)
                        .frame(width: 130, height: 130)
                    VStack(alignment: .leading, spacing: 6) {
                        SectionLabel("Focus score")
                        Text(Theme.scoreWord(model.focusScore)).font(.title2.weight(.bold)).foregroundStyle(Color.fzInk)
                        Label("\(model.streakDays)-day streak", systemImage: "flame.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.accent)
                    }
                }
                .riseIn()

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("This week")
                    Chart(week, id: \.day) { entry in
                        BarMark(x: .value("Day", entry.day), y: .value("Minutes", entry.minutes))
                            .foregroundStyle(entry.day == "Fri" ? Theme.accent : Color.fzInk.opacity(0.3))
                            .cornerRadius(8)
                    }
                    .chartYAxis(.hidden)
                    .frame(height: 170)
                    Text("\(week.map(\.minutes).reduce(0, +) / 60)h \(week.map(\.minutes).reduce(0, +) % 60)m focused · best day Friday")
                        .font(.footnote)
                        .foregroundStyle(Color.fzInk3)
                }
                .riseIn(delay: 0.1)

                VStack(alignment: .leading, spacing: 14) {
                    SectionLabel("Pulling you away today")
                    ForEach(DistractionApp.samples.prefix(4)) { app in
                        HStack(spacing: 12) {
                            AppIcon(app: app, size: 32)
                            Text(app.name).foregroundStyle(Color.fzInk)
                            Spacer()
                            Text(GoalDial.format(app.minutesToday)).font(.fzNumber(15)).foregroundStyle(Color.fzInk2)
                        }
                    }
                }
                .riseIn(delay: 0.2)

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("When you focus best")
                    HStack(spacing: 3) {
                        ForEach(hourLevels.indices, id: \.self) { index in
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Theme.accent.opacity(0.1 + 0.9 * hourLevels[index]))
                                .frame(height: 34)
                        }
                    }
                    HStack {
                        Text("6 AM"); Spacer(); Text("Noon"); Spacer(); Text("Midnight")
                    }
                    .font(.caption2)
                    .foregroundStyle(Color.fzInk3)
                }
                .riseIn(delay: 0.3)
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background { SkyBackground() }
        .navigationTitle("Stats")
    }
}

struct ScoreRing: View {
    let score: Double

    var body: some View {
        ZStack {
            Circle().stroke(Color.fzLine, lineWidth: 12)
            Circle()
                .trim(from: 0, to: score / 10)
                .stroke(Theme.accent, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: Theme.accent.opacity(0.5), radius: 10)
            Text(score, format: .number.precision(.fractionLength(1)))
                .font(.fzHero(38))
                .foregroundStyle(Color.fzInk)
        }
    }
}

// MARK: Friends (spec §4.13)

struct FriendsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let ranked = model.friends.sorted { $0.minutesThisWeek > $1.minutesThisWeek }
        let top = Double(ranked.first?.minutesThisWeek ?? 1)
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                SectionLabel("This week")
                ForEach(Array(ranked.enumerated()), id: \.element.id) { rank, friend in
                    HStack(spacing: 12) {
                        Text("\(rank + 1)")
                            .font(.fzNumber(17, weight: .bold))
                            .foregroundStyle(rank == 0 ? Theme.accent : Color.fzInk3)
                            .frame(width: 22)
                        Avatar(name: friend.name, size: 42)
                            .overlay(alignment: .bottomTrailing) {
                                if friend.focusingNow {
                                    Circle().fill(Theme.good).frame(width: 12, height: 12).overlay(Circle().strokeBorder(Color.fzBg, lineWidth: 2))
                                }
                            }
                        VStack(alignment: .leading, spacing: 6) {
                            Text(friend.isMe ? "\(friend.name) (you)" : friend.name).font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzInk)
                            GeometryReader { proxy in
                                Capsule()
                                    .fill(friend.isMe ? Theme.accent : Color.fzInk.opacity(0.25))
                                    .frame(width: proxy.size.width * Double(friend.minutesThisWeek) / top)
                            }
                            .frame(height: 5)
                        }
                        Text(GoalDial.format(friend.minutesThisWeek)).font(.fzNumber(15)).foregroundStyle(Color.fzInk2)
                    }
                    .padding(.vertical, 8)
                    .riseIn(delay: 0.06 * Double(rank))
                }
                Button {} label: {
                    Label("Invite a friend", systemImage: "person.badge.plus")
                }
                .buttonStyle(.glassPill)
                .padding(.top, 14)
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background { SkyBackground() }
        .navigationTitle("Friends")
    }
}

// MARK: Shop

struct ShopView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Label("\(model.coins)", systemImage: "circle.hexagongrid.fill")
                        .font(.fzNumber(28))
                        .foregroundStyle(Theme.accent)
                        .contentTransition(.numericText())
                    Spacer()
                    Text("Earn coins by finishing sessions").font(.caption).foregroundStyle(Color.fzInk3)
                }
                SectionLabel("Session scenes")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 14)], spacing: 14) {
                    ForEach(Array(model.shop.enumerated()), id: \.element.id) { index, item in
                        VStack(alignment: .leading, spacing: 10) {
                            if let scene = item.scene {
                                LandscapeScene(kind: scene, progress: 1)
                                    .frame(height: 120)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            Text(item.title).font(.headline).foregroundStyle(Color.fzInk)
                            Text(item.detail).font(.caption).foregroundStyle(Color.fzInk3)
                            Button { buy(item) } label: {
                                Text(item.owned ? "Owned" : "\(item.price) coins")
                                    .font(.subheadline.weight(.bold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 9)
                                    .foregroundStyle(item.owned ? Color.fzInk3 : Color.fzBg)
                                    .background(item.owned ? Color.fzLine : Color.fzInk, in: Capsule())
                            }
                            .disabled(item.owned || model.coins < item.price)
                        }
                        .padding(12)
                        .fzSurface()
                        .riseIn(delay: 0.06 * Double(index))
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: 820)
            .frame(maxWidth: .infinity)
        }
        .background { SkyBackground() }
        .navigationTitle("Focuz Shop")
    }

    private func buy(_ item: ShopItem) {
        guard let index = model.shop.firstIndex(where: { $0.id == item.id }), model.coins >= item.price else { return }
        withAnimation(.smooth) {
            model.coins -= item.price
            model.shop[index].owned = true
        }
    }
}

// MARK: Settings (spec §4.16): account things only. Focus, Pass and looks live where they're used.

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("appearance") private var appearance = "system"
    @AppStorage("onboarded") private var onboarded = true
    @State private var showPro = false
    @State private var confirmDelete = false
    @State private var nudges = true
    @State private var cheers = true

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    Avatar(name: model.userName, size: 52)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(model.userName).font(.headline)
                        Text(model.isPro ? "FocuzNow Pro" : "Free plan").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if !model.isPro {
                        Button("Go Pro") { showPro = true }
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Color.fzBg)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(Color.fzInk, in: Capsule())
                            .buttonStyle(.plain)
                    }
                }
            }
            Section("Notifications") {
                Toggle("Session reminders", isOn: $nudges)
                Toggle("Cheers when you finish", isOn: $cheers)
            }
            Section("Appearance") {
                Picker("Theme", selection: $appearance) {
                    Text("System").tag("system")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                }
            }
            Section("Account") {
                Button("Sign out") {}
                Button("Delete account", role: .destructive) { confirmDelete = true }
            }
            Section {
                Button("Replay the intro") { onboarded = false }
            } footer: {
                Text("FocuzNow 0.1 · Your passwords and photos stay encrypted on your devices.")
            }
        }
        .tint(Color.fzInk)
        .navigationTitle("Settings")
        .sheet(isPresented: $showPro) { ProView().environment(model) }
        .confirmationDialog("Delete your FocuzNow account?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete account", role: .destructive) {}
        } message: {
            Text("This deletes your account, sessions, lists and FocuzPass vault from the cloud. It can't be undone.")
        }
    }
}

// MARK: Pro (spec §4.17). StoreKit in Phase 7; never mentions website pricing.

struct ProView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var yearly = true
    @State private var focus = 0.3

    var body: some View {
        ZStack {
            SkyBackground(mood: .night, intensity: 1.5)
            ScrollView {
                VStack(spacing: 22) {
                    FocusField(focus: focus)
                        .frame(width: 200, height: 200)
                        .padding(.top, 20)
                    Text("FocuzNow Pro")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .riseIn(delay: 0.5)
                    VStack(alignment: .leading, spacing: 16) {
                        perk("infinity", "Unlimited block lists and schedules")
                        perk("brain.head.profile", "Coach Pro, which thinks deeper")
                        perk("key.fill", "FocuzPass on all your devices")
                        perk("photo.on.rectangle.angled", "Every scene and custom backgrounds")
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .riseIn(delay: 0.7)
                    HStack(spacing: 10) {
                        plan("Monthly", "$3.99 / month", selected: !yearly) { yearly = false }
                        plan("Yearly", "$29.99 / year", selected: yearly) { yearly = true }
                    }
                    .riseIn(delay: 0.85)
                    Button("Continue") {
                        model.isPro = true
                        dismiss()
                    }
                    .buttonStyle(.beam)
                    Button("Restore purchases") {}
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.6))
                }
                .padding(24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
        }
        .environment(\.colorScheme, .dark)
        .onAppear { withAnimation(.smooth(duration: 1.6)) { focus = 1 } }
    }

    private func perk(_ symbol: String, _ text: String) -> some View {
        Label {
            Text(text).foregroundStyle(.white)
        } icon: {
            Image(systemName: symbol).foregroundStyle(Theme.accent)
        }
    }

    private func plan(_ title: String, _ price: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline).foregroundStyle(.white)
                Text(price).font(.caption).foregroundStyle(.white.opacity(0.6))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(selected ? Color.white : .clear, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }
}

// MARK: The "You" sheet on iPhone

struct YouSheet: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        Avatar(name: model.userName, size: 54)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(model.userName).font(.title3.weight(.bold))
                            Text("\(model.coins) coins · \(model.streakDays)-day streak")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                }
                Section {
                    NavigationLink { StatsView() } label: { Label("Stats", systemImage: "chart.bar.fill") }
                    NavigationLink { FriendsView() } label: { Label("Friends", systemImage: "person.2.fill") }
                    NavigationLink { ForestView() } label: { Label("Forest", systemImage: "tree.fill") }
                    NavigationLink { ShopView() } label: { Label("Focuz Shop", systemImage: "bag.fill") }
                    NavigationLink { CustomizeView() } label: { Label("Customize", systemImage: "paintbrush.fill") }
                }
                Section {
                    NavigationLink { SettingsView() } label: { Label("Settings", systemImage: "gearshape.fill") }
                }
            }
            .tint(Color.fzInk)
            .navigationTitle("You")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(.ultraThinMaterial)
    }
}
