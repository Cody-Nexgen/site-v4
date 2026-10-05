import SwiftUI

// The pieces of `OrbStage`.

/// The wide shot the story opens on: the same pedestal far off in the dark. The camera flies in from
/// it (`OrbStageState.dolly`) through the landscape: `wideFly` grows each point by its own distance,
/// so the near ground rushes past while the far rocks barely move, until the pedestal is exactly
/// where the stage's is.
struct WideShot: View {
    let layout: OrbStageLayout
    let state: OrbStageState
    let cam: CGSize
    let t: CGFloat

    var body: some View {
        let d = CGFloat(state.dolly)
        let c = layout.camera(d)
        let s = layout.wideScale
        let size = CGSize(width: OrbStageLayout.widePixels.width * s, height: OrbStageLayout.widePixels.height * s)
        let origin = layout.wideOriginAtRest
        let speed = 4 * d * (1 - d)
        // Hovering a little, like a camera in flight.
        let anchor = CGPoint(x: c.ring.x - origin.x, y: c.ring.y - origin.y + sin(t * 2.3) * 1.6 * speed)
        let shader = ShaderLibrary.wideFly(
            .float(s),
            .float2(OrbStageLayout.wideRingPixels.x, OrbStageLayout.wideRingPixels.y),
            .float2(anchor.x, anchor.y),
            .float(layout.travelEnd * d),
            .float4(OrbStageLayout.wideHorizonPixels, OrbStageLayout.wideFootPixels, 0, 0),
            .float4(OrbStageLayout.wideRingPixels.x, OrbStageLayout.wideRingPixels.y,
                    OrbStageLayout.wideTopRadiiPixels.width, OrbStageLayout.wideTopRadiiPixels.height),
            .float(speed * 5)
        )
        Image("OrbStageWide")
            .resizable()
            .interpolation(.high)
            .frame(width: size.width, height: size.height)
            .layerEffect(shader, maxSampleOffset: CGSize(width: 24, height: 24))
            .saturation(0.5 + 0.5 * state.awake)
            .colorMultiply(Color(white: 0.62 + 0.38 * state.awake))
            // It's being magnified past its pixels as the camera closes in: let it go soft.
            .blur(radius: max(0, c.zoom - 1.6) * 1.2)
            .opacity(state.scene * Double(1 - fzSmooth(0.6, 0.97, d)))
            .position(x: origin.x + size.width / 2 + cam.width * 0.3, y: origin.y + size.height / 2 + cam.height * 0.3)
    }
}

/// The sky above the stage photo: its top edge carried on up the screen (the light from above with
/// it), so there's never just black above the scene, even pulled down. Graded like the photo.
struct SkyAbove: View {
    let layout: OrbStageLayout
    let awake: Double

    var body: some View {
        let f = layout.imageFrame
        let strip = 24 * layout.k
        let reach = max(f.minY, 0) + 420
        let dim = 0.62 + 0.38 * awake
        Image("OrbStage")
            .resizable()
            .frame(width: f.width, height: f.height)
            .frame(width: f.width, height: strip, alignment: .top)
            .clipped()
            .scaleEffect(x: 1, y: (reach + strip) / strip, anchor: .bottom)
            .blur(radius: 5 * layout.k)
            .saturation(0.5 + 0.5 * awake)
            .colorMultiply(Color(white: dim))
            .mask {
                LinearGradient(colors: [.black.opacity(0.5), .black], startPoint: .top, endPoint: .bottom)
                    .scaleEffect(x: 1, y: (reach + strip) / strip, anchor: .bottom)
            }
            .position(x: f.midX, y: f.minY + strip / 2)
    }
}

/// The stage photo through the world shader (`orbWorld`): lit by the orb, fog drifting, colder while
/// the world is asleep, shifted in depth by the camera, grown by depth when Today is pulled down
/// (`push`, from `pushFrom` in stage points). Faded into black at the top and bottom (and the sides on
/// iPad). While the camera is still flying in, it opens out of the wide shot from the pedestal outwards.
struct StagePhoto: View {
    let layout: OrbStageLayout
    let state: OrbStageState
    let t: CGFloat
    let cam: CGSize
    let flash: CGFloat
    let orbAt: CGPoint
    let pedShift: CGSize
    var push: CGFloat = 0
    var pushFrom: CGPoint = .zero

