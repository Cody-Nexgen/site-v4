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
/// Show one with `PopupCenter.show`; `RootView` (and the session screen) host them.
struct FZPopup: Identifiable {
    let id = UUID()
    var symbol: String
    var tint: Color = .fzGlow
    var title: String
    var message: String
    /// The main button. None for a popup whose `extra` does the job (the PIN pad).
    var primary: String?
    var destructive = false
    var secondary: String? = "Not now"
    var onPrimary: () -> Void = {}
    var onSecondary: () -> Void = {}
    /// Anything extra under the message (the PIN pad, a text field...).
    var extra: AnyView?
}

@MainActor
@Observable
final class PopupCenter {
    var current: FZPopup?
    /// Which host shows popups: 0 is `RootView`, 1 a full-screen cover over it (the session).
    var layer = 0

    func show(_ popup: FZPopup) {
        withAnimation(.spring(duration: 0.45, bounce: 0.22)) { current = popup }
    }

    func dismiss() {
        withAnimation(.easeInOut(duration: 0.25)) { current = nil }
    }

    /// Runs `action` now, or once the PIN is in if there is one.
    func withPin(_ why: String, _ action: @escaping () -> Void) {
        guard PinLock.isSet else { action(); return }
        show(FZPopup(symbol: "lock.fill", title: "PIN, please", message: why, secondary: "Cancel",
                     extra: AnyView(PinPad(mode: .check, done: action))))
    }
}

private struct PopupHost: ViewModifier {
    let layer: Int
    @Environment(PopupCenter.self) private var center

    func body(content: Content) -> some View {
        content.overlay {
            if center.layer == layer, let popup = center.current {
                PopupView(popup: popup)
                    .id(popup.id)
                    .transition(.opacity)
                    .zIndex(10)
            }
        }
    }
}

extension View {
    /// Shows `PopupCenter`'s popups over this view. A full-screen cover hosts its own at layer 1
    /// (and sets `PopupCenter.layer` while it's up).
    func fzPopupHost(layer: Int = 0) -> some View { modifier(PopupHost(layer: layer)) }
}

private struct PopupView: View {
    let popup: FZPopup
    @Environment(PopupCenter.self) private var center
    @State private var shown = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                // Tapping outside closes a popup that has a way out, without pressing either button.
                .onTapGesture { if popup.secondary != nil { center.dismiss() } }

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
                if let primary = popup.primary {
                    if popup.destructive {
                        Button(primary) { finish(popup.onPrimary) }
                            .buttonStyle(.fzDestructive)
                    } else {
                        Button(primary) { finish(popup.onPrimary) }
                            .buttonStyle(FZPrimaryButtonStyle(glow: popup.tint))
                    }
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
            .padding(.top, popup.primary == nil ? 0 : 6)
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

/// A text field inside a popup (a new to-do...). Focused as soon as the popup opens.
struct PopupField: View {
    let placeholder: String
    @Binding var text: String
    var submit: () -> Void = {}
    @FocusState private var focused: Bool

    var body: some View {
        TextField(placeholder, text: $text)
            .font(.body)
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .frame(height: 50)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.07)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(.white.opacity(focused ? 0.3 : 0.12)))
            .focused($focused)
            .submitLabel(.done)
            .onSubmit(submit)
            .onAppear { focused = true }
    }
}

// MARK: The PIN pad

/// Four dots and a keypad, for inside a popup. `.check` runs `done` once the right PIN is in;
/// `.create` asks twice and saves it. Five wrong tries in a row and it rests for 30 seconds.
struct PinPad: View {
    enum Mode { case check, create }

    let mode: Mode
    let done: () -> Void
    @Environment(PopupCenter.self) private var center
    @State private var digits = ""
    @State private var first: String?
    @State private var note = ""
    @State private var wrong = 0
    @State private var misses = 0
    @State private var restingUntil: Date?
    @State private var shake: CGFloat = 0

