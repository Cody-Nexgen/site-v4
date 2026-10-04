import SwiftUI

/// Your focus orb: a glass sphere with live electric filaments inside. `energy` (0–1) is how charged
/// it is: more strands, brighter, more crackle.
///
/// First version, drawn in code so the onboarding has it. The detailed electric orb (and the one on
/// the dashboard) comes next and can replace this view without touching the screens that use it.
struct FocusOrb: View, Animatable {
    var energy: Double
    var size: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// So a change to `energy` inside `withAnimation` glides instead of jumping.
    var animatableData: Double {
        get { energy }
        set { energy = newValue }
    }

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            Canvas { g, canvasSize in
                draw(in: &g, size: canvasSize, t: t)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private func draw(in g: inout GraphicsContext, size: CGSize, t: Double) {
        let e = max(0, min(1, energy))
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = min(size.width, size.height) / 2 * 0.8
        let ball = Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
        let mint = Color.fzMint

        // The light it throws around itself.
        g.drawLayer { layer in
            layer.addFilter(.blur(radius: radius * 0.45))
            layer.fill(ball, with: .color(mint.opacity(0.12 + 0.3 * e)))
        }

        // The glass body.
        g.fill(ball, with: .radialGradient(
            Gradient(colors: [Color(hex: 0x10201A), Color(hex: 0x060B09)]),
            center: CGPoint(x: center.x - radius * 0.2, y: center.y - radius * 0.25),
            startRadius: 0,
            endRadius: radius * 1.1
        ))

        // The filaments: rings around the sphere that slowly turn, with electric jitter along them.
        let strands = 6 + Int(e * 6)
        var filaments: [Path] = []
        for i in 0..<strands {
            filaments.append(strand(i, t: t, center: center, radius: radius, energy: e))
        }
        g.drawLayer { layer in
            layer.clip(to: ball)
            layer.blendMode = .plusLighter
            layer.addFilter(.blur(radius: 3.5))
            for path in filaments {
                layer.stroke(path, with: .color(mint.opacity(0.35 + 0.35 * e)), lineWidth: 3)
            }
        }
        g.drawLayer { layer in
            layer.clip(to: ball)
            layer.blendMode = .plusLighter
            for (i, path) in filaments.enumerated() {
                let white = i % 3 == 0
                layer.stroke(path, with: .color((white ? Color.white : mint).opacity(0.45 + 0.4 * e)), lineWidth: white ? 0.9 : 1.2)
            }
        }

        // A bright core that breathes.
        let breathe = 0.5 + 0.5 * sin(t * 1.6)
        let core = radius * (0.16 + 0.1 * e + 0.03 * breathe)
        g.drawLayer { layer in
            layer.addFilter(.blur(radius: core * 0.9))
            layer.fill(Path(ellipseIn: CGRect(x: center.x - core, y: center.y - core, width: core * 2, height: core * 2)), with: .color(Color.white.opacity(0.25 + 0.45 * e)))
        }

        // Glass: a rim and a highlight.
        g.stroke(ball, with: .color(Color.white.opacity(0.18)), lineWidth: 1)
        let highlight = Path(ellipseIn: CGRect(x: center.x - radius * 0.62, y: center.y - radius * 0.78, width: radius * 0.75, height: radius * 0.42))
        g.drawLayer { layer in
            layer.addFilter(.blur(radius: radius * 0.06))
            layer.fill(highlight, with: .linearGradient(
                Gradient(colors: [Color.white.opacity(0.28), Color.white.opacity(0)]),
                startPoint: CGPoint(x: center.x, y: center.y - radius * 0.8),
                endPoint: CGPoint(x: center.x, y: center.y - radius * 0.35)
            ))
        }
    }

    /// One filament: a tilted ring on the sphere, turned over time and projected flat.
    private func strand(_ i: Int, t: Double, center: CGPoint, radius: CGFloat, energy: Double) -> Path {
        let seed = Double(i) * 1.37
        let spinSpeed = 0.18 + 0.05 * Double(i % 4)
        let spin = t * spinSpeed + seed
        let tilt = 0.5 + 0.9 * sin(seed * 2.1 + t * 0.12)
        let shell = 0.55 + 0.4 * (0.5 + 0.5 * sin(seed * 3.3))
        var path = Path()
        let steps = 72
        for step in 0...steps {
            let a = Double(step) / Double(steps) * 2 * .pi
            // A ring, tilted, then turned around the vertical axis.
            let x0 = cos(a)
            let y0 = sin(a) * cos(tilt)
            let z0 = sin(a) * sin(tilt)
            let x = x0 * cos(spin) + z0 * sin(spin)
            // Crackle: fast little wobbles that get stronger with energy.
            let crackle = (sin(a * 17 + t * 11 + seed) * 0.03 + sin(a * 31 - t * 17 + seed * 2) * 0.015) * (0.5 + energy)
            let r = (shell + crackle) * Double(radius)
            let point = CGPoint(x: center.x + CGFloat(x * r), y: center.y + CGFloat(y0 * r))
            if step == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        return path
    }
}
