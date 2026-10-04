import ActivityKit
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit
import UserNotifications

/// Settings → Developer → Developer tools (shown when Developer mode is on). For testing, for people
/// who like to see what's going on, and for anyone whose app is misbehaving: what FocuzNow is allowed
/// to do, what it's doing right now, and ways to reset it. "Copy diagnostics" gives support
/// something to go on without any personal data.
struct DeveloperView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("onboarded") private var onboarded = true
    @AppStorage("onboardingStep") private var onboardingStep = 0

    @State private var notifications = "Checking…"
    @State private var activities = Activity<FocusActivityAttributes>.activities.count
    @State private var copied = false

    var body: some View {
        List {
            Section {
                Button("Replay onboarding") {
                    onboardingStep = 0
                    onboarded = false
                }
                row("Dynamic Island", IslandGeometry.deviceHasIsland ? "Yes" : "No (floating pill)")
            } header: {
                Text("Onboarding")
            } footer: {
                Text("Plays the onboarding (the title sequence) from the start. Your answers replace the current ones.")
            }

            Section("Live Activity") {
                row("Allowed", LiveFocus.activitiesEnabled ? "Yes" : "Off in Settings")
                row("Running now", "\(activities)")
                Button("Start a 1-minute test session") {
                    model.sessionMinutes = 1
                    model.startSession()
                    model.showSession = false
                    refresh()
                }
                .disabled(model.session != nil)
                Button("End the session", role: .destructive) {
                    model.endSession(completedFully: false)
                    refresh()
                }
                .disabled(model.session == nil)
            }

            Section {
                row("Permission", screenTimeStatus)
                row("Locked apps and categories", "\(BlockList.count(model.selection))")
                row("Daily block", BlockList.dailyWindow?.label ?? "None")
                if AuthorizationCenter.shared.authorizationStatus != .approved {
                    Button("Ask for Screen Time") {
                        Task {
                            try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                            refresh()
                        }
                    }
                }
                Button("Cancel the daily block", role: .destructive) {
                    BlockList.cancelDaily()
                    refresh()
                }
                .disabled(BlockList.dailyWindow == nil)
                Button("Unlock everything now", role: .destructive) {
                    ManagedSettingsStore(named: .focus).clearAllSettings()
                    ManagedSettingsStore(named: .daily).clearAllSettings()
                }
            } header: {
                Text("Screen Time")
            } footer: {
                Text("Unlocking clears the shields until the next session or daily block starts.")
            }

            Section("Notifications") {
                row("Permission", notifications)
            }

            Section {
                row("App", appVersion)
                row("iOS", UIDevice.current.systemVersion)
                row("Device", deviceModel)
                Button(copied ? "Copied" : "Copy diagnostics") {
                    UIPasteboard.general.string = diagnostics
                    copied = true
                }
            } header: {
                Text("This device")
            } footer: {
                Text("Diagnostics are the lines on this page: versions and permissions, no names or app lists.")
            }
        }
        .navigationTitle("Developer tools")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadNotifications() }
        .onAppear(perform: refresh)
    }

    private func row(_ title: String, _ value: String) -> some View {
        LabeledContent(title, value: value)
    }

    private func refresh() {
        activities = Activity<FocusActivityAttributes>.activities.count
    }

    private func loadNotifications() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        notifications = switch settings.authorizationStatus {
        case .authorized: "Allowed"
        case .denied: "Off in Settings"
        case .notDetermined: "Not asked yet"
        case .provisional: "Quiet (provisional)"
        case .ephemeral: "Ephemeral"
        @unknown default: "Unknown"
        }
    }

    private var screenTimeStatus: String {
        switch AuthorizationCenter.shared.authorizationStatus {
        case .approved: "Allowed"
        case .denied: "Denied"
        case .notDetermined: "Not asked yet"
        @unknown default: "Unknown"
        }
    }

    private var appVersion: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\(version) (\(build))"
    }

    /// "iPhone16,1", the hardware model.
    private var deviceModel: String {
        var info = utsname()
        uname(&info)
        return withUnsafeBytes(of: &info.machine) { buffer in
            String(decoding: buffer.prefix { $0 != 0 }, as: UTF8.self)
        }
    }

    private var diagnostics: String {
        [
            "FocuzNow \(appVersion)",
            "iOS \(UIDevice.current.systemVersion), \(deviceModel)",
            "Dynamic Island: \(IslandGeometry.deviceHasIsland ? "yes" : "no")",
            "Live Activities: \(LiveFocus.activitiesEnabled ? "allowed" : "off"), running: \(activities)",
            "Screen Time: \(screenTimeStatus), locked: \(BlockList.count(model.selection)), daily block: \(BlockList.dailyWindow?.label ?? "none")",
            "Notifications: \(notifications)",
            "Session running: \(model.session != nil ? "yes" : "no")",
        ].joined(separator: "\n")
    }
}
