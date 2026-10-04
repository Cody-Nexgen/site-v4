import CoreMotion
import SwiftUI

// The focus orb's world, from the owner's mockup: a dark landscape (`orb-stage.jpg`), a pedestal, and
// the orb floating over it with lightning down into the pedestal's ring. The world reacts to the orb:
// its light falls on the metal and the ground, fog drifts and glows (`OrbWorld.metal`), rocks lift off
// and float as it charges, and the whole scene sits in depth (tilt the phone, the camera drifts). The
// onboarding opens on a wide shot (`orb-stage-wide.jpg`), flies the camera in and builds the orb on
// the pedestal; Today shows it finished. Both place it with `OrbStageLayout`, so the onboarding's last
// frame is Today's first.

/// Where everything on the stage sits, in points from the top of the screen. Only the width and the
/// top safe area place the stage (a tab bar or a home indicator doesn't move anything); the screen's
/// height is only for the wide shot, which fills it.
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
    /// Where the ground meets the far rocks: depth 0 for parallax (the bottom of the photo is 1).
    static let horizonPixels: CGFloat = 440
    /// How far (pixels) the bottom of the orb floats above the ring's centre: just clear of its back.
    static let hoverPixels: CGFloat = 75

    // `orb-stage-wide.jpg`: the same pedestal from much further back, where the story opens.
    static let widePixels = CGSize(width: 941, height: 1672)
    static let wideRingPixels = CGPoint(x: 470, y: 793.75)
    static let wideRingRadiiPixels = CGSize(width: 61.25, height: 12.5)
    static let wideTopRadiiPixels = CGSize(width: 92.5, height: 18.75)
    /// Where the ground meets the haze, and the pedestal's foot, in the wide photo.
    static let wideHorizonPixels: CGFloat = 620
    static let wideFootPixels: CGFloat = 851

    /// How far a point of the wide photo is, relative to the pedestal (1): the ground as a plane, the
    /// far rocks and sky very far, the pedestal solid. The same as `fzWideDistance` in OrbWorld.metal.
    static func wideDistance(_ p: CGPoint) -> CGFloat {
        let ground = pow((wideFootPixels - wideHorizonPixels) / max(p.y - wideHorizonPixels, 18), 0.8)
        let q = hypot((p.x - wideRingPixels.x) / wideTopRadiiPixels.width, (p.y - wideRingPixels.y) / wideTopRadiiPixels.height)
        let top = 1 - fzSmooth(0.95, 1.1, q)
        let body = (1 - fzSmooth(wideTopRadiiPixels.width * 1.04, wideTopRadiiPixels.width * 1.14, abs(p.x - wideRingPixels.x)))
            * (p.y >= wideRingPixels.y ? 1 : 0) * (1 - fzSmooth(wideFootPixels, wideFootPixels + 6, p.y))
        return ground + (1 - ground) * max(top, body)
    }

    /// How much bigger something at `distance` looks once the camera has moved `travel` towards it.
    static func wideZoom(_ distance: CGFloat, travel: CGFloat) -> CGFloat {
        distance / max(distance - travel, 0.06)
    }

    /// How near the pedestal is, for parallax (as near as its foot).
    static let pedestalDepth = OrbStageLayout.depth(atPixelY: OrbStageLayout.basePixels)

    /// How near the ground is at a height in the photo: 0.06 at the horizon, 1 at the bottom.
    static func depth(atPixelY y: CGFloat) -> CGFloat {
        0.06 + 0.94 * fzSmooth(horizonPixels, imagePixels.height, y)
    }

    let width: CGFloat
    let top: CGFloat
    let screenHeight: CGFloat

    init(width: CGFloat, top: CGFloat, screenHeight: CGFloat = 0) {
        self.width = max(width, 1)
        self.top = top
        self.screenHeight = screenHeight > 0 ? screenHeight : max(width, 1) * 2.17
    }

    /// Photo pixels to points: a little wider than the screen, so the pedestal fills it like the
    /// mockup (the photo's sides are only rock and fog, and they give the parallax room). Capped on iPad.
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
    var horizonY: CGFloat { point(CGPoint(x: 0, y: Self.horizonPixels)).y }
    var orbCenter: CGPoint { CGPoint(x: ring.x, y: orbTop + sphereRadius) }
    /// `FocusOrb`'s sphere is 84% of its size.
    var orbViewSize: CGFloat { sphereRadius * 2 / 0.84 }
    /// The whole stage, down to the bottom of the photo.
    var height: CGFloat { imageFrame.maxY }
    var fillsWidth: Bool { imageFrame.minX <= 0.5 }
    /// Line widths and glows grow with the stage (iPad).
    var k: CGFloat { scale / 0.39 }

    // MARK: The wide shot, and the camera flying in from it

    /// The wide shot fills the screen.
    var wideScale: CGFloat { max(width / Self.widePixels.width, screenHeight / Self.widePixels.height) }

    private var wideRingAtRest: CGPoint {
        let s = wideScale
        return CGPoint(x: (width - Self.widePixels.width * s) / 2 + Self.wideRingPixels.x * s,
                       y: (screenHeight - Self.widePixels.height * s) / 2 + Self.wideRingPixels.y * s)
    }

    /// How much bigger the pedestal is on the stage than in the wide shot.
    var dollyZoom: CGFloat { ringRadii.width / (Self.wideRingRadiiPixels.width * wideScale) }

    /// How far the camera travels towards the pedestal (which starts 1 away) to get from the wide
    /// shot to the stage.
    var travelEnd: CGFloat { 1 - 1 / dollyZoom }

    /// The camera between the wide shot (0) and the stage (1): where the pedestal's ring is on screen,
    /// and how much bigger the pedestal looks. The camera really moves (`travel`), so things nearer
    /// than the pedestal grow faster and things further grow slower.
    func camera(_ d: CGFloat) -> (ring: CGPoint, zoom: CGFloat) {
        let rest = wideRingAtRest
        return (CGPoint(x: rest.x + (ring.x - rest.x) * d, y: rest.y + (ring.y - rest.y) * d), 1 / (1 - travelEnd * d))
    }

    /// A point of the wide photo (its pixels) on screen, with the camera at `d`. `distance` is how far
    /// it is (relative to the pedestal); by default, the ground's at that point.
    func widePoint(_ w: CGPoint, distance: CGFloat? = nil, dolly d: CGFloat) -> CGPoint {
        let c = camera(d)
        let s = wideScale * Self.wideZoom(distance ?? Self.wideDistance(w), travel: travelEnd * d)
        return CGPoint(x: c.ring.x + (w.x - Self.wideRingPixels.x) * s, y: c.ring.y + (w.y - Self.wideRingPixels.y) * s)
    }

    /// The wide shot's top-left when the camera hasn't moved.
    var wideOriginAtRest: CGPoint {
        CGPoint(x: (width - Self.widePixels.width * wideScale) / 2, y: (screenHeight - Self.widePixels.height * wideScale) / 2)
    }

    /// The orb's spot, in the wide photo's pixels.
    var orbInWide: CGPoint {
        let s = wideScale * dollyZoom
        return CGPoint(x: Self.wideRingPixels.x + (orbCenter.x - ring.x) / s, y: Self.wideRingPixels.y + (orbCenter.y - ring.y) / s)
    }
}

