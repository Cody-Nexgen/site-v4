import MetalKit
import SwiftUI

// The orb stage's heavy part as one Metal pass (`StageView.metal`): the photo lit by the orb, the
// rocks, the world in the glass, and the orb. As SwiftUI shader effects they cost a dozen passes a
// frame at 3x (the app ran at a few frames a second); this is one pass at 2x, which soft light and
// fog don't need more than. `OrbStage` uses it whenever `StageGPU.shared` exists and falls back to
// the SwiftUI effects otherwise.

/// What the pass needs for one frame. Matches `StageUniforms` in StageView.metal: every field a
/// float4, so the two layouts can't drift apart.
struct StageUniforms: Equatable {
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
}

func fzFloat4(_ a: CGFloat, _ b: CGFloat, _ c: CGFloat, _ d: CGFloat) -> SIMD4<Float> {
    SIMD4(Float(a), Float(b), Float(c), Float(d))
}

/// A floating rock for the pass, where `OrbStage` would have drawn it.
struct StageRock: Equatable {
    /// Its centre and size on screen (points).
    var center: CGPoint
    var size: CGSize
    /// Degrees, clockwise.
    var angle: CGFloat
    var opacity: Double
    /// How out of focus (points).
    var blur: CGFloat
    /// The way to the orb, a unit vector in the rock's own unrotated frame.
    var toLight: CGPoint
    /// How much of the orb's light reaches it, and how dark the world is around it.
    var light: CGFloat
    var dim: CGFloat
    var front: Bool
    /// OrbRock0...5.
    var texture: Int
}

/// The device, pipeline and textures, made once. Nil if any of it can't be made: the stage then
/// draws itself with SwiftUI shader effects as before.
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

    /// Four float4s a rock, as `fzRocks` in StageView.metal reads them.
    func pack(_ rocks: [StageRock], pixelsPerPoint: CGFloat) -> [SIMD4<Float>] {
        rocks.flatMap { rock -> [SIMD4<Float>] in
            let texture = rockTextures[min(max(rock.texture, 0), rockTextures.count - 1)]
            let angle = rock.angle * .pi / 180
            // The mip level: how many of its pixels land on one of the screen's, then its blur.
            let texelsPerPixel = CGFloat(texture.width) / max(rock.size.width * pixelsPerPoint, 1)
            let level = log2(max(texelsPerPixel, 1)) + log2(1 + rock.blur * pixelsPerPoint)
            return [
                fzFloat4(rock.center.x, rock.center.y, rock.size.width / 2, rock.size.height / 2),
                fzFloat4(cos(angle), sin(angle), CGFloat(rock.opacity), level),
                fzFloat4(rock.toLight.x, rock.toLight.y, rock.light, rock.dim),
                fzFloat4(rock.front ? 1 : 0, CGFloat(rock.texture), 0, 0),
            ]
        }
    }
}

/// The pass in a view. SwiftUI's timeline drives it (one draw per frame of the stage, in step with
/// the vector parts drawn over it), so it stops whenever the stage does.
struct StageMetalView: UIViewRepresentable {
    var uniforms: StageUniforms
    var rocks: [StageRock]

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
        view.isUserInteractionEnabled = false
        view.isPaused = true
        view.enableSetNeedsDisplay = true
        context.coordinator.uniforms = uniforms
        context.coordinator.rocks = rocks
        return view
    }

    func updateUIView(_ view: MTKView, context: Context) {
        context.coordinator.uniforms = uniforms
        context.coordinator.rocks = rocks
        view.setNeedsDisplay()
    }
}

final class StageRenderer: NSObject, MTKViewDelegate {
    var uniforms = StageUniforms()
    var rocks: [StageRock] = []

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    func draw(in view: MTKView) {
        guard let gpu = StageGPU.shared,
              let pass = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let buffer = gpu.queue.makeCommandBuffer(),
              let encoder = buffer.makeRenderCommandEncoder(descriptor: pass) else { return }
        var u = uniforms
        let pixelsPerPoint = view.drawableSize.width / max(view.bounds.width, 1)
        u.view.x = Float(view.drawableSize.width)
        u.view.y = Float(view.drawableSize.height)
        u.view.z = Float(pixelsPerPoint)
        u.camera.z = Float(rocks.count)
        var packed = gpu.pack(rocks, pixelsPerPoint: pixelsPerPoint)
        if packed.isEmpty {
            // The buffer can't be empty.
            packed = [SIMD4<Float>](repeating: .zero, count: 4)
        }
        encoder.setRenderPipelineState(gpu.pipeline)
        encoder.setFragmentBytes(&u, length: MemoryLayout<StageUniforms>.stride, index: 0)
        packed.withUnsafeBytes { bytes in
            if let base = bytes.baseAddress { encoder.setFragmentBytes(base, length: bytes.count, index: 1) }
        }
        encoder.setFragmentTexture(gpu.photo, index: 0)
        for (i, texture) in gpu.rockTextures.enumerated() {
            encoder.setFragmentTexture(texture, index: i + 1)
        }
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()
        buffer.present(drawable)
        buffer.commit()
    }
}
