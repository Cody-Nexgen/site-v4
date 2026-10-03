import SwiftUI

/// Behind every screen: black (or warm off-white in light mode) with one soft, slowly breathing
/// glow of the accent light. Restraint: no rainbow skies. `mood` only moves where the glow sits.
enum SkyMood: CaseIterable {
    case dawn, day, dusk, night, violet

    static var now: SkyMood { .night }

    var glowCenter: UnitPoint {
        switch self {
        case .dawn: UnitPoint(x: 0.2, y: -0.05)
        case .day: UnitPoint(x: 0.5, y: -0.1)
        case .dusk: UnitPoint(x: 0.85, y: -0.05)
        case .night: UnitPoint(x: 0.5, y: -0.08)
        case .violet: UnitPoint(x: 0.5, y: 0.0)
        }
    }
}

struct SkyBackground: View {
    var mood: SkyMood = .night
    var intensity: Double = 1
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 20, paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            let breathe = 0.85 + 0.15 * sin(t / 3)
            let light = Theme.accent
            ZStack {
                Color.fzBg
                RadialGradient(
                    colors: [light.opacity((scheme == .dark ? 0.32 : 0.45) * breathe * intensity), light.opacity(0.06 * intensity), .clear],
                    center: mood.glowCenter,
                    startRadius: 0,
                    endRadius: 520
                )
                // A second, fainter glow low on the screen for depth.
                RadialGradient(
                    colors: [light.opacity(0.08 * intensity * (2 - breathe)), .clear],
                    center: UnitPoint(x: 0.5, y: 1.15),
                    startRadius: 0,
                    endRadius: 420
                )
            }
        }
        .ignoresSafeArea()
    }
}
