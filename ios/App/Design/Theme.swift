import SwiftUI
import UIKit

/// The lamp's colour (Customize). It tints the lighthouse beam and the one highlight per screen.
/// The rest of the app is FocuzNow's own black, bone and white, like focuznow.com.
enum AccentLight: String, CaseIterable, Identifiable {
    case bone, warm, white, ice

    var id: String { rawValue }
    var title: String {
        switch self {
        case .bone: "Bone"
        case .warm: "Warm"
        case .white: "White"
        case .ice: "Ice"
        }
    }
    var color: Color { Color(uiColor: uiColor) }
    var uiColor: UIColor {
        switch self {
        case .bone: UIColor(hex: 0xECE8DF)
        case .warm: UIColor(hex: 0xFFD9A3)
        case .white: UIColor(hex: 0xFFFFFF)
        case .ice: UIColor(hex: 0xCFE3FF)
        }
    }
    /// The lamp colour as linear-ish RGB for the lighthouse renderer.
    var rgb: SIMD3<Float> {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        return SIMD3(Float(r), Float(g), Float(b))
    }
}

/// The chosen lamp, observable: every view that reads `Theme.accent` redraws when it changes.
@Observable
final class AccentStore {
    static let shared = AccentStore()
    private(set) var light: AccentLight

    private init() {
        light = AccentLight(rawValue: UserDefaults.standard.string(forKey: "accentLight") ?? "") ?? .bone
    }

    func set(_ light: AccentLight) {
        self.light = light
        UserDefaults.standard.set(light.rawValue, forKey: "accentLight")
    }
}

/// FocuzNow "Lighthouse" tokens (docs/ios-design-spec.md). Black, bone, white; Satoshi headlines.
enum Theme {
    /// The lamp on dark, ink on light: always readable as a highlight.
    static var accent: Color {
        let lamp = AccentStore.shared.light.uiColor
        return Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? lamp : UIColor(hex: 0x0E0E0F) })
    }

    static let good = Color(light: 0x2F7D57, dark: 0x9BDDB8)
    static let warn = Color(light: 0x9A6A12, dark: 0xF2CC86)
    static let danger = Color(light: 0xB3261E, dark: 0xFF8A80)

    // Older names: every screen speaks the same restrained palette.
    static var indigo: Color { accent }
    static var violet: Color { accent }
    static var coral: Color { accent }
    static var gold: Color { accent }
    static var beamGradient: LinearGradient { LinearGradient(colors: [accent, accent.opacity(0.7)], startPoint: .leading, endPoint: .trailing) }
    static var goldGradient: LinearGradient { beamGradient }

    /// The highlight gets brighter (not more colourful) as the score rises.
    static func scoreColor(_ score: Double) -> Color { accent.opacity(0.35 + 0.065 * min(10, max(0, score))) }

    static func scoreWord(_ score: Double) -> String {
        switch score {
        case ..<3: "Scattered"
        case ..<5: "Warming up"
        case ..<7: "Focused"
        case ..<9: "Sharp"
        default: "Lit up"
        }
    }

    /// Lighthouse brightness for a focus score: a dim lamp at 0, full beam at 10.
    static func lampPower(_ score: Double) -> Double { 0.25 + 0.085 * min(10, max(0, score)) }

    /// Calm, almost grey tile tint for a name (vault items, avatars).
    static func tileColor(for name: String) -> Color {
        let hash = name.lowercased().unicodeScalars.reduce(5381) { ($0 << 5) &+ $0 &+ Int($1.value) }
        return Color(hue: Double(hash.magnitude % 360) / 360, saturation: 0.12, brightness: 0.82)
    }
}

extension Color {
    // Screen and text
    static let fzBg = Color(light: 0xF3F0E9, dark: 0x0A0A0B)
    static let fzInk = Color(light: 0x0E0E0F, dark: 0xF5F3EE)
    static let fzInk2 = Color(light: 0x0E0E0F, dark: 0xF5F3EE, lightOpacity: 0.66, darkOpacity: 0.68)
    static let fzInk3 = Color(light: 0x0E0E0F, dark: 0xF5F3EE, lightOpacity: 0.42, darkOpacity: 0.44)
    static let fzLine = Color(light: 0x0E0E0F, dark: 0xFFFFFF, lightOpacity: 0.09, darkOpacity: 0.09)
    /// A raised surface: white on bone, graphite on black.
    static let fzSurface = Color(light: 0xFFFFFF, dark: 0x161617)

    // Bone, the website's feature-card colour (same in both modes).
    static let fzBone = Color(hex: 0xECE8DF)
    static let fzBoneTile = Color(hex: 0xE1DDD3)
    static let fzOnBone = Color(hex: 0x111111)
    static let fzOnBone2 = Color(hex: 0x111111, opacity: 0.58)

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

/// Satoshi (the website's headline face) when its files are in `App/Fonts`, otherwise a heavy
/// system face with the same tight tracking.
enum FZFont {
    static let hasSatoshi = UIFont(name: "Satoshi-Black", size: 12) != nil

    static func name(_ weight: Font.Weight) -> String {
        switch weight {
        case .black, .heavy: "Satoshi-Black"
        case .bold, .semibold: "Satoshi-Bold"
        default: "Satoshi-Medium"
        }
    }
}

extension Font {
    /// Headlines: "Everything else can wait."
    static func fzDisplay(_ size: CGFloat, weight: Font.Weight = .black) -> Font {
        FZFont.hasSatoshi ? .custom(FZFont.name(weight), size: size) : .system(size: size, weight: weight == .black ? .heavy : weight)
    }
    static func fzHero(_ size: CGFloat) -> Font { fzDisplay(size, weight: .bold) }
    static func fzNumber(_ size: CGFloat, weight: Font.Weight = .bold) -> Font { fzDisplay(size, weight: weight) }
}

extension View {
    /// Tight display tracking that scales with the size (Satoshi is set at about -3%).
    func fzTight(_ size: CGFloat) -> some View { tracking(-size * 0.03) }

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

    /// The website's bone feature card.
    func fzBoneCard(cornerRadius: CGFloat = 24, padding: CGFloat = 14) -> some View {
        self
            .padding(padding)
            .background(Color.fzBone, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .environment(\.colorScheme, .light)
    }
}
