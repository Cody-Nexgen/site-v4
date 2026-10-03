import FamilyControls
import SwiftUI

/// Start a session (spec §4.6): preset, length, what's blocked, difficulty, then Start.
struct FocusSetupView: View {
    @Environment(AppModel.self) private var model
    @State private var picking = false
    @State private var customizing = false
    @State private var screenTime = AuthorizationCenter.shared.authorizationStatus

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                Text("Focus")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(Color.fzInk)
                    .padding(.horizontal, 20)

                ScrollView(.horizontal) {
                    HStack(spacing: 10) {
                        ForEach(model.presets) { preset in
                            Button { withAnimation(.smooth) { model.choose(preset) } } label: {
                                Chip(title: preset.title, symbol: preset.symbol, selected: preset.id == model.selectedPresetID)
                            }
                            .buttonStyle(.plain)
                        }
                        Chip(title: "New", symbol: "plus")
                    }
                    .padding(.horizontal, 20)
                }
                .scrollIndicators(.hidden)

                TimeRing(minutes: $model.sessionMinutes)
                    .frame(height: 290)
                    .frame(maxWidth: .infinity)

                VStack(spacing: 12) {
                    if screenTime != .approved {
                        Button {
                            Task {
                                try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                                screenTime = AuthorizationCenter.shared.authorizationStatus
                            }
                        } label: {
                            HStack {
                                Image(systemName: "exclamationmark.shield.fill").foregroundStyle(Theme.warn)
                                Text("Allow Screen Time so FocuzNow can block apps").font(.subheadline).foregroundStyle(Color.fzInk)
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(Color.fzInk3)
                            }
                            .padding(16)
                            .fzSurface()
                        }
                        .buttonStyle(.plain)
                    }

                    Button { picking = true } label: {
                        SettingCard(label: "Block list", trailing: "\(model.blockedCount) items") {
                            AppStack(apps: model.blockedApps, size: 32, limit: 5)
                        }
                    }
                    .buttonStyle(.plain)

                    Menu {
                        Picker("Difficulty", selection: $model.difficulty) {
                            ForEach(Difficulty.allCases) { level in
                                Label(level.title, systemImage: level.symbol).tag(level)
                            }
                        }
                    } label: {
                        SettingCard(label: "Difficulty", trailing: nil) {
                            VStack(alignment: .leading, spacing: 2) {
                                Label(model.difficulty.title, systemImage: model.difficulty.symbol)
                                    .font(.headline)
                                    .foregroundStyle(Color.fzInk)
                                Text(model.difficulty.detail).font(.caption).foregroundStyle(Color.fzInk3)
                            }
                        }
                    }

                    Toggle(isOn: $model.breaksOn) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Breaks").font(.headline).foregroundStyle(Color.fzInk)
                            Text("\(model.selectedPreset.breakMinutes) min when you need one").font(.caption).foregroundStyle(Color.fzInk3)
                        }
                    }
                    .tint(Theme.violet)
                    .padding(16)
                    .fzSurface()
                    .disabled(model.difficulty == .lockedIn)

                    Button { customizing = true } label: {
                        SettingCard(label: "Background", trailing: nil) {
                            SessionBackdrop(progress: 0.5)
                                .frame(width: 120, height: 70)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
            }
            .padding(.top, 8)
            .padding(.bottom, 120)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background { SkyBackground(mood: .dusk) }
        .overlay(alignment: .bottom) {
            if model.session == nil {
                Button {
                    model.startSession()
                } label: {
                    Label("Start \(GoalDial.format(model.sessionMinutes)) session", systemImage: "play.fill")
                }
                .buttonStyle(.beam)
                .frame(maxWidth: 420)
                .padding(.horizontal, 24)
                .padding(.bottom, 12)
                .sensoryFeedback(.impact(weight: .medium), trigger: model.session?.id)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
        .sheet(isPresented: $customizing) { NavigationStack { CustomizeView() }.environment(model) }
    }
}

/// Drag around the ring to set the session length (15 min to 3 h, 5-minute steps).
struct TimeRing: View {
    @Binding var minutes: Int
    private let range = 15...180

    var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height) - 30
            let fraction = Double(minutes - range.lowerBound) / Double(range.upperBound - range.lowerBound)
            ZStack {
                ForEach(0..<60, id: \.self) { tick in
                    Capsule()
                        .fill(Double(tick) / 60 <= fraction ? Color.fzInk : Color.fzInk3.opacity(0.5))
                        .frame(width: 2.5, height: tick % 5 == 0 ? 14 : 7)
                        .offset(y: -side / 2 + 10)
                        .rotationEffect(.degrees(Double(tick) * 6))
                }
                Circle()
                    .trim(from: 0, to: max(0.01, fraction))
                    .stroke(Theme.beamGradient, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .padding(28)
                    .shadow(color: Theme.violet.opacity(0.6), radius: 10)
                VStack(spacing: 0) {
                    Text(FocusSession.clock(TimeInterval(minutes * 60)))
                        .font(.fzHero(64))
                        .foregroundStyle(Color.fzInk)
                        .contentTransition(.numericText())
                        .monospacedDigit()
                    SectionLabel("Drag to set")
                }
            }
            .frame(width: side, height: side)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Circle())
            .gesture(
                DragGesture(minimumDistance: 0).onChanged { drag in
                    let dx = Double(drag.location.x - proxy.size.width / 2)
                    let dy = Double(drag.location.y - proxy.size.height / 2)
                    var angle = atan2(dx, -dy)
                    if angle < 0 { angle += 2 * .pi }
                    let raw = Double(range.lowerBound) + angle / (2 * .pi) * Double(range.upperBound - range.lowerBound)
                    let value = min(range.upperBound, max(range.lowerBound, Int((raw / 5).rounded()) * 5))
                    if value != minutes { withAnimation(.snappy) { minutes = value } }
                }
            )
            .sensoryFeedback(.selection, trigger: minutes)
        }
        .accessibilityElement()
        .accessibilityLabel("Session length")
        .accessibilityValue(GoalDial.format(minutes))
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: minutes = min(range.upperBound, minutes + 5)
            case .decrement: minutes = max(range.lowerBound, minutes - 5)
            @unknown default: break
            }
        }
    }
}

struct SettingCard<Content: View>: View {
    let label: String
    let trailing: String?
    @ViewBuilder var content: Content

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 10) {
                SectionLabel(label)
                content
            }
            Spacer()
            if let trailing {
                Text(trailing).font(.caption).foregroundStyle(Color.fzInk3)
            }
            Image(systemName: "chevron.right").font(.caption.weight(.bold)).foregroundStyle(Color.fzInk3)
        }
        .padding(16)
        .fzSurface()
    }
}
