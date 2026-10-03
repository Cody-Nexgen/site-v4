import Charts
import SwiftUI

struct WavePoint: Identifiable {
    let hour: Double
    let value: Double
    var id: Double { hour }
}

/// Today's focus through the day (spec §3): a smooth area and line up to now, dashed after.
struct DayWave: View {
    let points: [WavePoint]
    var nowHour: Double = Double(Calendar.current.component(.hour, from: .now)) + Double(Calendar.current.component(.minute, from: .now)) / 60

    var body: some View {
        let past = points.filter { $0.hour <= nowHour }
        let future = points.filter { $0.hour >= (past.last?.hour ?? 0) }
        Chart {
            ForEach(past) { point in
                AreaMark(x: .value("Hour", point.hour), y: .value("Focus", point.value))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(LinearGradient(colors: [Theme.violet.opacity(0.45), Theme.indigo.opacity(0.02)], startPoint: .top, endPoint: .bottom))
            }
            ForEach(past) { point in
                LineMark(x: .value("Hour", point.hour), y: .value("Focus", point.value), series: .value("Part", "past"))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(Color.fzInk)
                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
            }
            ForEach(future) { point in
                LineMark(x: .value("Hour", point.hour), y: .value("Focus", point.value), series: .value("Part", "future"))
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(Color.fzInk3)
                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, dash: [3, 5]))
            }
            if let current = past.last {
                RuleMark(x: .value("Now", current.hour))
                    .foregroundStyle(Color.fzInk3)
                    .lineStyle(StrokeStyle(lineWidth: 1))
                PointMark(x: .value("Hour", current.hour), y: .value("Focus", current.value))
                    .symbolSize(90)
                    .foregroundStyle(Color.fzInk)
            }
        }
        .chartXScale(domain: 6.0...24.0)
        .chartYScale(domain: 0.0...10.0)
        .chartYAxis(.hidden)
        .chartXAxis {
            AxisMarks(values: [6.0, 12.0, 18.0, 24.0]) { value in
                AxisValueLabel {
                    if let hour = value.as(Double.self) {
                        Label(Self.label(hour), systemImage: Self.symbol(hour))
                            .font(.caption2)
                            .foregroundStyle(Color.fzInk3)
                    }
                }
            }
        }
        .accessibilityLabel("Your focus through the day")
    }

    static func label(_ hour: Double) -> String {
        switch Int(hour) {
        case 6: "6A"
        case 12: "12P"
        case 18: "6P"
        default: "12A"
        }
    }

    static func symbol(_ hour: Double) -> String {
        switch Int(hour) {
        case 6: "sunrise"
        case 12: "sun.max"
        case 18: "sunset"
        default: "moon"
        }
    }
}