func fzSmooth<T: BinaryFloatingPoint>(_ a: T, _ b: T, _ x: T) -> T {
    let t = min(max((x - a) / (b - a), 0), 1)
    return t * t * (3 - 2 * t)
}

/// How far along the stage is, as one animatable value, so `withAnimation` on any part of it glides
/// (and several parts can glide at once on their own curves).
struct OrbStageState: VectorArithmetic {
    /// The scene fading up from black.
    var scene = 1.0
    /// The shaft of light from above.
    var beam = 1.0
    /// How far the light has run round the pedestal's ring.
    var ring = 1.0
    /// The white-hot point the gathered light makes, before the orb forms around it.
    var spark = 0.0
    /// The orb: 0 not there, 1 the full sphere.
    var formed = 1.0
    /// The lightning down into the ring.
    var arcs = 1.0
    /// How charged the orb is.
    var energy = 0.5
    /// How lit the world is: 0 cold, dark and colourless, 1 awake.
    var awake = 0.65
    /// How far the rocks have lifted off the ground (they rise one after another).
    var lift = 0.5
    /// The camera: 0 the wide shot, 1 the stage.
    var dolly = 1.0
    /// The scattered lights across the landscape (your focus, everywhere).
    var scatter = 0.0

    /// The start of the story: the wide shot, all dark.
    static let dark = OrbStageState(scene: 0, beam: 0, ring: 0, spark: 0, formed: 0, arcs: 0, energy: 0.12,
                                    awake: 0, lift: 0, dolly: 0, scatter: 0)

    /// Finished, as charged as `energy`: the world wakes and the rocks lift with it.
    static func settled(_ energy: Double) -> OrbStageState {
        OrbStageState(energy: energy, awake: 0.3 + 0.7 * energy, lift: fzSmooth(0.2, 0.9, energy))
    }