    var body: some View {
        VStack(spacing: 18) {
            VStack(spacing: 10) {
                HStack(spacing: 16) {
                    ForEach(0..<PinLock.length, id: \.self) { index in
                        Circle()
                            .fill(index < digits.count ? Color.white : Color.white.opacity(0.14))
                            .frame(width: 14, height: 14)
                            .shadow(color: index < digits.count ? Color.fzGlow.opacity(0.7) : .clear, radius: 6)
                            .scaleEffect(index == digits.count - 1 ? 1.15 : 1)
                            .animation(.spring(duration: 0.25, bounce: 0.5), value: digits.count)
                    }
                }
                .modifier(Shake(amount: shake))
                Text(note.isEmpty ? (mode == .create ? (first == nil ? "Pick four digits" : "Once more, to be sure") : " ") : note)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(note.isEmpty ? .white.opacity(0.5) : Color(hex: 0xFF9C8F))
                    .contentTransition(.opacity)
                    .animation(.easeInOut(duration: 0.2), value: note)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.fixed(70), spacing: 18), count: 3), spacing: 12) {
                ForEach(1...9, id: \.self) { key("\($0)") }
                if mode == .check {
                    Button("Forgot?") { forgot() }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.55))
                        .frame(width: 70, height: 62)
                } else {
                    Color.clear.frame(width: 70, height: 62)
                }
                key("0")
                Button { if !digits.isEmpty { digits.removeLast() } } label: {
                    Image(systemName: "delete.left")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundStyle(.white.opacity(0.75))
                        .frame(width: 70, height: 62)
                }
                .accessibilityLabel("Delete")
            }
            .disabled(resting)
            .opacity(resting ? 0.4 : 1)
        }
        .sensoryFeedback(.error, trigger: wrong)
        .sensoryFeedback(.selection, trigger: digits)
    }

    private var resting: Bool { restingUntil != nil }

    private func key(_ digit: String) -> some View {
        Button { press(digit) } label: {
            Text(digit)
                .font(.fzDisplay(26, weight: .medium))
                .foregroundStyle(.white)
                .frame(width: 62, height: 62)
                .background(Circle().fill(.white.opacity(0.07)))
                .overlay(Circle().strokeBorder(.white.opacity(0.12)))
        }
        .buttonStyle(.pressable)
    }

    private func press(_ digit: String) {
        guard digits.count < PinLock.length else { return }
        note = ""
        digits += digit
        guard digits.count == PinLock.length else { return }
        let entered = digits
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(160))
            finishEntry(entered)
        }
    }

    private func finishEntry(_ entered: String) {
        switch mode {
        case .check:
            if PinLock.check(entered) {
                center.dismiss()
                done()
            } else {
                misses += 1
                if misses >= 5 {
                    misses = 0
                    restingUntil = .now.addingTimeInterval(30)
                    reject("Five misses. Take 30 seconds.")
                    Task { @MainActor in
                        try? await Task.sleep(for: .seconds(30))
                        restingUntil = nil
                        note = ""
                    }
                } else {
                    reject("Not quite. Try again.")
                }
            }
        case .create:
            if let first {
                if first == entered {
                    PinLock.set(entered)
                    center.dismiss()
                    done()
                } else {
                    self.first = nil
                    reject("Those didn't match. Start over.")
                }
            } else {
                first = entered
                digits = ""
            }
        }
    }

    private func reject(_ line: String) {
        wrong += 1
        note = line
        withAnimation(.linear(duration: 0.4)) { shake += 1 }
        digits = ""
    }

    private func forgot() {
        PinLock.startReset()
        let at = PinLock.resetAt ?? .now.addingTimeInterval(PinLock.resetWait)
        center.show(FZPopup(
            symbol: "hourglass", tint: Color(hex: 0xF2CC86), title: "It'll switch off tomorrow",
            message: "Your PIN turns itself off at \(at.formatted(date: .abbreviated, time: .shortened)). That wait is on purpose: long enough for the urge to pass. Remember it before then and nothing changes.",
            primary: "Okay"
        , secondary: nil))
    }
}

/// A side-to-side wobble, for a wrong PIN.
private struct Shake: GeometryEffect {
    var amount: CGFloat
    var animatableData: CGFloat {
        get { amount }
        set { amount = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 9 * sin(amount * .pi * 6), y: 0))
    }
}
