import SwiftUI

// MARK: Buttons

/// The primary action, like focuznow.com: a solid white button with black text on dark (ink with
/// white on light), 16pt corners. One per screen. `gold` keeps the old name for the Pro screen.
struct BeamButtonStyle: ButtonStyle {
    var gold = false
    @Environment(\.colorScheme) private var scheme
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(scheme == .dark ? Color.black : Color.white)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(scheme == .dark ? Color.white : Color.fzInk))
            .fzBottomGlow(strength: enabled ? (configuration.isPressed ? 1.4 : 1) : 0)
            .opacity(enabled ? 1 : 0.35)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// A secondary button: a quiet outline (glass on iOS 26).
struct GlassPillStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Color.fzInk)
            .frame(maxWidth: .infinity)
            .frame(height: 54)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.fzInk.opacity(0.06)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.fzLine))
            .fzBottomGlow(strength: 0.5)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

/// Text-only button ("End early", "Not now").
struct GhostButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.medium))
            .foregroundStyle(Color.fzInk2)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .contentShape(Rectangle())
            .opacity(configuration.isPressed ? 0.5 : 1)
    }
}

/// Any tappable card: it gives a little when pressed.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == BeamButtonStyle {
    static var beam: BeamButtonStyle { BeamButtonStyle() }
    static var beamGold: BeamButtonStyle { BeamButtonStyle(gold: true) }
}

extension ButtonStyle where Self == GlassPillStyle {
    static var glassPill: GlassPillStyle { GlassPillStyle() }
}

extension ButtonStyle where Self == GhostButtonStyle {
    static var ghost: GhostButtonStyle { GhostButtonStyle() }
}

extension ButtonStyle where Self == PressableStyle {
    static var pressable: PressableStyle { PressableStyle() }
}

/// A round floating glass button (add, close, help).
struct GlassCircleButton: View {
    let symbol: String
    var size: CGFloat = 44
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size * 0.4, weight: .semibold))
                .foregroundStyle(Color.fzInk)
                .frame(width: size, height: size)
                .fzGlass(in: Circle(), interactive: true)
        }
        .buttonStyle(.pressable)
    }
}

// MARK: Text

/// `FOCUS SCORE`, `UP NEXT`: small caps labels.
struct SectionLabel: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.semibold))
            .tracking(1.3)
            .foregroundStyle(Color.fzInk3)
    }
}

/// A screen title in the headline face: "Focus", "Plan".
struct ScreenTitle: View {
    let text: String
    var size: CGFloat = 36

    init(_ text: String, size: CGFloat = 36) {
        self.text = text
        self.size = size
    }

    var body: some View {
        Text(text)
            .font(.fzDisplay(size))
            .fzTight(size)
            .foregroundStyle(Color.fzInk)
    }
}

/// The Beam Z mark in its tile, like the website's header.
struct ZMark: View {
    var size: CGFloat = 30

    var body: some View {
        Text("Z")
            .font(.fzDisplay(size * 0.55))
            .foregroundStyle(Color.fzInk)
            .frame(width: size, height: size)
            .background(Color.fzSurface, in: RoundedRectangle(cornerRadius: size * 0.27, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: size * 0.27, style: .continuous).strokeBorder(Color.fzLine))
    }
}

/// Three labelled numbers in a row.
struct StatTrio: View {
    struct Item: Identifiable {
        let id = UUID()
        let label: String
        let value: String
        var trend: Double? = nil
    }

    let items: [Item]

