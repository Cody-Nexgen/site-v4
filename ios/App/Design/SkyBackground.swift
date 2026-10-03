import SwiftUI

/// The living gradient sky behind every screen (spec §1). Follows the time of day unless a mood is given.
enum SkyMood: CaseIterable {
    case dawn, day, dusk, night, violet

    static var now: SkyMood {
        switch Calendar.current.component(.hour, from: .now) {
        case 5..<9: .dawn
        case 9..<17: .day
        case 17..<20: .dusk
        default: .night
        }
    }

    /// 3×3 mesh colours, row by row (top → bottom).
    func colors(dark: Bool) -> [Color] {
        let hex: [UInt32]
        switch self {
        case .dawn: hex = [0x2B2550, 0x3A2F66, 0x4A3A78, 0x6E4C8C, 0xB06A8E, 0x8C5A9A, 0xF2A07B, 0xFFC9A8, 0xE89A8C]
        case .day: hex = [0x10224A, 0x1E3A70, 0x18306A, 0x2E5AB0, 0x3D6FD0, 0x4A7FE0, 0x6FA8F0, 0x8FC0FF, 0x7AB0F5]
        case .dusk: hex = [0x120E30, 0x1A1440, 0x221650, 0x4A2266, 0x6B2E7A, 0x8A3A80, 0xE0607A, 0xFF7A6B, 0xFF9A6B]
        case .night: hex = [0x04060F, 0x070A18, 0x0A0E22, 0x0E1430, 0x121A3A, 0x1A1A48, 0x1E1848, 0x2A1F5C, 0x14183C]
        case .violet: hex = [0x0C0A24, 0x16103A, 0x1C1248, 0x2C1A66, 0x4A2A8C, 0x3A2280, 0x5B3AB0, 0x7A4ACC, 0x4A30A0]
        }
        if dark { return hex.map { Color(hex: $0) } }
        // Light mode: the same hues, soft, under a white veil.
        return hex.map { Color(hex: $0).mix(with: .white, by: 0.78) }
    }
}

struct SkyBackground: View {
    var mood: SkyMood = .now
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            MeshGradient(width: 3, height: 3, points: Self.points(t), colors: mood.colors(dark: scheme == .dark))
        }
        .ignoresSafeArea()
    }

    static func points(_ t: Double) -> [SIMD2<Float>] {
        let a = Float(sin(t / 6)) * 0.09
        let b = Float(cos(t / 7.5)) * 0.08
        let c = Float(sin(t / 9 + 1)) * 0.07
        return [
            [0, 0], [0.5 + c, 0], [1, 0],
            [0, 0.45 + a], [0.5 + b, 0.5 - a], [1, 0.5 + c],
            [0, 1], [0.5 - b, 1], [1, 1],
        ]
    }
}
