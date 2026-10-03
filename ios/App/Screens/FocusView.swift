import FamilyControls
import SwiftUI

/// Phase 0 only checks that Screen Time works on this device and Apple ID (the Family Controls
/// entitlement). Timers, picking apps and the shield come in Phase 2.
struct FocusView: View {
    @State private var status = AuthorizationCenter.shared.authorizationStatus
    @State private var error: String?

    var body: some View {
        List {
            Section {
                HStack {
                    Text("Screen Time")
                    Spacer()
                    Text(statusText).foregroundStyle(status == .approved ? .green : Color.fzText3)
                }
                if status != .approved {
                    Button("Allow Screen Time") {
                        Task { await requestAccess() }
                    }
                }
            } footer: {
                Text(error ?? "FocuzNow uses Screen Time to block the apps and sites you pick, only during your focus sessions. It never sees which apps you use.")
            }
        }
        .navigationTitle("Focus")
    }

    private var statusText: String {
        switch status {
        case .approved: "Allowed"
        case .denied: "Not allowed"
        case .notDetermined: "Not asked yet"
        @unknown default: "Unknown"
        }
    }

    @MainActor
    private func requestAccess() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            error = nil
        } catch {
            // Common causes: the Simulator (Screen Time only works on a real device) or a build
            // without the Family Controls entitlement.
            self.error = "Couldn't turn on Screen Time: \(error.localizedDescription)"
        }
        status = AuthorizationCenter.shared.authorizationStatus
    }
}