    var body: some View {
        let s = state
        let d = CGFloat(s.dolly)
        let c = layout.camera(d)
        let pxScale = layout.scale * c.zoom / layout.dollyZoom
        let size = CGSize(width: OrbStageLayout.imagePixels.width * pxScale, height: OrbStageLayout.imagePixels.height * pxScale)
        let origin = CGPoint(x: c.ring.x - OrbStageLayout.ringPixels.x * pxScale, y: c.ring.y - OrbStageLayout.ringPixels.y * pxScale)
        let ring = layout.ring + pedShift
        let reveal = fzSmooth(0.45, 0.95, d)
        // The shader works in 32-bit floats: keep time small (it jumps once every 20 minutes).
        let time = CGFloat(Double(t).truncatingRemainder(dividingBy: 1200))
        let center = UnitPoint(x: OrbStageLayout.ringPixels.x / OrbStageLayout.imagePixels.width,
                               y: OrbStageLayout.ringPixels.y / OrbStageLayout.imagePixels.height)
        let shader = ShaderLibrary.orbWorld(
            .float2(origin.x, origin.y),
            .float(pxScale),
            .float2(cam.width, cam.height),
            .float4(time, CGFloat(s.energy), CGFloat(s.awake), flash),
            .float4(orbAt.x, orbAt.y, layout.sphereRadius, layout.k),
            .float4(ring.x, ring.y, layout.ringRadii.width, layout.ringRadii.height),
            .float4(layout.topRadii.width, layout.topRadii.height, layout.baseY + pedShift.height, layout.horizonY),
            .float4(OrbStageLayout.horizonPixels, OrbStageLayout.imagePixels.height, OrbStageLayout.basePixels, 0),
            .float4(OrbStageLayout.ringPixels.x, OrbStageLayout.ringPixels.y, OrbStageLayout.topRadiiPixels.width, OrbStageLayout.topRadiiPixels.height),
            .float2(CGFloat(max(s.formed, s.spark * 0.5)), CGFloat(s.ring)),
            .float4(pushFrom.x - origin.x, pushFrom.y - origin.y, push, OrbStageLayout.pedestalDepth)
        )
        Image("OrbStage")
            .resizable()
            .interpolation(.high)
            .frame(width: size.width, height: size.height)
            .layerEffect(shader, maxSampleOffset: CGSize(width: 32, height: 32))
            .mask {
                LinearGradient(stops: [
                    .init(color: .clear, location: 0), .init(color: .black, location: 0.05),
                    .init(color: .black, location: 0.68), .init(color: .clear, location: 1),
                ], startPoint: .top, endPoint: .bottom)
            }
            .mask {
                LinearGradient(stops: layout.fillsWidth ? [.init(color: .black, location: 0), .init(color: .black, location: 1)] : [
                    .init(color: .clear, location: 0), .init(color: .black, location: 0.14),
                    .init(color: .black, location: 0.86), .init(color: .clear, location: 1),
                ], startPoint: .leading, endPoint: .trailing)
            }
            .mask {
                RadialGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.7), .init(color: .clear, location: 1)],
                               center: center, startRadius: 0, endRadius: size.width * (0.4 + 3 * reveal))
            }
            .opacity(Double(reveal) * s.scene)
            .position(x: origin.x + size.width / 2, y: origin.y + size.height / 2)
    }
}

/// The night sky above the scene, where the photo goes black: faint stars that twinkle and barely
/// move with the camera (they're far), and a soft haze where the light comes down from. It fades out
/// before the mountain tops.
struct NightSky: View {
    let layout: OrbStageLayout
    let t: CGFloat
    let cam: CGSize
    let awake: Double

