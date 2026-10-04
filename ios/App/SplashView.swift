import SwiftUI

/// Every launch once you're set up: on black (the launch screen is black too, so there's no flash),
/// the bare Beam Z draws itself as a beam of light, fills, glows once, then fades as Today comes up
/// behind it. About 2 seconds. No tile: it's a splash, not an icon.
struct SplashView: View {
    let done: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var draw: CGFloat = 0
    @State private var fill: CGFloat = 0
    @State private var bloom = false
    @State private var exiting = false

    var body: some View {
        ZStack {
            Color.black
                .opacity(exiting ? 0 : 1)
            BeamZDrawing(size: 184, draw: draw, fill: fill)
                .shadow(color: Color.fzMint.opacity(bloom ? 0.55 : 0), radius: 44)
                .scaleEffect(exiting ? 0.88 : 1)
                .blur(radius: exiting ? 10 : 0)
                .opacity(exiting ? 0 : 1)
        }
        .ignoresSafeArea()
        .allowsHitTesting(!exiting)
        .sensoryFeedback(.impact(weight: .light), trigger: bloom)
        .task { await play() }
    }

    private func play() async {
        if reduceMotion {
            draw = 1
            fill = 1
            try? await Task.sleep(for: .milliseconds(500))
            withAnimation(.easeOut(duration: 0.4)) { exiting = true }
            try? await Task.sleep(for: .milliseconds(400))
            done()
            return
        }
        try? await Task.sleep(for: .milliseconds(150))
        withAnimation(.easeInOut(duration: 0.95)) { draw = 1 }
        try? await Task.sleep(for: .milliseconds(850))
        withAnimation(.easeInOut(duration: 0.4)) { fill = 1 }
        try? await Task.sleep(for: .milliseconds(380))
        withAnimation(.easeOut(duration: 0.25)) { bloom = true }
        try? await Task.sleep(for: .milliseconds(300))
        withAnimation(.easeInOut(duration: 0.6)) { exiting = true }
        try? await Task.sleep(for: .milliseconds(600))
        done()
    }
}
