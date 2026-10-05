import MetalKit
import SwiftUI

// The orb stage drawn in one Metal pass (`StageView.metal`): the sky and its stars, the photo lit by
// the orb, the light shaft, the ring's glow, the rocks, dust, the lightning, the world in the glass
// and the orb. The pass runs its own 60 fps loop and works out each frame itself (the time, the
// camera, the bolts), so SwiftUI does nothing per frame: it only hands over `StageInputs` when
// something changes. As SwiftUI views and shader effects this was dozens of passes and a view
// rebuild every frame (a few frames a second on an iPhone 15 Pro Max). `OrbStage` falls back to the
// SwiftUI drawing whenever `StageGPU.shared` is nil.

/// What the stage looks like, apart from the time.
struct StageInputs: Equatable {
    var layout: OrbStageLayout
    var state: OrbStageState
    var push: CGFloat
    var look: CGSize
    var touch: CGPoint?
    var struckAt: Date
    /// Reduce Motion: one still frame.
    var still: Bool
}

/// What changes with the time: the camera (the phone's tilt, a slow drift, scrolling), the strike's
/// flash, where the bobbing orb is. The Metal pass and the SwiftUI fallback both use it.
struct StageFrame {
    let t: CGFloat
    let cam: CGSize
    /// A strike: 1 fading to 0 over 0.55 s.
    let boost: CGFloat
    /// How hard the world flashes (a strike, or a finger on the orb).
    let flash: CGFloat
    /// The ring flashing white on a strike.
    let ringFlash: CGFloat
    let pedShift: CGSize
    let orbAt: CGPoint
    /// The camera has arrived at the stage (the pedestal's lights and the orb come on).
    let close: CGFloat

    init(layout: OrbStageLayout, state s: OrbStageState, now: Date, tilt: CGSize, look: CGSize, still: Bool,
         struckAt: Date, touch: CGPoint?) {
        // Absolute time, so a second stage (Today, after the onboarding) picks up where this was.
        t = CGFloat(still ? 0 : now.timeIntervalSinceReferenceDate)
        // The tilt of the phone, plus a slow drift like a camera held by hand.
        let lookY = min(max(look.height, -14), 14)
        cam = still ? CGSize(width: 0, height: lookY)
            : CGSize(width: tilt.width + 3 * sin(t * 0.13), height: tilt.height + 2 * sin(t * 0.09 + 1) + lookY)
        let since = now.timeIntervalSince(struckAt)
        boost = CGFloat(max(0, 1 - since / 0.55))
        flash = max(boost, touch == nil ? 0 : 0.3 + 0.2 * sin(t * 37))
        ringFlash = since < 0.06 ? CGFloat(0.9 * max(0, since) / 0.06) : 0.9 * (1 - fzSmooth(0, 1, CGFloat((since - 0.06) / 0.7)))
        pedShift = cam * OrbStageLayout.pedestalDepth
        let bob = sin(t * 1.15) * 3 * CGFloat(s.formed)
        let lead = OrbStageLayout.pedestalDepth + 0.08
        orbAt = CGPoint(x: layout.orbCenter.x + cam.width * lead, y: layout.orbCenter.y + bob + cam.height * lead)
        close = fzSmooth(0.9, 1.0, CGFloat(s.dolly))
    }
}

/// A speck of dust in the light.
struct DustSpeck {
    var center: CGPoint
    var size: CGFloat
    var alpha: CGFloat
    /// Out of focus: a soft disc instead of a dot.
    var soft: Bool
}

/// A lightning bolt: its jagged line, sometimes a short fork off its middle, how bright and how thick.
struct Bolt {
    var points: [CGPoint]
    var fork: [CGPoint]
    var strength: CGFloat
    var width: CGFloat
}

/// A soft spot of light: where a bolt touches the ring (squashed onto its plane), or round a finger.
struct GlowSpot {
    var center: CGPoint
    var radius: CGFloat
    var alpha: CGFloat
    var squash: Bool
}

/// What the pass needs for one frame, besides the arrays. Matches `StageUniforms` in StageView.metal:
/// every field a float4, so the two layouts can't drift apart.
struct StageUniforms {
    var view = SIMD4<Float>.zero
    var photo = SIMD4<Float>.zero
    var fade = SIMD4<Float>.zero
    var camera = SIMD4<Float>.zero
    var state = SIMD4<Float>.zero
    var orb = SIMD4<Float>.zero
    var ring = SIMD4<Float>.zero
    var top = SIMD4<Float>.zero
    var depthPx = SIMD4<Float>.zero
    var pedPx = SIMD4<Float>.zero
    var push = SIMD4<Float>.zero
    var orbView = SIMD4<Float>.zero
    var touch = SIMD4<Float>.zero
    var glass = SIMD4<Float>.zero
    var sky = SIMD4<Float>.zero
    var shaft = SIMD4<Float>.zero
    var glow = SIMD4<Float>.zero
    var counts = SIMD4<Float>.zero
    var boltBox = SIMD4<Float>.zero
    var dustBox = SIMD4<Float>.zero
}

