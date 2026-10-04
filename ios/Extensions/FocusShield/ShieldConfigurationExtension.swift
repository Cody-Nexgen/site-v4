import ManagedSettings
import ManagedSettingsUI
import UIKit

/// The screen over a blocked app or site. Apple only lets us set the background, an icon, a title, a
/// subtitle and the buttons (text and colours; no fonts, no layout), so it's kept to the essentials:
/// pure black, the Beam Z, a line written like a person would say it, and one way out: back to focus.
class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        shield(for: application.localizedDisplayName)
    }

    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        shield(for: application.localizedDisplayName)
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        shield(for: webDomain.domain)
    }

    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
        shield(for: webDomain.domain)
    }

    private func shield(for name: String?) -> ShieldConfiguration {
        let app = name ?? "This"
        // A different line each minute, so it doesn't feel like a form letter.
        let pick = Int(Date.now.timeIntervalSince1970 / 60)
        let titles = [
            "Not now, \(app).",
            "\(app) can wait.",
            "\(app) is on a break.",
            "Nice try.",
            "We've been here before.",
        ]
        return ShieldConfiguration(
            backgroundBlurStyle: nil,
            backgroundColor: .black,
            icon: Self.mark,
            title: ShieldConfiguration.Label(text: titles[pick % titles.count], color: .white),
            subtitle: ShieldConfiguration.Label(text: Self.subtitle(pick), color: UIColor(white: 1, alpha: 0.6)),
            primaryButtonLabel: ShieldConfiguration.Label(text: "Back to focus", color: .black),
            primaryButtonBackgroundColor: UIColor(red: 0.933, green: 0.953, blue: 0.925, alpha: 1)
        )
    }

    /// When it opens again, while a session runs (the app saves its end in the App Group,
    /// `BlockList.sessionEndKey`); otherwise the daily block.
    private static func subtitle(_ pick: Int) -> String {
        let defaults = UserDefaults(suiteName: "group.com.focuznow.shared")
        if let end = defaults?.object(forKey: "sessionEnd") as? Date, end > .now {
            let time = end.formatted(date: .omitted, time: .shortened)
            let lines = [
                "It's back at \(time). Future you says thanks.",
                "Opens again at \(time). You were doing so well.",
                "See you at \(time). It'll still be there, promise.",
            ]
            return lines[pick % lines.count]
        }
        let lines = [
            "Your FocuzNow block is on. It'll still be there later, promise.",
            "Blocked for now. Whatever it was, it can wait.",
        ]
        return lines[pick % lines.count]
    }

    /// The Beam Z (the extension's path, a 64 × 64 box) in bone, with a faint mint light under it.
    private static let mark: UIImage = {
        let size = CGSize(width: 120, height: 120)
        return UIGraphicsImageRenderer(size: size).image { context in
            let cg = context.cgContext
            let s: CGFloat = 1.9
            let ox = size.width / 2 - 32 * s, oy = size.height / 2 - 32 * s
            let points: [(CGFloat, CGFloat)] = [(20, 17.8), (47.2, 17.8), (47.2, 22.2), (22.8, 41.8), (47.2, 41.8),
                                                (44, 46.2), (16.8, 46.2), (16.8, 41.8), (29.2, 22.2), (16.8, 22.2)]
            let z = UIBezierPath()
            for (i, p) in points.enumerated() {
                let point = CGPoint(x: ox + p.0 * s, y: oy + p.1 * s)
                if i == 0 { z.move(to: point) } else { z.addLine(to: point) }
            }
            z.close()
            cg.setShadow(offset: CGSize(width: 0, height: 6), blur: 18,
                         color: UIColor(red: 0.651, green: 0.902, blue: 0.749, alpha: 0.55).cgColor)
            UIColor(red: 0.957, green: 0.949, blue: 0.933, alpha: 1).setFill()
            z.fill()
        }
    }()
}
