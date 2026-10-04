import SwiftUI

// The pedestal scene from the owner's dashboard mockup (`orb-stage.jpg`) with the focus orb floating
// over it and lightning arcing down into the pedestal's ring. The onboarding builds it up step by step
// (the light comes up, the ring powers on, sparks gather, the orb forms); Today shows it finished.
// Both place it with `OrbStageLayout`, so the onboarding's last frame is Today's first.

/// Where everything on the stage sits, in points from the top of the screen. Only the width and the
/// top safe area matter, not the height, so a tab bar or a home indicator doesn't move anything.
struct OrbStageLayout: Equatable {
    // `orb-stage.jpg`, measured in its pixels. A new photo needs these measured again.
    static let imagePixels = CGSize(width: 1122, height: 1402)
    /// The centre of the groove ring on the pedestal's top, and its radii.
    static let ringPixels = CGPoint(x: 557.5, y: 570)
    static let ringRadiiPixels = CGSize(width: 195.5, height: 44.75)
    /// The pedestal's top surface (radii, same centre).
    static let topRadiiPixels = CGSize(width: 293.5, height: 69)
    /// The two slits on its front.
    static let slitPixels = [CGPoint(x: 551, y: 742), CGPoint(x: 571.5, y: 742)]
    static let slitSizePixels = CGSize(width: 10, height: 46)
    /// Where it meets the ground.
    static let basePixels: CGFloat = 784
    /// How far (pixels) the bottom of the orb floats above the ring's centre: just clear of its back.
    static let hoverPixels: CGFloat = 75

    let width: CGFloat
    let top: CGFloat

    init(width: CGFloat, top: CGFloat) {
        self.width = max(width, 1)
        self.top = top
    }

    /// Photo pixels to points: a little wider than the screen, so the pedestal fills it like the
    /// mockup (the photo's sides are only rock and fog). Capped on iPad.
    var scale: CGFloat { min(width * 1.12 / Self.imagePixels.width, 0.62) }
    var sphereRadius: CGFloat { Self.ringRadiiPixels.width * 0.95 * scale }
    /// The top of the orb, under the greeting.
    var orbTop: CGFloat { top + 126 }

    var imageFrame: CGRect {
        let w = Self.imagePixels.width * scale
        let h = Self.imagePixels.height * scale
        let ringY = orbTop + sphereRadius * 2 + Self.hoverPixels * scale
        return CGRect(x: (width - w) / 2, y: ringY - Self.ringPixels.y * scale, width: w, height: h)
    }

    func point(_ p: CGPoint) -> CGPoint {
        let f = imageFrame
        return CGPoint(x: f.minX + p.x * scale, y: f.minY + p.y * scale)
    }

    var ring: CGPoint { point(Self.ringPixels) }
    var ringRadii: CGSize { CGSize(width: Self.ringRadiiPixels.width * scale, height: Self.ringRadiiPixels.height * scale) }
    var topRadii: CGSize { CGSize(width: Self.topRadiiPixels.width * scale, height: Self.topRadiiPixels.height * scale) }
    var slits: [CGPoint] { Self.slitPixels.map(point) }
    var slitSize: CGSize { CGSize(width: Self.slitSizePixels.width * scale, height: Self.slitSizePixels.height * scale) }
    var baseY: CGFloat { point(CGPoint(x: 0, y: Self.basePixels)).y }
    var orbCenter: CGPoint { CGPoint(x: ring.x, y: orbTop + sphereRadius) }
    /// `FocusOrb`'s sphere is 84% of its size.
    var orbViewSize: CGFloat { sphereRadius * 2 / 0.84 }
    /// The whole stage, down to the bottom of the photo.
    var height: CGFloat { imageFrame.maxY }
    var fillsWidth: Bool { imageFrame.minX <= 0.5 }
    /// Line widths and glows grow with the stage (iPad).
    var k: CGFloat { scale / 0.39 }
}

