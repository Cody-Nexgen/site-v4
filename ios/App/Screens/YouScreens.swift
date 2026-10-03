import Charts
import SwiftUI

// MARK: Stats (spec §4.12)

struct StatsView: View {
    @Environment(AppModel.self) private var model
    private let week: [(day: String, minutes: Int)] = [("Mon", 95), ("Tue", 140), ("Wed", 60), ("Thu", 125), ("Fri", 170), ("Sat", 74), ("Sun", 0)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(spacing: 22) {
                    ScoreRing(score: model.focusScore)
                        .frame(width: 140, height: 140)
                    VStack(alignment: .leading, spacing: 8) {
                        SectionLabel("Focus score")
                        Text(Theme.scoreWord(model.focusScore)).font(.title2.weight(.bold)).foregroundStyle(Color.fzInk)
                        Label("\(model.streakDays)-day streak", systemImage: "flame.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.coral)
                    }
                }
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("This week")
                    Chart(week, id: \.day) { entry in
                        BarMark(x: .value("Day", entry.day), y: .value("Minutes", entry.minutes))
                            .foregroundStyle(LinearGradient(colors: [Theme.coral, Theme.violet, Theme.indigo], startPoint: .top, endPoint: .bottom))
                            .cornerRadius(8)
                    }
                    .chartYAxis(.hidden)
                    .frame(height: 180)
                    Text("\(week.map(\.minutes).reduce(0, +) / 60)h \(week.map(\.minutes).reduce(0, +) % 60)m focused · best day Friday")
                        .font(.footnote)
                        .foregroundStyle(Color.fzInk3)
                }
                .padding(18)
                .fzSurface()

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("Top distractions today")
                    ForEach(DistractionApp.samples.prefix(4)) { app in
                        HStack(spacing: 12) {
                            AppIcon(app: app, size: 34)
                            Text(app.name).foregroundStyle(Color.fzInk)
                            Spacer()
                            Text(GoalDial.format(app.minutesToday)).font(.fzNumber(15, weight: .semibold)).foregroundStyle(Color.fzInk2)
                        }
                    }
                }
                .padding(18)
                .fzSurface()

                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("Best hours")
                    HStack(spacing: 3) {
                        ForEach(6..<24, id: \.self) { hour in
                            let level = [0.1, 0.2, 0.6, 0.9, 0.8, 0.5, 0.3, 0.4, 0.7, 0.95, 0.85, 0.6, 0.3, 0.2, 0.45, 0.6, 0.3, 0.15][hour - 6]
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Theme.violet.opacity(0.15 + 0.85 * level))
                                .frame(height: 34)
                        }
                    }
                    HStack {
                        Text("6 AM"); Spacer(); Text("Noon"); Spacer(); Text("Midnight")
                    }
                    .font(.caption2)
                    .foregroundStyle(Color.fzInk3)
                }
                .padding(18)
                .fzSurface()
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background { SkyBackground(mood: .dusk) }
        .navigationTitle("Stats")
    }
}

struct ScoreRing: View {
    let score: Double

    var body: some View {
        ZStack {
            Circle().stroke(Color.fzLine, lineWidth: 14)
            Circle()
                .trim(from: 0, to: score / 10)
                .stroke(AngularGradient(colors: [Theme.indigo, Theme.violet, Theme.coral], center: .center), style: StrokeStyle(lineWidth: 14, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: Theme.scoreColor(score).opacity(0.6), radius: 10)
            Text(score, format: .number.precision(.fractionLength(1)))
                .font(.fzHero(40))
                .foregroundStyle(Color.fzInk)
        }
    }
}

// MARK: Friends (spec §4.13)

struct FriendsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("Focus rooms")
                    ForEach(model.rooms) { room in
                        HStack(spacing: 14) {
                            HStack(spacing: -10) {
                                ForEach(room.people.prefix(4), id: \.self) { Avatar(name: $0, size: 36) }
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(room.name).font(.headline).foregroundStyle(Color.fzInk)
                                Text("\(room.people.count) focusing · \(room.minutesLeft) min left").font(.caption).foregroundStyle(Color.fzInk3)
                            }
                            Spacer()
                            Button("Join") {}
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(Theme.beamGradient, in: Capsule())
                        }
                        .padding(16)
                        .fzSurface()
                    }
                }
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel("This week")
                    let top = Double(model.friends.map(\.minutesThisWeek).max() ?? 1)
                    ForEach(Array(model.friends.sorted { $0.minutesThisWeek > $1.minutesThisWeek }.enumerated()), id: \.element.id) { rank, friend in
                        HStack(spacing: 12) {
                            Text("\(rank + 1)")
                                .font(.fzNumber(17, weight: .heavy))
                                .foregroundStyle(rank == 0 ? Theme.gold : Color.fzInk3)
                                .frame(width: 22)
                            Avatar(name: friend.name, size: 40)
                                .overlay(alignment: .bottomTrailing) {
                                    if friend.focusingNow {
                                        Circle().fill(Theme.good).frame(width: 12, height: 12).overlay(Circle().strokeBorder(.black.opacity(0.4), lineWidth: 2))
                                    }
                                }
                            VStack(alignment: .leading, spacing: 6) {
                                Text(friend.isMe ? "\(friend.name) (you)" : friend.name).font(.subheadline.weight(.semibold)).foregroundStyle(Color.fzInk)
                                GeometryReader { proxy in
                                    Capsule()
                                        .fill(friend.isMe ? AnyShapeStyle(Theme.beamGradient) : AnyShapeStyle(Color.fzInk3.opacity(0.5)))
                                        .frame(width: proxy.size.width * Double(friend.minutesThisWeek) / top)
                                }
                                .frame(height: 6)
                            }
                            Text(GoalDial.format(friend.minutesThisWeek)).font(.fzNumber(15, weight: .semibold)).foregroundStyle(Color.fzInk2)
                        }
                        .padding(.vertical, 6)
                    }
                }
                .padding(18)
                .fzSurface()
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background { SkyBackground(mood: .day) }
        .navigationTitle("Friends")
    }
}

