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

// MARK: Settings: account things only. Focus, Pass and looks live where they're used.

/// Themed like the rest of FocuzNow: a lighthouse card on top, then quiet grouped rows.
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("appearance") private var appearance = "system"
    @AppStorage("onboarded") private var onboarded = true
    @AppStorage("onboardingStep") private var onboardingStep = 0
    @AppStorage("devMode") private var devMode = false
    @State private var showPro = false
    @State private var confirmDelete = false
    @State private var nudges = true
    @State private var cheers = true
    @State private var haptics = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                profile.riseIn()

                group("Notifications") {
                    SettingsToggle(symbol: "bell", title: "Session reminders", isOn: $nudges)
                    SettingsToggle(symbol: "party.popper", title: "Heads-up when you finish", isOn: $cheers)
                    SettingsToggle(symbol: "iphone.radiowaves.left.and.right", title: "Haptics", isOn: $haptics)
                }
                .riseIn(delay: 0.08)

                group("Appearance") {
                    HStack(spacing: 8) {
                        ForEach(["system", "light", "dark"], id: \.self) { option in
                            Button { withAnimation(.spring(duration: 0.35)) { appearance = option } } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: option == "light" ? "sun.max" : option == "dark" ? "moon" : "circle.lefthalf.filled").font(.title3)
                                    Text(option == "light" ? "Light" : option == "dark" ? "Dark" : "Auto").font(.caption.weight(.semibold))
                                }
                                .foregroundStyle(appearance == option ? Color.fzBg : Color.fzInk)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(appearance == option ? Color.fzInk : Color.fzInk.opacity(0.05), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                            .buttonStyle(.pressable)
                        }
                    }
                    .padding(10)
                    .sensoryFeedback(.selection, trigger: appearance)
                }
                .riseIn(delay: 0.16)

                group("About") {
                    NavigationLink { AboutView() } label: { SettingsRow(symbol: "light.beacon.max", title: "About FocuzNow") }
                    NavigationLink { GuestPassView() } label: { SettingsRow(symbol: "ticket", title: "Send a guest pass") }
                    Button {
                        onboardingStep = 0
                        onboarded = false
                    } label: { SettingsRow(symbol: "arrow.counterclockwise", title: "Replay the intro", chevron: false) }
                }
                .riseIn(delay: 0.24)

                group("Developer") {
                    SettingsToggle(symbol: "hammer", title: "Developer mode", isOn: $devMode)
                    if devMode {
                        NavigationLink { DeveloperView() } label: { SettingsRow(symbol: "wrench.and.screwdriver", title: "Developer tools") }
                            .transition(.opacity)
                    }
                }
                .animation(.spring(duration: 0.35), value: devMode)
                .riseIn(delay: 0.28)

                group("Account") {
                    Button {} label: { SettingsRow(symbol: "rectangle.portrait.and.arrow.right", title: "Sign out", chevron: false) }
                    Button { confirmDelete = true } label: { SettingsRow(symbol: "trash", title: "Delete account", chevron: false, destructive: true) }
                }
                .riseIn(delay: 0.32)

                Text("FocuzNow 0.1 · Your passwords and photos stay encrypted on your devices.")
                    .font(.footnote)
                    .foregroundStyle(Color.fzInk3)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(SkyBackground())
        .buttonStyle(.plain)
        .navigationTitle("Settings")
        .sheet(isPresented: $showPro) { ProView().environment(model) }
        .confirmationDialog("Delete your FocuzNow account?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete account", role: .destructive) {}
        } message: {
            Text("This deletes your account, sessions, lists and FocuzPass vault from the cloud. It can't be undone.")
        }
    }

    private var profile: some View {
        ZStack(alignment: .bottomLeading) {
            LighthouseView(scene: LighthouseScene(power: Theme.lampPower(model.focusScore), phase: 3.2, speed: 0.7, x: 0.78, waterline: 0.12, horizon: 0.18, scale: 1.0))
                .frame(height: 190)
                .overlay(LinearGradient(colors: [.clear, .black.opacity(0.65)], startPoint: .center, endPoint: .bottom))
            HStack(spacing: 12) {
                Avatar(name: model.userName, size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.userName).font(.fzDisplay(22, weight: .bold)).foregroundStyle(.white)
                    Text(model.isPro ? "FocuzNow Pro" : "Free plan · \(model.streakDays)-day streak").font(.subheadline).foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                if !model.isPro {
                    Button("Go Pro") { showPro = true }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.white, in: Capsule())
                }
            }
            .padding(16)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func group<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionLabel(title).padding(.leading, 4)
            VStack(spacing: 0) { content() }
                .fzSurface(cornerRadius: 20)
        }
    }
}

