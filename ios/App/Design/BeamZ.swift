import SwiftUI

/// The Beam Z, the same path as the browser extension (`src/src/components/BeamZMark.tsx`), drawn
/// in a 64 × 64 box and scaled to fit.
struct BeamZShape: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 64
        let ox = rect.midX - 32 * s
        let oy = rect.midY - 32 * s
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
        var path = Path()
        path.move(to: p(20, 17.8))
        path.addLine(to: p(47.2, 17.8))
        path.addLine(to: p(47.2, 22.2))
        path.addLine(to: p(22.8, 41.8))
        path.addLine(to: p(47.2, 41.8))
        path.addLine(to: p(44, 46.2))
        path.addLine(to: p(16.8, 46.2))
        path.addLine(to: p(16.8, 41.8))
        path.addLine(to: p(29.2, 22.2))
        path.addLine(to: p(16.8, 22.2))
        path.closeSubpath()
        return path
    }
}

/// The Beam Z as the logo, in its dark tile like the extension and the website header. `tile` (0–1)
/// fades the tile, so the bare splash Z can land in the header and become the logo.
struct BeamZMark: View {
    var size: CGFloat = 44
    var tile: Double = 1

    var body: some View {
        let corner = size * 0.25
        ZStack {
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(Color(hex: 0x0A0B0D))
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .strokeBorder(.white.opacity(0.16), lineWidth: max(1, size * 0.023))
                )
                .opacity(tile)
            BeamZShape()
                .fill(Color(hex: 0xF4F2EE))
        }
        .frame(width: size, height: size)
        .accessibilityLabel("FocuzNow")
    }
}

/// The splash: the bare Z, no tile, drawing itself as a beam of light. A bright head with a fading
/// mint tail runs around the outline (`draw`, 0–1), then the fill sweeps in left to right (`fill`),
/// with a soft band of light on its edge. The Z sits in a `size` box like `BeamZMark`, so the two can
/// share a matched geometry and the drawn Z lands in the header without a jump.
struct BeamZDrawing: View, Animatable {
    var size: CGFloat
    var draw: CGFloat
    var fill: CGFloat

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(draw, fill) }
        set { draw = newValue.first; fill = newValue.second }
    }

    private static let tail: CGFloat = 0.24
    private static let bone = Color(hex: 0xF4F2EE)

    var body: some View {
        let outline = BeamZShape().path(in: CGRect(x: 0, y: 0, width: size, height: size))
        let d = min(max(draw, 0), 1)
        let head = outline.trimmedPath(from: 0, to: max(d, 0.0001)).currentPoint ?? .zero
        let line = max(1.2, size * 0.02)
        let drawing = d > 0 && d < 1
        ZStack {
            // What's been drawn so far stays as a fine line.
            outline.trimmedPath(from: 0, to: d)
                .stroke(Self.bone.opacity(0.85), style: StrokeStyle(lineWidth: line, lineCap: .round, lineJoin: .round))
                .opacity(1 - Double(fill))

            // The tail: the last stretch glows, brightest at the head.
            ForEach(0..<4, id: \.self) { i in
                let from = max(0, d - Self.tail * CGFloat(4 - i) / 4)
                let to = max(0, d - Self.tail * CGFloat(3 - i) / 4)
                outline.trimmedPath(from: from, to: to)
                    .stroke(Color.fzMint.opacity(0.25 + 0.25 * Double(i)), style: StrokeStyle(lineWidth: line * 3.2, lineCap: .round, lineJoin: .round))
                    .blur(radius: size * 0.025)
            }
            .opacity(drawing ? 1 : 0)

            // The head of the beam.
            Circle()
                .fill(.white)
                .frame(width: line * 3, height: line * 3)
                .shadow(color: Color.fzMint, radius: size * 0.05)
                .shadow(color: .white.opacity(0.6), radius: size * 0.015)
                .position(head)
                .opacity(drawing ? 1 : 0)

            // The fill, sweeping in, with light on its leading edge.
            BeamZShape()
                .fill(Self.bone)
                .mask(alignment: .leading) {
                    // The Z spans the middle half of its box.
                    Rectangle().frame(width: size * (0.25 + 0.5 * min(max(fill, 0), 1)))
                }
            Rectangle()
                .fill(LinearGradient(colors: [.clear, .white, .clear], startPoint: .leading, endPoint: .trailing))
                .frame(width: size * 0.12)
                .blur(radius: size * 0.02)
                .position(x: size * (0.25 + 0.5 * fill), y: size / 2)
                .mask { BeamZShape().fill(.white) }
                .opacity(fill > 0 && fill < 1 ? 0.9 : 0)
        }
        .frame(width: size, height: size)
        .accessibilityLabel("FocuzNow")
    }
}
