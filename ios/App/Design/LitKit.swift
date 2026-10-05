import SwiftUI

// The pieces of the "lit by the orb" look (2026-10-05, docs/ios-lit-look.md). Below the orb everything
// is the same night: dark machined plates that catch the orb's light, lines cut into them, and light
// that lives in those grooves (progress, the picked option, the start ring, like the ring on the
// pedestal's top). The orb's light comes through its glass split into a prism (mint, aqua, periwinkle,
// violet, rose: `fzPrism` in OrbShared.h), so the light everywhere carries those colours. Labels are
// Satoshi in sentence case, never grey monospaced capitals. All of it is gradients and strokes: no
// blur, shadow or mask, so none of it costs a pass per frame while it scrolls over the moving stage.

extension Color {
    /// Bone white, for text on the night.
    static let fzNightInk = Color(hex: 0xF2F1EC)
    /// The hottest light: a lit groove's head, a pressed ring.
    static let fzHot = Color(hex: 0xEFFFF5)
    /// The metal, top and bottom.
    static let fzPlateTop = Color(hex: 0x141817)
    static let fzPlateBottom = Color(hex: 0x0A0C0C)
    /// The floor of a groove.
    static let fzGrooveFloor = Color(hex: 0x030404)

    // The prism, after the mint (`fzMint`): the orb's light split by its glass.
    static let fzAqua = Color(hex: 0x7DE3F2)
    static let fzPeri = Color(hex: 0x8FA8FF)
    static let fzViolet = Color(hex: 0xBD99FF)
    static let fzRose = Color(hex: 0xFF99C7)

    /// Mint to rose, in order.
    static let fzPrism: [Color] = [.fzMint, .fzAqua, .fzPeri, .fzViolet, .fzRose]
}

extension ShapeStyle where Self == LinearGradient {
    /// A big number lit from above through the orb's glass: white at the top, a little aqua and violet
    /// at its foot.
    static var fzLitFromAbove: LinearGradient {
        LinearGradient(stops: [
            .init(color: .white, location: 0.15),
            .init(color: Color(hex: 0xD3F4F8), location: 0.6),
            .init(color: Color(hex: 0xCDBDFF), location: 1),
        ], startPoint: .top, endPoint: .bottom)
    }

    /// The prism across a line, left to right.
    static var fzPrismLine: LinearGradient {
        LinearGradient(colors: Color.fzPrism, startPoint: .leading, endPoint: .trailing)
    }
}

extension ShapeStyle where Self == AngularGradient {
    /// The prism all the way round (a ring, someone focusing).
    static var fzPrismRing: AngularGradient {
        AngularGradient(colors: Color.fzPrism + [.fzViolet, .fzPeri, .fzAqua, .fzMint], center: .center)
    }
}

/// A small label: Satoshi, sentence case. Its colour says what it is (the prism's colours for kinds of
/// things, bone for the rest), never grey capitals.
struct LitCaption: View {
    let text: String
    var color: Color
    var size: CGFloat

    init(_ text: String, color: Color = Color.fzNightInk.opacity(0.72), size: CGFloat = 13) {
        self.text = text
        self.color = color
        self.size = size
    }

    var body: some View {
        Text(text)
            .font(.fzDisplay(size, weight: .bold))
            .foregroundStyle(color)
            .lineLimit(1)
    }
}

/// A section's title on the night: "Today", "Your day".
struct LitHeading: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.fzDisplay(20, weight: .bold))
            .fzTight(20)
            .foregroundStyle(Color.fzNightInk)
    }
}

