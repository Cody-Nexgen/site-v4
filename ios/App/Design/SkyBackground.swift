import SwiftUI

/// Kept for older call sites: `mood` no longer changes anything.
enum SkyMood: CaseIterable {
    case dawn, day, dusk, night, violet
}

/// Behind most screens: FocuzNow black (bone in light mode) with a faint glow of lamplight at the
/// top, like the website. Static, so it costs nothing.
struct SkyBackground: View {
    var mood: SkyMood = .night
    var intensity: Double = 1
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        ZStack {
            Color.fzBg
            if scheme == .dark {
                RadialGradient(
                    colors: [Theme.accent.opacity(0.10 * intensity), .clear],
                    center: UnitPoint(x: 0.5, y: -0.1),
                    startRadius: 0,
                    endRadius: 460
                )
            }
        }
        .ignoresSafeArea()
    }
}
