import SwiftUI

/// FocuzNow's signature visual (spec §1): a glass prism holding living light. It fills toward today's
/// goal, warms as the Focus Score rises, and light rises inside it during a session.
struct BeamView: View {
    var fill: Double
    var score: Double
    var active = false
    var gold = false
    var width: CGFloat = 150
    var height: CGFloat = 280

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            let level = CGFloat(max(0.06, min(1, fill)))
            ZStack {
                // Bloom behind the prism.
                Capsule()
                    .fill(glow)
                    .frame(width: width * 1.05, height: height * (0.45 + 0.5 * level))
                    .blur(radius: 46)
                    .opacity(0.55 + 0.1 * sin(t / 2))
                    .offset(y: height * (1 - level) * 0.25)

                // The glass shell.
                Capsule()
                    .fill(Color.white.opacity(0.05))
                    .overlay(
                        Capsule().strokeBorder(
                            LinearGradient(colors: [.white.opacity(0.55), .white.opacity(0.08), .white.opacity(0.25)], startPoint: .topLeading, endPoint: .bottomTrailing),
                            lineWidth: 1.2
                        )
                    )

                // The light, filled to today's level.
                MeshGradient(width: 3, height: 3, points: Self.points(t), colors: palette)
                    .mask(alignment: .bottom) {
                        Rectangle().frame(height: height * level)
                    }
                    .clipShape(Capsule())
                    .padding(5)

                // The surface line where the light ends.
                Capsule()
                    .fill(Color.white.opacity(0.8))
                    .frame(width: width * 0.62, height: 2)
                    .blur(radius: 1.5)
                    .offset(y: height / 2 - 5 - (height - 10) * level)
                    .opacity(level < 0.97 ? 0.9 : 0)

                if active && !reduceMotion {
                    BeamParticles(time: t)
                        .clipShape(Capsule())
                        .padding(8)
                }

                // Glass highlight down the left side.
                Capsule()
                    .fill(LinearGradient(colors: [.white.opacity(0.38), .clear], startPoint: .leading, endPoint: .center))
                    .padding(7)
                    .blendMode(.plusLighter)
                    .opacity(0.55)
            }
            .frame(width: width, height: height)
        }
        .accessibilityElement()
        .accessibilityLabel("Today's focus, \(Int(fill * 100)) percent of your goal")
    }

    private var palette: [Color] {
        if gold {
            return [0xFFF1B8, 0xFFD36B, 0xFFB05B, 0xFFC25B, 0xFF9A5B, 0xFFD36B, 0xFF8A5B, 0xFFB05B, 0xFFE08A].map { Color(hex: $0) }
        }
        switch score {
        case ..<4: return [0x8EA2FF, 0x5B6CFF, 0x7A8CFF, 0x3E4FD6, 0x5B6CFF, 0x4A5BE8, 0x2E3B8F, 0x3E4FD6, 0x2A3580].map { Color(hex: $0) }
        case ..<7: return [0xC4A8FF, 0x8F6BFF, 0xA88CFF, 0x6B4FE0, 0x8F6BFF, 0x7A5BF0, 0x4A35A8, 0x5B44C0, 0x3E2E90].map { Color(hex: $0) }
        case ..<9: return [0xFFB8E8, 0xC266FF, 0xE08CFF, 0x8F6BFF, 0xA35BFF, 0xC266FF, 0x5B6CFF, 0x7A5BF0, 0x4A4AD0].map { Color(hex: $0) }
        default: return [0xFFE0A0, 0xFF9A6B, 0xFFC28A, 0xFF7A6B, 0xE066C8, 0xFF8A5B, 0xA35BFF, 0xC266FF, 0x7A5BF0].map { Color(hex: $0) }
        }
    }

    private var glow: Color { gold ? Theme.gold : Theme.scoreColor(score) }

    static func points(_ t: Double) -> [SIMD2<Float>] {
        let a = Float(sin(t / 2.4)) * 0.16
        let b = Float(cos(t / 3.1)) * 0.14
        return [
            [0, 0], [0.5 + a, 0], [1, 0],
            [0, 0.5 - b], [0.5 + b, 0.5 + a], [1, 0.5 + a],
            [0, 1], [0.5 - a, 1], [1, 1],
        ]
    }
}

/// Specks of light rising inside the Beam while a session runs.
private struct BeamParticles: View {
    let time: Double

    var body: some View {
        Canvas { context, size in
            let w = Double(size.width)
            let h = Double(size.height)
            for index in 0..<22 {
                let seed = Double(index)
                let speed: Double = 0.05 + 0.02 * frac(seed * 0.37)
                let phase: Double = (time * speed + seed * 0.137).truncatingRemainder(dividingBy: 1)
                let y: Double = (1 - phase) * h
                let x: Double = w * (0.15 + 0.7 * frac(seed * 0.618)) + sin(time + seed) * 5
                let radius: Double = 1.2 + 1.6 * frac(seed * 0.29)
                let opacity: Double = sin(phase * .pi) * 0.85
                context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: radius * 2, height: radius * 2)), with: .color(.white.opacity(opacity)))
            }
        }
        .blendMode(.plusLighter)
    }

    private func frac(_ value: Double) -> Double { value - value.rounded(.down) }
}
