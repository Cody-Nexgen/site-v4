import SwiftUI

// The pieces of `OrbStage`.

/// The wide shot the story opens on: the same pedestal far off in the dark. The camera flies in from
/// it (`OrbStageState.dolly`), magnifying it until its pedestal is exactly where the stage's is.
struct WideShot: View {
    let layout: OrbStageLayout
    let state: OrbStageState
    let cam: CGSize

    var body: some View {
        let d = CGFloat(state.dolly)
        let c = layout.camera(d)
        let s = layout.wideScale * c.zoom
        let size = CGSize(width: OrbStageLayout.widePixels.width * s, height: OrbStageLayout.widePixels.height * s)
        let origin = CGPoint(x: c.ring.x - OrbStageLayout.wideRingPixels.x * s, y: c.ring.y - OrbStageLayout.wideRingPixels.y * s)
        Image("OrbStageWide")
            .resizable()
            .interpolation(.high)
            .frame(width: size.width, height: size.height)
            .saturation(0.55 + 0.45 * state.awake)
            .brightness(-0.1 * (1 - state.awake))
            // It's being magnified past its pixels as the camera closes in: let it go soft.
            .blur(radius: max(0, c.zoom - 1.5) * 1.6)
            .opacity(state.scene * Double(1 - fzSmooth(0.6, 0.97, d)))
            .position(x: origin.x + size.width / 2 + cam.width * 0.3, y: origin.y + size.height / 2 + cam.height * 0.3)
    }
}

/// The stage photo through the world shader (`orbWorld`): lit by the orb, fog drifting, colder while
/// the world is asleep, shifted in depth by the camera. Faded into black at the top and bottom (and
/// the sides on iPad). While the camera is still flying in, it opens out of the wide shot from the
/// pedestal outwards.
struct StagePhoto: View {
    let layout: OrbStageLayout
    let state: OrbStageState
    let t: CGFloat
    let cam: CGSize
    let flash: CGFloat
    let orbAt: CGPoint
    let pedShift: CGSize

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
            .float2(CGFloat(max(s.formed, s.spark * 0.5)), CGFloat(s.ring))
        )
        Image("OrbStage")
            .resizable()
            .interpolation(.high)
            .frame(width: size.width, height: size.height)
            .layerEffect(shader, maxSampleOffset: CGSize(width: 16, height: 16))
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
            .mask {
                RadialGradient(stops: [.init(color: .black, location: 0), .init(color: .black, location: 0.7), .init(color: .clear, location: 1)],
                               center: center, startRadius: 0, endRadius: size.width * (0.4 + 3 * reveal))
            }
            .opacity(Double(reveal) * s.scene)
            .position(x: origin.x + size.width / 2, y: origin.y + size.height / 2)
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

/// The pedestal powering on: the groove ring, lit from the front both ways round, and its front
/// slits. (The light they throw on the metal is the world shader's.)
struct PedestalGlow: View {
    let layout: OrbStageLayout
    var trace: Double
    var power: Double

    var body: some View {
        let ring = layout.ring
        let rr = layout.ringRadii
        let k = layout.k
        let lit = min(max(trace, 0), 1)
        let slitsOn = min(max((lit - 0.35) / 0.4, 0), 1)
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

            ForEach(Array(layout.slits.enumerated()), id: \.offset) { _, slit in
                let size = layout.slitSize
                ZStack {
                    RoundedRectangle(cornerRadius: 2 * k)
                        .fill(Color.fzMint)
                        .frame(width: size.width * 2.2, height: size.height * 1.3)
                        .blur(radius: 5 * k)
                        .opacity(0.6)
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