func fzFloat4(_ a: CGFloat, _ b: CGFloat, _ c: CGFloat, _ d: CGFloat) -> SIMD4<Float> {
    SIMD4(Float(a), Float(b), Float(c), Float(d))
}

/// A floating rock for the pass.
struct StageRock {
    var center: CGPoint
    var size: CGSize
    /// Degrees, clockwise.
    var angle: CGFloat
    var opacity: Double
    /// How out of focus (points).
    var blur: CGFloat
    /// The way to the orb, a unit vector in the rock's own unrotated frame.
    var toLight: CGPoint
    var light: CGFloat
    var dim: CGFloat
    var front: Bool
    /// OrbRock0...5.
    var texture: Int
}

extension StageInputs {
    /// The point the push grows things from: the middle of the pedestal's top.
    var pushFrom: CGPoint { layout.ring }

    /// How much bigger something at `depth` is with the push (`fzPushZoom` in OrbShared.h).
    func pushZoom(_ depth: CGFloat) -> CGFloat {
        1 + push * min(depth / OrbStageLayout.pedestalDepth, 1.8)
    }

    /// The uniforms for a frame (the counts and boxes are filled in by the renderer).
    func uniforms(_ f: StageFrame) -> StageUniforms {
        let s = state
        let d = CGFloat(s.dolly)
        let c = layout.camera(d)
        let pxScale = layout.scale * c.zoom / layout.dollyZoom
        let size = CGSize(width: OrbStageLayout.imagePixels.width * pxScale, height: OrbStageLayout.imagePixels.height * pxScale)
        let origin = CGPoint(x: c.ring.x - OrbStageLayout.ringPixels.x * pxScale, y: c.ring.y - OrbStageLayout.ringPixels.y * pxScale)
        let ring = layout.ring + f.pedShift
        let reveal = fzSmooth(0.45, 0.95, d)
        // 32-bit floats in the shader: keep time small (it jumps once every 20 minutes).
        let time = CGFloat(Double(f.t).truncatingRemainder(dividingBy: 1200))
        let finger = touch.map { CGPoint(x: $0.x - f.orbAt.x, y: $0.y - f.orbAt.y) }
        let awake = CGFloat(s.awake)
        let scene = CGFloat(s.scene)
        let frame = layout.imageFrame
        var u = StageUniforms()
        u.view = fzFloat4(0, 0, 0, time)
        u.photo = fzFloat4(origin.x, origin.y, pxScale, reveal * scene)
        u.fade = fzFloat4(size.width, size.height, layout.fillsWidth ? 0 : 1, size.width * (0.4 + 3 * reveal))
        u.camera = fzFloat4(f.cam.width, f.cam.height, 0, 0)
        u.state = fzFloat4(CGFloat(s.energy), awake, f.flash, CGFloat(max(s.formed, s.spark * 0.5)))
        u.orb = fzFloat4(f.orbAt.x, f.orbAt.y, layout.sphereRadius, layout.k)
        u.ring = fzFloat4(ring.x, ring.y, layout.ringRadii.width, layout.ringRadii.height)
        u.top = fzFloat4(layout.topRadii.width, layout.topRadii.height, layout.baseY + f.pedShift.height, layout.horizonY)
        u.depthPx = fzFloat4(OrbStageLayout.horizonPixels, OrbStageLayout.imagePixels.height, OrbStageLayout.basePixels, 0)
        u.pedPx = fzFloat4(OrbStageLayout.ringPixels.x, OrbStageLayout.ringPixels.y,
                           OrbStageLayout.topRadiiPixels.width, OrbStageLayout.topRadiiPixels.height)
        u.push = fzFloat4(pushFrom.x, pushFrom.y, push, OrbStageLayout.pedestalDepth)
        u.orbView = fzFloat4(layout.orbViewSize * 1.5, CGFloat(s.formed), CGFloat(s.ring), layout.width)
        u.touch = fzFloat4(finger?.x ?? 0, finger?.y ?? 0, finger == nil ? 0 : 1, 0)
        u.glass = fzFloat4((0.55 + 0.45 * awake) * scene, 0.5 + 0.5 * awake, 0, 0)
        // The sky above the photo (its top edge carried up) and the stars: the stage's photo frame.
        u.sky = fzFloat4(frame.minX, frame.width, frame.minY, f.close * scene)
        u.shaft = fzFloat4(CGFloat(s.beam) * (0.4 + 0.6 * awake) * f.close, f.cam.width * 0.1, f.cam.height * 0.1, 0)
        u.glow = fzFloat4(CGFloat(s.ring), (0.45 + 0.55 * CGFloat(s.energy)) * f.close, f.ringFlash * f.close, 0)
        return u
    }

