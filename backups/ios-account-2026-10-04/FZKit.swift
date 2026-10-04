import SwiftUI

// The pieces every screen shares: the glow under buttons, the glass popups, glass cards.

extension Color {
    /// The light under every button (and behind popups). One place to change it.
    static let fzGlow = Color.fzMint
}

// MARK: The glow under buttons

/// Light pooling under a button and catching its bottom edge, like it's sitting on something lit.
struct BottomGlow: ViewModifier {
    var color: Color = .fzGlow
    var strength: Double = 1

    func body(content: Content) -> some View {
        content
            .background(alignment: .bottom) {
                Ellipse()
                    .fill(color.opacity(0.5 * strength))
                    .frame(height: 26)
                    .padding(.horizontal, 26)
                    .offset(y: 14)
                    .blur(radius: 16)
                    .allowsHitTesting(false)
            }
            .overlay(alignment: .bottom) {
                Capsule()
                    .fill(LinearGradient(colors: [color.opacity(0), color.opacity(0.9 * strength), color.opacity(0)],
                                         startPoint: .leading, endPoint: .trailing))
                    .frame(height: 1.5)
                    .padding(.horizontal, 18)
                    .blur(radius: 0.6)
                    .allowsHitTesting(false)
            }
    }
}

extension View {
    func fzBottomGlow(_ color: Color = .fzGlow, strength: Double = 1) -> some View {
        modifier(BottomGlow(color: color, strength: strength))
    }
}

/// The main action: a bone capsule with black text, glowing underneath.
struct FZPrimaryButtonStyle: ButtonStyle {
    var height: CGFloat = 56
    var glow: Color = .fzGlow
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Capsule().fill(Color(hex: 0xEEF3EC)))
            .fzBottomGlow(glow, strength: enabled ? (configuration.isPressed ? 1.4 : 1) : 0)
            .opacity(enabled ? 1 : 0.4)
            .contentShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// A second action: dark glass with white (or red) text, a softer glow.
struct FZGlassButtonStyle: ButtonStyle {
    var height: CGFloat = 54
    var destructive = false

    func makeBody(configuration: Configuration) -> some View {
        let tint = destructive ? Theme.danger : Color.white
        configuration.label
            .font(.headline)
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(Capsule().fill(.white.opacity(configuration.isPressed ? 0.1 : 0.05)))
            .overlay(Capsule().strokeBorder(.white.opacity(0.13)))
            .fzGlass(in: Capsule(), interactive: true)
            .fzBottomGlow(destructive ? Theme.danger : .fzGlow, strength: 0.55)
            .contentShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == FZPrimaryButtonStyle {
    static var fzPrimary: FZPrimaryButtonStyle { FZPrimaryButtonStyle() }
}

extension ButtonStyle where Self == FZGlassButtonStyle {
    static var fzGlass: FZGlassButtonStyle { FZGlassButtonStyle() }
    static var fzDestructive: FZGlassButtonStyle { FZGlassButtonStyle(destructive: true) }
}

// MARK: Glass cards

extension View {
    /// Dark glass over the scene, like the Today card.
    func fzGlassCard(cornerRadius: CGFloat = 24, padding: CGFloat = 16) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        return self
            .padding(padding)
            .background(shape.fill(Color(hex: 0x111214).opacity(0.72)))
            .fzGlass(in: shape)
            .overlay(shape.strokeBorder(.white.opacity(0.09)))
    }
}

// MARK: Popups

/// A popup: Liquid Glass over a glow, an icon, a title, a line or two, and a button (or two).
/// Show one with `PopupCenter.show`; `RootView` (and full-screen covers) host them.
struct FZPopup: Identifiable {
    let id = UUID()
    var symbol: String
    var tint: Color = .fzGlow
    var title: String
    var message: String
    var primary: String
    var destructive = false
    var secondary: String? = "Not now"
    var onPrimary: () -> Void = {}
    var onSecondary: () -> Void = {}
    /// Anything extra under the message (the emergency pass, a PIN pad...).
    var extra: AnyView?
}

@MainActor
@Observable
final class PopupCenter {
    var current: FZPopup?

    func show(_ popup: FZPopup) {
        withAnimation(.spring(duration: 0.45, bounce: 0.22)) { current = popup }
    }

    func dismiss() {
        withAnimation(.easeInOut(duration: 0.25)) { current = nil }
    }
}

private struct PopupHost: ViewModifier {
    @Environment(PopupCenter.self) private var center

    func body(content: Content) -> some View {
        content.overlay {
            if let popup = center.current {
                PopupView(popup: popup)
                    .id(popup.id)
                    .transition(.asymmetric(insertion: .opacity, removal: .opacity))
                    .zIndex(10)
            }
        }
    }
}

extension View {
    /// Shows `PopupCenter`'s popups over this view.
    func fzPopupHost() -> some View { modifier(PopupHost()) }
}

private struct PopupView: View {
    let popup: FZPopup
    @Environment(PopupCenter.self) private var center
    @State private var shown = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture { if popup.secondary != nil { finish(popup.onSecondary) } }

            ZStack {
                // The glow behind the glass.
                Circle()
                    .fill(RadialGradient(colors: [popup.tint.opacity(0.55), popup.tint.opacity(0)], center: .center, startRadius: 0, endRadius: 170))
                    .frame(width: 340, height: 340)
                    .offset(y: -60)
                    .blur(radius: 30)
                    .phaseAnimator([0.85, 1.0]) { glow, phase in glow.opacity(phase) } animation: { _ in .easeInOut(duration: 2.2) }

                card
            }
            .scaleEffect(shown ? 1 : 0.9)
            .blur(radius: shown ? 0 : 10)
            .opacity(shown ? 1 : 0)
            .padding(.horizontal, 24)
        }
        .environment(\.colorScheme, .dark)
        .onAppear { withAnimation(.spring(duration: 0.45, bounce: 0.22)) { shown = true } }
        .sensoryFeedback(.impact(weight: .light), trigger: shown)
    }

    private var card: some View {
        let shape = RoundedRectangle(cornerRadius: 32, style: .continuous)
        return VStack(spacing: 14) {
            Image(systemName: popup.symbol)
                .font(.system(size: 26, weight: .semibold))
                .foregroundStyle(.black)
                .frame(width: 64, height: 64)
                .background(Circle().fill(LinearGradient(colors: [popup.tint, popup.tint.opacity(0.7)], startPoint: .top, endPoint: .bottom)))
                .shadow(color: popup.tint.opacity(0.6), radius: 16)
                .padding(.top, 4)
            Text(popup.title)
                .font(.fzDisplay(23, weight: .bold))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
            Text(popup.message)
                .font(.body)
                .foregroundStyle(.white.opacity(0.72))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let extra = popup.extra {
                extra
            }
            VStack(spacing: 6) {
                if popup.destructive {
                    Button(popup.primary) { finish(popup.onPrimary) }
                        .buttonStyle(.fzDestructive)
                } else {
                    Button(popup.primary) { finish(popup.onPrimary) }
                        .buttonStyle(FZPrimaryButtonStyle(glow: popup.tint))
                }
                if let secondary = popup.secondary {
                    Button(secondary) { finish(popup.onSecondary) }
                        .font(.headline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.6))
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .contentShape(Rectangle())
                }
            }
            .padding(.top, 6)
        }
        .padding(22)
        .frame(maxWidth: 420)
        .background(shape.fill(.white.opacity(0.06)))
        .fzGlass(in: shape)
        .overlay(shape.strokeBorder(.white.opacity(0.15)))
    }

    private func finish(_ action: @escaping () -> Void) {
        center.dismiss()
        action()
    }
}
