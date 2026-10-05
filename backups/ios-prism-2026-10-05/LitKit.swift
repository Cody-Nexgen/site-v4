import SwiftUI

// The pieces of the "lit by the orb" look (2026-10-05, the canvas in docs/ios-lit-look.md). Below the
// orb everything is the same night: dark machined plates whose top edges catch the orb's mint light,
// lines cut into them, light that lives in those grooves (progress, the picked option, the start
// ring, like the ring on the pedestal's top), and small engraved labels like the markings on an
// instrument. Mint is only ever light, never paint. All of it is gradients and strokes: no blur,
// shadow or mask, so none of it costs a pass per frame while it scrolls over the moving stage.

extension Color {
    /// Bone white, for text on the night.
    static let fzNightInk = Color(hex: 0xF2F1EC)
    /// The hottest light: a lit groove's head, a pressed ring.
    static let fzHot = Color(hex: 0xEFFFF5)
    /// The metal, top and bottom.
    static let fzPlateTop = Color(hex: 0x131716)
    static let fzPlateBottom = Color(hex: 0x0A0C0C)
    /// The floor of a groove.
    static let fzGrooveFloor = Color(hex: 0x030404)
    /// The orb's light where it catches an edge: mint, a little whiter.
    static let fzRim = Color(hex: 0xC6FFE0)
}

extension ShapeStyle where Self == LinearGradient {
    /// A big number lit from above: white at the top, the orb's mint-grey at its foot.
    static var fzLitFromAbove: LinearGradient {
        LinearGradient(colors: [.white, Color(hex: 0xA9D9BF)], startPoint: UnitPoint(x: 0.5, y: 0.15), endPoint: .bottom)
    }
}

/// A small label engraved like a marking on an instrument: monospaced capitals, spaced out.
struct Engraved: View {
    let text: String
    var color: Color
    var size: CGFloat

    init(_ text: String, color: Color = Color.fzNightInk.opacity(0.46), size: CGFloat = 10.5) {
        self.text = text
        self.color = color
        self.size = size
    }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: size, weight: .semibold, design: .monospaced))
            .tracking(size * 0.22)
            .foregroundStyle(color)
            .lineLimit(1)
    }
}

/// A machined plate: dark metal, a little lighter at the top, its top edge catching the orb's light.
/// `light` is how much of it reaches the plate (less further from the orb).
struct LitPlate: ViewModifier {
    var cornerRadius: CGFloat = 24
    var light: Double = 1

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        content
            .background {
                shape
                    .fill(LinearGradient(colors: [.fzPlateTop, .fzPlateBottom], startPoint: .top, endPoint: .bottom))
                    .overlay(shape.fill(EllipticalGradient(colors: [Color.fzMint.opacity(0.07 * light), Color.fzMint.opacity(0)],
                                                           center: .top, startRadiusFraction: 0, endRadiusFraction: 0.65)))
            }
            .overlay {
                shape.strokeBorder(LinearGradient(stops: [
                    .init(color: Color.fzRim.opacity(0.2 * light), location: 0),
                    .init(color: .white.opacity(0.05), location: 0.2),
                    .init(color: .white.opacity(0.035), location: 1),
                ], startPoint: .top, endPoint: .bottom), lineWidth: 1)
            }
    }
}

extension View {
    func fzPlate(cornerRadius: CGFloat = 24, light: Double = 1) -> some View {
        modifier(LitPlate(cornerRadius: cornerRadius, light: light))
    }

    /// Something sunk into the metal (a segmented control's track, a switch): a dark floor, its lower lip
    /// catching the light.
    func fzSunk(cornerRadius: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        return background(shape.fill(Color.fzGrooveFloor))
            .overlay(shape.strokeBorder(LinearGradient(colors: [.black, .black.opacity(0.4), .white.opacity(0.08)],
                                                       startPoint: .top, endPoint: .bottom), lineWidth: 1))
    }

    /// Someone focusing right now: a lit ring round their picture.
    func fzLiveRing(_ on: Bool = true) -> some View {
        overlay {
            if on {
                ZStack {
                    Circle().inset(by: -3.5).stroke(Color.fzMint.opacity(0.16), lineWidth: 6)
                    Circle().inset(by: -3.5).stroke(Color.fzMint.opacity(0.85), lineWidth: 1.5)
                }
                .allowsHitTesting(false)
            }
        }
    }
}