    static let zero = OrbStageState(scene: 0, beam: 0, ring: 0, spark: 0, formed: 0, arcs: 0, energy: 0,
                                    awake: 0, lift: 0, dolly: 0, scatter: 0)
    static func + (a: OrbStageState, b: OrbStageState) -> OrbStageState { a.combined(b, +) }
    static func - (a: OrbStageState, b: OrbStageState) -> OrbStageState { a.combined(b, -) }
    mutating func scale(by rhs: Double) { self = combined(self) { x, _ in x * rhs } }
    var magnitudeSquared: Double {
        [scene, beam, ring, spark, formed, arcs, energy, awake, lift, dolly, scatter].reduce(0) { $0 + $1 * $1 }
    }

    private func combined(_ o: OrbStageState, _ f: (Double, Double) -> Double) -> OrbStageState {
        OrbStageState(scene: f(scene, o.scene), beam: f(beam, o.beam), ring: f(ring, o.ring), spark: f(spark, o.spark),
                      formed: f(formed, o.formed), arcs: f(arcs, o.arcs), energy: f(energy, o.energy),
                      awake: f(awake, o.awake), lift: f(lift, o.lift), dolly: f(dolly, o.dolly), scatter: f(scatter, o.scatter))
    }
}

/// The stage itself. Lay it out at the top of the screen (or of a scroll view that ignores the top
/// safe area), `layout.width` wide; it's `layout.height` tall (the wide shot fills the screen).
struct OrbStage: View, Animatable {
    let layout: OrbStageLayout
    var state: OrbStageState
    /// Bump it to send a strike down the lightning and flash the world (each answer, each grant).
    var strike = 0
    /// When the scattered lights set off for the pedestal. They arrive at the orb's spot in about 2.8 s.
    var gatherAt: Date?
    /// A finger on the stage, in stage points: the lightning reaches for it.
    var touch: CGPoint?
    /// A soft pulse round the orb asking to be touched.
    var hint = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var struckAt = Date.distantPast
    @State private var tilt = StageTilt()