    var body: some View {
        HStack(alignment: .top) {
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 4) {
                    SectionLabel(item.label)
                    HStack(spacing: 3) {
                        if let trend = item.trend {
                            Image(systemName: trend >= 0 ? "arrow.up.right" : "arrow.down.right")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(Color.fzInk2)
                        }
                        Text(item.value)
                            .font(.fzNumber(22))
                            .foregroundStyle(Color.fzInk)
                            .contentTransition(.numericText())
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

// MARK: Bone tiles (the website's feature card)

/// A tile inside a bone card: black icon square, title, detail.
struct BoneTile: View {
    let symbol: String
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.fzBone)
                .frame(width: 30, height: 30)
                .background(Color.fzOnBone, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Spacer(minLength: 14)
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.fzOnBone)
                .lineLimit(1)
            Text(detail)
                .font(.caption)
                .foregroundStyle(Color.fzOnBone2)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
        .padding(12)
        .background(Color.fzBoneTile, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: Bits

struct Chip: View {
    let title: String
    var symbol: String? = nil
    var selected = false

    var body: some View {
        HStack(spacing: 6) {
            if let symbol { Image(systemName: symbol) }
            Text(title)
        }
        .font(.subheadline.weight(.semibold))
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .foregroundStyle(selected ? Color.fzBg : Color.fzInk)
        .background {
            if selected {
                Capsule().fill(Color.fzInk)
            } else {
                Capsule().fill(Color.fzSurface).overlay(Capsule().strokeBorder(Color.fzLine))
            }
        }
        .animation(.spring(duration: 0.3), value: selected)
    }
}

/// Overlapping app icons (mock apps until Screen Time tokens are wired).
struct AppStack: View {
    let apps: [DistractionApp]
    var size: CGFloat = 30
    var limit = 4

    var body: some View {
        HStack(spacing: -size * 0.28) {
            ForEach(apps.prefix(limit)) { app in
                AppIcon(app: app, size: size)
            }
            if apps.count > limit {
                Text("+\(apps.count - limit)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.fzInk)
                    .frame(width: size, height: size)
                    .background(Color.fzSurface, in: RoundedRectangle(cornerRadius: size * 0.26, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: size * 0.26, style: .continuous).strokeBorder(Color.fzLine))
            }
        }
    }
}

struct AppIcon: View {
    let app: DistractionApp
    var size: CGFloat = 30

    var body: some View {
        Image(systemName: app.symbol)
            .font(.system(size: size * 0.5, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(app.color, in: RoundedRectangle(cornerRadius: size * 0.26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: size * 0.26, style: .continuous).strokeBorder(Color.fzBg, lineWidth: 1.5))
    }
}

/// A bone circle with the initial, like the website's account button.
struct Avatar: View {
    let name: String
    var size: CGFloat = 34

    var body: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.fzDisplay(size * 0.44, weight: .bold))
            .foregroundStyle(Color.fzOnBone)
            .frame(width: size, height: size)
            .background(Color.fzBone, in: Circle())
    }
}

/// A letter tile for vault items.
struct LetterTile: View {
    let title: String
    var size: CGFloat = 40

    var body: some View {
        Text(String(title.prefix(2)))
            .font(.fzDisplay(size * 0.36, weight: .bold))
            .foregroundStyle(Color.fzOnBone)
            .frame(width: size, height: size)
            .background(Color.fzBoneTile, in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
    }
}

/// The running session, floating above the tab bar (or as the iOS 26 tab bar accessory).
struct SessionBar: View {
    let session: FocusSession
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                HStack(spacing: 12) {
                    Circle()
                        .fill(Color.fzInk)
                        .frame(width: 7, height: 7)
                        .phaseAnimator([0.35, 1.0]) { dot, phase in dot.opacity(phase) } animation: { _ in .easeInOut(duration: 1.2) }
                    VStack(alignment: .leading, spacing: 1) {
                        Text(session.isOnBreak(at: context.date) ? "On a break" : "In session · \(session.blockedCount) blocked")
                            .font(.caption2)
                            .foregroundStyle(Color.fzInk3)
                        Text(session.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.fzInk)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Text(FocusSession.clock(session.remaining(at: context.date)))
                        .font(.fzNumber(18))
                        .monospacedDigit()
                        .foregroundStyle(Color.fzInk)
                        .contentTransition(.numericText(countsDown: true))
                    Image(systemName: "chevron.up")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.fzInk2)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open your focus session")
    }
}

/// A small lamp: a bright core with a soft halo that breathes. Coach's "thinking" and empty state.
struct LampGlow: View {
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            Circle().fill(Theme.accent.opacity(0.35)).blur(radius: size * 0.25)
            Circle().fill(Theme.accent).frame(width: size * 0.32, height: size * 0.32)
                .shadow(color: Theme.accent.opacity(0.8), radius: size * 0.12)
        }
        .frame(width: size, height: size)
        .phaseAnimator([0.82, 1.0]) { lamp, phase in
            lamp.scaleEffect(phase).opacity(0.7 + 0.3 * phase)
        } animation: { _ in .easeInOut(duration: 1.4) }
        .accessibilityHidden(true)
    }
}
