import FamilyControls
import SwiftUI

/// Start a session, on the night (`docs/ios-lit-look.md`): the timer as a thing you could hold
/// (`TimerDevice`), presets, a ruler you slide for the length (`TimeRuler`), then one plate with what's
/// locked, how strict, breaks and the background, and hold to start. Dark in light mode too.
struct FocusSetupView: View {
    @Environment(AppModel.self) private var model
    @State private var picking = false
    @State private var customizing = false
    @State private var screenTime = AuthorizationCenter.shared.authorizationStatus

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Focus")
                        .font(.fzDisplay(34, weight: .bold))
                        .fzTight(34)
                        .foregroundStyle(Color.fzNightInk)
                    Text("Pick a length, then hold to start.")
                        .font(.subheadline)
                        .foregroundStyle(Color.fzNightInk.opacity(0.72))
                }
                .padding(.horizontal, 20)

                TimerDevice(minutes: model.sessionMinutes)
                    .frame(height: 196)
                    .padding(.horizontal, 14)

                presets
                TimeRuler(minutes: $model.sessionMinutes)
                    .padding(.horizontal, 20)

                settings
                    .padding(.horizontal, 20)
                    .padding(.top, 6)
            }
            .padding(.top, 8)
            .padding(.bottom, 130)
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background {
            // The orb's light coming down from above, split.
            ZStack {
                Color.black
                RadialGradient(colors: [Color.fzAqua.opacity(0.14), .clear], center: UnitPoint(x: 0.3, y: -0.05), startRadius: 0, endRadius: 320)
                RadialGradient(colors: [Color.fzViolet.opacity(0.14), .clear], center: UnitPoint(x: 0.75, y: -0.05), startRadius: 0, endRadius: 320)
            }
            .ignoresSafeArea()
        }
        .overlay(alignment: .bottom) { startButton }
        .environment(\.colorScheme, .dark)
        .toolbarColorScheme(.dark, for: .tabBar)
        .toolbar(.hidden, for: .navigationBar)
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
        .sheet(isPresented: $customizing) { NavigationStack { CustomizeView() }.environment(model) }
    }

    // MARK: Length

    /// The presets as pills: the picked one lit from inside with the orb's colours (no outline).
    private var presets: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(model.presets) { preset in
                    let on = preset.id == model.selectedPresetID
                    Button {
                        withAnimation(.smooth) { model.choose(preset) }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: preset.symbol)
                                .font(.system(size: 12, weight: .semibold))
                            Text(preset.title)
                            Text(GoalDial.format(preset.minutes))
                                .foregroundStyle(.white.opacity(on ? 0.8 : 0.5))
                        }
                        .font(.fzDisplay(14, weight: .bold))
                        .foregroundStyle(.white.opacity(on ? 1 : 0.75))
                        .padding(.horizontal, 14)
                        .frame(height: 38)
                        .background {
                            if on {
                                LitGlass(glow: 0.9)
                            } else {
                                Capsule().fill(.white.opacity(0.06))
                            }
                        }
                        .contentShape(Capsule())
                    }
                    .buttonStyle(.pressable)
                }
            }
            .padding(.horizontal, 20)
        }
        .scrollIndicators(.hidden)
        .sensoryFeedback(.selection, trigger: model.selectedPresetID)
    }

    // MARK: Settings

    private var settings: some View {
        @Bindable var model = model
        return VStack(spacing: 0) {
            if screenTime != .approved {
                Button {
                    Task {
                        try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                        screenTime = AuthorizationCenter.shared.authorizationStatus
                    }
                } label: {
                    row {
                        LitCaption("Screen Time is off", color: .fzGold)
                        Text("Allow it so FocuzNow can lock apps")
                            .font(.fzDisplay(15, weight: .bold))
                            .foregroundStyle(Color.fzNightInk)
                    } trailing: {
                        chevron
                    }
                }
                .buttonStyle(.plain)
                GrooveLine()
            }

            Button { picking = true } label: {
                row {
                    LitCaption("Locked while you focus", color: .fzViolet)
                    HStack(spacing: 12) {
                        AppStack(apps: model.blockedApps, size: 30, limit: 5)
                        Text(model.blockedCount == 1 ? "1 app" : "\(model.blockedCount) apps")
                            .font(.subheadline)
                            .foregroundStyle(Color.fzNightInk.opacity(0.7))
                    }
                } trailing: {
                    chevron
                }
            }
            .buttonStyle(.plain)
            GrooveLine()

            row {
                LitCaption("How strict", color: .fzAqua)
                StrictnessPicker(difficulty: $model.difficulty)
                Text(model.difficulty.detail)
                    .font(.footnote)
                    .foregroundStyle(Color.fzNightInk.opacity(0.65))
                    .fixedSize(horizontal: false, vertical: true)
            } trailing: {
                EmptyView()
            }
            GrooveLine()

            row {
                LitCaption("Breaks", color: .fzWheelMint)
                Text(model.difficulty == .lockedIn ? "None when you're locked in" : "\(GoalDial.format(model.selectedPreset.breakMinutes)) when you need one")
                    .font(.fzDisplay(15, weight: .bold))
                    .foregroundStyle(Color.fzNightInk)
            } trailing: {
                Toggle("Breaks", isOn: $model.breaksOn)
                    .labelsHidden()
                    .tint(Color.fzAqua)
                    .disabled(model.difficulty == .lockedIn)
            }
            GrooveLine()

            Button { customizing = true } label: {
                row {
                    LitCaption("While you focus", color: .fzRose)
                    Text("The background")
                        .font(.fzDisplay(15, weight: .bold))
                        .foregroundStyle(Color.fzNightInk)
                } trailing: {
                    HStack(spacing: 12) {
                        SessionBackdrop(progress: 0.5)
                            .frame(width: 84, height: 52)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        chevron
                    }
                }
            }
            .buttonStyle(.plain)
        }
        .fzPlate()
    }

    private func row<Content: View, Trailing: View>(@ViewBuilder _ content: () -> Content,
                                                    @ViewBuilder trailing: () -> Trailing) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing()
        }
        .padding(16)
        .contentShape(Rectangle())
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(Color.fzNightInk.opacity(0.45))
    }

    // MARK: Start

    @ViewBuilder
    private var startButton: some View {
        Group {
            if model.session == nil {
                LightHoldButton(title: "Hold to start \(GoalDial.format(model.sessionMinutes))", holdingTitle: "Charging your orb…",
                                symbol: "bolt.fill", duration: 0.9) {
                    model.startSession()
                }
            } else {
                Button { model.showSession = true } label: {
                    Label("Back to your session", systemImage: "timer")
                }
                .buttonStyle(FZLightButtonStyle())
            }
        }
        .frame(maxWidth: 420)
        .padding(.horizontal, 22)
        .padding(.bottom, 14)
    }
}

/// Easy, Normal, Locked in: a track cut into the metal, the picked one a lit piece of glass in it.
private struct StrictnessPicker: View {
    @Binding var difficulty: Difficulty
    @Namespace private var glass

    var body: some View {
        HStack(spacing: 3) {
            ForEach(Difficulty.allCases) { level in
                let on = level == difficulty
                Button {
                    withAnimation(.spring(duration: 0.35)) { difficulty = level }
                } label: {
                    Text(level.title)
                        .font(.fzDisplay(14, weight: .bold))
                        .foregroundStyle(.white.opacity(on ? 1 : 0.6))
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background {
                            if on {
                                LitGlass(glow: 0.75)
                                    .matchedGeometryEffect(id: "picked", in: glass)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .fzSunk(cornerRadius: 21)
        .sensoryFeedback(.selection, trigger: difficulty)
    }
}
