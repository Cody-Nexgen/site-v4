import SwiftUI

/// Every launch: darkness, the lamp switches on, the beam sweeps once and the wordmark rises.
/// Then the camera flies into the light and the app appears out of it.
struct SplashView: View {
    let done: () -> Void

    @State private var scene = LighthouseScene(power: 0, exposure: 0, phase: 2.7, speed: 1.8)
    @State private var showMark = false
    @State private var exiting = false
    @State private var lit = false

    var body: some View {
        GeometryReader { proxy in
            let lamp = scene.lampPoint(in: proxy.size)
            ZStack {
                LighthouseView(scene: scene)
                VStack(spacing: 10) {
                    Spacer()
                    if showMark {
                        HStack(spacing: 12) {
                            ZMark(size: 40)
                            Text("FocuzNow")
                                .font(.fzDisplay(34))
                                .fzTight(34)
                                .foregroundStyle(.white)
                        }
                        .transition(.blurRise)
                        Text("Everything else can wait.")
                            .font(.headline.weight(.medium))
                            .foregroundStyle(.white.opacity(0.7))
                            .transition(.blurRise)
                    }
                    Spacer().frame(height: proxy.size.height * 0.16)
                }
                .frame(maxWidth: .infinity)
            }
            .scaleEffect(exiting ? 7 : 1, anchor: UnitPoint(x: lamp.x / max(1, proxy.size.width), y: lamp.y / max(1, proxy.size.height)))
            .opacity(exiting ? 0 : 1)
        }
        .ignoresSafeArea()
        .environment(\.colorScheme, .dark)
        .sensoryFeedback(.impact(weight: .medium), trigger: lit)
        .task { await play() }
    }

    private func play() async {
        try? await Task.sleep(for: .milliseconds(120))
        scene.exposure = 1
        try? await Task.sleep(for: .milliseconds(380))
        scene.power = 1.15
        lit = true
        withAnimation(.spring(duration: 0.7, bounce: 0.15)) { showMark = true }
        try? await Task.sleep(for: .milliseconds(1300))
        scene.exposure = 3.2
        scene.speed = 0.2
        withAnimation(.easeIn(duration: 0.6)) { exiting = true }
        try? await Task.sleep(for: .milliseconds(520))
        done()
    }
}
