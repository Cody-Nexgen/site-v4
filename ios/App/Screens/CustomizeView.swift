import PhotosUI
import SwiftUI

/// Make FocuzNow yours (spec §4.16): the session background (your own photo or a scene), the clock
/// style, your one accent light, and what Home shows.
struct CustomizeView: View {
    @Environment(AppModel.self) private var model
    @State private var photoItem: PhotosPickerItem?

    var body: some View {
        @Bindable var model = model
        ScrollView {
            VStack(alignment: .leading, spacing: 30) {
                section("Session background", detail: "A scene, or a place you love. Your photo stays on this device.") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 12)], spacing: 12) {
                        Button { withAnimation(.smooth) { model.sessionBackground = .lighthouse } } label: {
                            tile(selected: model.sessionBackground == .lighthouse, title: "Lighthouse") {
                                LighthouseView(scene: LighthouseScene(power: 1, phase: 3.3, speed: 0.6, x: 0.6, waterline: 0.18, horizon: 0.24, scale: 0.9))
                            }
                        }
                        .buttonStyle(.plain)
                        PhotosPicker(selection: $photoItem, matching: .images) {
                            tile(selected: model.sessionBackground == .photo, title: model.backgroundPhoto == nil ? "Your photo" : "Your photo ✓") {
                                if let photo = model.backgroundPhoto {
                                    Image(uiImage: photo).resizable().scaledToFill()
                                } else {
                                    ZStack {
                                        Color.fzSurface
                                        Image(systemName: "photo.badge.plus").font(.title2).foregroundStyle(Color.fzInk2)
                                    }
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        ForEach(SceneKind.allCases) { kind in
                            Button { withAnimation(.smooth) { model.sessionBackground = .scene(kind) } } label: {
                                tile(selected: model.sessionBackground == .scene(kind), title: kind.title) {
                                    LandscapeScene(kind: kind, progress: 1)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                section("Clock", detail: nil) {
                    Picker("Clock", selection: $model.timerStyle) {
                        ForEach(TimerStyle.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    ZStack(alignment: .bottomLeading) {
                        SessionBackdrop(progress: 0.4)
                            .environment(model)
                        SessionClock(remaining: 38 * 60 + 26, progress: 0.4, style: model.timerStyle)
                            .padding(18)
                    }
                    .frame(height: 170)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .animation(.smooth, value: model.timerStyle)
                }

                section("Highlight", detail: "The colour of highlights around the app. Everything else stays black, bone and white.") {
                    HStack(spacing: 18) {
                        ForEach(AccentLight.allCases) { light in
                            let picked = AccentStore.shared.light == light
                            Button { withAnimation(.smooth) { AccentStore.shared.set(light) } } label: {
                                VStack(spacing: 8) {
                                    Circle()
                                        .fill(light.color)
                                        .frame(width: 46, height: 46)
                                        .overlay(Circle().strokeBorder(Color.fzLine))
                                        .shadow(color: light.color.opacity(0.7), radius: picked ? 14 : 0)
                                        .overlay(Circle().strokeBorder(Color.fzInk, lineWidth: picked ? 2.5 : 0).padding(-5))
                                    Text(light.title).font(.caption.weight(.semibold)).foregroundStyle(Color.fzInk2)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .sensoryFeedback(.selection, trigger: AccentStore.shared.light)
                }

                section("Home", detail: nil) {
                    VStack(spacing: 0) {
                        Toggle("Focus through the day", isOn: $model.homeShowsWave).padding(16)
                        Divider().overlay(Color.fzLine)
                        Toggle("Friends focusing now", isOn: $model.homeShowsFriends).padding(16)
                        Divider().overlay(Color.fzLine)
                        Toggle("A quote during sessions", isOn: $model.showQuote).padding(16)
                    }
                    .tint(Color.fzInk)
                    .fzSurface()
                }
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background { SkyBackground() }
        .navigationTitle("Customize")
        .onChange(of: photoItem) {
            Task {
                if let data = try? await photoItem?.loadTransferable(type: Data.self) {
                    withAnimation(.smooth) { model.setBackgroundPhoto(data) }
                }
            }
        }
    }

    private func section<Content: View>(_ title: String, detail: String?, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.title3.weight(.bold)).foregroundStyle(Color.fzInk)
            if let detail {
                Text(detail).font(.footnote).foregroundStyle(Color.fzInk3)
            }
            content()
        }
    }

    private func tile<Content: View>(selected: Bool, title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            content()
                .frame(height: 130)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(selected ? Color.fzInk : .clear, lineWidth: 2.5))
            Text(title).font(.caption.weight(.semibold)).foregroundStyle(selected ? Color.fzInk : Color.fzInk3)
        }
    }
}
