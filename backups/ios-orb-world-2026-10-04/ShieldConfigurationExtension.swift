import ManagedSettings
import ManagedSettingsUI
import UIKit

/// The screen shown over a blocked app or site. Apple only lets us set an icon, a title, a subtitle,
/// two buttons and colours, so the FocuzNow look has to fit in that.
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

    private func focusShield(for name: String?) -> ShieldConfiguration {
        ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: UIColor(white: 0.07, alpha: 0.55),
            icon: UIImage(systemName: "bolt.circle.fill"),
            title: ShieldConfiguration.Label(text: "Stay focused", color: .white),
            subtitle: ShieldConfiguration.Label(
                text: "\(name ?? "This") is blocked during your FocuzNow session.",
                color: UIColor(white: 0.82, alpha: 1)
            ),
            primaryButtonLabel: ShieldConfiguration.Label(text: "Close", color: .black),
            primaryButtonBackgroundColor: .white,
            secondaryButtonLabel: ShieldConfiguration.Label(text: "Ask for 5 minutes", color: .white)
        )
    }
}