    var body: some View {
        let f = layout.imageFrame
        let fadeEnd = f.minY + 70 * layout.k
        Canvas { g, _ in
            // The canvas starts 420 points above the stage.
            g.translateBy(x: 0, y: 420)
            let haze = CGRect(x: layout.width / 2 - layout.width * 0.9, y: f.minY - 420, width: layout.width * 1.8, height: 520)
            g.fill(Path(ellipseIn: haze), with: .radialGradient(
                Gradient(colors: [Color(hex: 0xBFE8D2).opacity(0.05 + 0.05 * awake), .clear]),
                center: CGPoint(x: layout.width / 2, y: f.minY - 160), startRadius: 0, endRadius: layout.width * 0.9))
            for i in 0..<90 {
                let h1 = Self.hash(i, 71), h2 = Self.hash(i, 72), h3 = Self.hash(i, 73), h4 = Self.hash(i, 74)
                let x = h1 * layout.width + cam.width * 0.03
                let y = f.minY - 420 + h2 * (fadeEnd - f.minY + 420) + cam.height * 0.03
                let fade = 1 - fzSmooth(f.minY - 10, fadeEnd, y)
                let twinkle = 0.45 + 0.55 * (0.5 + 0.5 * sin(t * (0.6 + h3 * 1.8) + h4 * 6.3))
                let r = (0.45 + 1.1 * h3 * h3) * layout.k
                let alpha = Double(fade * twinkle) * (0.25 + 0.55 * Double(h4)) * (0.6 + 0.4 * awake)
                g.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)), with: .color(.white.opacity(alpha)))
            }
        }
        .frame(width: layout.width, height: max(fadeEnd, 1) + 420)
        .offset(y: -420)
        .blendMode(.plusLighter)
        .allowsHitTesting(false)
    }

    private static func hash(_ i: Int, _ k: Int) -> CGFloat {
        let x = sin(CGFloat(i) * 12.9898 + CGFloat(k) * 78.233) * 43758.5453
        return x - floor(x)
    }
}

/// A soft shaft of light falling from the top onto the pedestal.
struct LightShaft: View {
    let layout: OrbStageLayout

    var body: some View {
        let ring = layout.ring
        let narrow = layout.topRadii.width * 0.35
        let wide = layout.topRadii.width * 1.05
        let light = Color(hex: 0xDDF5E6)
        // From well above the top of the screen, so pulling the page down never shows its end.
        Path { p in
            p.addLines([
                CGPoint(x: ring.x - narrow * 0.8, y: -420), CGPoint(x: ring.x + narrow * 0.8, y: -420),
                CGPoint(x: ring.x + narrow, y: 0), CGPoint(x: ring.x + wide, y: ring.y),
                CGPoint(x: ring.x - wide, y: ring.y), CGPoint(x: ring.x - narrow, y: 0),
            ])
            p.closeSubpath()
        }
        .fill(LinearGradient(colors: [light.opacity(0.13), light.opacity(0.05), light.opacity(0.1)], startPoint: .top, endPoint: .bottom))
        .blur(radius: 26 * layout.k)
        .blendMode(.plusLighter)
    }
}

/// The pedestal powering on: the groove ring, lit from the front both ways round. (The light it throws
/// on the metal is the world shader's. Its front slits stay dark: lit, they looked like a pause button.)
struct PedestalGlow: View {
    let layout: OrbStageLayout
    var trace: Double
    var power: Double

    var body: some View {
        let ring = layout.ring
        let rr = layout.ringRadii
        let k = layout.k
        let lit = min(max(trace, 0), 1)
        ZStack(alignment: .topLeading) {
            RingTrace(trace: lit)
                .stroke(Color.fzMint.opacity(0.75), style: StrokeStyle(lineWidth: 3.5 * k, lineCap: .round))
                .blur(radius: 3.5 * k)
                .frame(width: rr.width * 2, height: rr.height * 2)
                .position(ring)
                .opacity(power)
            RingTrace(trace: lit)
                .stroke(Color(hex: 0xEFFFF5), style: StrokeStyle(lineWidth: 1.4 * k, lineCap: .round))
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

        }
        .blendMode(.plusLighter)
    }
}

/// The groove ring, lit from the front centre outwards both ways; `trace` 1 is the whole ring.
struct RingTrace: Shape {
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
struct RingFlash: View {
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
