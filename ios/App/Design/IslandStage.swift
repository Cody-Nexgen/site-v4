import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit

// The in-app Dynamic Island (docs/ios-island-plan.md §4.1). iOS hides an app's own Live Activity
// from the island while the app is open, so the app draws its own black pill exactly over the
// camera cutout. On black it can't be told apart from the real one, and when you leave the app the
// real Live Activity takes over in the same spot.

// MARK: Where the island is

struct IslandGeometry: Equatable {
    /// False on iPhone SE, notch phones and iPad: the pill then floats below the status bar.
    var hasIsland: Bool
    /// The resting pill, in full-screen coordinates (origin at the top-left of the screen).
    var rect: CGRect

    var center: CGPoint { CGPoint(x: rect.midX, y: rect.midY) }

    /// Phones with a Dynamic Island have a top safe area of 59 pt or more (notch phones: 44–50).
    @MainActor
    static func make(width: CGFloat, safeTop: CGFloat) -> IslandGeometry {
        let island = UIDevice.current.userInterfaceIdiom == .phone && safeTop >= 54
        let size = CGSize(width: 126, height: 37)
        let top: CGFloat = island ? (safeTop >= 62 ? 14 : 11) : max(safeTop, 20) + 8
        return IslandGeometry(hasIsland: island, rect: CGRect(x: (width - size.width) / 2, y: top, width: size.width, height: size.height))
    }

    /// For screens that aren't laid out around the island (Developer tools).
    @MainActor
    static var deviceHasIsland: Bool {
        let window = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first
        return UIDevice.current.userInterfaceIdiom == .phone && (window?.safeAreaInsets.top ?? 0) >= 54
    }
}

// MARK: The pill

enum IslandMode: Equatable {
    /// The bare pill.
    case resting
    /// Something is being dragged toward it: it widens a little and pulses.
    case catching
    /// The pill with small things on both sides of the camera.
    case compact
    /// Wide and tall, with content below the camera.
    case expanded
}

/// The island itself. Content never goes in the middle of the resting pill: on a real island phone
/// that's where the camera is. Compact content sits on the sides, expanded content below.
struct IslandView<Leading: View, Trailing: View, Expanded: View>: View {
    let geometry: IslandGeometry
    let mode: IslandMode
    let stageWidth: CGFloat
    /// Bump to play the swallow (squash and bounce).
    var gulp = 0
    @ViewBuilder var leading: Leading
    @ViewBuilder var trailing: Trailing
    @ViewBuilder var expanded: Expanded

    private let side: CGFloat = 46

    var body: some View {
        let rect = geometry.rect
        let isExpanded = mode == .expanded
        let width: CGFloat = switch mode {
        case .resting: rect.width
        case .catching: rect.width + 64
        case .compact: rect.width + side * 2
        case .expanded: min(stageWidth - 22, 520)
        }
        let height = mode == .catching ? rect.height + 4 : rect.height

        ZStack(alignment: .top) {
            if isExpanded {
                expanded
                    .padding(.horizontal, 20)
                    .padding(.top, rect.height + 8)
                    .padding(.bottom, 20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 0.92, anchor: .top)).animation(.spring(duration: 0.45).delay(0.08)),
                        removal: .opacity.animation(.easeOut(duration: 0.12))
                    ))
            } else if mode == .compact {
                HStack(spacing: 0) {
                    leading.frame(width: side)
                    Spacer(minLength: rect.width)
                    trailing.frame(width: side)
                }
                .frame(height: rect.height)
                .transition(.opacity.animation(.easeInOut(duration: 0.2)))
            }
        }
        .frame(width: width)
        .frame(minHeight: height, alignment: .top)
        .background {
            RoundedRectangle(cornerRadius: isExpanded ? 40 : height / 2, style: .continuous)
                .fill(Color.black)
                .overlay {
                    // Without real hardware the black pill needs an edge to be seen on black.
                    if !geometry.hasIsland {
                        RoundedRectangle(cornerRadius: isExpanded ? 40 : height / 2, style: .continuous)
                            .strokeBorder(.white.opacity(0.14))
                    }
                }
                .shadow(color: .white.opacity(mode == .catching ? 0.25 : 0), radius: 18)
        }
        .foregroundStyle(.white)
        .keyframeAnimator(initialValue: CGSize(width: 1, height: 1), trigger: gulp) { content, scale in
            content.scaleEffect(x: scale.width, y: scale.height, anchor: .top)
        } keyframes: { _ in
            KeyframeTrack(\.width) {
                SpringKeyframe(1.1, duration: 0.12)
                SpringKeyframe(0.97, duration: 0.14)
                SpringKeyframe(1, duration: 0.3)
            }
            KeyframeTrack(\.height) {
                SpringKeyframe(0.84, duration: 0.12)
                SpringKeyframe(1.05, duration: 0.14)
                SpringKeyframe(1, duration: 0.3)
            }
        }
        .animation(.spring(duration: 0.5, bounce: 0.28), value: mode)
        .accessibilityElement(children: .contain)
    }
}

// MARK: The light that falls from the island

