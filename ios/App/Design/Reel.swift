import SwiftUI
import UIKit

// The onboarding's look: a film's opening titles (docs/ios-title-sequence.md). Big condensed titles,
// Bodoni credits, paper with grain, and a small cut-paper figure. Every font here ships with iOS, so
// there are no files to add.

// MARK: Type

enum Reel {
    /// The titles: Futura Condensed ExtraBold.
    static func title(_ size: CGFloat) -> Font {
        UIFont(name: "Futura-CondensedExtraBold", size: size) != nil
            ? .custom("Futura-CondensedExtraBold", size: size)
            : .system(size: size, weight: .black).width(.condensed)
    }

    /// The narrator's lines and credits: Bodoni 72 Book Italic.
    static func credit(_ size: CGFloat) -> Font {
        UIFont(name: "BodoniSvtyTwoITCTT-BookIta", size: size) != nil
            ? .custom("BodoniSvtyTwoITCTT-BookIta", size: size)
            : .system(size: size, design: .serif).italic()
    }

    /// "FocuzNow presents": Bodoni 72 Smallcaps.
    static func smallCaps(_ size: CGFloat) -> Font {
        UIFont(name: "BodoniSvtyTwoSCITCTT-Book", size: size) != nil
            ? .custom("BodoniSvtyTwoSCITCTT-Book", size: size)
            : .system(size: size, design: .serif).smallCaps()
    }

    /// The little words that loop through AGAIN: Futura Condensed Medium.
    static func loop(_ size: CGFloat) -> Font {
        UIFont(name: "Futura-CondensedMedium", size: size) != nil
            ? .custom("Futura-CondensedMedium", size: size)
            : .system(size: size, weight: .medium).width(.condensed)
    }

    /// The largest title size that fits `text` across `width` (one line, or each word on its own line).
    /// Futura Condensed capitals are about half an em wide.
    static func fit(_ text: String, width: CGFloat, limit: CGFloat, byWord: Bool = false) -> CGFloat {
        let pieces = byWord ? text.split(separator: " ").map(String.init) : [text]
        let widest = pieces.map(ems).max() ?? 1
        return min(limit, width * 0.96 / max(0.5, widest))
    }

    /// About how wide `text` is in the title face at `size`.
    static func width(_ text: String, size: CGFloat) -> CGFloat { ems(text) * size }

    private static func ems(_ text: String) -> CGFloat { text.reduce(0) { $0 + em($1) } }

    private static func em(_ character: Character) -> CGFloat {
        switch character {
        case " ": 0.24
        case "I", "J", "1", ".", ",", "'", "!", ":", "+": 0.28
        case "M", "W": 0.72
        default: 0.52
        }
    }
}

// MARK: Light

/// The paper changes with the time of day you pick ("When does it usually happen?").
enum ReelLight: Equatable {
    case plain, morning, afternoon, evening, night

    static func forHardestTime(_ title: String) -> ReelLight {
        switch title {
        case "Mornings": .morning
        case "After school": .afternoon
        case "Evenings": .evening
        case "Late at night": .night
        default: .plain
        }
    }
}

struct ReelPalette: Equatable {
    var paper: Color
    var ink: Color
    /// True when the paper is dark (Dark Mode, or the night light).
    var darkPaper: Bool

    var ink2: Color { ink.opacity(0.62) }
    var ink3: Color { ink.opacity(0.4) }

    /// Ivory paper and ink in Light Mode, deep ink paper and ivory type in Dark Mode.
    static func make(_ light: ReelLight, dark: Bool) -> ReelPalette {
        func p(_ paper: UInt32, _ ink: UInt32, _ isDark: Bool) -> ReelPalette {
            ReelPalette(paper: Color(hex: paper), ink: Color(hex: ink), darkPaper: isDark)
        }
        switch (light, dark) {
        case (.plain, false): return p(0xF1ECE1, 0x161412, false)
        case (.plain, true): return p(0x12110F, 0xEFE9DC, true)
        case (.morning, false): return p(0xECEFE8, 0x14201D, false)
        case (.morning, true): return p(0x0E1517, 0xE6EEEA, true)
        case (.afternoon, false): return p(0xF3E2C4, 0x2A1A0C, false)
        case (.afternoon, true): return p(0x18120A, 0xF2E1C3, true)
        case (.evening, false): return p(0xE6C3A1, 0x2A140A, false)
        case (.evening, true): return p(0x1D100A, 0xEDCDAF, true)
        case (.night, false): return p(0x0F1B30, 0xEDE5D3, true)
        case (.night, true): return p(0x0A1322, 0xEDE5D3, true)
        }
    }
}

