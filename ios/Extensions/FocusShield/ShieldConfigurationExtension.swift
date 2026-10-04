import ManagedSettings
import ManagedSettingsUI
import UIKit

/// The screen shown over a blocked app or site, in the FocuzNow look. Apple only lets us set the
/// background, an icon, a title, a subtitle and two buttons (text and colours, no fonts or layout),
/// so the look comes from those: near-black glass, the focus orb with the Beam Z as the icon, a mint
/// "Back to focus" button, and when the session ends.
class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        focusShield(for: application.localizedDisplayName)
    }

    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
        focusShield(for: application.localizedDisplayName)
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        focusShield(for: webDomain.domain)
    }

    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
        focusShield(for: webDomain.domain)
    }

    private static let mint = UIColor(red: 0.651, green: 0.902, blue: 0.749, alpha: 1)

    private func focusShield(for name: String?) -> ShieldConfiguration {
        ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor(red: 0.02, green: 0.035, blue: 0.03, alpha: 0.94),
            icon: Self.orbIcon,
            title: ShieldConfiguration.Label(text: "\(name ?? "This") can wait", color: .white),
            subtitle: ShieldConfiguration.Label(text: Self.subtitle, color: UIColor(white: 1, alpha: 0.62)),
            primaryButtonLabel: ShieldConfiguration.Label(text: "Back to focus", color: .black),
            primaryButtonBackgroundColor: Self.mint,
            secondaryButtonLabel: ShieldConfiguration.Label(text: "Ask for 5 minutes", color: Self.mint)
        )
    }

    /// "It's back at 3:45 PM." while a session runs (the app saves its end in the App Group,
    /// `BlockList.sessionEndKey`); otherwise the daily block.
    private static var subtitle: String {
        let defaults = UserDefaults(suiteName: "group.com.focuznow.shared")
        if let end = defaults?.object(forKey: "sessionEnd") as? Date, end > .now {
            return "You're in a focus session. It's back at \(end.formatted(date: .omitted, time: .shortened)), and your orb's charging."
        }
        return "Your FocuzNow block is on. Stay with it, it's worth it."
    }

    /// The focus orb with the Beam Z in it, drawn here (the extension has no asset catalog).
    private static let orbIcon: UIImage = {
        let size = CGSize(width: 180, height: 180)
        return UIGraphicsImageRenderer(size: size).image { context in
            let cg = context.cgContext
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let space = CGColorSpaceCreateDeviceRGB()
            func gradient(_ colors: [UIColor], _ stops: [CGFloat]) -> CGGradient? {
                CGGradient(colorsSpace: space, colors: colors.map(\.cgColor) as CFArray, locations: stops)
            }
            // The glow round it.
            if let glow = gradient([ShieldConfigurationExtension.mint.withAlphaComponent(0.55), ShieldConfigurationExtension.mint.withAlphaComponent(0)], [0, 1]) {
                cg.drawRadialGradient(glow, startCenter: center, startRadius: 46, endCenter: center, endRadius: 90, options: [])
            }
            // The dark glass, lit from inside.
            let ball = CGRect(x: center.x - 58, y: center.y - 58, width: 116, height: 116)
            cg.saveGState()
            cg.addEllipse(in: ball)
            cg.clip()
            if let glass = gradient([UIColor(red: 0.16, green: 0.42, blue: 0.33, alpha: 1), UIColor(red: 0.02, green: 0.07, blue: 0.055, alpha: 1)], [0, 1]) {
                cg.drawRadialGradient(glass, startCenter: center, startRadius: 0, endCenter: center, endRadius: 60, options: [])
            }
            cg.restoreGState()
            cg.setStrokeColor(ShieldConfigurationExtension.mint.withAlphaComponent(0.85).cgColor)
            cg.setLineWidth(2)
            cg.strokeEllipse(in: ball.insetBy(dx: 1, dy: 1))
            // The Beam Z, the extension's path (a 64 × 64 box), in bone.
            let s: CGFloat = 1.6
            let ox = center.x - 32 * s, oy = center.y - 32 * s
            let z = UIBezierPath()
            let points: [(CGFloat, CGFloat)] = [(20, 17.8), (47.2, 17.8), (47.2, 22.2), (22.8, 41.8), (47.2, 41.8),
                                                (44, 46.2), (16.8, 46.2), (16.8, 41.8), (29.2, 22.2), (16.8, 22.2)]
            for (i, p) in points.enumerated() {
                let point = CGPoint(x: ox + p.0 * s, y: oy + p.1 * s)
                if i == 0 { z.move(to: point) } else { z.addLine(to: point) }
            }
            z.close()
            cg.setShadow(offset: .zero, blur: 10, color: ShieldConfigurationExtension.mint.cgColor)
            UIColor(red: 0.957, green: 0.949, blue: 0.933, alpha: 1).setFill()
            z.fill()
        }
    }()
}
