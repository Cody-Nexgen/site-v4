import AuthenticationServices
import UIKit

/// FocuzPass in the QuickType bar. Phase 0 only registers the extension; Phase 5 unlocks with Face ID
/// and returns the picked login (and passkeys).
class CredentialProviderViewController: ASCredentialProviderViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let label = UILabel()
        label.text = "FocuzPass AutoFill is coming soon."
        label.textAlignment = .center
        label.numberOfLines = 0

        let cancel = UIButton(type: .system, primaryAction: UIAction(title: "Close") { [weak self] _ in self?.cancel() })

        let stack = UIStackView(arrangedSubviews: [label, cancel])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.layoutMarginsGuide.leadingAnchor),
        ])
    }

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        // Phase 5: show the matching logins.
    }

    private func cancel() {
        extensionContext.cancelRequest(withError: NSError(domain: ASExtensionErrorDomain, code: ASExtensionError.userCanceled.rawValue))
    }
}