/// A line cut into a plate between two parts of it: the dark cut, and its lower (or right) lip
/// catching the light.
struct GrooveLine: View {
    var vertical = false

    var body: some View {
        if vertical {
            HStack(spacing: 0) {
                Color.black.opacity(0.85).frame(width: 1)
                Color.white.opacity(0.05).frame(width: 1)
            }
        } else {
            VStack(spacing: 0) {
                Color.black.opacity(0.85).frame(height: 1)
                Color.white.opacity(0.05).frame(height: 1)
            }
        }
    }
}

/// A groove with light running along it, 0 to 1 (today's goal, a session), and a hot head where the
/// light has got to.
struct LitGroove: View {
    var progress: Double
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            let lit = max(height, width * min(max(progress, 0), 1))
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.fzGrooveFloor)
                    .overlay(Capsule().strokeBorder(LinearGradient(colors: [.black, .white.opacity(0.08)],
                                                                   startPoint: .top, endPoint: .bottom), lineWidth: 1))
                    .frame(height: height)
                // The light's glow: a wider, fainter band (no blur).
                Capsule()
                    .fill(Color.fzMint.opacity(0.16))
                    .frame(width: lit + 6, height: height + 6)
                    .offset(x: -3)
                Capsule()
                    .fill(LinearGradient(colors: [Color.fzMint.opacity(0.25), .fzMint], startPoint: .leading, endPoint: .trailing))
                    .frame(width: lit, height: height - 2)
                Circle()
                    .fill(RadialGradient(colors: [Color.fzMint.opacity(0.55), Color.fzMint.opacity(0)], center: .center,
                                         startRadius: 0, endRadius: 11))
                    .frame(width: 22, height: 22)
                    .offset(x: lit - 11)
                Circle()
                    .fill(Color.fzHot)
                    .frame(width: 10, height: 10)
                    .offset(x: lit - 5)
            }
            .frame(width: width, height: proxy.size.height)
        }
        .frame(height: 22)
        .accessibilityElement()
        .accessibilityValue("\(Int(min(max(progress, 0), 1) * 100)) percent")
    }
}

/// The main action, from the pedestal: a dark machined capsule with a lit ring cut into it, like the
/// groove on the pedestal's top. Pressed, the ring runs hot and more light spills onto the ground
/// under it.
struct FZRingButtonStyle: ButtonStyle {
    var height: CGFloat = 62
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        configuration.label
            .font(.fzDisplay(17, weight: .bold))
            .foregroundStyle(pressed ? Color.white : Color.fzNightInk)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(alignment: .bottom) {
                // The light it throws on the ground.
                Rectangle()
                    .fill(EllipticalGradient(colors: [Color.fzMint.opacity(pressed ? 0.34 : 0.2), Color.fzMint.opacity(0)],
                                             center: .center, startRadiusFraction: 0, endRadiusFraction: 0.5))
                    .frame(height: 44)
                    .padding(.horizontal, pressed ? 14 : 30)
                    .offset(y: 30)
                    .allowsHitTesting(false)
            }
            .background {
                Capsule()
                    .fill(LinearGradient(colors: [Color(hex: pressed ? 0x242A27 : 0x1D2220), Color(hex: 0x0B0D0C)],
                                         startPoint: .top, endPoint: .bottom))
                    .overlay(Capsule().strokeBorder(LinearGradient(colors: [.white.opacity(0.14), .white.opacity(0.02), .black.opacity(0.6)],
                                                                   startPoint: .top, endPoint: .bottom), lineWidth: 1))
                    .overlay(Capsule().stroke(Color.black, lineWidth: 1))
            }
            .overlay {
                ZStack {
                    Capsule().inset(by: 6).stroke(Color.fzMint.opacity(pressed ? 0.3 : 0.12), lineWidth: 7)
                    Capsule().inset(by: 6).stroke(Color.fzMint.opacity(pressed ? 0.5 : 0.22), lineWidth: 3.5)
                    Capsule().inset(by: 6).stroke(pressed ? Color.fzHot : Color.fzMint.opacity(0.8), lineWidth: 1.5)
                }
                .allowsHitTesting(false)
            }
            .opacity(enabled ? 1 : 0.4)
            .contentShape(Capsule())
            .scaleEffect(pressed ? 0.97 : 1)
            .animation(pressed ? .easeOut(duration: 0.15) : .spring(duration: 0.45), value: pressed)
    }
}
