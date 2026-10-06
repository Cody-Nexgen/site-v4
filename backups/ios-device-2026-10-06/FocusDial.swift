import SwiftUI

/// The session length, as a 3D dial: a glass ring on a machined plate that fills with the orb's light
/// as you drag round it (15 minutes to 3 hours, in 5-minute steps). The light crackles and runs through
/// the prism; the minute marks it has passed light up; tilting the phone moves the light on the glass.
/// Drawn on the GPU (`FocusDial.metal`, `fzDial` in OrbShared.h). It replaced the flat `TimeRing`.
struct FocusDial: View {
    @Binding var minutes: Int
    private let range = 15...180
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var tilt = StageTilt()
    @State private var visible = false

    /// The ring is tilted back by this much (DIAL_TILT in the shader), so a drag is read off the ellipse.
    private static let tiltAngle = 0.42

    var body: some View {
        GeometryReader { proxy in
            let side = min(proxy.size.width, proxy.size.height)
            let fraction = Double(minutes - range.lowerBound) / Double(range.upperBound - range.lowerBound)
            ZStack {
                DialSurface(fill: fraction, tilt: tilt, paused: !visible || reduceMotion)
                    .frame(width: side, height: side)
                VStack(spacing: 2) {
                    DimensionalNumber(text: FocusSession.clock(TimeInterval(minutes * 60)), size: side * 0.2, depth: 4,
                                      value: Double(minutes))
                    LitCaption("Drag the ring", color: Color.fzNightInk.opacity(0.6), size: 13)
                }
                .offset(y: side * 0.02)
                .allowsHitTesting(false)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .contentShape(Circle())
            .gesture(
                DragGesture(minimumDistance: 0).onChanged { drag in
                    let dx = Double(drag.location.x - proxy.size.width / 2)
                    // The ring leans back: undo it so the angle matches what's under the finger.
                    let dy = Double(drag.location.y - proxy.size.height / 2) / cos(Self.tiltAngle)
                    var angle = atan2(dx, -dy)
                    if angle < 0 { angle += 2 * .pi }
                    let raw = Double(range.lowerBound) + angle / (2 * .pi) * Double(range.upperBound - range.lowerBound)
                    let value = min(range.upperBound, max(range.lowerBound, Int((raw / 5).rounded()) * 5))
                    if value != minutes { withAnimation(.snappy) { minutes = value } }
                }
            )
            .sensoryFeedback(.selection, trigger: minutes)
        }
        .onAppear {
            visible = true
            if !reduceMotion { tilt.start() }
        }
        .onDisappear {
            visible = false
            tilt.stop()
        }
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
}

/// The GPU drawing, with `fill` animatable so the light runs round instead of jumping.
private struct DialSurface: View, Animatable {
    var fill: Double
    let tilt: StageTilt
    var paused: Bool

    var animatableData: Double {
        get { fill }
        set { fill = newValue }
    }

    var body: some View {
        // 60 frames a second at most, and only while it's on screen.
        TimelineView(.animation(minimumInterval: 1.0 / 60, paused: paused)) { context in
            let t = context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1200)
            GeometryReader { proxy in
                Rectangle()
                    .fill(.black)
                    .colorEffect(ShaderLibrary.focusDial(.float2(proxy.size.width, proxy.size.height), .float(fill), .float(t),
                                                         .float2(tilt.offset.width / 10, -tilt.offset.height / 8)))
            }
        }
        .accessibilityHidden(true)
    }
}