/// How far along the stage is, as one animatable value, so `withAnimation` on any part of it glides
/// (and several parts can glide at once on their own curves).
struct OrbStageState: VectorArithmetic {
    /// The photo fading up from black.
    var scene = 1.0
    /// The shaft of light from above.
    var beam = 1.0
    /// How far the light has run round the pedestal's ring.
    var ring = 1.0
    /// The white-hot point the sparks gather into, before the orb forms around it.
    var spark = 0.0
    /// The orb: 0 not there, 1 the full sphere.
    var formed = 1.0
    /// The lightning down into the ring.
    var arcs = 1.0
    /// How charged the orb is.
    var energy = 0.5

    /// The start of the story: all dark.
    static let dark = OrbStageState(scene: 0, beam: 0, ring: 0, spark: 0, formed: 0, arcs: 0, energy: 0.12)
    static func settled(_ energy: Double) -> OrbStageState { OrbStageState(energy: energy) }

    static let zero = OrbStageState(scene: 0, beam: 0, ring: 0, spark: 0, formed: 0, arcs: 0, energy: 0)
    static func + (a: OrbStageState, b: OrbStageState) -> OrbStageState { a.combined(b, +) }
    static func - (a: OrbStageState, b: OrbStageState) -> OrbStageState { a.combined(b, -) }
    mutating func scale(by rhs: Double) { self = combined(self) { x, _ in x * rhs } }
    var magnitudeSquared: Double {
        [scene, beam, ring, spark, formed, arcs, energy].reduce(0) { $0 + $1 * $1 }
    }

    private func combined(_ o: OrbStageState, _ f: (Double, Double) -> Double) -> OrbStageState {
        OrbStageState(scene: f(scene, o.scene), beam: f(beam, o.beam), ring: f(ring, o.ring), spark: f(spark, o.spark),
                      formed: f(formed, o.formed), arcs: f(arcs, o.arcs), energy: f(energy, o.energy))
    }
}

/// The stage itself. Lay it out at the top of the screen (or of a scroll view that ignores the top
/// safe area), `layout.width` wide; it's `layout.height` tall.
struct OrbStage: View, Animatable {
    let layout: OrbStageLayout
    var state: OrbStageState
    /// Bump it to send a strike down the lightning and flash the ring (each answer, each grant).
    var strike = 0
    /// When the sparks lifted off the ring. They spiral up and gather where the orb will be in about
    /// 1.7 seconds.
    var sparksAt: Date?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var struckAt = Date.distantPast

    var animatableData: OrbStageState {
        get { state }
        set { state = newValue }
    }

