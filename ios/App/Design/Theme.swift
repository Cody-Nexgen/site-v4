import SwiftUI
import UIKit

/// FocuzNow "Beam" design tokens (docs/ios-design-spec.md §2).
enum Theme {
    static let indigo = Color(hex: 0x5B6CFF)
    static let violet = Color(hex: 0xA35BFF)
    static let coral = Color(hex: 0xFF7A6B)
    static let gold = Color(hex: 0xFFC25B)
    static let good = Color(hex: 0x5BE3A6)
    static let warn = Color(hex: 0xFFC25B)
    static let danger = Color(hex: 0xFF6B7A)

    /// The brand accent. One per screen at most (the primary action, the Beam).
    static let beamGradient = LinearGradient(colors: [indigo, violet, coral], startPoint: .leading, endPoint: .trailing)
    static let goldGradient = LinearGradient(colors: [Color(hex: 0xFFE08A), gold, Color(hex: 0xFF9A5B)], startPoint: .topLeading, endPoint: .bottomTrailing)

    /// Focus Score colour: cool when low, warm when high.
    static func scoreColor(_ score: Double) -> Color {
        switch score {
        case ..<4: Color(hex: 0x5B7BFF)
        case ..<7: Color(hex: 0x8F6BFF)
        case ..<9: Color(hex: 0xC266FF)
        default: Color(hex: 0xFF8A5B)
        }
    }

    static func scoreWord(_ score: Double) -> String {
        switch score {
        case ..<3: "Scattered"
        case ..<5: "Warming up"
        case ..<7: "Good focus"
        case ..<9: "Excellent focus"
        default: "In the zone"
        }
    }

    /// Pastel tile hue for a name (same idea as the extension's letter tiles).
    static func tileColor(for name: String) -> Color {
        let hash = name.lowercased().unicodeScalars.reduce(5381) { ($0 << 5) &+ $0 &+ Int($1.value) }
        return Color(hue: Double(hash.magnitude % 360) / 360, saturation: 0.42, brightness: 0.92)
    }
}

extension Color {
    // Text and lines that flip between light and dark.
    static let fzInk = Color(light: 0x0E1020, dark: 0xF7F7FB)
    static let fzInk2 = Color(light: 0x0E1020, dark: 0xF7F7FB, lightOpacity: 0.66, darkOpacity: 0.74)
    static let fzInk3 = Color(light: 0x0E1020, dark: 0xF7F7FB, lightOpacity: 0.44, darkOpacity: 0.48)
    static let fzLine = Color(light: 0x0E1020, dark: 0xFFFFFF, lightOpacity: 0.08, darkOpacity: 0.10)
    static let fzSurface = Color(light: 0xFFFFFF, dark: 0xFFFFFF, lightOpacity: 0.72, darkOpacity: 0.07)
    static let fzBg = Color(light: 0xF4F5FA, dark: 0x07080D)

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
    /// Hero numbers: SF Pro Rounded, heavy.
    static func fzHero(_ size: CGFloat) -> Font { .system(size: size, weight: .heavy, design: .rounded) }
    static func fzNumber(_ size: CGFloat, weight: Font.Weight = .bold) -> Font { .system(size: size, weight: weight, design: .rounded) }
}

// Liquid Glass on iOS 26, a frosted material on iOS 18. Glass is only for things that float.
extension View {
    @ViewBuilder
    func fzGlass<S: Shape>(in shape: S, interactive: Bool = false) -> some View {
        if #available(iOS 26, *) {
            glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
        } else {
            background(.ultraThinMaterial, in: shape)
        }
    }

    /// iOS 26: the tab bar shrinks while scrolling down. Nothing on 18.
    @ViewBuilder
    func fzMinimizeTabBarOnScroll() -> some View {
        if #available(iOS 26, *) {
            tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }

    /// A solid card on a sky (content, not glass).
    func fzSurface(cornerRadius: CGFloat = 20) -> some View {
        background(Color.fzSurface, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).strokeBorder(Color.fzLine))
    }
}
