import SwiftUI

/// Full-bleed landscapes for the session screen, drawn in code (spec §1): layered ridges, a sun or
/// moon, stars. They brighten as the session nears its end.
enum SceneKind: String, CaseIterable, Identifiable, Codable {
    case dawnRidge, nightLake, desertDusk, aurora

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dawnRidge: "Dawn Ridge"
        case .nightLake: "Night Lake"
        case .desertDusk: "Desert Dusk"
        case .aurora: "Aurora"
        }
    }

    var sky: [Color] {
        switch self {
        case .dawnRidge: [0x2A2A5E, 0x7A5A9A, 0xF0A890, 0xFFD6B0].map { Color(hex: $0) }
        case .nightLake: [0x03050E, 0x0A1030, 0x18225A, 0x2A3A78].map { Color(hex: $0) }
        case .desertDusk: [0x1A1240, 0x6A2E70, 0xE0607A, 0xFFB070].map { Color(hex: $0) }
        case .aurora: [0x020812, 0x06203A, 0x0A3A4A, 0x103050].map { Color(hex: $0) }
        }
    }

    /// Far → near.
    var ridges: [Color] {
        switch self {
        case .dawnRidge: [0x6E5A9A, 0x4E3E7A, 0x33285A, 0x1C1638].map { Color(hex: $0) }
        case .nightLake: [0x1A2350, 0x121A3E, 0x0B112C, 0x05081A].map { Color(hex: $0) }
        case .desertDusk: [0xB0507A, 0x7A3466, 0x4A2050, 0x241230].map { Color(hex: $0) }
        case .aurora: [0x0E2A40, 0x0A2034, 0x061628, 0x030C18].map { Color(hex: $0) }
        }
    }

    var hasStars: Bool { self == .nightLake || self == .aurora }
    var sunColor: Color {
        switch self {
        case .dawnRidge: Color(hex: 0xFFE2B8)
        case .nightLake: Color(hex: 0xE8ECFF)
        case .desertDusk: Color(hex: 0xFFC28A)
        case .aurora: Color(hex: 0xD8F5FF)
        }
    }
}

struct LandscapeScene: View {
    var kind: SceneKind
    /// 0 at the start of the session, 1 at the end.
    var progress: Double = 0

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 20, paused: reduceMotion)) { timeline in
            let t = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate
            Canvas { context, size in
                draw(in: &context, size: size, time: t)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    private func draw(in context: inout GraphicsContext, size: CGSize, time: Double) {
        let w = Double(size.width)
        let h = Double(size.height)
        let rect = CGRect(x: 0, y: 0, width: w, height: h)
        context.fill(Path(rect), with: .linearGradient(Gradient(colors: kind.sky), startPoint: .zero, endPoint: CGPoint(x: 0, y: h * 0.75)))

        if kind == .aurora {
            let bandColors: [Color] = [Color(hex: 0x5BFFB0), Color(hex: 0x5BC8FF), Color(hex: 0xA35BFF)]
            for band in 0..<3 {
                let b = Double(band)
                let base: Double = h * (0.18 + 0.07 * b)
                var path = Path()
                path.move(to: CGPoint(x: 0, y: base))
                for x in stride(from: 0.0, through: w, by: 8.0) {
                    let wave: Double = sin(x / 70 + time / 3 + b) * 26 + sin(x / 23 + time / 2) * 6
                    path.addLine(to: CGPoint(x: x, y: base + wave))
                }
                context.drawLayer { layer in
                    layer.addFilter(.blur(radius: 18))
                    layer.stroke(path, with: .color(bandColors[band].opacity(0.55)), lineWidth: 34)
                }
            }
        }

        if kind.hasStars {
            for index in 0..<90 {
                let seed = Double(index)
                let x: Double = frac(seed * 0.754877) * w
                let y: Double = frac(seed * 0.569840) * h * 0.55
                let twinkle: Double = 0.45 + 0.55 * (0.5 + 0.5 * sin(time * 1.3 + seed * 2.1))
                let r: Double = 0.6 + 1.2 * frac(seed * 0.31)
                context.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r, height: r)), with: .color(.white.opacity(twinkle * 0.9)))
            }
        }

        // Sun or moon, with a soft glow.
        let orbX: Double = w * 0.68
        let orbY: Double = h * (0.30 - 0.06 * progress)
        let orbR: Double = min(w, h) * 0.07
        context.drawLayer { layer in
            layer.addFilter(.blur(radius: orbR * 1.6))
            layer.fill(Path(ellipseIn: CGRect(x: orbX - orbR * 2.2, y: orbY - orbR * 2.2, width: orbR * 4.4, height: orbR * 4.4)), with: .color(kind.sunColor.opacity(0.45)))
        }
        context.fill(Path(ellipseIn: CGRect(x: orbX - orbR, y: orbY - orbR, width: orbR * 2, height: orbR * 2)), with: .color(kind.sunColor))

        // Ridges, far to near.
        for (index, color) in kind.ridges.enumerated() {
            let i = Double(index)
            let base: Double = h * (0.46 + 0.1 * i)
            let amplitude: Double = h * (0.07 - 0.008 * i)
            let f1: Double = 140 - 18 * i
            let f2: Double = 57 - 6 * i
            var path = Path()
            path.move(to: CGPoint(x: 0, y: h))
            for x in stride(from: 0.0, through: w + 6, by: 6.0) {
                let n1: Double = 0.55 * sin(x / f1 + i * 1.7)
                let n2: Double = 0.30 * sin(x / f2 + i * 3.1)
                let n3: Double = 0.15 * sin(x / 19 + i * 5.3)
                path.addLine(to: CGPoint(x: x, y: base - amplitude * (n1 + n2 + n3)))
            }
            path.addLine(to: CGPoint(x: w, y: h))
            path.closeSubpath()
            context.fill(path, with: .color(color))
        }

        // Night Lake: a lake with the moon's reflection.
        if kind == .nightLake {
            let top: Double = h * 0.72
            let lake = CGRect(x: 0, y: top, width: w, height: h - top)
            context.fill(Path(lake), with: .linearGradient(Gradient(colors: [Color(hex: 0x0E1838), Color(hex: 0x03050E)]), startPoint: CGPoint(x: 0, y: top), endPoint: CGPoint(x: 0, y: h)))
            for line in 0..<10 {
                let l = Double(line)
                let y: Double = top + 10 + l * 9
                let width: Double = orbR * (2.4 - l * 0.18) + sin(time * 1.5 + l) * 6
                let shimmer = CGRect(x: orbX - width / 2, y: y, width: width, height: 2)
                context.fill(Path(roundedRect: shimmer, cornerRadius: 1), with: .color(kind.sunColor.opacity(0.32 - l * 0.025)))
            }
        }

        // The session's progress: dim at the start, brighter toward the end.
        context.fill(Path(rect), with: .color(.black.opacity(0.32 * (1 - progress))))
    }

    private func frac(_ value: Double) -> Double { value - value.rounded(.down) }
}