    var body: some View {
        let s = state
        ZStack(alignment: .topLeading) {
            StagePhoto(layout: layout)
                .opacity(s.scene)
            LightShaft(layout: layout)
                .opacity(s.beam * (0.55 + 0.45 * s.energy))
            PedestalGlow(layout: layout, trace: s.ring, power: 0.45 + 0.55 * s.energy, orbLight: s.formed * (0.35 + 0.65 * s.energy))
            RingFlash(layout: layout, strike: strike)

            // Everything that moves on its own. Time is absolute, so a second stage (Today, after the
            // onboarding) picks up exactly where the first one was.
            TimelineView(.animation(paused: reduceMotion)) { context in
                let t = CGFloat(reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate)
                let bob: CGFloat = sin(t * 1.15) * 3 * CGFloat(s.formed)
                let boost = CGFloat(max(0, 1 - context.date.timeIntervalSince(struckAt) / 0.55))
                ZStack(alignment: .topLeading) {
                    Canvas { g, _ in
                        drawDust(&g, t: t, power: CGFloat(s.beam))
                        drawArcs(&g, t: t, bob: bob, state: s, boost: boost)
                    }
                    .blendMode(.plusLighter)

                    if s.formed > 0.001 {
                        FocusOrb(energy: s.energy, size: layout.orbViewSize)
                            .scaleEffect(0.12 + 0.88 * s.formed)
                            .opacity(min(1, s.formed * 2.5))
                            .blur(radius: (1 - min(1, s.formed)) * 10)
                            .position(x: layout.orbCenter.x, y: layout.orbCenter.y + bob)
                    }

                    if let sparksAt {
                        Canvas { g, _ in
                            drawSparks(&g, elapsed: CGFloat(context.date.timeIntervalSince(sparksAt)))
                        }
                        .blendMode(.plusLighter)
                    }
                }
            }

            hotPoint(s)
            ripple(s)
        }
        .frame(width: layout.width, height: layout.height, alignment: .topLeading)
        .onChange(of: strike) { struckAt = .now }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    // MARK: The orb forming

    /// The white-hot point the sparks gather into. It hands over to the orb's own core as it forms.
    private func hotPoint(_ s: OrbStageState) -> some View {
        ZStack {
            Circle().fill(Color.fzMint).frame(width: 76 * layout.k, height: 76 * layout.k).blur(radius: 22 * layout.k).opacity(0.75)
            Circle().fill(.white).frame(width: 14 * layout.k, height: 14 * layout.k).blur(radius: 2)
        }
        .scaleEffect(0.3 + 0.7 * s.spark)
        .opacity(max(0, s.spark) * (1 - 0.85 * min(1, s.formed)))
        .blendMode(.plusLighter)
        .position(layout.orbCenter)
    }

    /// A ring of light that runs out across the glass as the sphere closes.
    private func ripple(_ s: OrbStageState) -> some View {
        let k = min(max((s.formed - 0.5) / 0.5, 0), 1)
        let size = layout.sphereRadius * 2 * (0.85 + 0.35 * k)
        return Circle()
            .strokeBorder(.white.opacity(0.9), lineWidth: 1.5)
            .frame(width: size, height: size)
            .blur(radius: 1 + 3 * k)
            .opacity(sin(k * .pi) * 0.85)
            .blendMode(.plusLighter)
            .position(layout.orbCenter)
    }

    // MARK: Drawn every frame

    private static func hash(_ i: Int, _ k: Int) -> CGFloat {
        let x = sin(CGFloat(i) * 12.9898 + CGFloat(k) * 78.233) * 43758.5453
        return x - floor(x)
    }

    /// Dust drifting up through the light.
    private func drawDust(_ g: inout GraphicsContext, t: CGFloat, power: CGFloat) {
        guard power > 0.01 else { return }
        let ring = layout.ring
        let spread = layout.topRadii.width * 1.7
        let top = max(0, layout.imageFrame.minY)
        let bottom = ring.y + layout.ringRadii.height * 2
        let span = max(bottom - top, 1)
        for i in 0..<38 {
            let h1 = Self.hash(i, 1), h2 = Self.hash(i, 2), h3 = Self.hash(i, 3), h4 = Self.hash(i, 4)
            let inBeam = i % 5 != 0
            let x0: CGFloat = inBeam ? ring.x + (h1 - 0.5) * spread : h1 * layout.width
            let rise: CGFloat = h3 * span + t * (4 + 9 * h2)
            let y: CGFloat = bottom - rise.truncatingRemainder(dividingBy: span)
            let x: CGFloat = x0 + sin(t * (0.3 + h4 * 0.4) + h1 * 6) * 10
            let size: CGFloat = (0.8 + 1.4 * h4) * layout.k
            let twinkle: CGFloat = 0.5 + 0.5 * sin(t * (1 + 2 * h2) + h3 * 6.3)
            let edge: CGFloat = max(0, min((y - top) / 40, (bottom - y) / 40, 1))
            let alpha: CGFloat = power * (inBeam ? 0.55 : 0.3) * twinkle * edge
            g.fill(Path(ellipseIn: CGRect(x: x - size / 2, y: y - size / 2, width: size, height: size)), with: .color(.white.opacity(Double(alpha))))
        }
    }

    /// Lightning from the underside of the orb down into the ring: two at first, four when charged,
    /// all four (thicker, brighter) for a moment after a strike. They re-strike 13 times a second.
    private func drawArcs(_ g: inout GraphicsContext, t: CGFloat, bob: CGFloat, state s: OrbStageState, boost: CGFloat) {
        let power = CGFloat(s.arcs)
        guard power > 0.01 else { return }
        let ring = layout.ring
        let rr = layout.ringRadii
        let center = CGPoint(x: layout.orbCenter.x, y: layout.orbCenter.y + bob)
        let radius: CGFloat = layout.sphereRadius * (0.12 + 0.88 * min(1, CGFloat(s.formed))) * 0.86
        let count = boost > 0.05 ? 4 : 2 + min(2, Int(s.energy * 2.99))
        let seed = Int(t * 13)
        // Degrees, 90 is straight at you: left, right, front left, front right.
        let ringAngles: [CGFloat] = [160, 20, 122, 58]
        let sphereAngles: [CGFloat] = [130, 50, 110, 70]
        let k = layout.k
        for i in 0..<count {
            let fi = CGFloat(i)
            let flicker = Self.hash(seed, i + 11)
            guard boost > 0.05 || flicker > 0.22 else { continue }
            let a: CGFloat = (ringAngles[i] + 7 * sin(t * 0.45 + fi * 1.7)) * .pi / 180
            let end = CGPoint(x: ring.x + rr.width * cos(a), y: ring.y + rr.height * sin(a))
            let b: CGFloat = (sphereAngles[i] + 6 * sin(t * 0.6 + fi)) * .pi / 180
            let begin = CGPoint(x: center.x + radius * cos(b), y: center.y + radius * sin(b))
            let points = Self.bolt(from: begin, to: end, seed: seed &* 7 &+ i, jag: 0.2)
            var path = Path()
            path.addLines(points)
            let strength: CGFloat = power * (0.6 + 0.4 * flicker) * (1 + 1.2 * boost)
            g.drawLayer { layer in
                layer.addFilter(.blur(radius: 3.5 * k))
                layer.stroke(path, with: .color(Color.fzMint.opacity(Double(min(1, 0.7 * strength)))), lineWidth: (3 + 2 * boost) * k)
            }
            g.stroke(path, with: .color(.white.opacity(Double(min(1, 0.95 * strength)))), lineWidth: (1 + 0.6 * boost) * k)

            // A short fork off the middle now and then.
            if Self.hash(seed, i + 31) > 0.4 {
                let from = points[points.count / 2]
                let dx = end.x - begin.x, dy = end.y - begin.y
                let side: CGFloat = Self.hash(seed, i + 41) > 0.5 ? 1 : -1
                let tip = CGPoint(x: from.x + dx * 0.35 - side * dy * 0.25, y: from.y + dy * 0.35 + side * dx * 0.25)
                var fork = Path()
                fork.addLines(Self.bolt(from: from, to: tip, seed: seed &* 5 &+ i &+ 3, jag: 0.25))
                g.stroke(fork, with: .color(.white.opacity(Double(min(1, 0.6 * strength)))), lineWidth: 0.8 * k)
            }

            // Where it touches the ring.
            let glow: CGFloat = (9 + 6 * boost) * k
            g.drawLayer { layer in
                layer.addFilter(.blur(radius: glow * 0.6))
                layer.fill(Path(ellipseIn: CGRect(x: end.x - glow, y: end.y - glow * 0.5, width: glow * 2, height: glow)),
                           with: .color(Color.fzMint.opacity(Double(min(1, 0.8 * strength)))))
            }
        }
    }

    /// A jagged line from a to b (midpoint displacement, four levels: 17 points).
    private static func bolt(from a: CGPoint, to b: CGPoint, seed: Int, jag: CGFloat) -> [CGPoint] {
        var points = [a, b]
        var amount: CGFloat = hypot(b.x - a.x, b.y - a.y) * jag
        for level in 0..<4 {
            var next: [CGPoint] = [points[0]]
            for i in 0..<(points.count - 1) {
                let p = points[i], q = points[i + 1]
                let dx = q.x - p.x, dy = q.y - p.y
                let length = max(hypot(dx, dy), 0.001)
                let offset: CGFloat = (hash(seed &+ level &* 97, i) - 0.5) * 2 * amount
                next.append(CGPoint(x: (p.x + q.x) / 2 - dy / length * offset, y: (p.y + q.y) / 2 + dx / length * offset))
                next.append(q)
            }
            points = next
            amount *= 0.5
        }
        return points
    }

    /// Sparks lifting off the ring and spiralling up into the spot where the orb will form.
    private func drawSparks(_ g: inout GraphicsContext, elapsed e: CGFloat) {
        guard e > 0, e < 2.2 else { return }
        let ring = layout.ring
        let rr = layout.ringRadii
        let target = layout.orbCenter
        let k = layout.k
        for i in 0..<44 {
            let delay: CGFloat = Self.hash(i, 5) * 0.55
            let p: CGFloat = min(max((e - delay) / 1.15, 0), 1)
            guard p > 0, p < 1 else { continue }
            let start: CGFloat = Self.hash(i, 6) * 2 * .pi
            func position(_ q: CGFloat) -> CGPoint {
                let a = start + q * 2.6
                let r = 1 - q
                return CGPoint(x: ring.x + rr.width * r * cos(a), y: ring.y + (target.y - ring.y) * q + rr.height * r * sin(a))
            }
            let eased: CGFloat = p * p * (3 - 2 * p)
            let head = position(eased)
            let tail = position(max(0, eased - 0.07))
            var streak = Path()
            streak.move(to: tail)
            streak.addLine(to: head)
            let fade = Double(sin(p * .pi))
            g.drawLayer { layer in
                layer.addFilter(.blur(radius: 2 * k))
                layer.stroke(streak, with: .color(Color.fzMint.opacity(0.9 * fade)), style: StrokeStyle(lineWidth: 3 * k, lineCap: .round))
            }
            g.stroke(streak, with: .color(.white.opacity(0.8 * fade)), style: StrokeStyle(lineWidth: 1.1 * k, lineCap: .round))
        }
    }
}

// MARK: Pieces

/// The photo, faded into black at the top and bottom (and at the sides on iPad, where it's narrower
/// than the screen).
private struct StagePhoto: View {
    let layout: OrbStageLayout