    /// The rocks, where the SwiftUI fallback would draw them.
    func rocks(_ f: StageFrame, aspect: [CGFloat]) -> [StageRock] {
        let s = state
        let radius = layout.sphereRadius
        var list: [StageRock] = []
        for r in FloatingRock.all {
            let up = fzSmooth(r.from, r.to, CGFloat(s.lift))
            let opacity = Double(up) * s.scene
            guard opacity > 0.002 else { continue }
            let x = layout.orbCenter.x + r.x * radius + f.cam.width * r.depth
            let y = layout.orbCenter.y + r.y * radius + sin(f.t * 0.55 + r.phase) * 0.09 * radius
                + (1 - up) * 1.4 * radius + f.cam.height * r.depth
            let angle = r.sway * sin(f.t * 0.21 + r.phase) + (1 - up) * 24
            let index = Int(r.image.dropFirst("OrbRock".count)) ?? 0
            list.append(rock(index, width: r.width * radius, aspect: aspect[index], at: CGPoint(x: x, y: y), angle: angle,
                             f: f, opacity: opacity, blur: r.blur * layout.k, zoom: pushZoom(r.depth), front: r.front))
        }
        // The pebble going round the orb: behind it, then in front.
        let a = f.t * 0.62
        let up = fzSmooth(0.55, 0.85, CGFloat(s.lift))
        let opacity = Double(up) * s.scene
        if opacity > 0.002 {
            let x = f.orbAt.x + cos(a) * 1.6 * radius + f.cam.width * 0.05
            let y = f.orbAt.y + sin(a) * 0.32 * radius - 0.1 * radius + f.cam.height * 0.05
            list.append(rock(5, width: radius * 0.3 * (1 + 0.15 * sin(a)), aspect: aspect[5], at: CGPoint(x: x, y: y),
                             angle: a * 20, f: f, opacity: opacity, blur: 0, zoom: 1 + push, front: sin(a) > 0))
        }
        return list
    }

    /// One rock, lit by the orb (brighter the nearer it is), grown by the push.
    private func rock(_ index: Int, width: CGFloat, aspect: CGFloat, at p: CGPoint, angle: CGFloat, f: StageFrame,
                      opacity: Double, blur: CGFloat, zoom: CGFloat, front: Bool) -> StageRock {
        let s = state
        let dx = f.orbAt.x - p.x, dy = f.orbAt.y - p.y
        let distance = max(hypot(dx, dy), 1)
        let back = -angle * .pi / 180
        let toLight = CGPoint(x: (dx * cos(back) - dy * sin(back)) / distance, y: (dx * sin(back) + dy * cos(back)) / distance)
        let near = distance / layout.sphereRadius
        let light = CGFloat(s.formed) * (0.25 + 0.85 * CGFloat(s.energy)) / (1 + near * near * 0.25) + f.flash * 0.5
        let from = pushFrom
        return StageRock(center: CGPoint(x: from.x + (p.x - from.x) * zoom, y: from.y + (p.y - from.y) * zoom),
                         size: CGSize(width: width * zoom, height: width * aspect * zoom), angle: angle, opacity: opacity,
                         blur: blur, toLight: toLight, light: light, dim: 0.62 + 0.38 * CGFloat(s.awake), front: front,
                         texture: index)
    }
}

/// The device, pipeline and textures, made once. Nil if any of it can't be made: the stage then
/// draws itself with SwiftUI as before.
final class StageGPU {
    static let shared: StageGPU? = StageGPU()

    let device: MTLDevice
    let queue: MTLCommandQueue
    let pipeline: MTLRenderPipelineState
    let photo: MTLTexture
    let rockTextures: [MTLTexture]
    /// Each rock image's height over its width.
    let rockAspect: [CGFloat]

