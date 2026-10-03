import SwiftUI

/// FocuzNow's signature (spec §1, "Into focus"): out-of-focus lights drifting apart when you're
/// scattered; as `focus` goes from 0 to 1 they shrink, sharpen and gather into the Beam Z, which
/// then lights up. Animatable, so `withAnimation { focus = 1 }` plays the whole gathering.
struct FocusField: View, Animatable {
    var focus: Double
    var lights = 46
    /// Size of the Z inside the frame (fraction of the shorter side).
    var markScale: Double = 0.46

    var animatableData: Double {
        get { focus }
        set { focus = newValue }
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { timeline in
            let t = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate
            Canvas { context, size in
                draw(&context, size: size, time: t)
            }
        }
        .accessibilityHidden(true)
    }

    private func draw(_ context: inout GraphicsContext, size: CGSize, time: Double) {
        let w = Double(size.width)
        let h = Double(size.height)
        let f = min(1, max(0, focus))
        let gather = smooth(f)
        let side = min(w, h) * markScale
        let origin = CGPoint(x: (w - side * 0.86) / 2, y: (h - side) / 2)
        let light = Theme.accent

        for index in 0..<lights {
            let seed = Double(index)
            // Scattered: anywhere in the frame, drifting slowly.
            let sx: Double = frac(seed * 0.7548776662) * w + sin(time / (3 + frac(seed * 0.3) * 3) + seed) * 18
            let sy: Double = frac(seed * 0.5698402910) * h + cos(time / (4 + frac(seed * 0.7) * 3) + seed * 1.3) * 14
            // Focused: a point along the Z.
            let target = zPoint(Double(index) / Double(lights - 1), width: side * 0.86, height: side)
            let tx = Double(origin.x) + target.x
            let ty = Double(origin.y) + target.y
            let x = sx + (tx - sx) * gather
            let y = sy + (ty - sy) * gather

            let bokeh: Double = 10 + 26 * frac(seed * 0.4142)
            let sharp: Double = 2.2 + 1.2 * frac(seed * 0.2718)
            let radius = bokeh + (sharp - bokeh) * gather
            let alpha: Double = (0.10 + 0.22 * frac(seed * 0.618)) * (1 - gather) + 0.95 * gather
            let tint = index.isMultiple(of: 3) ? light : light.mix(with: .white, by: 0.65)

            let rect = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
            context.fill(
                Path(ellipseIn: rect),
                with: .radialGradient(
                    Gradient(stops: [
                        .init(color: tint.opacity(alpha), location: 0),
                        .init(color: tint.opacity(alpha * (0.55 + 0.4 * gather)), location: 0.7 - 0.3 * gather),
                        .init(color: tint.opacity(0), location: 1),
                    ]),
                    center: CGPoint(x: x, y: y),
                    startRadius: 0,
                    endRadius: radius
                )
            )
        }

        // The Beam Z lights up once the lights have gathered.
        let markOpacity = max(0, (f - 0.82) / 0.18)
        if markOpacity > 0 {
            var mark = Path()
            let mw = side * 0.86
            mark.move(to: CGPoint(x: Double(origin.x), y: Double(origin.y)))
            mark.addLine(to: CGPoint(x: Double(origin.x) + mw, y: Double(origin.y)))
            mark.addLine(to: CGPoint(x: Double(origin.x), y: Double(origin.y) + side))
            mark.addLine(to: CGPoint(x: Double(origin.x) + mw, y: Double(origin.y) + side))
            let style = StrokeStyle(lineWidth: max(3, side * 0.035), lineCap: .round, lineJoin: .round)
            context.drawLayer { layer in
                layer.addFilter(.blur(radius: side * 0.09))
                layer.stroke(mark, with: .color(light.opacity(0.75 * markOpacity)), style: StrokeStyle(lineWidth: side * 0.08, lineCap: .round, lineJoin: .round))
            }
            context.drawLayer { layer in
                layer.addFilter(.blur(radius: side * 0.02))
                layer.stroke(mark, with: .color(light.opacity(0.9 * markOpacity)), style: style)
            }
            context.stroke(mark, with: .color(.white.opacity(markOpacity)), style: StrokeStyle(lineWidth: max(1.5, side * 0.014), lineCap: .round, lineJoin: .round))
        }
    }

    /// A point `s` (0…1) along the Z by distance: top bar, diagonal, bottom bar.
    private func zPoint(_ s: Double, width: Double, height: Double) -> (x: Double, y: Double) {
        let diagonal = (width * width + height * height).squareRoot()
        let total = width * 2 + diagonal
        var d = s * total
        if d <= width { return (d, 0) }
        d -= width
        if d <= diagonal {
            let k = d / diagonal
            return (width * (1 - k), height * k)
        }
        d -= diagonal
        return (min(width, d), height)
    }

    private func smooth(_ x: Double) -> Double { x * x * (3 - 2 * x) }
    private func frac(_ v: Double) -> Double { v - v.rounded(.down) }
}

// MARK: Blur-rise: text and views arrive out of focus, rising, and sharpen.

struct BlurRise: ViewModifier {
    let amount: Double

    func body(content: Content) -> some View {
        content
            .blur(radius: amount * 14)
            .opacity(1 - amount)
            .offset(y: amount * 26)
    }
}

extension AnyTransition {
    static var blurRise: AnyTransition {
        .modifier(active: BlurRise(amount: 1), identity: BlurRise(amount: 0))
    }
}

/// Plays a blur-rise when the view first appears, after `delay`.
struct RiseIn: ViewModifier {
    let delay: Double
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .modifier(BlurRise(amount: shown || reduceMotion ? 0 : 1))
            .onAppear {
                withAnimation(.smooth(duration: 0.7).delay(delay)) { shown = true }
            }
    }
}

extension View {
    func riseIn(delay: Double = 0) -> some View { modifier(RiseIn(delay: delay)) }
}