// MARK: Forest (spec §4.14)

struct ForestView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack(alignment: .top) {
            SkyBackground(mood: .dawn)
            Canvas { context, size in
                let w = Double(size.width)
                let h = Double(size.height)
                var hill = Path()
                hill.move(to: CGPoint(x: 0, y: h))
                hill.addLine(to: CGPoint(x: 0, y: h * 0.62))
                hill.addQuadCurve(to: CGPoint(x: w, y: h * 0.6), control: CGPoint(x: w * 0.5, y: h * 0.44))
                hill.addLine(to: CGPoint(x: w, y: h))
                hill.closeSubpath()
                context.fill(hill, with: .linearGradient(Gradient(colors: [Color(hex: 0x3E7A5A), Color(hex: 0x1E3A2C)]), startPoint: CGPoint(x: 0, y: h * 0.45), endPoint: CGPoint(x: 0, y: h)))
                let trees = model.trees
                for (index, tree) in trees.enumerated() {
                    let column = Double(index % 6)
                    let row = Double(index / 6)
                    let x: Double = w * (0.1 + column * 0.16) + (row.truncatingRemainder(dividingBy: 2) == 0 ? 0 : w * 0.08)
                    let groundY: Double = h * (0.62 + row * 0.1) - 18 * sin(x / w * .pi)
                    let height: Double = 26 + Double(tree.minutes) * 0.55
                    context.fill(Path(CGRect(x: x - 2.5, y: groundY - height * 0.3, width: 5, height: height * 0.3)), with: .color(Color(hex: 0x5A3A22)))
                    var crown = Path()
                    crown.move(to: CGPoint(x: x, y: groundY - height))
                    crown.addLine(to: CGPoint(x: x - height * 0.32, y: groundY - height * 0.25))
                    crown.addLine(to: CGPoint(x: x + height * 0.32, y: groundY - height * 0.25))
                    crown.closeSubpath()
                    let greens: [Color] = [Color(hex: 0x5BE3A6), Color(hex: 0x3FBF7C), Color(hex: 0x8EDB6B)]
                    context.fill(crown, with: .color(greens[tree.kind % 3]))
                }
            }
            .ignoresSafeArea()
            VStack(spacing: 4) {
                Text("\(model.trees.count) trees").font(.fzHero(44)).foregroundStyle(Color.fzInk)
                Text("One for every session you finish").font(.subheadline).foregroundStyle(Color.fzInk2)
            }
            .padding(.top, 30)
        }
        .navigationTitle("Forest")
        .navigationBarTitleDisplayMode(.inline)
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
                        .font(.fzNumber(28, weight: .heavy))
                        .foregroundStyle(Theme.goldGradient)
                    Spacer()
                    Text("Earn coins by finishing sessions").font(.caption).foregroundStyle(Color.fzInk3)
                }
                SectionLabel("Session scenes")
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 14)], spacing: 14) {
                    ForEach(model.shop) { item in
                        VStack(alignment: .leading, spacing: 10) {
                            if let scene = item.scene {
                                LandscapeScene(kind: scene, progress: 1)
                                    .frame(height: 110)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            Text(item.title).font(.headline).foregroundStyle(Color.fzInk)
                            Text(item.detail).font(.caption).foregroundStyle(Color.fzInk3)
                            Button {
                                buy(item)
                            } label: {
                                Text(item.owned ? "Owned" : "\(item.price) coins")
                                    .font(.subheadline.weight(.bold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 9)
                                    .foregroundStyle(item.owned ? Color.fzInk3 : Color(hex: 0x3A2200))
                                    .background(item.owned ? AnyShapeStyle(Color.fzLine) : AnyShapeStyle(Theme.goldGradient), in: Capsule())
                            }
                            .disabled(item.owned || model.coins < item.price)
                        }
                        .padding(12)
                        .fzSurface()
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: 820)
            .frame(maxWidth: .infinity)
        }
        .background { SkyBackground(mood: .dusk) }
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

// MARK: Settings (spec §4.16)

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("appearance") private var appearance = "system"
    @AppStorage("onboarded") private var onboarded = true
    @State private var showPro = false
    @State private var confirmDelete = false

    var body: some View {
        @Bindable var model = model
        Form {
            Section {
                HStack(spacing: 14) {
                    Avatar(name: model.userName, size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.userName).font(.title3.weight(.bold))
                        Text(model.isPro ? "FocuzNow Pro" : "Free plan").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if !model.isPro {
                        Button("Go Pro") { showPro = true }
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(Color(hex: 0x3A2200))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Theme.goldGradient, in: Capsule())
                            .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 6)
            }
            Section("Focus") {
                Stepper("Daily goal: \(GoalDial.format(model.goalMinutes))", value: $model.goalMinutes, in: 30...480, step: 15)
                Picker("Default difficulty", selection: $model.difficulty) {
                    ForEach(Difficulty.allCases) { Text($0.title).tag($0) }
                }
                Picker("Scene", selection: $model.scene) {
                    ForEach(SceneKind.allCases) { Text($0.title).tag($0) }
                }
            }
            Section("FocuzPass") {
                Toggle("Unlock with Face ID", isOn: .constant(true))
                Label("Turn on AutoFill in Settings → General → AutoFill & Passwords", systemImage: "key.viewfinder")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Section("Appearance") {
                Picker("Theme", selection: $appearance) {
                    Text("System").tag("system")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                }
                .pickerStyle(.segmented)
            }
            Section("Account") {
                Button("Show onboarding again") { onboarded = false }
                Button("Sign out") {}
                Button("Delete account", role: .destructive) { confirmDelete = true }
            }
        }
        .scrollContentBackground(.hidden)
        .background { SkyBackground(mood: .night) }
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

    var body: some View {
        ZStack {
            SkyBackground(mood: .night)
            ScrollView {
                VStack(spacing: 22) {
                    BeamView(fill: 0.95, score: 10, active: true, gold: true, width: 110, height: 200)
                        .padding(.top, 30)
                    Text("FocuzNow Pro")
                        .font(.system(size: 34, weight: .heavy, design: .rounded))
                        .foregroundStyle(Theme.goldGradient)
                    VStack(alignment: .leading, spacing: 14) {
                        perk("infinity", "Unlimited block lists and schedules")
                        perk("sparkles", "The Pro coach that thinks deeper")
                        perk("key.fill", "FocuzPass sync across all your devices")
                        perk("mountain.2.fill", "Every scene, every Beam colour")
                        perk("person.3.fill", "Private focus rooms with friends")
                    }
                    .padding(20)
                    .fzSurface()
                    HStack(spacing: 10) {
                        plan("Monthly", "$3.99 / month", selected: !yearly) { yearly = false }
                        plan("Yearly", "$29.99 / year · save 37%", selected: yearly) { yearly = true }
                    }
                    Button("Continue") {
                        model.isPro = true
                        dismiss()
                    }
                    .buttonStyle(.beamGold)
                    Button("Restore purchases") {}
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.fzInk2)
                }
                .padding(24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
        }
        .environment(\.colorScheme, .dark)
    }

    private func perk(_ symbol: String, _ text: String) -> some View {
        Label {
            Text(text).foregroundStyle(Color.fzInk)
        } icon: {
            Image(systemName: symbol).foregroundStyle(Theme.goldGradient)
        }
    }

    private func plan(_ title: String, _ price: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline).foregroundStyle(Color.fzInk)
                Text(price).font(.caption).foregroundStyle(Color.fzInk2)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fzSurface(cornerRadius: 18)
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(selected ? Theme.gold : .clear, lineWidth: 2))
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
                            Label("\(model.coins) coins · 🔥 \(model.streakDays) days", systemImage: "circle.hexagongrid.fill")
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
                    NavigationLink { SettingsView() } label: { Label("Settings", systemImage: "gearshape.fill") }
                }
            }
            .navigationTitle("You")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(.ultraThinMaterial)
    }
}