    private init?() {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue(),
              let library = device.makeDefaultLibrary(),
              let vertex = library.makeFunction(name: "fzStageVertex"),
              let fragment = library.makeFunction(name: "fzStageFragment") else { return nil }
        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertex
        descriptor.fragmentFunction = fragment
        descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        guard let pipeline = try? device.makeRenderPipelineState(descriptor: descriptor) else { return nil }

        let loader = MTKTextureLoader(device: device)
        // Not sRGB: the shaders work on the photo's own (gamma) values, like the SwiftUI effects did.
        let options: [MTKTextureLoader.Option: Any] = [.SRGB: false, .generateMipmaps: true]
        func load(_ name: String) -> MTLTexture? {
            if let texture = try? loader.newTexture(name: name, scaleFactor: 1, bundle: .main, options: options) {
                return texture
            }
            guard let image = UIImage(named: name)?.cgImage else { return nil }
            return try? loader.newTexture(cgImage: image, options: options)
        }
        guard let photo = load("OrbStage") else { return nil }
        let rocks = (0..<6).compactMap { load("OrbRock\($0)") }
        guard rocks.count == 6 else { return nil }

        self.device = device
        self.queue = queue
        self.pipeline = pipeline
        self.photo = photo
        self.rockTextures = rocks
        self.rockAspect = rocks.map { CGFloat($0.height) / CGFloat(max($0.width, 1)) }
    }
}

/// The pass in a view. It runs its own 60 fps loop (paused off screen or with Reduce Motion, when it
/// draws only when its inputs change).
struct StageMetalView: UIViewRepresentable {
    var inputs: StageInputs
    var tilt: StageTilt
    var paused: Bool

    func makeCoordinator() -> StageRenderer { StageRenderer() }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: StageGPU.shared?.device)
        view.delegate = context.coordinator
        view.colorPixelFormat = .bgra8Unorm
        view.framebufferOnly = true
        view.isOpaque = false
        view.backgroundColor = .clear
        view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        // 2x: less than half the pixels of 3x, and soft light and fog look the same.
        view.contentScaleFactor = 2
        view.preferredFramesPerSecond = 60
        view.isUserInteractionEnabled = false
        context.coordinator.inputs = inputs
        context.coordinator.tilt = tilt
        apply(to: view)
        return view
    }

    func updateUIView(_ view: MTKView, context: Context) {
        context.coordinator.inputs = inputs
        context.coordinator.tilt = tilt
        apply(to: view)
    }

    private func apply(to view: MTKView) {
        let hold = paused || inputs.still
        view.enableSetNeedsDisplay = hold
        view.isPaused = hold
        if hold { view.setNeedsDisplay() }
    }
}

final class StageRenderer: NSObject, MTKViewDelegate {
    var inputs: StageInputs?
    var tilt: StageTilt?
    /// Three buffers for the per-frame arrays, used in turn so the GPU never reads one being written.
    private var buffers: [MTLBuffer] = []
    private var slot = 0
    private static let capacity = 1024

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard let gpu = StageGPU.shared, let inputs else { return }
        let began = CACurrentMediaTime()
        if buffers.isEmpty {
            buffers = (0..<3).compactMap { _ in
                gpu.device.makeBuffer(length: Self.capacity * MemoryLayout<SIMD4<Float>>.stride, options: .storageModeShared)
            }
            guard buffers.count == 3 else { return }
        }
        guard let pass = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let commands = gpu.queue.makeCommandBuffer(),
              let encoder = commands.makeRenderCommandEncoder(descriptor: pass) else { return }

        let layout = inputs.layout
        let s = inputs.state
        let f = StageFrame(layout: layout, state: s, now: .now, tilt: tilt?.offset ?? .zero, look: inputs.look,
                           still: inputs.still, struckAt: inputs.struckAt, touch: inputs.touch)
        var u = inputs.uniforms(f)
        let pixelsPerPoint = view.drawableSize.width / max(view.bounds.width, 1)
        u.view.x = Float(view.drawableSize.width)
        u.view.y = Float(view.drawableSize.height)
        u.view.z = Float(pixelsPerPoint)