    var body: some View {
        let frame = layout.imageFrame
        Image("OrbStage")
            .resizable()
            .interpolation(.high)
            .frame(width: frame.width, height: frame.height)
            .mask {
                LinearGradient(stops: [
                    .init(color: .clear, location: 0), .init(color: .black, location: 0.2),
                    .init(color: .black, location: 0.68), .init(color: .clear, location: 1),
                ], startPoint: .top, endPoint: .bottom)
            }
            .mask {
                LinearGradient(stops: layout.fillsWidth ? [.init(color: .black, location: 0), .init(color: .black, location: 1)] : [
                    .init(color: .clear, location: 0), .init(color: .black, location: 0.14),
                    .init(color: .black, location: 0.86), .init(color: .clear, location: 1),
                ], startPoint: .leading, endPoint: .trailing)
            }
            .position(x: frame.midX, y: frame.midY)
    }
}

/// A soft shaft of light falling from the top onto the pedestal.
private struct LightShaft: View {
    let layout: OrbStageLayout

    var body: some View {
        let ring = layout.ring
        let narrow = layout.topRadii.width * 0.35
        let wide = layout.topRadii.width * 1.05
        let light = Color(hex: 0xDDF5E6)
        Path { p in
            p.move(to: CGPoint(x: ring.x - narrow, y: 0))
            p.addLine(to: CGPoint(x: ring.x + narrow, y: 0))
            p.addLine(to: CGPoint(x: ring.x + wide, y: ring.y))
            p.addLine(to: CGPoint(x: ring.x - wide, y: ring.y))
            p.closeSubpath()
        }
        .fill(LinearGradient(colors: [light.opacity(0.13), light.opacity(0.05), light.opacity(0.1)], startPoint: .top, endPoint: .bottom))
        .blur(radius: 26 * layout.k)
        .blendMode(.plusLighter)
    }
}

/// The pedestal powered on: the groove ring (lit from the front, both ways round), its front slits,
/// the light it throws on the metal and the ground, and the orb's own light on the dish below it.
private struct PedestalGlow: View {
    let layout: OrbStageLayout
    var trace: Double
    var power: Double
    var orbLight: Double

