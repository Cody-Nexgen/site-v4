import SceneKit
import SwiftUI
import UIKit

/// Your forest (spec §4.14): a floating low-poly island, one tree per finished session (bigger
/// sessions, bigger trees), real light and shadows. Drag to turn it; it drifts slowly on its own.
struct ForestView: View {
    @Environment(AppModel.self) private var model
    @State private var scene: SCNScene?

    var body: some View {
        ZStack(alignment: .top) {
            SkyBackground(mood: .dawn, intensity: 1.2)
            if let scene {
                SceneView(scene: scene, options: [.allowsCameraControl])
                    .ignoresSafeArea()
                    .transition(.opacity)
            }
            VStack(spacing: 4) {
                Text("\(model.trees.count) trees")
                    .font(.fzHero(44))
                    .foregroundStyle(Color.fzInk)
                    .contentTransition(.numericText())
                Text("One for every session you finish")
                    .font(.subheadline)
                    .foregroundStyle(Color.fzInk2)
            }
            .padding(.top, 20)
            .allowsHitTesting(false)
        }
        .navigationTitle("Forest")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: model.trees.count) {
            let built = ForestScene.make(trees: model.trees)
            withAnimation(.smooth(duration: 0.6)) { scene = built }
        }
    }
}

enum ForestScene {
    static func make(trees: [ForestTree]) -> SCNScene {
        let scene = SCNScene()
        // A soft dusk sky behind the island.
        scene.background.contents = UIGraphicsImageRenderer(size: CGSize(width: 4, height: 256)).image { context in
            let colors = [UIColor(hex: 0x141A33).cgColor, UIColor(hex: 0x6A5A8A).cgColor, UIColor(hex: 0xF0C49A).cgColor] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.55, 1]) {
                context.cgContext.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: 256), options: [])
            }
        }

        let island = SCNNode()
        scene.rootNode.addChildNode(island)

        // Grass top and an earthy underside, a little uneven so it isn't a perfect disc.
        let top = SCNCylinder(radius: 5, height: 0.6)
        top.radialSegmentCount = 14
        top.firstMaterial = material(0x6FBF5A)
        let topNode = SCNNode(geometry: top)
        topNode.scale = SCNVector3(1, 1, 0.82)
        island.addChildNode(topNode)

        let dirt = SCNCone(topRadius: 4.9, bottomRadius: 1.2, height: 2.6)
        dirt.radialSegmentCount = 12
        dirt.firstMaterial = material(0x8A5A3A)
        let dirtNode = SCNNode(geometry: dirt)
        dirtNode.position = SCNVector3(0, -1.6, 0)
        dirtNode.scale = SCNVector3(1, 1, 0.82)
        island.addChildNode(dirtNode)

        // A few rocks and a pond for character.
        for (index, spot) in [(-3.2, 1.6), (3.5, -1.2), (1.0, 3.2)].enumerated() {
            let rock = SCNSphere(radius: 0.32 + 0.1 * Double(index))
            rock.segmentCount = 6
            rock.firstMaterial = material(0x9AA0A6)
            let node = SCNNode(geometry: rock)
            node.position = SCNVector3(Float(spot.0), 0.35, Float(spot.1))
            node.scale = SCNVector3(1.3, 0.7, 1)
            island.addChildNode(node)
        }
        let pond = SCNCylinder(radius: 0.9, height: 0.02)
        pond.radialSegmentCount = 16
        pond.firstMaterial = material(0x5BB8E8, shiny: true)
        let pondNode = SCNNode(geometry: pond)
        pondNode.position = SCNVector3(-1.6, 0.31, -1.8)
        pondNode.scale = SCNVector3(1.4, 1, 1)
        island.addChildNode(pondNode)

        // Trees, spread on a spiral so they don't overlap.
        var random = SeededRandom(seed: 7)
        for (index, tree) in trees.enumerated() {
            let angle = Double(index) * 2.399963
            let radius = 0.9 + 3.4 * (Double(index) + 0.5).squareRoot() / (Double(max(trees.count, 1)) + 0.5).squareRoot()
            let x = Float(cos(angle) * radius + random.next(-0.25, 0.25))
            let z = Float(sin(angle) * radius * 0.8 + random.next(-0.25, 0.25))
            let size = Float(0.55 + min(1.4, Double(tree.minutes) / 60))
            let node = treeNode(kind: tree.kind, size: size, random: &random)
            node.position = SCNVector3(x, 0.3, z)
            node.eulerAngles.y = Float(random.next(0, .pi * 2))
            island.addChildNode(node)
        }

        // Light: warm sun with shadows, soft sky fill.
        let sun = SCNNode()
        sun.light = SCNLight()
        sun.light?.type = .directional
        sun.light?.color = UIColor(red: 1, green: 0.95, blue: 0.85, alpha: 1)
        sun.light?.intensity = 1100
        sun.light?.castsShadow = true
        sun.light?.shadowMode = .deferred
        sun.light?.shadowRadius = 6
        sun.light?.shadowColor = UIColor.black.withAlphaComponent(0.35)
        sun.eulerAngles = SCNVector3(-Float.pi / 3, Float.pi / 5, 0)
        scene.rootNode.addChildNode(sun)

        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.color = UIColor(red: 0.62, green: 0.70, blue: 0.85, alpha: 1)
        ambient.light?.intensity = 420
        scene.rootNode.addChildNode(ambient)

        let camera = SCNNode()
        camera.camera = SCNCamera()
        camera.camera?.fieldOfView = 38
        camera.position = SCNVector3(0, 9, 15)
        camera.look(at: SCNVector3(0, -0.4, 0))
        scene.rootNode.addChildNode(camera)

        // Bob and turn slowly.
        island.runAction(.repeatForever(.rotateBy(x: 0, y: CGFloat.pi * 2, z: 0, duration: 90)))
        let bob = SCNAction.sequence([.moveBy(x: 0, y: 0.25, z: 0, duration: 3), .moveBy(x: 0, y: -0.25, z: 0, duration: 3)])
        bob.timingMode = .easeInEaseOut
        island.runAction(.repeatForever(bob))
        return scene
    }

    /// 0 = pine (stacked cones), 1 = round leafy tree, 2 = birch-like tall tree.
    private static func treeNode(kind: Int, size: Float, random: inout SeededRandom) -> SCNNode {
        let tree = SCNNode()
        let trunkHeight = CGFloat(0.5 * size)
        let trunk = SCNCylinder(radius: CGFloat(0.09 * size), height: trunkHeight)
        trunk.radialSegmentCount = 6
        trunk.firstMaterial = material(kind == 2 ? 0xE8E2D6 : 0x7A4E2E)
        let trunkNode = SCNNode(geometry: trunk)
        trunkNode.position = SCNVector3(0, Float(trunkHeight / 2), 0)
        tree.addChildNode(trunkNode)

        let greens: [UInt32] = [0x2F7D4A, 0x3E9A57, 0x4FAF62, 0x7CC66B]
        let green = greens[Int(random.next(0, Double(greens.count) - 0.01))]
        switch kind {
        case 0:
            for layer in 0..<3 {
                let l = Float(layer)
                let cone = SCNCone(topRadius: 0, bottomRadius: CGFloat((0.55 - 0.13 * l) * size), height: CGFloat(0.7 * size))
                cone.radialSegmentCount = 7
                cone.firstMaterial = material(green)
                let node = SCNNode(geometry: cone)
                node.position = SCNVector3(0, Float(trunkHeight) + (0.25 + 0.38 * l) * size, 0)
                tree.addChildNode(node)
            }
        case 1:
            for blob in 0..<3 {
                let sphere = SCNSphere(radius: CGFloat((0.42 - 0.06 * Float(blob)) * size))
                sphere.segmentCount = 7
                sphere.firstMaterial = material(green)
                let node = SCNNode(geometry: sphere)
                let offsets: [(Float, Float, Float)] = [(0, 0.45, 0), (0.22, 0.3, 0.1), (-0.2, 0.32, -0.12)]
                node.position = SCNVector3(offsets[blob].0 * size, Float(trunkHeight) + offsets[blob].1 * size, offsets[blob].2 * size)
                tree.addChildNode(node)
            }
        default:
            let crown = SCNCapsule(capRadius: CGFloat(0.26 * size), height: CGFloat(1.1 * size))
            crown.radialSegmentCount = 7
            crown.firstMaterial = material(0x8CC96A)
            let node = SCNNode(geometry: crown)
            node.position = SCNVector3(0, Float(trunkHeight) + 0.5 * size, 0)
            tree.addChildNode(node)
        }
        tree.enumerateChildNodes { child, _ in child.castsShadow = true }
        return tree
    }

    /// Flat, matte, slightly faceted: the low-poly look.
    private static func material(_ hex: UInt32, shiny: Bool = false) -> SCNMaterial {
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(hex: hex)
        material.lightingModel = shiny ? .blinn : .lambert
        if shiny { material.specular.contents = UIColor.white.withAlphaComponent(0.6) }
        return material
    }
}

/// Same island layout every time for the same trees.
struct SeededRandom {
    private var state: UInt64

    init(seed: UInt64) { state = seed &* 0x9E3779B97F4A7C15 }

    mutating func next(_ low: Double, _ high: Double) -> Double {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        let unit = Double(state >> 11) / Double(1 << 53)
        return low + (high - low) * unit
    }
}