/// The lighthouse beam without drawing a lighthouse: a soft cone of light from the island down the
/// screen, plus a glow at the island. `intensity` (0–1) is driven by `.opacity`, so it animates
/// smoothly.
struct IslandLight: View {
    let origin: CGPoint
    var intensity: Double

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            ZStack {
                Path { path in
                    path.move(to: CGPoint(x: origin.x - 44, y: origin.y))
                    path.addLine(to: CGPoint(x: origin.x + 44, y: origin.y))
                    path.addLine(to: CGPoint(x: origin.x + size.width * 0.95, y: size.height * 0.82))
                    path.addLine(to: CGPoint(x: origin.x - size.width * 0.95, y: size.height * 0.82))
                    path.closeSubpath()
                }
                .fill(LinearGradient(
                    stops: [
                        .init(color: .white.opacity(0.22), location: 0),
                        .init(color: .white.opacity(0.07), location: 0.45),
                        .init(color: .white.opacity(0), location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                ))
                .blur(radius: 44)

                RadialGradient(
                    colors: [.white.opacity(0.3), .white.opacity(0)],
                    center: UnitPoint(x: origin.x / max(1, size.width), y: origin.y / max(1, size.height)),
                    startRadius: 0,
                    endRadius: 230
                )
            }
            .compositingGroup()
        }
        .opacity(intensity)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: Chips you flick into the island

/// What a chip looks like. The same face is drawn by the chip and by the copy that flies into the
/// island.
enum ChipFace: Hashable {
    /// An answer: icon tile and a label (v2's capsules).
    case option(symbol: String, title: String)
    /// The main choice on a step: white, black text.
    case primary(symbol: String, title: String)
    /// "Not now", "Later".
    case quiet(title: String)
    /// A typed name on its way up.
    case word(String)
    /// One of your real apps or categories from Screen Time.
    case app(ApplicationToken)
    case category(ActivityCategoryToken)
}

extension ChipFace {
    /// "Not now" and "Later" are tapped, not thrown.
    var isQuiet: Bool {
        if case .quiet = self { return true }
        return false
    }
}

struct ChipFaceView: View {
    let face: ChipFace

    var body: some View {
        switch face {
        case let .option(symbol, title):
            HStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 30, height: 30)
                    .background(.white.opacity(0.12), in: Circle())
                Text(title).font(.system(size: 17, weight: .semibold))
            }
            .foregroundStyle(.white)
            .padding(.leading, 7)
            .padding(.trailing, 18)
            .padding(.vertical, 7)
            .background(Capsule().fill(.white.opacity(0.07)))
            .overlay(Capsule().strokeBorder(.white.opacity(0.13)))
            .fzGlass(in: Capsule(), interactive: true)
        case let .primary(symbol, title):
            HStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 30, height: 30)
                    .background(.black.opacity(0.08), in: Circle())
                Text(title).font(.system(size: 17, weight: .semibold))
            }
            .foregroundStyle(.black)
            .padding(.leading, 7)
            .padding(.trailing, 18)
            .padding(.vertical, 7)
            .background(Capsule().fill(.white))
        case let .quiet(title):
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white.opacity(0.7))
                .padding(.horizontal, 18)
                .padding(.vertical, 12)
                .overlay(Capsule().strokeBorder(.white.opacity(0.15)))
        case let .word(text):
            Text(text)
                .font(.fzDisplay(28, weight: .bold))
                .foregroundStyle(.white)
        case let .app(token):
            Label(token)
                .labelStyle(.iconOnly)
                .scaleEffect(1.9)
                .frame(width: 60, height: 60)
        case let .category(token):
            Label(token)
                .labelStyle(.iconOnly)
                .scaleEffect(1.9)
                .frame(width: 60, height: 60)
        }
    }
}

/// A chip you can drag up into the island, or tap. It drifts a little while it waits.
struct ThrowChip<Face: View>: View {
    /// The island's centre in the "stage" coordinate space.
    let target: CGPoint
    var drift = 2.2
    let onDragStart: () -> Void
    let onDragCancel: () -> Void
    /// Called with the chip's frame (in "stage" space) when it's thrown or tapped.
    let onThrow: (CGRect) -> Void
    @ViewBuilder let face: Face

    @State private var drag: CGSize = .zero
    @State private var dragging = false
    @State private var layoutFrame: CGRect = .zero
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        face
            .phaseAnimator([false, true]) { content, up in
                content.offset(y: reduceMotion || dragging ? 0 : (up ? -2.5 : 2.5))
            } animation: { _ in .easeInOut(duration: drift) }
            .scaleEffect(dragging ? 1.07 : 1)
            .offset(drag)
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(IslandStage.space)) } action: { layoutFrame = $0 }
            .onTapGesture { onThrow(layoutFrame) }
            .gesture(
                DragGesture(minimumDistance: 8, coordinateSpace: .named(IslandStage.space))
                    .onChanged { value in
                        if !dragging {
                            dragging = true
                            onDragStart()
                        }
                        drag = value.translation
                    }
                    .onEnded { value in
                        dragging = false
                        let flungUp = value.translation.height < -50 && value.predictedEndLocation.y < target.y + 160
                        let near = hypot(value.location.x - target.x, value.location.y - target.y) < 130
                        if flungUp || near {
                            let frame = layoutFrame.offsetBy(dx: drag.width, dy: drag.height)
                            drag = .zero
                            onThrow(frame)
                        } else {
                            withAnimation(.spring(duration: 0.45, bounce: 0.35)) { drag = .zero }
                            onDragCancel()
                        }
                    }
            )
            .animation(.spring(duration: 0.25), value: dragging)
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Adds it to FocuzNow")
            .accessibilityAction { onThrow(layoutFrame) }
    }
}

/// Names shared by the island pieces.
enum IslandStage {
    /// The full-screen coordinate space chips and the island measure themselves in.
    static let space = "islandStage"
}

// MARK: Layout

/// Lays chips out left to right and wraps onto new lines.
struct FlowLayout: Layout {
    var spacing: CGFloat = 10

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: proposal.width ?? widest, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
