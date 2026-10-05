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

    /// The glow as press feedback: a hint of light at rest that blooms while the button is held down.
    /// It builds over a quarter of a second and fades slower than it came, like a light warming up.
    func fzPressGlow(_ pressed: Bool, color: Color = .fzGlow, rest: Double = 0.18) -> some View {
        fzBottomGlow(color, strength: pressed ? 1.35 : rest)
            .animation(pressed ? .easeOut(duration: 0.25) : .easeOut(duration: 0.55), value: pressed)
    }

    /// A card's edge catching the light from above: brighter along the top, nearly gone at the bottom.
    func fzEdgeLight(cornerRadius: CGFloat) -> some View {
        overlay(
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .strokeBorder(LinearGradient(colors: [.white.opacity(0.2), .white.opacity(0.06), .white.opacity(0.09)],
                                             startPoint: .top, endPoint: .bottom), lineWidth: 1)
        )
    }
}

/// The main action: a bone capsule with black text; it glows underneath when pressed.
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
            .fzPressGlow(configuration.isPressed, color: glow, rest: enabled ? 0.18 : 0)
            .opacity(enabled ? 1 : 0.4)
            .contentShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// A second action: dark glass with white (or red) text; it glows underneath when pressed.
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
            .fzPressGlow(configuration.isPressed, color: destructive ? Theme.danger : .fzGlow, rest: 0.1)
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
            .fzEdgeLight(cornerRadius: cornerRadius)
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

/// A sheet of Liquid Glass floating at the bottom, in reach of your thumb, with its colour glowing up
/// from behind it. Drag it down (or tap outside) to close it, if it has a way out.
private struct PopupView: View {
    let popup: FZPopup
    @Environment(PopupCenter.self) private var center
    @State private var shown = false
    @State private var drag: CGFloat = 0

    private var closable: Bool { popup.secondary != nil }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(shown ? 0.55 : 0)
                .ignoresSafeArea()
                // Tapping outside closes a popup that has a way out, without pressing either button.
                .onTapGesture { if closable { center.dismiss() } }

