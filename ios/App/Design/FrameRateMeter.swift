import QuartzCore
import SwiftUI

// Developer mode → Show frame rate: a small readout at the top of the screen, to turn "it's laggy"
// into numbers. The first line is the app itself: how many frames a second the main thread really
// delivers (a display link that misses a tick when the main thread is busy; 60 is the most it counts)
// and the longest gap between two frames in that second. The second line is the orb's stage: how it's
// drawn (one Metal pass, or the SwiftUI fallback when Metal can't start), how many frames it drew, and
// how long each took on the CPU and on the GPU.

/// What the stage's Metal pass did, written by `StageRenderer` (the CPU side on the main thread, the
/// GPU time from Metal's completion thread) and read once a second by the meter.
enum StageStats {
    nonisolated(unsafe) static var frames = 0
    nonisolated(unsafe) static var cpuSeconds: Double = 0
    nonisolated(unsafe) static var gpuSeconds: Double = 0
    nonisolated(unsafe) static var gpuFrames = 0
}

@MainActor
@Observable
final class FrameRateMeter {
    static let shared = FrameRateMeter()

    struct Reading: Equatable {
        var fps = 0
        /// The longest gap between two frames (ms): 16.7 is smooth at 60, anything over 33 is a hitch.
        var longest = 0.0
        var stageFPS = 0
        var stageCPU = 0.0
        var stageGPU = 0.0
    }

    private(set) var reading = Reading()

    @ObservationIgnored private var link: CADisplayLink?
    @ObservationIgnored private var frames = 0
    @ObservationIgnored private var windowStart: CFTimeInterval = 0
    @ObservationIgnored private var last: CFTimeInterval = 0
    @ObservationIgnored private var longest: CFTimeInterval = 0

    func start() {
        guard link == nil else { return }
        let proxy = DisplayLinkProxy { [weak self] link in
            MainActor.assumeIsolated { self?.tick(link) }
        }
        let link = CADisplayLink(target: proxy, selector: #selector(DisplayLinkProxy.step(_:)))
        // Common modes: it keeps counting while you scroll (that's when it matters).
        link.add(to: .main, forMode: .common)
        self.link = link
        frames = 0
        windowStart = 0
        last = 0
        longest = 0
    }

    func stop() {
        link?.invalidate()
        link = nil
    }

    private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        if last > 0 { longest = max(longest, now - last) }
        last = now
        if windowStart == 0 {
            windowStart = now
            StageStats.frames = 0
            StageStats.cpuSeconds = 0
            StageStats.gpuSeconds = 0
            StageStats.gpuFrames = 0
            return
        }
        frames += 1
        let span = now - windowStart
        guard span >= 1 else { return }
        let drawn = StageStats.frames
        reading = Reading(fps: Int((Double(frames) / span).rounded()),
                          longest: longest * 1000,
                          stageFPS: Int((Double(drawn) / span).rounded()),
                          stageCPU: drawn > 0 ? StageStats.cpuSeconds / Double(drawn) * 1000 : 0,
                          stageGPU: StageStats.gpuFrames > 0 ? StageStats.gpuSeconds / Double(StageStats.gpuFrames) * 1000 : 0)
        frames = 0
        windowStart = now
        longest = 0
        StageStats.frames = 0
        StageStats.cpuSeconds = 0
        StageStats.gpuSeconds = 0
        StageStats.gpuFrames = 0
    }
}

/// CADisplayLink wants an Objective-C target; this one hands each tick to a closure (and doesn't keep
/// the meter alive).
private final class DisplayLinkProxy: NSObject {
    let onTick: (CADisplayLink) -> Void

    init(_ onTick: @escaping (CADisplayLink) -> Void) {
        self.onTick = onTick
    }

    @objc func step(_ link: CADisplayLink) {
        onTick(link)
    }
}

/// The readout, at the top of the screen over everything (not over a session or a sheet: those are
/// their own windows).
struct FrameRatePill: View {
    private let meter = FrameRateMeter.shared

    var body: some View {
        let r = meter.reading
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                Circle()
                    .fill(r.fps >= 55 ? Color.fzMint : r.fps >= 40 ? Color.yellow : Color.fzRed)
                    .frame(width: 6, height: 6)
                Text("\(r.fps) fps · worst \(Self.ms(r.longest))")
            }
            Text(stageLine(r))
                .foregroundStyle(.white.opacity(0.7))
        }
        .font(.system(size: 10.5, weight: .semibold, design: .monospaced))
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.black.opacity(0.75)))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(.white.opacity(0.15)))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { meter.start() }
        .onDisappear { meter.stop() }
    }

    private func stageLine(_ r: FrameRateMeter.Reading) -> String {
        guard StageGPU.shared != nil else { return "stage: SwiftUI (no Metal)" }
        guard r.stageFPS > 0 else { return "stage: Metal, paused" }
        return "stage: Metal \(r.stageFPS) fps · CPU \(Self.ms(r.stageCPU)) · GPU \(Self.ms(r.stageGPU))"
    }

    private static func ms(_ value: Double) -> String {
        value >= 10 ? "\(Int(value.rounded())) ms" : String(format: "%.1f ms", value)
    }
}