    var body: some View {
        let ring = layout.ring
        let rr = layout.ringRadii
        let top = layout.topRadii
        let k = layout.k
        let lit = min(max(trace, 0), 1)
        let slitsOn = min(max((lit - 0.35) / 0.4, 0), 1)
        ZStack(alignment: .topLeading) {
            Ellipse()
                .fill(Color.fzMint.opacity(0.16))
                .frame(width: top.width * 2.1, height: top.height * 2.2)
                .blur(radius: 16 * k)
                .position(ring)
                .opacity(power * lit)
            Ellipse()
                .fill(Color.fzMint.opacity(0.09))
                .frame(width: top.width * 2.8, height: top.height * 1.6)
                .blur(radius: 26 * k)
                .position(x: ring.x, y: layout.baseY)
                .opacity(power * lit)
            Ellipse()
                .fill(Color(hex: 0xDFF7E8).opacity(0.22))
                .frame(width: rr.width * 1.5, height: rr.height * 1.4)
                .blur(radius: 12 * k)
                .position(ring)
                .opacity(orbLight)

            RingTrace(trace: lit)
                .stroke(Color.fzMint.opacity(0.8), style: StrokeStyle(lineWidth: 6 * k, lineCap: .round))
                .blur(radius: 5 * k)
                .frame(width: rr.width * 2, height: rr.height * 2)
                .position(ring)
                .opacity(power)
            RingTrace(trace: lit)
                .stroke(Color(hex: 0xEFFFF5), style: StrokeStyle(lineWidth: 1.6 * k, lineCap: .round))
                .frame(width: rr.width * 2, height: rr.height * 2)
                .position(ring)
                .opacity(power)

            // The two heads of light while it runs round.
            ForEach([1.0, -1.0], id: \.self) { side in
                let a = Double.pi / 2 + side * Double.pi * lit
                Circle()
                    .fill(.white)
                    .frame(width: 5 * k, height: 5 * k)
                    .shadow(color: Color.fzMint, radius: 6 * k)
                    .position(x: ring.x + rr.width * cos(a), y: ring.y + rr.height * sin(a))
                    .opacity(lit > 0 && lit < 1 ? 1 : 0)
            }

            ForEach(Array(layout.slits.enumerated()), id: \.offset) { _, slit in
                let size = layout.slitSize
                ZStack {
                    RoundedRectangle(cornerRadius: 2 * k)
                        .fill(Color.fzMint)
                        .frame(width: size.width * 2.2, height: size.height * 1.3)
                        .blur(radius: 5 * k)
                        .opacity(0.7)
                    RoundedRectangle(cornerRadius: 1.5 * k)
                        .fill(Color(hex: 0xEFFFF5))
                        .frame(width: size.width * 0.55, height: size.height * 0.8)
                }
                .position(slit)
                .opacity(power * slitsOn)
            }
        }
        .blendMode(.plusLighter)
    }
}

/// The groove ring, lit from the front centre outwards both ways; `trace` 1 is the whole ring.
private struct RingTrace: Shape {
    var trace: Double

    var animatableData: Double {
        get { trace }
        set { trace = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard trace > 0 else { return path }
        let rx = rect.width / 2, ry = rect.height / 2
        let steps = 90
        for side in [1.0, -1.0] {
            for i in 0...steps {
                let a = Double.pi / 2 + side * Double.pi * trace * Double(i) / Double(steps)
                let p = CGPoint(x: rect.midX + rx * cos(a), y: rect.midY + ry * sin(a))
                if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
            }
        }
        return path
    }
}

/// The ring flashing white when a strike comes down.
private struct RingFlash: View {
    let layout: OrbStageLayout
    let strike: Int

    var body: some View {
        Ellipse()
            .stroke(.white, lineWidth: 3 * layout.k)
            .blur(radius: 4 * layout.k)
            .frame(width: layout.ringRadii.width * 2, height: layout.ringRadii.height * 2)
            .position(layout.ring)
            .keyframeAnimator(initialValue: 0.0, trigger: strike) { content, value in
                content.opacity(value)
            } keyframes: { _ in
                KeyframeTrack(\.self) {
                    LinearKeyframe(0.9, duration: 0.06)
                    CubicKeyframe(0, duration: 0.7)
                }
            }
            .blendMode(.plusLighter)
    }
}
