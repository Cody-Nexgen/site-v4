import SwiftUI
import UIKit

// FocuzNow's colours (the extension's --fz-* tokens), light and dark. The accent is white/ink like
// the extension; colour comes from content (vaults, tags, tiles), not chrome.
extension Color {
    static let fzBg = Color(light: 0xF7F7F7, dark: 0x111111)
    static let fzPanel = Color(light: 0xFFFFFF, dark: 0x1A1A1A)
    static let fzCard = Color(light: 0xFFFFFF, dark: 0x202020)
    static let fzText1 = Color(light: 0x171717, dark: 0xFAFAFA)
    static let fzText2 = Color(light: 0x404040, dark: 0xC4C4C4)
    static let fzText3 = Color(light: 0x6B6B6B, dark: 0x8F8F8F)
    static let fzBorder = Color(light: 0x000000, dark: 0xFFFFFF, opacity: 0.08)
    static let fzAccent = Color(light: 0x171717, dark: 0xFAFAFA)

    init(light: UInt32, dark: UInt32, opacity: Double = 1) {
        self = Color(uiColor: UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light, alpha: opacity)
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

// Liquid Glass on iOS 26, a frosted material on iOS 18. Glass is for things that float over content
// (bars, the running-timer bar, floating buttons); content itself stays solid.
extension View {
    @ViewBuilder
    func fzGlass<S: Shape>(in shape: S, interactive: Bool = false) -> some View {
        if #available(iOS 26, *) {
            glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
        } else {
            background(.ultraThinMaterial, in: shape)
        }
    }

    /// Glass buttons on iOS 26 (`.glass` / `.glassProminent`), FocuzNow's bordered ones on 18.
    @ViewBuilder
    func fzGlassButton(prominent: Bool = false) -> some View {
        if #available(iOS 26, *) {
            if prominent {
                buttonStyle(.glassProminent)
            } else {
                buttonStyle(.glass)
            }
        } else if prominent {
            buttonStyle(.borderedProminent)
        } else {
            buttonStyle(.bordered)
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
}

/// A solid FocuzNow card (content, not glass).
struct FZCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) { content }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.fzCard, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.fzBorder))
    }
}
