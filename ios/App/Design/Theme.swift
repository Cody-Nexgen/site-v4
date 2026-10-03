import SwiftUI
import UIKit

/// The one light colour the person picks (Customize). Everything else is FocuzNow black and white.
enum AccentLight: String, CaseIterable, Identifiable {
    case warm, ice, mint, rose

    var id: String { rawValue }
    var title: String {
        switch self {
        case .warm: "Warm"
        case .ice: "Ice"
        case .mint: "Mint"
        case .rose: "Rose"
        }
    }
    var color: Color {
        switch self {
        case .warm: Color(hex: 0xFFD49A)
        case .ice: Color(hex: 0xA8D8FF)
        case .mint: Color(hex: 0x9FF0CF)
        case .rose: Color(hex: 0xFFB3C1)
        }
    }

}

/// The chosen light, observable: every view that reads `Theme.accent` redraws when it changes.
@Observable
final class AccentStore {
    static let shared = AccentStore()
    private(set) var light: AccentLight

    private init() {
        light = AccentLight(rawValue: UserDefaults.standard.string(forKey: "accentLight") ?? "") ?? .warm
    }

    func set(_ light: AccentLight) {
        self.light = light
        UserDefaults.standard.set(light.rawValue, forKey: "accentLight")
    }
}

/// FocuzNow "Into focus" tokens (docs/ios-design-spec.md §2). Restraint: black, white, one light.
enum Theme {
    /// The person's light. Use it for one thing per screen: a highlighted number, the focus glow.
    static var accent: Color { AccentStore.shared.light.color }

    static let good = Color(hex: 0x8FE3B8)
    static let warn = Color(hex: 0xFFC97A)
    static let danger = Color(hex: 0xFF7A85)

    // Older names, kept so every screen speaks the same restrained palette.
    static var indigo: Color { accent }
    static var violet: Color { accent }
    static var coral: Color { accent }
    static var gold: Color { accent }
    /// A soft wash of the accent (never a rainbow).
    static var beamGradient: LinearGradient { LinearGradient(colors: [accent, accent.mix(with: .white, by: 0.45)], startPoint: .leading, endPoint: .trailing) }
    static var goldGradient: LinearGradient { beamGradient }

    /// The focus glow gets brighter (not more colourful) as the score rises.
    static func scoreColor(_ score: Double) -> Color { accent.opacity(0.35 + 0.065 * min(10, max(0, score))) }

    static func scoreWord(_ score: Double) -> String {
        switch score {
        case ..<3: "Scattered"
        case ..<5: "Coming into focus"
        case ..<7: "Focused"
        case ..<9: "Sharp"
        default: "Crystal clear"
        }
    }

    /// Muted tile tint for a name (vault items, avatars): low saturation so content stays calm.
    static func tileColor(for name: String) -> Color {
        let hash = name.lowercased().unicodeScalars.reduce(5381) { ($0 << 5) &+ $0 &+ Int($1.value) }
        return Color(hue: Double(hash.magnitude % 360) / 360, saturation: 0.22, brightness: 0.86)
    }
}

extension Color {
    static let fzInk = Color(light: 0x0B0B0F, dark: 0xF5F5F7)
    static let fzInk2 = Color(light: 0x0B0B0F, dark: 0xF5F5F7, lightOpacity: 0.64, darkOpacity: 0.70)
    static let fzInk3 = Color(light: 0x0B0B0F, dark: 0xF5F5F7, lightOpacity: 0.40, darkOpacity: 0.42)
    static let fzLine = Color(light: 0x0B0B0F, dark: 0xFFFFFF, lightOpacity: 0.08, darkOpacity: 0.09)
    static let fzSurface = Color(light: 0xFFFFFF, dark: 0xFFFFFF, lightOpacity: 0.80, darkOpacity: 0.06)
    static let fzBg = Color(light: 0xF6F5F2, dark: 0x000000)

    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }

    init(light: UInt32, dark: UInt32, lightOpacity: Double = 1, darkOpacity: Double = 1) {
        self = Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark, alpha: darkOpacity) : UIColor(hex: light, alpha: lightOpacity)
        })
    }
}

extension UIColor {
    convenience init(hex: UInt32, alpha: Double = 1) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}

extension Font {
    static func fzHero(_ size: CGFloat) -> Font { .system(size: size, weight: .semibold, design: .rounded) }
    static func fzNumber(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font { .system(size: size, weight: weight, design: .rounded) }
}

extension View {
    /// Liquid Glass on iOS 26, a frosted material on iOS 18. Only for things that float.
    @ViewBuilder
    func fzGlass<S: Shape>(in shape: S, interactive: Bool = false) -> some View {
        if #available(iOS 26, *) {
            glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
        } else {
            background(.ultraThinMaterial, in: shape)
        }
    }

    @ViewBuilder
    func fzMinimizeTabBarOnScroll() -> some View {
        if #available(iOS 26, *) {
            tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }

    func fzSurface(cornerRadius: CGFloat = 20) -> some View {
        background(Color.fzSurface, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).strokeBorder(Color.fzLine))
    }
}