// MARK: Paper

/// The canvas: a paper colour, fine grain, and a soft vignette.
struct ReelPaper: View {
    let palette: ReelPalette

    var body: some View {
        ZStack {
            palette.paper
            Image(uiImage: PaperGrain.tile)
                .resizable(resizingMode: .tile)
                .opacity(palette.darkPaper ? 0.22 : 0.42)
                .blendMode(palette.darkPaper ? .screen : .multiply)
            RadialGradient(
                colors: [.clear, .black.opacity(palette.darkPaper ? 0.42 : 0.1)],
                center: .center,
                startRadius: 140,
                endRadius: 720
            )
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// A small tile of random specks, made once.
enum PaperGrain {
    static let tile: UIImage = {
        let size = CGSize(width: 180, height: 180)
        return UIGraphicsImageRenderer(size: size).image { context in
            for _ in 0..<5200 {
                let x = CGFloat.random(in: 0..<size.width)
                let y = CGFloat.random(in: 0..<size.height)
                UIColor(white: .random(in: 0...1), alpha: .random(in: 0.04...0.3)).setFill()
                context.fill(CGRect(x: x, y: y, width: 1, height: 1))
            }
        }
    }()
}

// MARK: The figure

/// A small cut-paper person, Saul Bass style. It stands, walks (legs and arms swing) and sits.
/// Drawn in code for now; a generated cutout can replace it later with the same poses.
struct Silhouette: View {
    enum Pose: Equatable { case stand, walk, sit }

    var pose: Pose
    var height: CGFloat = 44
    var color: Color
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: pose != .walk || reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            figure(swing: pose == .walk && !reduceMotion ? sin(t * 9) * 24 : 0)
        }
        .frame(width: height * 0.6, height: height)
        .accessibilityHidden(true)
    }

    private func figure(swing: Double) -> some View {
        let h = height
        let limb = h * 0.085
        let sitting = pose == .sit
        return ZStack(alignment: .top) {
            leg(hip: sitting ? -86 : swing, knee: sitting ? 86 : max(0, -swing) * 0.7, width: limb)
                .offset(x: -h * 0.035, y: h * 0.55)
            leg(hip: sitting ? -78 : -swing, knee: sitting ? 78 : max(0, swing) * 0.7, width: limb)
                .offset(x: h * 0.035, y: h * 0.55)
            RoundedRectangle(cornerRadius: h * 0.08, style: .continuous)
                .frame(width: h * 0.24, height: h * 0.36)
                .offset(y: h * 0.215)
            Capsule()
                .frame(width: limb, height: h * 0.3)
                .rotationEffect(.degrees(sitting ? -24 : -swing * 0.8), anchor: .top)
                .offset(x: -h * 0.105, y: h * 0.235)
            Capsule()
                .frame(width: limb, height: h * 0.3)
                .rotationEffect(.degrees(sitting ? -34 : swing * 0.8), anchor: .top)
                .offset(x: h * 0.105, y: h * 0.235)
            Circle()
                .frame(width: h * 0.2, height: h * 0.2)
        }
        .foregroundStyle(color)
        .frame(width: h * 0.6, height: h, alignment: .top)
    }

    /// A two-part leg that bends at the knee.
    private func leg(hip: Double, knee: Double, width: CGFloat) -> some View {
        let part = height * 0.21
        return Capsule()
            .frame(width: width, height: part)
            .overlay(alignment: .top) {
                Capsule()
                    .frame(width: width, height: part)
                    .rotationEffect(.degrees(knee), anchor: .top)
                    .offset(y: part - width * 0.6)
            }
            .rotationEffect(.degrees(hip), anchor: .top)
    }
}

// MARK: The loop

/// Small words on orderly lanes that cross the big title: the things that keep getting another turn.
struct LoopingWords: View {
    let t: Double
    let size: CGSize
    let centerY: CGFloat
    let titleSize: CGFloat
    let color: Color

    private struct Lane {
        let words: [String]
        let vertical: Bool
        let fixed: CGFloat
        let speed: Double
    }

