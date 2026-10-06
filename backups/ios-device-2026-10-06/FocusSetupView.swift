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
                ScreenTitle("Focus")
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

                FocusDial(minutes: $model.sessionMinutes)
                    .frame(height: 320)
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
                    .tint(Color.fzInk)
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
                HoldButton(title: "Hold to start \(GoalDial.format(model.sessionMinutes))", holdingTitle: "Charging your orb…", symbol: "bolt.fill", duration: 0.9) {
                    model.startSession()
                }
                .frame(maxWidth: 420)
                .padding(.horizontal, 22)
                .padding(.bottom, 12)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .familyActivityPicker(isPresented: $picking, selection: $model.selection)
        .sheet(isPresented: $customizing) { NavigationStack { CustomizeView() }.environment(model) }
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
