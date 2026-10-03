import MetalKit
import SwiftUI

/// Where the lighthouse stands and how bright it is. Heights are fractions of the view, measured up
/// from the bottom.
struct LighthouseScene: Equatable {
    /// Lamp brightness: 0.25 is a dim lamp, 1 is the full beam, up to 1.3 for a flash.
    var power: Double = 1
    /// Overall exposure (1 normal, 0 black, above 1 a white-out for the splash exit).
    var exposure: Double = 1
    /// Beam angle at time zero (about 3.3 points it left and slightly away).
    var phase: Double = 3.35
    /// Beam rotation speed (1 is a slow sweep; 0 holds it still).
    var speed: Double = 1
    var x: Double = 0.70
    var waterline: Double = 0.47
    var horizon: Double = 0.52
    var scale: Double = 0.62

    /// Full screen, lighthouse right of centre, room for a headline underneath.
    static let hero = LighthouseScene()
    /// A header strip (Today, onboarding questions).
    static let header = LighthouseScene(power: 0.9, phase: 3.05, x: 0.72, waterline: 0.18, horizon: 0.24, scale: 0.92)
    /// Behind a running session: the clock sits low, over the sea.
    static let session = LighthouseScene(power: 1.05, phase: 3.6, speed: 0.6, x: 0.70, waterline: 0.48, horizon: 0.53, scale: 0.58)

    func with(power: Double) -> LighthouseScene {
        var copy = self
        copy.power = power
        return copy
    }

    /// The lamp, in view coordinates (for things that fly out of it, like the splash exit).
    func lampPoint(in size: CGSize) -> CGPoint {
        CGPoint(x: x * size.width, y: size.height * (1 - (waterline + scale * 0.525)))
    }
}

/// The rendered lighthouse (`Lighthouse.metal`). A Metal view at 60 fps, drawn at a lower internal
/// resolution and smoothed by the screen, so it costs little battery. Changes to `power` and
/// `exposure` glide instead of jumping.
struct LighthouseView: View {
    var scene: LighthouseScene = .hero
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        LighthouseMetalView(scene: scene, lamp: AccentStore.shared.light.rgb, still: reduceMotion, paused: scenePhase != .active)
            .background(Color.black)
            .accessibilityHidden(true)
    }
}

private struct LighthouseMetalView: UIViewRepresentable {
    let scene: LighthouseScene
    let lamp: SIMD3<Float>
    let still: Bool
    let paused: Bool

    func makeCoordinator() -> LighthouseRenderer { LighthouseRenderer() }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: context.coordinator.device)
        view.delegate = context.coordinator
        view.colorPixelFormat = .bgra8Unorm
        view.framebufferOnly = true
        view.preferredFramesPerSecond = 60
        view.contentScaleFactor = 1.5
        view.isOpaque = true
        view.backgroundColor = .black
        view.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
        view.isUserInteractionEnabled = false
        context.coordinator.target = scene
        context.coordinator.current = scene
        return view
    }

    func updateUIView(_ view: MTKView, context: Context) {
        context.coordinator.target = scene
        context.coordinator.lamp = lamp
        context.coordinator.still = still
        view.isPaused = paused
    }
}

/// Matches `FZUniforms` in Lighthouse.metal (64 bytes).
private struct LighthouseUniforms {
    var size: SIMD2<Float>
    var time: Float
    var power: Float
    var phase: Float
    var lx: Float
    var waterline: Float
    var horizon: Float
    var scale: Float
    var exposure: Float
    var lamp: SIMD3<Float>
}

final class LighthouseRenderer: NSObject, MTKViewDelegate {
    let device = MTLCreateSystemDefaultDevice()
    private var queue: MTLCommandQueue?
    private var pipeline: MTLRenderPipelineState?
    var target = LighthouseScene()
    var current = LighthouseScene()
    var lamp = SIMD3<Float>(0.93, 0.91, 0.87)
    var still = false
    private var clock: Double = 0
    private var lastFrame = CACurrentMediaTime()

    override init() {
        super.init()
        guard let device,
              let library = device.makeDefaultLibrary(),
              let vertex = library.makeFunction(name: "fzLighthouseVertex"),
              let fragment = library.makeFunction(name: "fzLighthouseFragment") else { return }
        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertex
        descriptor.fragmentFunction = fragment
        descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        pipeline = try? device.makeRenderPipelineState(descriptor: descriptor)
        queue = device.makeCommandQueue()
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        let now = CACurrentMediaTime()
        let dt = min(0.1, now - lastFrame)
        lastFrame = now
        // Glide toward the target (about 0.35 s to settle), and keep time continuous when speed changes.
        let k = 1 - exp(-dt * 9)
        current.power += (target.power - current.power) * k
        current.exposure += (target.exposure - current.exposure) * k
        current.speed += (target.speed - current.speed) * k
        // Framing glides too, so moving between a full-screen and a header lighthouse is one camera move.
        current.x += (target.x - current.x) * k
        current.waterline += (target.waterline - current.waterline) * k
        current.horizon += (target.horizon - current.horizon) * k
        current.scale += (target.scale - current.scale) * k
        current.phase += (target.phase - current.phase) * k
        clock += still ? 0 : dt * current.speed

        guard let pipeline, let queue,
              let pass = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let buffer = queue.makeCommandBuffer(),
              let encoder = buffer.makeRenderCommandEncoder(descriptor: pass) else { return }
        var uniforms = LighthouseUniforms(
            size: SIMD2(Float(view.drawableSize.width), Float(view.drawableSize.height)),
            time: Float(clock),
            power: Float(current.power),
            phase: Float(current.phase),
            lx: Float(current.x),
            waterline: Float(current.waterline),
            horizon: Float(current.horizon),
            scale: Float(current.scale),
            exposure: Float(current.exposure),
            lamp: lamp
        )
        encoder.setRenderPipelineState(pipeline)
        encoder.setFragmentBytes(&uniforms, length: MemoryLayout<LighthouseUniforms>.stride, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()
        buffer.present(drawable)
        buffer.commit()
    }
}
