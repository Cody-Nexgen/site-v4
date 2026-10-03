import SwiftUI

// MARK: Rise: things arrive rising and settling. A short, light blur only, so text is always readable.

struct BlurRise: ViewModifier {
    let amount: Double

    func body(content: Content) -> some View {
        content
            .blur(radius: amount * 4)
            .opacity(1 - amount)
            .offset(y: amount * 18)
    }
}

extension AnyTransition {
    static var blurRise: AnyTransition {
        .asymmetric(
            insertion: .modifier(active: BlurRise(amount: 1), identity: BlurRise(amount: 0)),
            removal: .opacity.combined(with: .offset(y: -10))
        )
    }
}

/// Plays a rise when the view first appears, after `delay`.
struct RiseIn: ViewModifier {
    let delay: Double
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .modifier(BlurRise(amount: shown || reduceMotion ? 0 : 1))
            .onAppear {
                withAnimation(.spring(duration: 0.6, bounce: 0.15).delay(delay)) { shown = true }
            }
    }
}

extension View {
    func riseIn(delay: Double = 0) -> some View { modifier(RiseIn(delay: delay)) }

    /// Rises in as it scrolls into view and settles back as it leaves (About, lists).
    func scrollRise() -> some View {
        scrollTransition(.animated(.spring(duration: 0.5, bounce: 0.1))) { content, phase in
            content
                .opacity(phase.isIdentity ? 1 : 0.2)
                .scaleEffect(phase.isIdentity ? 1 : 0.94)
                .offset(y: phase.value * 24)
        }
    }
}

// MARK: Hold to commit

/// A button you press and hold. The fill sweeps across, haptics tick, and it fires when full.
/// Letting go early drains it. Used for things worth meaning: starting, committing, breaks.
struct HoldButton: View {
    let title: String
    var holdingTitle: String? = nil
    var symbol: String? = nil
    var duration: Double = 1.1
    var onPressingChanged: ((Bool) -> Void)? = nil
    let action: () -> Void

    @Environment(\.colorScheme) private var scheme
    @State private var progress: CGFloat = 0
    @State private var pressing = false
    @State private var fired = 0
    @State private var ticks = 0
    @State private var tickTask: Task<Void, Never>?

    var body: some View {
        let fill = scheme == .dark ? Color.white : Color.fzInk
        let ink = scheme == .dark ? Color.black : Color.white
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(fill)
            GeometryReader { proxy in
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(scheme == .dark ? Color.fzBoneTile : Color(hex: 0x3A3A3C))
                    .frame(width: proxy.size.width * progress)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            HStack(spacing: 8) {
                if let symbol { Image(systemName: symbol) }
                Text(pressing ? (holdingTitle ?? "Keep holding…") : title)
                    .contentTransition(.interpolate)
            }
            .font(.headline)
            .foregroundStyle(ink)
        }
        .frame(height: 58)
        .scaleEffect(pressing ? 0.975 : 1)
        .animation(.spring(duration: 0.3), value: pressing)
        .contentShape(Rectangle())
        .onLongPressGesture(minimumDuration: duration, maximumDistance: 60) {
            fired += 1
            tickTask?.cancel()
            action()
        } onPressingChanged: { isPressing in
            pressing = isPressing
            onPressingChanged?(isPressing)
            if isPressing {
                withAnimation(.linear(duration: duration)) { progress = 1 }
                startTicks()
            } else {
                tickTask?.cancel()
                withAnimation(.spring(duration: 0.45)) { progress = 0 }
            }
        }
        .sensoryFeedback(.impact(weight: .light, intensity: 0.6), trigger: ticks)
        .sensoryFeedback(.success, trigger: fired)
        .accessibilityLabel(title)
        .accessibilityHint("Press and hold")
        .accessibilityAction { action() }
    }

    /// Haptic ticks that speed up as the fill grows.
    private func startTicks() {
        tickTask?.cancel()
        tickTask = Task { @MainActor in
            let start = Date.now
            while !Task.isCancelled {
                let t = Date.now.timeIntervalSince(start) / duration
                if t >= 1 { break }
                ticks += 1
                try? await Task.sleep(for: .milliseconds(Int(170 - 120 * t)))
            }
        }
    }
}

// MARK: 3D tilt

/// Drag to tilt in 3D, with a sheen that follows the light. Springs back when let go.
struct Tilt3D: ViewModifier {
    var maxAngle: Double = 16
    @State private var drag: CGSize = .zero

    func body(content: Content) -> some View {
        GeometryReader { proxy in
            let nx = max(-1, min(1, drag.width / max(1, proxy.size.width / 2)))
            let ny = max(-1, min(1, drag.height / max(1, proxy.size.height / 2)))
            content
                .overlay {
                    LinearGradient(
                        colors: [.white.opacity(0), .white.opacity(0.35), .white.opacity(0)],
                        startPoint: UnitPoint(x: 0.0 + nx * 0.6, y: 0.0 + ny * 0.6),
                        endPoint: UnitPoint(x: 1.0 + nx * 0.6, y: 1.0 + ny * 0.6)
                    )
                    .blendMode(.overlay)
                    .allowsHitTesting(false)
                }
                .rotation3DEffect(.degrees(Double(-ny) * maxAngle), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
                .rotation3DEffect(.degrees(Double(nx) * maxAngle), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
                .frame(width: proxy.size.width, height: proxy.size.height)
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            withAnimation(.interactiveSpring(duration: 0.2)) { drag = value.translation }
                        }
                        .onEnded { _ in
                            withAnimation(.spring(duration: 0.7, bounce: 0.45)) { drag = .zero }
                        }
                )
        }
    }
}

extension View {
    func tilt3D(maxAngle: Double = 16) -> some View { modifier(Tilt3D(maxAngle: maxAngle)) }
}

// MARK: Write-on (signatures)

/// Reveals its content left to right like a pen writing it.
struct WriteOn: ViewModifier {
    var delay: Double = 0
    var duration: Double = 1.4
    @State private var progress: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .mask(alignment: .leading) {
                GeometryReader { proxy in
                    LinearGradient(stops: [.init(color: .black, location: 0.85), .init(color: .clear, location: 1)], startPoint: .leading, endPoint: .trailing)
                        .frame(width: proxy.size.width * 1.15 * progress)
                }
            }
            .onAppear {
                progress = 0
                withAnimation(.easeInOut(duration: duration).delay(delay)) { progress = 1 }
            }
    }
}

extension View {
    func writeOn(delay: Double = 0, duration: Double = 1.4) -> some View { modifier(WriteOn(delay: delay, duration: duration)) }
}

/// A handwriting face that ships with iOS.
extension Font {
    static func fzSignature(_ size: CGFloat) -> Font { .custom("SnellRoundhand-Bold", size: size) }
}
