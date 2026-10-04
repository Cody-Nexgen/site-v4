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

/// The Beam Z in its dark tile, like the extension and the website header.
/// `draw` (0–1) traces the outline; `filled` fills it in. Both default to the finished mark.
struct BeamZMark: View {
    var size: CGFloat = 44
    var draw: CGFloat = 1
    var filled = true
    var glow: Color = .fzMint

    var body: some View {
        let corner = size * 0.25
        ZStack {
            RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(Color(hex: 0x0A0B0D))
                .overlay(
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .strokeBorder(.white.opacity(0.16), lineWidth: max(1, size * 0.023))
                )
            // The outline being drawn, with a soft glow.
            BeamZShape()
                .trim(from: 0, to: draw)
                .stroke(glow, style: StrokeStyle(lineWidth: max(1.2, size * 0.035), lineCap: .round, lineJoin: .round))
                .blur(radius: size * 0.04)
                .opacity(filled ? 0 : 0.9)
            BeamZShape()
                .trim(from: 0, to: draw)
                .stroke(Color(hex: 0xF4F2EE), style: StrokeStyle(lineWidth: max(1, size * 0.025), lineCap: .round, lineJoin: .round))
            BeamZShape()
                .fill(Color(hex: 0xF4F2EE))
                .opacity(filled ? 1 : 0)
        }
        .frame(width: size, height: size)
        .accessibilityLabel("FocuzNow")
    }
}
