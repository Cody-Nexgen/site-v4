import SwiftUI

/// The focus timer as a thing you could hold: a chunky machined block, its bottom side showing, with a
/// recessed smoked-glass display and glowing segment digits (like an old vacuum-fluorescent clock) in
/// the orb's colours. The unlit segments show faintly, a fine mesh sits over the digits, the glass
/// catches a reflection, and tilting the phone moves the light. Drawn on the GPU (`FocusTimer.metal`,
/// `fzDevice` in OrbShared.h). Running, its colon blinks.
struct TimerDevice: View {
    var minutes: Int
    var seconds: Int = 0
    /// A session is counting down: the colon blinks.
    var running = false
    @Environment(\.displayScale) private var scale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var tilt = StageTilt()
    @State private var visible = false
    @State private var changedAt = Date.distantPast

    var body: some View {
        // 30 frames a second is plenty for a blinking colon and the tilt.
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !visible || reduceMotion)) { context in
            let now = context.date
            let t = now.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1200)
            let colon = running && t.truncatingRemainder(dividingBy: 1) >= 0.5 ? 0.2 : 1.0
            let flash = max(0, 1 - now.timeIntervalSince(changedAt) / 0.25)
            GeometryReader { proxy in
                Rectangle()
                    .fill(.black)
                    .colorEffect(ShaderLibrary.focusTimer(
                        .float2(proxy.size.width, proxy.size.height),
                        .float4(Double(minutes), Double(seconds), colon, flash),
                        .float(t),
                        .float2(tilt.offset.width / 10, -tilt.offset.height / 8),
                        .float(1 / max(scale, 1))
                    ))
            }
        }
        .onChange(of: minutes) { changedAt = .now }
        .onAppear {
            visible = true
            if !reduceMotion { tilt.start() }
        }
        .onDisappear {
            visible = false
            tilt.stop()
        }
        .accessibilityElement()
        .accessibilityLabel(running ? "Time left" : "Session length")
        .accessibilityValue(seconds > 0 || running ? "\(minutes) minutes \(seconds) seconds" : GoalDial.format(minutes))
    }
}

/// The session length as a ruler you slide sideways, cut into the metal: a mark every minute, a longer
/// one every 5, a label every 15, and a light standing in the middle at the length you've picked.
/// Snaps to 5 minutes, with a tick you feel at each.
struct TimeRuler: View {
    @Binding var minutes: Int
    var range: ClosedRange<Int> = 15...180
    /// Where the ruler is while your finger is on it (minutes, not snapped).
    @State private var dragging: Double?
    @State private var dragFrom = 0

    private static let perMinute: CGFloat = 5

    var body: some View {
        let shown = dragging ?? Double(minutes)
        GeometryReader { proxy in
            ZStack {
                Canvas { g, size in
                    let mid = size.width / 2
                    let first = max(range.lowerBound, Int(shown - Double(mid / Self.perMinute)) - 2)
                    let last = min(range.upperBound, Int(shown + Double(mid / Self.perMinute)) + 2)
                    guard first <= last else { return }
                    for m in first...last {
                        let x = mid + CGFloat(Double(m) - shown) * Self.perMinute
                        let major = m % 15 == 0
                        let five = m % 5 == 0
                        let h: CGFloat = major ? 18 : five ? 12 : 6
                        let rect = CGRect(x: x - (five ? 1 : 0.6), y: 12, width: five ? 2 : 1.2, height: h)
                        g.fill(Path(roundedRect: rect, cornerRadius: 1),
                               with: .color(.white.opacity(major ? 0.62 : five ? 0.36 : 0.18)))
                        if major {
                            g.draw(Text(Self.label(m)).font(.fzDisplay(12, weight: .bold)).foregroundColor(.white.opacity(0.62)),
                                   at: CGPoint(x: x, y: size.height - 14))
                        }
                    }
                }
                // Fading out at both ends into the groove.
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(LinearGradient(stops: [.init(color: .fzGrooveFloor, location: 0), .init(color: .fzGrooveFloor.opacity(0), location: 0.2),
                                                 .init(color: .fzGrooveFloor.opacity(0), location: 0.8), .init(color: .fzGrooveFloor, location: 1)],
                                         startPoint: .leading, endPoint: .trailing))
                    .allowsHitTesting(false)
                // The light at the picked length.
                ZStack {
                    Capsule()
                        .fill(LinearGradient(colors: [.fzAqua, .fzViolet, .fzRose], startPoint: .top, endPoint: .bottom))
                        .frame(width: 8, height: 40)
                        .opacity(0.3)
                    Capsule()
                        .fill(LinearGradient(colors: [.fzAqua, .fzViolet, .fzRose], startPoint: .top, endPoint: .bottom))
                        .frame(width: 3, height: 34)
                }
                .allowsHitTesting(false)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { drag in
                        if dragging == nil { dragFrom = minutes }
                        let raw = Double(dragFrom) - Double(drag.translation.width / Self.perMinute)
                        let clamped = min(Double(range.upperBound), max(Double(range.lowerBound), raw))
                        dragging = clamped
                        let snapped = Int((clamped / 5).rounded()) * 5
                        if snapped != minutes { minutes = snapped }
                    }
                    .onEnded { _ in
                        dragging = nil
                    }
            )
        }
        .frame(height: 60)
        .fzSunk(cornerRadius: 18)
        .sensoryFeedback(.selection, trigger: minutes)
        .accessibilityElement()
        .accessibilityLabel("Session length")
        .accessibilityValue(GoalDial.format(minutes))
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: minutes = min(range.upperBound, minutes + 5)
            case .decrement: minutes = max(range.lowerBound, minutes - 5)
            @unknown default: break
            }
        }
    }

    /// "15m", "1h", "1h 15m".
    static func label(_ minutes: Int) -> String {
        GoalDial.format(minutes)
    }
}