        // Everything per frame in one array: rocks (4 each), dust (1 each), bolt segments (2 each),
        // glow spots (1 each). StageView.metal finds each by the counts.
        var items: [SIMD4<Float>] = []
        items.reserveCapacity(Self.capacity)
        let rocks = inputs.rocks(f, aspect: gpu.rockAspect)
        for rock in rocks {
            let angle = rock.angle * .pi / 180
            let texture = gpu.rockTextures[min(max(rock.texture, 0), gpu.rockTextures.count - 1)]
            // The mip level: how many of its pixels land on one of the screen's, then its blur.
            let texelsPerPixel = CGFloat(texture.width) / max(rock.size.width * pixelsPerPoint, 1)
            let level = log2(max(texelsPerPixel, 1)) + log2(1 + rock.blur * pixelsPerPoint)
            items.append(fzFloat4(rock.center.x, rock.center.y, rock.size.width / 2, rock.size.height / 2))
            items.append(fzFloat4(cos(angle), sin(angle), CGFloat(rock.opacity), level))
            items.append(fzFloat4(rock.toLight.x, rock.toLight.y, rock.light, rock.dim))
            items.append(fzFloat4(rock.front ? 1 : 0, CGFloat(rock.texture), 0, 0))
        }
        let dust = OrbStage.dust(layout, t: f.t, cam: f.cam, power: CGFloat(s.beam) * f.close)
        var dustTop = CGFloat.greatestFiniteMagnitude, dustBottom = -CGFloat.greatestFiniteMagnitude
        for speck in dust {
            items.append(fzFloat4(speck.center.x, speck.center.y, speck.size, speck.soft ? -speck.alpha : speck.alpha))
            dustTop = min(dustTop, speck.center.y - speck.size)
            dustBottom = max(dustBottom, speck.center.y + speck.size)
        }
        let arcs = OrbStage.arcs(layout, t: f.t, orbAt: f.orbAt, ring: layout.ring + f.pedShift, state: s, boost: f.boost)
        let reach = OrbStage.reach(layout, t: f.t, orbAt: f.orbAt, touch: inputs.touch, state: s)
        var box = CGRect.null
        var segments = 0
        for bolt in arcs.bolts + reach.bolts {
            let reachOut = (3 + 2 * (bolt.width - 1)) * layout.k * 1.5 + 2
            for (line, fork) in [(bolt.points, 0 as CGFloat), (bolt.fork, 1)] where line.count > 1 {
                for i in 0..<(line.count - 1) where items.count + 2 + 8 < Self.capacity {
                    let a = line[i], b = line[i + 1]
                    items.append(fzFloat4(a.x, a.y, b.x, b.y))
                    items.append(fzFloat4(bolt.strength, bolt.width, fork, 0))
                    box = box.union(CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(b.x - a.x), height: abs(b.y - a.y))
                        .insetBy(dx: -reachOut, dy: -reachOut))
                    segments += 1
                }
            }
        }
        let spots = arcs.spots + reach.spots
        for spot in spots {
            items.append(fzFloat4(spot.center.x, spot.center.y, spot.squash ? -spot.radius : spot.radius, spot.alpha))
            box = box.union(CGRect(x: spot.center.x - spot.radius, y: spot.center.y - spot.radius, width: spot.radius * 2, height: spot.radius * 2))
        }
        u.counts = fzFloat4(CGFloat(rocks.count), CGFloat(dust.count), CGFloat(segments), CGFloat(spots.count))
        u.boltBox = box.isNull ? fzFloat4(0, 0, -1, -1) : fzFloat4(box.minX, box.minY, box.maxX, box.maxY)
        u.dustBox = dust.isEmpty ? fzFloat4(0, -1, 0, 0) : fzFloat4(dustTop, dustBottom, 0, 0)

        slot = (slot + 1) % buffers.count
        let buffer = buffers[slot]
        if !items.isEmpty {
            items.withUnsafeBytes { bytes in
                if let base = bytes.baseAddress {
                    buffer.contents().copyMemory(from: base, byteCount: min(bytes.count, buffer.length))
                }
            }
        }

        encoder.setRenderPipelineState(gpu.pipeline)
        encoder.setFragmentBytes(&u, length: MemoryLayout<StageUniforms>.stride, index: 0)
        encoder.setFragmentBuffer(buffer, offset: 0, index: 1)
        encoder.setFragmentTexture(gpu.photo, index: 0)
        for (i, texture) in gpu.rockTextures.enumerated() {
            encoder.setFragmentTexture(texture, index: i + 1)
        }
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()
        commands.present(drawable)
        // For Developer mode's frame-rate readout (FrameRateMeter.swift).
        commands.addCompletedHandler { done in
            let gpuTime = done.gpuEndTime - done.gpuStartTime
            if gpuTime > 0 {
                StageStats.gpuSeconds += gpuTime
                StageStats.gpuFrames += 1
            }
        }
        commands.commit()
        StageStats.frames += 1
        StageStats.cpuSeconds += CACurrentMediaTime() - began
    }
}