/// A machined plate: dark metal, a little lighter at the top, with the orb's split light falling on its
/// top edge (aqua on the left, violet on the right). `light` is how much reaches it.
struct LitPlate: ViewModifier {
    var cornerRadius: CGFloat = 24
    var light: Double = 1

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        content
            .background {
                shape
                    .fill(LinearGradient(colors: [.fzPlateTop, .fzPlateBottom], startPoint: .top, endPoint: .bottom))
                    .overlay(shape.fill(EllipticalGradient(colors: [Color.fzAqua.opacity(0.09 * light), Color.fzAqua.opacity(0)],
                                                           center: UnitPoint(x: 0.2, y: 0), startRadiusFraction: 0, endRadiusFraction: 0.55)))
                    .overlay(shape.fill(EllipticalGradient(colors: [Color.fzViolet.opacity(0.08 * light), Color.fzViolet.opacity(0)],
                                                           center: UnitPoint(x: 0.85, y: 0), startRadiusFraction: 0, endRadiusFraction: 0.5)))
            }
            .overlay {
                // The rim: the prism along the top edge, fading down the sides.
                shape.strokeBorder(LinearGradient(colors: [Color.fzMint.opacity(0.32 * light), Color.fzAqua.opacity(0.3 * light),
                                                           Color.fzPeri.opacity(0.28 * light), Color.fzViolet.opacity(0.3 * light),
                                                           Color.fzRose.opacity(0.26 * light)],
                                                  startPoint: .leading, endPoint: .trailing), lineWidth: 1)
                    .overlay(shape.strokeBorder(LinearGradient(colors: [.clear, Color.fzPlateBottom.opacity(0.85)],
                                                               startPoint: .top, endPoint: UnitPoint(x: 0.5, y: 0.35)), lineWidth: 1.5))
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

    /// Someone focusing right now: the prism lit round their picture.
    func fzLiveRing(_ on: Bool = true) -> some View {
        overlay {
            if on {
                ZStack {
                    Circle().inset(by: -3.5).stroke(.fzPrismRing, lineWidth: 6).opacity(0.28)
                    Circle().inset(by: -3.5).stroke(.fzPrismRing, lineWidth: 1.8)
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

/// A groove with light running along it, 0 to 1 (today's goal, a session): the prism from mint, and a
/// hot head where the light has got to.
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
                    .fill(.fzPrismLine)
                    .opacity(0.22)
                    .frame(width: lit + 6, height: height + 6)
                    .offset(x: -3)
                Capsule()
                    .fill(.fzPrismLine)
                    .frame(width: lit, height: height - 2)
                Circle()
                    .fill(RadialGradient(colors: [Color.fzViolet.opacity(0.6), Color.fzViolet.opacity(0)], center: .center,
                                         startRadius: 0, endRadius: 12))
                    .frame(width: 24, height: 24)
                    .offset(x: lit - 12)
                Circle()
                    .fill(Color.fzHot)
                    .frame(width: 10, height: 10)
                    .offset(x: lit - 5)
            }
            .frame(width: width, height: proxy.size.height)
        }
        .frame(height: 24)
        .accessibilityElement()
        .accessibilityValue("\(Int(min(max(progress, 0), 1) * 100)) percent")
    }
}

/// The main action, from the pedestal: a dark machined capsule with a ring of the orb's split light
/// cut into it, like the groove on the pedestal's top, the prism pooling on the ground under it.
/// Pressed, the ring runs hot.
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
                // The light it throws on the ground: aqua one side, violet the other.
                HStack(spacing: -40) {
                    Rectangle()
                        .fill(EllipticalGradient(colors: [Color.fzAqua.opacity(pressed ? 0.32 : 0.2), Color.fzAqua.opacity(0)],
                                                 center: .center, startRadiusFraction: 0, endRadiusFraction: 0.5))
                    Rectangle()
                        .fill(EllipticalGradient(colors: [Color.fzViolet.opacity(pressed ? 0.32 : 0.2), Color.fzViolet.opacity(0)],
                                                 center: .center, startRadiusFraction: 0, endRadiusFraction: 0.5))
                }
                .frame(height: 46)
                .padding(.horizontal, pressed ? 10 : 26)
                .offset(y: 30)
                .allowsHitTesting(false)
            }
            .background {
                Capsule()
                    .fill(LinearGradient(colors: [Color(hex: pressed ? 0x252B2E : 0x1D2222), Color(hex: 0x0B0D0D)],
                                         startPoint: .top, endPoint: .bottom))
                    .overlay(Capsule().strokeBorder(LinearGradient(colors: [.white.opacity(0.14), .white.opacity(0.02), .black.opacity(0.6)],
                                                                   startPoint: .top, endPoint: .bottom), lineWidth: 1))
                    .overlay(Capsule().stroke(Color.black, lineWidth: 1))
            }
            .overlay {
                ZStack {
                    Capsule().inset(by: 6).stroke(.fzPrismRing, lineWidth: 7).opacity(pressed ? 0.34 : 0.14)
                    Capsule().inset(by: 6).stroke(.fzPrismRing, lineWidth: 3.5).opacity(pressed ? 0.55 : 0.26)
                    Capsule().inset(by: 6).stroke(.fzPrismRing, lineWidth: 1.6)
                    if pressed {
                        Capsule().inset(by: 6).stroke(Color.fzHot.opacity(0.6), lineWidth: 1)
                    }
                }
                .allowsHitTesting(false)
            }
            .opacity(enabled ? 1 : 0.4)
            .contentShape(Capsule())
            .scaleEffect(pressed ? 0.97 : 1)
            .animation(pressed ? .easeOut(duration: 0.15) : .spring(duration: 0.45), value: pressed)
    }
}

/// A big number with depth: its face lit from above, and its edge going down into the dark under it,
/// like a numeral machined out of the metal. (Stacked copies, no blur or shadow.)
struct DimensionalNumber: View {
    let text: String
    var size: CGFloat
    /// How deep its edge goes (points).
    var depth: CGFloat = 4
    var value: Double?

    var body: some View {
        ZStack {
            ForEach(0..<Int(max(1, depth.rounded())), id: \.self) { i in
                let step = CGFloat(i + 1)
                face
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0x3A4048), Color(hex: 0x15181C)],
                                                    startPoint: .top, endPoint: .bottom))
                    .opacity(1 - Double(step / (depth + 2)) * 0.5)
                    .offset(y: step)
            }
            // The violet light catching the bottom of its edge.
            face
                .foregroundStyle(Color.fzViolet.opacity(0.35))
                .offset(y: depth + 0.5)
                .opacity(0.6)
            face
                .foregroundStyle(.fzLitFromAbove)
        }
        .accessibilityElement()
        .accessibilityLabel(text)
    }

    private var face: some View {
        Text(text)
            .font(.fzDisplay(size, weight: .black))
            .fzTight(size)
            .monospacedDigit()
            .contentTransition(value.map { ContentTransition.numericText(value: $0) } ?? ContentTransition.numericText())
    }
}
