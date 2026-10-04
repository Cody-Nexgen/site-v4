import SwiftUI

/// Your focus orb: a dark glass sphere holding live electricity, drawn on the GPU (`FocusOrb.metal`).
/// `energy` (0–1) is how charged it is: at the start two or three tendrils flicker from the core;
/// fully charged, eight strike the glass, fork, and light the whole sphere.
///
/// `size` is the space it takes in the layout (the sphere is about 84% of it). Its light spills
/// past that, so the drawing is bigger than the frame and centred on it.
struct FocusOrb: View, Animatable {
    var energy: Double
    var size: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start = Date()

    /// So a change to `energy` inside `withAnimation` glides instead of jumping.
    var animatableData: Double {
        get { energy }
        set { energy = newValue }
    }

    /// How much bigger the drawing is than `size`, for the glow. Matches FZ_ORB_R in the shader.
    private static let spill: CGFloat = 1.5

    var body: some View {
        let canvas = size * Self.spill
        TimelineView(.animation(paused: reduceMotion)) { context in
            // Kept small: the shader works in 32-bit floats. The pattern jumps once every 20 minutes.
            let t = reduceMotion ? 12 : context.date.timeIntervalSince(start).truncatingRemainder(dividingBy: 1200)
            Rectangle()
                .fill(.black)
                .colorEffect(ShaderLibrary.focusOrb(.float2(canvas, canvas), .float(t), .float(energy)))
        }
        .frame(width: canvas, height: canvas)
        .frame(width: size, height: size)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// Compiles the shader ahead of time, so the orb's first frame doesn't stutter.
    static func prepare() async {
        try? await ShaderLibrary.focusOrb(.float2(1, 1), .float(0), .float(0)).compile(as: .colorEffect)
    }
}