            card
                .padding(.horizontal, 10)
                .padding(.bottom, 6)
                .offset(y: shown ? drag : 560)
                .gesture(
                    DragGesture(minimumDistance: 10)
                        .onChanged { value in
                            guard closable else { return }
                            let y = value.translation.height
                            drag = y > 0 ? y : y / 8
                        }
                        .onEnded { value in
                            guard closable else { return }
                            if value.translation.height > 90 || value.predictedEndTranslation.height > 260 {
                                center.dismiss()
                            } else {
                                withAnimation(.spring(duration: 0.35)) { drag = 0 }
                            }
                        }
                )
        }
        .environment(\.colorScheme, .dark)
        .onAppear { withAnimation(.spring(duration: 0.5, bounce: 0.16)) { shown = true } }
        .sensoryFeedback(.impact(weight: .light), trigger: shown)
    }

    private var card: some View {
        let shape = RoundedRectangle(cornerRadius: 38, style: .continuous)
        return VStack(spacing: 0) {
            if closable {
                Capsule()
                    .fill(.white.opacity(0.22))
                    .frame(width: 36, height: 5)
                    .padding(.top, 8)
            }
            VStack(spacing: 12) {
                Image(systemName: popup.symbol)
                    .font(.system(size: 25, weight: .semibold))
                    .foregroundStyle(popup.tint)
                    .frame(width: 64, height: 64)
                    .background(Circle().fill(popup.tint.opacity(0.14)))
                    .overlay(Circle().strokeBorder(popup.tint.opacity(0.45), lineWidth: 1.2))
                    .shadow(color: popup.tint.opacity(0.45), radius: 18)
                    .padding(.bottom, 2)
                Text(popup.title)
                    .font(.fzDisplay(23, weight: .bold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text(popup.message)
                    .font(.body)
                    .foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                if let extra = popup.extra {
                    extra
                }
                VStack(spacing: 4) {
                    if let primary = popup.primary {
                        if popup.destructive {
                            // Things that can't be undone take a deliberate hold, not a tap.
                            FZHoldButton(title: primary) { finish(popup.onPrimary) }
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
                            .frame(height: 46)
                            .contentShape(Rectangle())
                    }
                }
                .padding(.top, popup.primary == nil ? 0 : 8)
            }
            .padding(.horizontal, 22)
            .padding(.top, closable ? 14 : 24)
            .padding(.bottom, 14)
        }
        .frame(maxWidth: 520)
        .background {
            ZStack {
                shape.fill(Color(hex: 0x15171A).opacity(0.5))
                // The popup's colour glowing up through the glass from the top.
                LinearGradient(stops: [.init(color: popup.tint.opacity(0.34), location: 0),
                                       .init(color: popup.tint.opacity(0.08), location: 0.45),
                                       .init(color: .clear, location: 0.8)],
                               startPoint: .top, endPoint: .bottom)
                    .clipShape(shape)
                    .phaseAnimator([0.8, 1.0]) { glow, phase in glow.opacity(phase) } animation: { _ in .easeInOut(duration: 2.4) }
            }
        }
        .fzGlass(in: shape)
        .fzEdgeLight(cornerRadius: 38)
        .background(alignment: .top) {
            // ...and spilling out round it.
            Ellipse()
                .fill(popup.tint.opacity(0.3))
                .frame(height: 180)
                .padding(.horizontal, 30)
                .offset(y: -50)
                .blur(radius: 50)
                .allowsHitTesting(false)
        }
    }

    private func finish(_ action: @escaping () -> Void) {
        center.dismiss()
        action()
    }
}

/// Press and hold to confirm something that can't be undone: light fills the button from the left and
/// glows along its bottom as you hold, with ticks that speed up. Let go early and it drains away.
struct FZHoldButton: View {
    let title: String
    var tint: Color = Theme.danger
    var duration: Double = 1.0
    let action: () -> Void

    @State private var progress: CGFloat = 0
    @State private var pressing = false
    @State private var ticks = 0
    @State private var done = 0
    @State private var tickTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            Capsule().fill(.white.opacity(0.05))
            GeometryReader { proxy in
                Capsule()
                    .fill(LinearGradient(colors: [tint.opacity(0.16), tint.opacity(0.45)], startPoint: .leading, endPoint: .trailing))
                    .frame(width: max(proxy.size.height, proxy.size.width * progress))
                    .opacity(progress > 0.001 ? 1 : 0)
            }
            .clipShape(Capsule())
            Text(pressing ? "Keep holding…" : title)
                .font(.headline)
                .foregroundStyle(tint)
                .contentTransition(.interpolate)
        }
        .frame(height: 54)
        .overlay(Capsule().strokeBorder(.white.opacity(0.13)))
        .fzGlass(in: Capsule())
        .fzBottomGlow(tint, strength: 0.12 + 1.3 * Double(progress))
        .scaleEffect(pressing ? 0.975 : 1)
        .animation(.spring(duration: 0.3), value: pressing)
        .contentShape(Capsule())
        .onLongPressGesture(minimumDuration: duration, maximumDistance: 60) {
            tickTask?.cancel()
            done += 1
            action()
        } onPressingChanged: { isPressing in
            pressing = isPressing
            if isPressing {
                withAnimation(.linear(duration: duration)) { progress = 1 }
                startTicks()
            } else {
                tickTask?.cancel()
                withAnimation(.spring(duration: 0.45)) { progress = 0 }
            }
        }
        .sensoryFeedback(.impact(weight: .light, intensity: 0.6), trigger: ticks)
        .sensoryFeedback(.success, trigger: done)
        .accessibilityLabel(title)
        .accessibilityHint("Press and hold")
        .accessibilityAction { action() }
    }

    /// Haptic ticks that speed up as the light fills it.
    private func startTicks() {
        tickTask?.cancel()
        tickTask = Task { @MainActor in
            let start = Date.now
            while !Task.isCancelled {
                let t = Date.now.timeIntervalSince(start) / duration
                if t >= 1 { break }
                ticks += 1
                try? await Task.sleep(for: .milliseconds(Int(160 - 110 * t)))
            }
        }
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