private struct SettingsRow: View {
    let symbol: String
    let title: String
    var chevron = true
    var destructive = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(destructive ? Theme.danger : Color.fzInk)
                .frame(width: 30, height: 30)
                .background(Color.fzInk.opacity(0.06), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(title).foregroundStyle(destructive ? Theme.danger : Color.fzInk)
            Spacer()
            if chevron {
                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(Color.fzInk3)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

private struct SettingsToggle: View {
    let symbol: String
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.fzInk)
                    .frame(width: 30, height: 30)
                    .background(Color.fzInk.opacity(0.06), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(title).foregroundStyle(Color.fzInk)
            }
        }
        .tint(Color.fzInk)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .sensoryFeedback(.selection, trigger: isOn)
    }
}

// MARK: Pro. StoreKit in Phase 7; never mentions website pricing.

struct ProView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var yearly = true
    @State private var bright = false

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()
            LighthouseView(scene: LighthouseScene(power: bright ? 1.25 : 0.4, phase: 3.1, speed: 1.2, x: 0.7, waterline: 0.55, horizon: 0.6, scale: 0.6))
                .frame(height: 420)
                .mask(LinearGradient(stops: [.init(color: .black, location: 0.6), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom))
                .ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Spacer().frame(height: 230)
                    Text("FocuzNow Pro")
                        .font(.fzDisplay(40))
                        .fzTight(40)
                        .foregroundStyle(.white)
                        .riseIn(delay: 0.3)
                    VStack(alignment: .leading, spacing: 14) {
                        perk("infinity", "Unlimited block lists and schedules")
                        perk("brain.head.profile", "Coach Pro, which thinks deeper")
                        perk("key.fill", "FocuzPass on all your devices")
                        perk("photo.on.rectangle.angled", "Every scene and your own backgrounds")
                    }
                    .riseIn(delay: 0.45)
                    HStack(spacing: 10) {
                        plan("Monthly", "$3.99 / month", selected: !yearly) { yearly = false }
                        plan("Yearly", "$29.99 / year", selected: yearly) { yearly = true }
                    }
                    .riseIn(delay: 0.6)
                    HoldButton(title: "Hold to go Pro", holdingTitle: "Almost…", duration: 0.8) {
                        model.isPro = true
                        dismiss()
                    }
                    .riseIn(delay: 0.75)
                    Button("Restore purchases") {}
                        .buttonStyle(.ghost)
                }
                .padding(24)
                .frame(maxWidth: 520)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
        }
        .environment(\.colorScheme, .dark)
        .task {
            try? await Task.sleep(for: .milliseconds(300))
            bright = true
        }
    }

    private func perk(_ symbol: String, _ text: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.fzOnBone)
                .frame(width: 30, height: 30)
                .background(Color.fzBone, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(text).foregroundStyle(.white)
        }
    }

    private func plan(_ title: String, _ price: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(price).font(.caption).opacity(0.65)
            }
            .foregroundStyle(selected ? Color.fzOnBone : .white)
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? Color.fzBone : Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(selected ? 0 : 0.12)))
        }
        .buttonStyle(.pressable)
        .sensoryFeedback(.selection, trigger: selected)
    }
}

// MARK: The "You" sheet on iPhone

struct YouSheet: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack(spacing: 14) {
                        Avatar(name: model.userName, size: 56)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(model.userName).font(.fzDisplay(24, weight: .bold)).foregroundStyle(Color.fzInk)
                            Text("\(model.coins) coins · \(model.streakDays)-day streak")
                                .font(.subheadline)
                                .foregroundStyle(Color.fzInk3)
                        }
                    }
                    .riseIn()
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        tile("chart.bar.fill", "Stats") { StatsView() }
                        tile("person.2.fill", "Friends") { FriendsView() }
                        tile("tree.fill", "Forest") { ForestView() }
                        tile("bag.fill", "Shop") { ShopView() }
                        tile("paintbrush.fill", "Customize") { CustomizeView() }
                        tile("ticket.fill", "Guest pass") { GuestPassView() }
                    }
                    .riseIn(delay: 0.1)
                    VStack(spacing: 0) {
                        NavigationLink { SettingsView() } label: { row("gearshape.fill", "Settings") }
                        Divider().overlay(Color.fzLine).padding(.leading, 54)
                        NavigationLink { AboutView() } label: { row("light.beacon.max", "About FocuzNow") }
                    }
                    .fzSurface(cornerRadius: 20)
                    .riseIn(delay: 0.2)
                }
                .padding(20)
            }
            .buttonStyle(.pressable)
            .background(Color.fzBg)
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(32)
    }

    private func tile<Destination: View>(_ symbol: String, _ title: String, @ViewBuilder destination: @escaping () -> Destination) -> some View {
        NavigationLink(destination: destination) {
            VStack(alignment: .leading, spacing: 14) {
                Image(systemName: symbol)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.fzBone)
                    .frame(width: 32, height: 32)
                    .background(Color.fzOnBone, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                Text(title).font(.headline).foregroundStyle(Color.fzOnBone)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Color.fzBone, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
    }

    private func row(_ symbol: String, _ title: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.fzInk)
                .frame(width: 30, height: 30)
                .background(Color.fzInk.opacity(0.06), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(title).foregroundStyle(Color.fzInk)
            Spacer()
            Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(Color.fzInk3)
        }
        .padding(12)
        .contentShape(Rectangle())
    }
}
