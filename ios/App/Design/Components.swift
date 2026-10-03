import SwiftUI

// MARK: Buttons

/// The primary action: a capsule in the Beam gradient. One per screen.
struct BeamButtonStyle: ButtonStyle {
    var gold = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(gold ? Color(hex: 0x3A2200) : .white)
            .padding(.vertical, 17)
            .frame(maxWidth: .infinity)
            .background(Capsule().fill(gold ? Theme.goldGradient : Theme.beamGradient))
            .overlay(Capsule().strokeBorder(.white.opacity(0.28), lineWidth: 1))
            .shadow(color: (gold ? Theme.gold : Theme.violet).opacity(0.45), radius: 18, y: 8)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.smooth(duration: 0.2), value: configuration.isPressed)
    }
}

/// A secondary capsule: glass on iOS 26, frosted on 18.
struct GlassPillStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(Color.fzInk)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity)
            .fzGlass(in: Capsule(), interactive: true)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.smooth(duration: 0.2), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == BeamButtonStyle {
    static var beam: BeamButtonStyle { BeamButtonStyle() }
    static var beamGold: BeamButtonStyle { BeamButtonStyle(gold: true) }
}

extension ButtonStyle where Self == GlassPillStyle {
    static var glassPill: GlassPillStyle { GlassPillStyle() }
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
        .buttonStyle(.plain)
    }
}

// MARK: Text

/// `NOW`, `SCREEN TIME`: small caps labels (spec §2).
struct SectionLabel: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.semibold))
            .tracking(1.2)
            .foregroundStyle(Color.fzInk3)
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
                VStack(spacing: 4) {
                    SectionLabel(item.label)
                    HStack(spacing: 3) {
                        if let trend = item.trend {
                            Image(systemName: trend >= 0 ? "arrowtriangle.up.fill" : "arrowtriangle.down.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(trend >= 0 ? Theme.good : Theme.danger)
                        }
                        Text(item.value)
                            .font(.fzNumber(20, weight: .semibold))
                            .foregroundStyle(Color.fzInk)
                            .contentTransition(.numericText())
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
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
        .foregroundStyle(selected ? Color.white : Color.fzInk)
        .background {
            if selected {
                Capsule().fill(Theme.beamGradient)
            } else {
                Capsule().fill(Color.fzSurface).overlay(Capsule().strokeBorder(Color.fzLine))
            }
        }
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
            .background(LinearGradient(colors: [app.color, app.color.opacity(0.75)], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: size * 0.26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: size * 0.26, style: .continuous).strokeBorder(.black.opacity(0.25), lineWidth: 1.5))
    }
}

struct Avatar: View {
    let name: String
    var size: CGFloat = 34

    var body: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(LinearGradient(colors: [Theme.tileColor(for: name), Theme.tileColor(for: name + "x").opacity(0.8)], startPoint: .topLeading, endPoint: .bottomTrailing), in: Circle())
            .overlay(Circle().strokeBorder(.white.opacity(0.35), lineWidth: 1))
    }
}

/// A letter tile for vault items, in the pastel hue of its name.
struct LetterTile: View {
    let title: String
    var size: CGFloat = 40

    var body: some View {
        Text(String(title.prefix(2)))
            .font(.system(size: size * 0.36, weight: .bold, design: .rounded))
            .foregroundStyle(Color.black.opacity(0.72))
            .frame(width: size, height: size)
            .background(
                LinearGradient(colors: [Theme.tileColor(for: title).mix(with: .white, by: 0.25), Theme.tileColor(for: title)], startPoint: .top, endPoint: .bottom),
                in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            )
            .overlay(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous).strokeBorder(.white.opacity(0.5), lineWidth: 1))
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
                        .fill(session.isOnBreak(at: context.date) ? Theme.warn : Theme.good)
                        .frame(width: 8, height: 8)
                        .shadow(color: Theme.good.opacity(0.8), radius: 4)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(session.isOnBreak(at: context.date) ? "On a break" : "In session · \(session.blockedCount) blocked")
                            .font(.caption2)
                            .foregroundStyle(Color.fzInk3)
                        Label(session.title, systemImage: session.symbol)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.fzInk)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Text(FocusSession.clock(session.remaining(at: context.date)))
                        .font(.fzNumber(17, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Color.fzInk)
                        .contentTransition(.numericText())
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
