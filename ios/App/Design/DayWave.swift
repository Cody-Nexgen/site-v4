import SwiftUI

struct WavePoint: Identifiable {
    let hour: Double
    let value: Double
    var id: Double { hour }
}

/// Today's focus through the day, lit like the stage: a line of the orb's light with fog under it up
/// to now, fainter for the rest of the day, and a beam of light standing at now. Plain shapes (it was
/// a Swift Charts chart: heavier, and it looked like every other app).
struct DayWave: View {
    let points: [WavePoint]
    var nowHour: Double = Double(Calendar.current.component(.hour, from: .now)) + Double(Calendar.current.component(.minute, from: .now)) / 60

    private static let start = 6.0
    private static let end = 24.0

    var body: some View {
        VStack(spacing: 6) {
            GeometryReader { proxy in
                let size = proxy.size
                let sorted = points.sorted { $0.hour < $1.hour }
                let now = min(max(nowHour, Self.start), Self.end)
                let past = sorted.filter { $0.hour < now } + [WavePoint(hour: now, value: Self.value(at: now, in: sorted))]
                let nowPoint = Self.point(past[past.count - 1], in: size)
                ZStack(alignment: .topLeading) {
                    // The rest of the day: faint.
                    Self.line(sorted, in: size)
                        .stroke(Color.fzNightInk.opacity(0.16), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [3, 5]))
                    // Up to now: fog under the light, then its glow and the line itself.
                    Self.area(past, in: size)
                        .fill(LinearGradient(colors: [Color.fzMint.opacity(0.2), Color.fzMint.opacity(0)], startPoint: .top, endPoint: .bottom))
                    Self.line(past, in: size)
                        .stroke(Color.fzMint.opacity(0.22), style: StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round))
                    Self.line(past, in: size)
                        .stroke(Color(hex: 0xC8F5DA), style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
                    // Now: a beam of light standing on the ground, and where the line has got to.
                    Rectangle()
                        .fill(LinearGradient(colors: [Color.fzHot.opacity(0), Color.fzHot.opacity(0.7), Color.fzHot.opacity(0)],
                                             startPoint: .top, endPoint: .bottom))
                        .frame(width: 1.5, height: size.height)
                        .offset(x: nowPoint.x - 0.75)
                    Circle()
                        .fill(RadialGradient(colors: [Color.fzMint.opacity(0.45), Color.fzMint.opacity(0)], center: .center, startRadius: 0, endRadius: 11))
                        .frame(width: 22, height: 22)
                        .offset(x: nowPoint.x - 11, y: nowPoint.y - 11)
                    Circle()
                        .fill(Color.fzHot)
                        .frame(width: 9, height: 9)
                        .offset(x: nowPoint.x - 4.5, y: nowPoint.y - 4.5)
                    GrooveLine()
                        .frame(width: size.width)
                        .offset(y: size.height - 1)
                }
            }
            GeometryReader { proxy in
                ZStack(alignment: .topLeading) {
                    ForEach([6.0, 12.0, 18.0, 24.0], id: \.self) { hour in
                        Engraved(Self.label(hour), color: Color.fzNightInk.opacity(0.4), size: 9)
                            .fixedSize()
                            .position(x: min(max(Self.x(hour, width: proxy.size.width), 18), proxy.size.width - 20), y: 6)
                    }
                }
            }
            .frame(height: 12)
        }
        .accessibilityElement()
        .accessibilityLabel("Your focus through the day")
        .accessibilityValue("Sharpest at \(Self.label(Self.peak(points)))")
    }

    /// When focus was highest.
    static func peak(_ points: [WavePoint]) -> Double {
        points.max { $0.value < $1.value }?.hour ?? 15
    }

    static func label(_ hour: Double) -> String {
        let h = Int(hour) % 24
        let display = h % 12 == 0 ? 12 : h % 12
        return "\(display) \(h < 12 ? "AM" : "PM")"
    }

    private static func x(_ hour: Double, width: CGFloat) -> CGFloat {
        CGFloat((hour - start) / (end - start)) * width
    }

    private static func point(_ p: WavePoint, in size: CGSize) -> CGPoint {
        // A little room at the top for the glow; 0 sits on the ground.
        CGPoint(x: x(p.hour, width: size.width), y: 6 + (1 - CGFloat(min(max(p.value, 0), 10) / 10)) * (size.height - 8))
    }

    private static func value(at hour: Double, in sorted: [WavePoint]) -> Double {
        guard let after = sorted.firstIndex(where: { $0.hour >= hour }) else { return sorted.last?.value ?? 0 }
        guard after > 0 else { return sorted[after].value }
        let a = sorted[after - 1], b = sorted[after]
        let t = (hour - a.hour) / max(b.hour - a.hour, 0.0001)
        return a.value + (b.value - a.value) * t
    }

    /// A smooth line through the points (Catmull-Rom as Béziers).
    private static func line(_ points: [WavePoint], in size: CGSize) -> Path {
        let p = points.map { point($0, in: size) }
        var path = Path()
        guard let first = p.first else { return path }
        path.move(to: first)
        guard p.count > 1 else { return path }
        for i in 0..<(p.count - 1) {
            let p0 = p[max(i - 1, 0)], p1 = p[i], p2 = p[i + 1], p3 = p[min(i + 2, p.count - 1)]
            let c1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6)
            let c2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6)
            path.addCurve(to: p2, control1: c1, control2: c2)
        }
        return path
    }

    private static func area(_ points: [WavePoint], in size: CGSize) -> Path {
        var path = line(points, in: size)
        guard let first = points.first, let last = points.last else { return path }
        path.addLine(to: CGPoint(x: x(last.hour, width: size.width), y: size.height))
        path.addLine(to: CGPoint(x: x(first.hour, width: size.width), y: size.height))
        path.closeSubpath()
        return path
    }
}