    var body: some View {
        let lanes = [
            Lane(words: ["scroll", "scroll", "refresh"], vertical: false, fixed: centerY - titleSize * 0.2, speed: 34),
            Lane(words: ["watch", "next", "watch"], vertical: false, fixed: centerY + titleSize * 0.22, speed: -27),
            Lane(words: ["check", "check"], vertical: true, fixed: size.width * 0.29, speed: -30),
            Lane(words: ["swipe", "open", "swipe"], vertical: true, fixed: size.width * 0.73, speed: 23),
        ]
        ZStack {
            ForEach(lanes.indices, id: \.self) { laneIndex in
                let lane = lanes[laneIndex]
                ForEach(lane.words.indices, id: \.self) { wordIndex in
                    let spot = place(lane, wordIndex)
                    Text(lane.words[wordIndex])
                        .font(Reel.loop(20))
                        .foregroundStyle(color)
                        .fixedSize()
                        .rotationEffect(.degrees(lane.vertical ? (lane.speed < 0 ? -90 : 90) : 0))
                        .opacity(spot.fade)
                        .position(spot.point)
                }
            }
        }
        .frame(width: size.width, height: size.height)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func place(_ lane: Lane, _ index: Int) -> (point: CGPoint, fade: Double) {
        let span: CGFloat = lane.vertical ? titleSize * 2.6 : size.width + 180
        let start: CGFloat = lane.vertical ? centerY - span / 2 : -90
        let gap = span / CGFloat(lane.words.count)
        var along = (CGFloat(t * lane.speed) + gap * CGFloat(index)).truncatingRemainder(dividingBy: span)
        if along < 0 { along += span }
        // Vertical lanes are short, so their words fade in and out at the ends instead of popping.
        let fade = lane.vertical ? Double(sin(.pi * along / span)).squareRoot() : 1
        let p = start + along
        return (lane.vertical ? CGPoint(x: lane.fixed, y: p) : CGPoint(x: p, y: lane.fixed), fade)
    }
}

// MARK: Controls

/// An answer: a printed-ticket capsule with its icon.
struct ReelChip: View {
    let symbol: String
    let title: String
    let palette: ReelPalette

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
            Text(title)
                .font(.system(size: 16, weight: .semibold))
        }
        .foregroundStyle(palette.ink)
        .padding(.horizontal, 15)
        .padding(.vertical, 11)
        .background(Capsule().fill(palette.ink.opacity(0.04)))
        .overlay(Capsule().strokeBorder(palette.ink.opacity(0.32), lineWidth: 1.3))
        .contentShape(Capsule())
    }
}

/// The main action (ink pill) or a secondary one (outlined pill).
struct ReelButtonStyle: ButtonStyle {
    let palette: ReelPalette
    var primary = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(primary ? palette.paper : palette.ink)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background {
                if primary {
                    Capsule().fill(palette.ink)
                } else {
                    Capsule().strokeBorder(palette.ink.opacity(0.32), lineWidth: 1.3)
                }
            }
            .contentShape(Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// "Not now", "Explore first".
struct ReelQuietButtonStyle: ButtonStyle {
    let palette: ReelPalette

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.medium))
            .foregroundStyle(palette.ink2)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .contentShape(Rectangle())
            .opacity(configuration.isPressed ? 0.5 : 1)
    }
}

/// "TAP TO CONTINUE", breathing.
struct TapHint: View {
    let palette: ReelPalette

    var body: some View {
        Text("TAP TO CONTINUE")
            .font(.caption.weight(.semibold))
            .tracking(2.4)
            .foregroundStyle(palette.ink2)
            .phaseAnimator([1.0, 0.45]) { content, value in
                content.opacity(value)
            } animation: { _ in .easeInOut(duration: 1.3) }
            .frame(maxWidth: .infinity)
            .accessibilityHidden(true)
    }
}

/// Slides in from an edge of the screen on appear (the distraction answers arrive from all sides).
struct EnterFrom: ViewModifier {
    let edge: Edge
    var delay: Double = 0
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let distance: CGFloat = 240
        let start: CGSize = switch edge {
        case .leading: CGSize(width: -distance, height: 0)
        case .trailing: CGSize(width: distance, height: 0)
        case .top: CGSize(width: 0, height: -distance * 0.6)
        case .bottom: CGSize(width: 0, height: distance * 0.35)
        }
        content
            .offset(shown || reduceMotion ? .zero : start)
            .opacity(shown || reduceMotion ? 1 : 0)
            .onAppear {
                withAnimation(.spring(duration: 0.75, bounce: 0.16).delay(delay)) { shown = true }
            }
    }
}