    var animatableData: OrbStageState {
        get { state }
        set { state = newValue }
    }

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            scene(at: context.date, state)
        }
        .frame(width: layout.width, height: layout.height, alignment: .topLeading)
        .onChange(of: strike) { struckAt = .now }
        .onAppear { if !reduceMotion { tilt.start() } }
        .onDisappear { tilt.stop() }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    /// One frame of the stage.
    private func scene(at now: Date, _ s: OrbStageState) -> some View {
        // Absolute time, so a second stage (Today, after the onboarding) picks up where this was.
        let t = CGFloat(reduceMotion ? 0 : now.timeIntervalSinceReferenceDate)
        let cam = camera(t)
        let boost = CGFloat(max(0, 1 - now.timeIntervalSince(struckAt) / 0.55))
        let flash: CGFloat = max(boost, touch == nil ? 0 : 0.3 + 0.2 * sin(t * 37))
        let pedShift = cam * OrbStageLayout.pedestalDepth
        let bob: CGFloat = sin(t * 1.15) * 3 * CGFloat(s.formed)
        let lead: CGFloat = OrbStageLayout.pedestalDepth + 0.08
        let orbAt = CGPoint(x: layout.orbCenter.x + cam.width * lead, y: layout.orbCenter.y + bob + cam.height * lead)
        // The pedestal's lights and the orb only once the camera has arrived.
        let close = Double(fzSmooth(0.9, 1.0, CGFloat(s.dolly)))
        return ZStack(alignment: .topLeading) {
            if s.dolly < 0.999 {
                WideShot(layout: layout, state: s, cam: cam, t: t)
            }
            SkyAbove(layout: layout, awake: s.awake)
                .opacity(close * s.scene)
                .offset(cam * 0.06)
            StagePhoto(layout: layout, state: s, t: t, cam: cam, flash: flash, orbAt: orbAt, pedShift: pedShift)
            LightShaft(layout: layout)
                .opacity(s.beam * (0.4 + 0.6 * s.awake) * close)
                .offset(cam * 0.1)
            Group {
                PedestalGlow(layout: layout, trace: s.ring, power: 0.45 + 0.55 * s.energy)
                RingFlash(layout: layout, strike: strike)
            }
            .offset(pedShift)
            .opacity(close)

            rocks(front: false, t: t, cam: cam, orbAt: orbAt, s: s, flash: flash)

            Canvas { g, _ in
                drawDust(&g, t: t, cam: cam, power: CGFloat(s.beam * close))
                drawArcs(&g, t: t, orbAt: orbAt, ring: layout.ring + pedShift, state: s, boost: boost)
                drawReach(&g, t: t, orbAt: orbAt, state: s)
            }
            .blendMode(.plusLighter)

            refraction(s, at: orbAt)
            orb(s, at: orbAt)

            rocks(front: true, t: t, cam: cam, orbAt: orbAt, s: s, flash: flash)

            if s.scatter > 0.01 {
                Canvas { g, _ in
                    drawLights(&g, t: t, now: now, state: s)
                }
                .frame(width: layout.width, height: max(layout.height, layout.screenHeight))
                .blendMode(.plusLighter)
            }

            hotPoint(s, at: orbAt)
            ripple(s, at: orbAt)
            if hint {
                hintRing(t: t, at: orbAt)
            }
        }
    }

    /// What you see through the glass: the world behind the orb, upside down and squeezed, like a
    /// crystal ball. The orb draws over it, half see-through.
    @ViewBuilder
    private func refraction(_ s: OrbStageState, at p: CGPoint) -> some View {
        if s.formed > 0.05 {
            let f = layout.imageFrame
            let squeeze: CGFloat = 0.5
            let ball = layout.sphereRadius * 2
            Image("OrbStage")
                .resizable()
                .frame(width: f.width * squeeze, height: f.height * squeeze)
                .offset(x: (f.width / 2 - (p.x - f.minX)) * squeeze, y: (f.height / 2 - (p.y - f.minY)) * squeeze)
                .scaleEffect(x: -1, y: -1)
                .frame(width: ball, height: ball)
                .clipShape(Circle())
                .saturation(0.5 + 0.5 * s.awake)
                .colorMultiply(Color(red: 0.78, green: 0.96, blue: 0.86))
                .blur(radius: 1)
                .scaleEffect(0.12 + 0.88 * s.formed)
                .opacity(min(1, s.formed * 2) * (0.55 + 0.45 * s.awake) * s.scene)
                .position(p)
        }
    }

    @ViewBuilder
    private func orb(_ s: OrbStageState, at p: CGPoint) -> some View {
        if s.formed > 0.001 {
            FocusOrb(energy: s.energy, size: layout.orbViewSize, touch: touch.map { CGPoint(x: $0.x - p.x, y: $0.y - p.y) })
                .scaleEffect(0.12 + 0.88 * s.formed)
                .opacity(min(1, s.formed * 2.5))
                .blur(radius: (1 - min(1, s.formed)) * 10)
                .position(p)
        }
    }

    /// The tilt of the phone, plus a slow drift like a camera held by hand.
    private func camera(_ t: CGFloat) -> CGSize {
        guard !reduceMotion else { return .zero }
        return CGSize(width: tilt.offset.width + 3 * sin(t * 0.13), height: tilt.offset.height + 2 * sin(t * 0.09 + 1))
    }

    // MARK: The orb forming

    /// The white-hot point the gathered light makes. It hands over to the orb's own core as it forms.
    private func hotPoint(_ s: OrbStageState, at p: CGPoint) -> some View {
        ZStack {
            Circle().fill(Color.fzMint).frame(width: 76 * layout.k, height: 76 * layout.k).blur(radius: 22 * layout.k).opacity(0.75)
            Circle().fill(.white).frame(width: 14 * layout.k, height: 14 * layout.k).blur(radius: 2)
        }
        .scaleEffect(0.3 + 0.7 * s.spark)
        .opacity(max(0, s.spark) * (1 - 0.85 * min(1, s.formed)))
        .blendMode(.plusLighter)
        .position(p)
    }

    /// A ring of light that runs out across the glass as the sphere closes.
    private func ripple(_ s: OrbStageState, at p: CGPoint) -> some View {
        let k = CGFloat(min(max((s.formed - 0.5) / 0.5, 0), 1))
        let size = layout.sphereRadius * 2 * (0.85 + 0.35 * k)
        return Circle()
            .strokeBorder(.white.opacity(0.9), lineWidth: 1.5)
            .frame(width: size, height: size)
            .blur(radius: 1 + 3 * k)
            .opacity(Double(sin(k * .pi)) * 0.85)
            .blendMode(.plusLighter)
            .position(p)
    }

    /// "Touch it": a soft ring that keeps leaving the orb.
    private func hintRing(t: CGFloat, at p: CGPoint) -> some View {
        let phase = (t * 0.6).truncatingRemainder(dividingBy: 1)
        let size = layout.sphereRadius * 2 * (1.04 + 0.4 * phase)
        return Circle()
            .strokeBorder(.white.opacity(0.55 * Double(1 - phase)), lineWidth: 1.5)
            .frame(width: size, height: size)
            .position(p)
    }

    // MARK: Rocks

    @ViewBuilder
    private func rocks(front: Bool, t: CGFloat, cam: CGSize, orbAt: CGPoint, s: OrbStageState, flash: CGFloat) -> some View {
        ForEach(FloatingRock.all.indices, id: \.self) { i in
            let rock = FloatingRock.all[i]
            if rock.front == front {
                floatingRock(rock, t: t, cam: cam, orbAt: orbAt, s: s, flash: flash)
            }
        }
        // The pebble goes round the orb, behind it and then in front.
        let a = t * 0.62
        if (sin(a) > 0) == front {
            pebble(angle: a, cam: cam, orbAt: orbAt, s: s, flash: flash)
        }
    }

    private func floatingRock(_ r: FloatingRock, t: CGFloat, cam: CGSize, orbAt: CGPoint, s: OrbStageState, flash: CGFloat) -> some View {
        let radius = layout.sphereRadius
        let up = fzSmooth(r.from, r.to, CGFloat(s.lift))
        let x = layout.orbCenter.x + r.x * radius + cam.width * r.depth
        let y = layout.orbCenter.y + r.y * radius + sin(t * 0.55 + r.phase) * 0.09 * radius
            + (1 - up) * 1.4 * radius + cam.height * r.depth
        let angle = r.sway * sin(t * 0.21 + r.phase) + (1 - up) * 24
        return lit(r.image, width: r.width * radius, at: CGPoint(x: x, y: y), angle: angle, orbAt: orbAt, s: s, flash: flash)
            .blur(radius: r.blur * layout.k)
            .opacity(Double(up) * s.scene)
    }

    private func pebble(angle a: CGFloat, cam: CGSize, orbAt: CGPoint, s: OrbStageState, flash: CGFloat) -> some View {
        let radius = layout.sphereRadius
        let up = fzSmooth(0.55, 0.85, CGFloat(s.lift))
        let x = orbAt.x + cos(a) * 1.6 * radius + cam.width * 0.05
        let y = orbAt.y + sin(a) * 0.32 * radius - 0.1 * radius + cam.height * 0.05
        return lit("OrbRock5", width: radius * 0.3 * (1 + 0.15 * sin(a)), at: CGPoint(x: x, y: y), angle: a * 20, orbAt: orbAt, s: s, flash: flash)
            .opacity(Double(up) * s.scene)
    }

    /// A rock lit by the orb: brighter the nearer it is, with a mint rim on the edge that faces it.
    private func lit(_ image: String, width: CGFloat, at p: CGPoint, angle: CGFloat, orbAt: CGPoint, s: OrbStageState, flash: CGFloat) -> some View {
        let dx = orbAt.x - p.x, dy = orbAt.y - p.y
        let distance = max(hypot(dx, dy), 1)
        // The way to the orb, in the rock's own (unrotated) frame.
        let back = -angle * .pi / 180
        let toLight = CGPoint(x: (dx * cos(back) - dy * sin(back)) / distance, y: (dx * sin(back) + dy * cos(back)) / distance)
        let near = distance / layout.sphereRadius
        let light = CGFloat(s.formed) * (0.25 + 0.85 * CGFloat(s.energy)) / (1 + near * near * 0.25) + flash * 0.5
        let dim = 0.62 + 0.38 * CGFloat(s.awake)
        return Image(image)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: width)
            .layerEffect(ShaderLibrary.rockLight(.float2(toLight.x, toLight.y), .float(light), .float(dim)),
                         maxSampleOffset: CGSize(width: 8, height: 8))
            .rotationEffect(.degrees(Double(angle)))
            .position(p)
    }

    // MARK: Drawn every frame

    private static func hash(_ i: Int, _ k: Int) -> CGFloat {
        let x = sin(CGFloat(i) * 12.9898 + CGFloat(k) * 78.233) * 43758.5453
        return x - floor(x)
    }

    /// Dust drifting up through the light, at different depths: the near specks bigger, softer and
    /// moving more with the camera.
    private func drawDust(_ g: inout GraphicsContext, t: CGFloat, cam: CGSize, power: CGFloat) {
        guard power > 0.01 else { return }
        let ring = layout.ring
        let spread = layout.topRadii.width * 1.7
        let top = max(0, layout.imageFrame.minY)
        let bottom = layout.baseY + layout.ringRadii.height * 3
        let span = max(bottom - top, 1)
        for i in 0..<44 {
            let h1 = Self.hash(i, 1), h2 = Self.hash(i, 2), h3 = Self.hash(i, 3), h4 = Self.hash(i, 4), h5 = Self.hash(i, 5)
            let inBeam = i % 5 != 0
            let depth: CGFloat = 0.1 + 0.9 * h5
            let x0: CGFloat = inBeam ? ring.x + (h1 - 0.5) * spread : h1 * layout.width
            let rise: CGFloat = h3 * span + t * (4 + 9 * h2)
            let y: CGFloat = bottom - rise.truncatingRemainder(dividingBy: span) + cam.height * depth
            let x: CGFloat = x0 + sin(t * (0.3 + h4 * 0.4) + h1 * 6) * 10 + cam.width * depth
            let size: CGFloat = (0.6 + 1.2 * h4) * (0.6 + 2.2 * depth * depth) * layout.k
            let twinkle: CGFloat = 0.5 + 0.5 * sin(t * (1 + 2 * h2) + h3 * 6.3)
            let edge: CGFloat = max(0, min((y - top) / 40, (bottom - y) / 40, 1))
            let alpha: CGFloat = power * (inBeam ? 0.55 : 0.3) * twinkle * edge * (1.15 - 0.6 * depth)
            let rect = CGRect(x: x - size, y: y - size, width: size * 2, height: size * 2)
            if depth > 0.75 {
                // Out of focus: a soft disc.
                g.fill(Path(ellipseIn: rect), with: .radialGradient(
                    Gradient(colors: [.white.opacity(Double(alpha) * 0.7), .white.opacity(0)]),
                    center: CGPoint(x: x, y: y), startRadius: 0, endRadius: size))
            } else {
                g.fill(Path(ellipseIn: rect.insetBy(dx: size / 2, dy: size / 2)), with: .color(.white.opacity(Double(alpha))))
            }
        }
    }

    /// Lightning from the underside of the orb down into the ring: two at first, four when charged,
    /// all four (thicker, brighter) for a moment after a strike. They re-strike 13 times a second.
    private func drawArcs(_ g: inout GraphicsContext, t: CGFloat, orbAt: CGPoint, ring: CGPoint, state s: OrbStageState, boost: CGFloat) {
        let power = CGFloat(s.arcs)
        guard power > 0.01 else { return }
        let rr = layout.ringRadii
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
            let begin = CGPoint(x: orbAt.x + radius * cos(b), y: orbAt.y + radius * sin(b))
            let strength: CGFloat = power * (0.6 + 0.4 * flicker) * (1 + 1.2 * boost)
            strokeBolt(&g, from: begin, to: end, seed: seed &* 7 &+ i, strength: strength, width: 1 + 0.6 * boost)

            // Where it touches the ring.
            let glow: CGFloat = (9 + 6 * boost) * k
            g.drawLayer { layer in
                layer.addFilter(.blur(radius: glow * 0.6))
                layer.fill(Path(ellipseIn: CGRect(x: end.x - glow, y: end.y - glow * 0.5, width: glow * 2, height: glow)),
                           with: .color(Color.fzMint.opacity(Double(min(1, 0.8 * strength)))))
            }
        }
    }

    /// A finger off the orb: lightning leaves the glass and reaches for it. (On the orb, the lightning
    /// inside bends to it instead: that's in the orb's shader.)
    private func drawReach(_ g: inout GraphicsContext, t: CGFloat, orbAt: CGPoint, state s: OrbStageState) {
        guard let touch, s.formed > 0.5 else { return }
        let dx = touch.x - orbAt.x, dy = touch.y - orbAt.y
        let distance = hypot(dx, dy)
        let radius = layout.sphereRadius
        guard distance > radius * 0.98 else { return }
        let toward = atan2(dy, dx)
        let seed = Int(t * 15)
        for i in 0..<3 {
            let a = toward + (CGFloat(i) - 1) * 0.32
            let begin = CGPoint(x: orbAt.x + cos(a) * radius * 0.97, y: orbAt.y + sin(a) * radius * 0.97)
            let end = CGPoint(x: touch.x + (Self.hash(seed, i + 51) - 0.5) * 10, y: touch.y + (Self.hash(seed, i + 61) - 0.5) * 10)
            strokeBolt(&g, from: begin, to: end, seed: seed &* 3 &+ i, strength: 1.3, width: 1.2)
        }
        let glow = 22 * layout.k
        g.fill(Path(ellipseIn: CGRect(x: touch.x - glow, y: touch.y - glow, width: glow * 2, height: glow * 2)),
               with: .radialGradient(Gradient(colors: [Color.fzMint.opacity(0.8), Color.fzMint.opacity(0)]),
                                     center: touch, startRadius: 0, endRadius: glow))
    }

    private func strokeBolt(_ g: inout GraphicsContext, from begin: CGPoint, to end: CGPoint, seed: Int, strength: CGFloat, width: CGFloat) {
        let k = layout.k
        let points = Self.bolt(from: begin, to: end, seed: seed, jag: 0.2)
        var path = Path()
        path.addLines(points)
        g.drawLayer { layer in
            layer.addFilter(.blur(radius: 3.5 * k))
            layer.stroke(path, with: .color(Color.fzMint.opacity(Double(min(1, 0.7 * strength)))), lineWidth: (3 + 2 * (width - 1)) * k)
        }
        g.stroke(path, with: .color(.white.opacity(Double(min(1, 0.95 * strength)))), lineWidth: width * k)

        // A short fork off the middle now and then.
        if Self.hash(seed, 31) > 0.4 {
            let from = points[points.count / 2]
            let dx = end.x - begin.x, dy = end.y - begin.y
            let side: CGFloat = Self.hash(seed, 41) > 0.5 ? 1 : -1
            let tip = CGPoint(x: from.x + dx * 0.35 - side * dy * 0.25, y: from.y + dy * 0.35 + side * dx * 0.25)
            var fork = Path()
            fork.addLines(Self.bolt(from: from, to: tip, seed: seed &* 5 &+ 3, jag: 0.25))
            g.stroke(fork, with: .color(.white.opacity(Double(min(1, 0.6 * strength)))), lineWidth: 0.8 * k)
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

    /// Your focus, scattered: little lights across the landscape of the wide shot, flickering. When
    /// `gatherAt` is set they rise and stream to the orb's spot, while the camera flies in after them.
    private func drawLights(_ g: inout GraphicsContext, t: CGFloat, now: Date, state s: OrbStageState) {
        let scatter = CGFloat(s.scatter)
        let target = layout.orbInWide
        let elapsed: CGFloat = gatherAt.map { CGFloat(now.timeIntervalSince($0)) } ?? -1
        let d = CGFloat(s.dolly)
        let k = layout.k
        for i in 0..<34 {
            let h1 = Self.hash(i, 21), h2 = Self.hash(i, 22), h3 = Self.hash(i, 23), h4 = Self.hash(i, 24)
            let h5 = Self.hash(i, 25), h6 = Self.hash(i, 26), h7 = Self.hash(i, 27)
            // More of them far away than near.
            let start = CGPoint(x: 70 + h1 * 800, y: 650 + h2 * h2 * 800)
            let near: CGFloat = (start.y - 650) / 800
            // How far it is: where it lies on the ground, then the pedestal's distance as it flies there.
            let startDistance = OrbStageLayout.wideDistance(start)
            var distance = startDistance
            var behindDistance = startDistance
            var at = start
            var behind: CGPoint?
            var alpha: CGFloat = scatter
            if elapsed >= 0 {
                let p = min(max((elapsed - h3 * 0.9) / 1.9, 0), 1)
                if p >= 1 { continue }
                let ctrl = CGPoint(x: (start.x + target.x) / 2 + (h7 - 0.5) * 260, y: min(start.y, target.y) - 120 - h7 * 200)
                func along(_ q: CGFloat) -> CGPoint {
                    let u = 1 - q
                    return CGPoint(x: u * u * start.x + 2 * u * q * ctrl.x + q * q * target.x,
                                   y: u * u * start.y + 2 * u * q * ctrl.y + q * q * target.y)
                }
                let e = p * p * (3 - 2 * p)
                at = along(e)
                behind = along(max(0, e - 0.09))
                distance = startDistance + (1 - startDistance) * e
                behindDistance = startDistance + (1 - startDistance) * max(0, e - 0.09)
                alpha *= 1 - fzSmooth(0.85, 1, p) * 0.6
            }
            // The camera has flown past it.
            if distance <= layout.travelEnd * d + 0.03 { continue }
            let screen = layout.widePoint(at, distance: distance, dolly: d)
            let twinkle: CGFloat = 0.55 + 0.45 * sin(t * (1.3 + h4 * 2.2) + h5 * 6.3)
            let size: CGFloat = (1.6 + 2 * h6) * (0.7 + 0.8 * near) * k
            let a = Double(alpha * twinkle)
            if let behind {
                // A thin trail that fades out behind it.
                let tail = layout.widePoint(behind, distance: max(behindDistance, layout.travelEnd * d + 0.05), dolly: d)
                var streak = Path()
                streak.move(to: tail)
                streak.addLine(to: screen)
                g.stroke(streak, with: .linearGradient(Gradient(colors: [Color.fzMint.opacity(0), Color.fzMint.opacity(0.85 * a)]),
                                                       startPoint: tail, endPoint: screen),
                         style: StrokeStyle(lineWidth: max(0.8, size * 0.45), lineCap: .round))
            }
            let glow = size * 5
            g.fill(Path(ellipseIn: CGRect(x: screen.x - glow, y: screen.y - glow, width: glow * 2, height: glow * 2)),
                   with: .radialGradient(Gradient(colors: [Color.fzMint.opacity(0.5 * a), Color.fzMint.opacity(0)]),
                                         center: screen, startRadius: 0, endRadius: glow))
            g.fill(Path(ellipseIn: CGRect(x: screen.x - size / 2, y: screen.y - size / 2, width: size, height: size)),
                   with: .color(.white.opacity(0.95 * a)))
        }
    }
}

/// A rock that lifts off the ground and floats near the orb as it charges.
private struct FloatingRock {
    let image: String
    /// Where it floats, in sphere radii from the orb's centre.
    let x: CGFloat
    let y: CGFloat
    /// Its width, in sphere radii.
    let width: CGFloat
    /// How near it is, for parallax (the pedestal is about 0.33).
    let depth: CGFloat
    /// How out of focus it is (points on a 6.1" phone).
    let blur: CGFloat
    /// The stretch of `lift` over which it rises.
    let from: CGFloat
    let to: CGFloat
    /// How far it rocks back and forth (degrees).
    let sway: CGFloat
    let phase: CGFloat
    /// In front of the orb (and of everything on the stage) or behind it.
    let front: Bool

    static let all: [FloatingRock] = [
        FloatingRock(image: "OrbRock0", x: -2.3, y: 0.25, width: 0.95, depth: 0.32, blur: 0, from: 0, to: 0.35, sway: 5, phase: 0.3, front: false),
        FloatingRock(image: "OrbRock1", x: 2.25, y: -0.6, width: 0.78, depth: 0.28, blur: 0.6, from: 0.15, to: 0.5, sway: 4, phase: 1.7, front: false),
        FloatingRock(image: "OrbRock4", x: -1.45, y: -1.55, width: 0.62, depth: 0.25, blur: 0.8, from: 0.3, to: 0.65, sway: 8, phase: 2.9, front: false),
        FloatingRock(image: "OrbRock2", x: -1.9, y: 2.5, width: 1.3, depth: 0.75, blur: 3, from: 0.1, to: 0.45, sway: 3, phase: 4.1, front: true),
        FloatingRock(image: "OrbRock3", x: 2.3, y: 1.9, width: 1.15, depth: 0.6, blur: 1.6, from: 0.4, to: 0.8, sway: 3, phase: 5.3, front: true),
    ]
}

/// The phone's tilt, for parallax: up to about 10 points, easing back to the middle when you settle
/// at a new angle. No permission needed (it's the motion sensors, not your activity).
@MainActor
@Observable
final class StageTilt {
    var offset: CGSize = .zero
    @ObservationIgnored private let motion = CMMotionManager()
    @ObservationIgnored private var rest: CMAcceleration?

    func start() {
        guard motion.isDeviceMotionAvailable, !motion.isDeviceMotionActive else { return }
        motion.deviceMotionUpdateInterval = 1.0 / 60
        motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
            guard let gravity = data?.gravity else { return }
            MainActor.assumeIsolated { self?.update(gravity) }
        }
    }

    func stop() {
        motion.stopDeviceMotionUpdates()
    }

    private func update(_ g: CMAcceleration) {
        var r = rest ?? g
        // Slowly forget where "straight" was, so a new way of holding it becomes the middle.
        r.x += (g.x - r.x) * 0.01
        r.y += (g.y - r.y) * 0.01
        rest = r
        // Like looking through a window: tilt right and the near ground slides left.
        let target = CGSize(width: -max(-1, min(1, (g.x - r.x) * 3.5)) * 10, height: -max(-1, min(1, (g.y - r.y) * 3.5)) * 8)
        offset = CGSize(width: offset.width + (target.width - offset.width) * 0.18,
                        height: offset.height + (target.height - offset.height) * 0.18)
    }
}

extension CGSize {
    static func * (size: CGSize, k: CGFloat) -> CGSize { CGSize(width: size.width * k, height: size.height * k) }
}

extension CGPoint {
    static func + (point: CGPoint, size: CGSize) -> CGPoint { CGPoint(x: point.x + size.width, y: point.y + size.height) }
}
