import FamilyControls
import SwiftUI
import UserNotifications

// The You tab's settings, each on its own page (like iOS Settings): its light, what it does in a
// sentence or two, the switch, and every option under it. You only shows a row with its state.

/// A setting's page: a big icon that lights up while it's on, the title, a line about it, then the rest.
struct SettingPage<Content: View>: View {
    let symbol: String
    let title: String
    let blurb: String
    var lit = false
    let content: Content

    init(symbol: String, title: String, blurb: String, lit: Bool = false, @ViewBuilder content: () -> Content) {
        self.symbol = symbol
        self.title = title
        self.blurb = blurb
        self.lit = lit
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                VStack(alignment: .leading, spacing: 14) {
                    Image(systemName: symbol)
                        .font(.system(size: 26, weight: .semibold))
                        .foregroundStyle(lit ? Color.black : .white)
                        .frame(width: 64, height: 64)
                        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(lit ? Color.fzMint : .white.opacity(0.07)))
                        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.white.opacity(lit ? 0 : 0.12)))
                        .shadow(color: lit ? Color.fzMint.opacity(0.4) : .clear, radius: 14)
                        .animation(.spring(duration: 0.4), value: lit)
                    Text(title)
                        .font(.fzDisplay(30, weight: .bold))
                        .fzTight(30)
                        .foregroundStyle(.white)
                    Text(blurb)
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.62))
                        .fixedSize(horizontal: false, vertical: true)
                }
                .riseIn()
                content
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 40)
            .frame(maxWidth: 600)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background {
            ZStack(alignment: .top) {
                Color.black
                RadialGradient(colors: [Color.fzMint.opacity(lit ? 0.12 : 0.05), .clear], center: .center, startRadius: 0, endRadius: 240)
                    .frame(width: 520, height: 420)
                    .offset(x: -120, y: -140)
                    .animation(.easeInOut(duration: 0.5), value: lit)
            }
            .ignoresSafeArea()
        }
        .buttonStyle(.plain)
        .environment(\.colorScheme, .dark)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// A line of "how it works": a small icon and a sentence.
struct SettingNote: View {
    let symbol: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.fzMint)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Color.fzMint.opacity(0.12)))
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
    }
}

/// Things several pages do.
@MainActor
enum AccountActions {
    /// Runs `then` once FocuzNow may use Screen Time, asking first if it hasn't yet.
    static func withScreenTime(_ popups: PopupCenter, _ then: @escaping () -> Void) {
        if LiveFocus.screenTimeApproved { then(); return }
        Task {
            try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            if LiveFocus.screenTimeApproved {
                then()
            } else {
                popups.show(FZPopup(symbol: "hourglass", title: "This needs Screen Time",
                                    message: "FocuzNow uses Apple's Screen Time to do this. You can allow it in Settings → Screen Time.",
                                    primary: "Open Settings", onPrimary: { openSettings() }))
            }
        }
    }

    /// A real autofocus nudge in 4 seconds, so you can lock the phone and see it like the real thing.
    static func sendTestNudge(_ popups: PopupCenter, _ protections: Protections, explain: Bool, sent: @escaping () -> Void = {}) {
        Task {
            let center = UNUserNotificationCenter.current()
            _ = try? await center.requestAuthorization(options: [.alert, .sound])
            guard await center.notificationSettings().authorizationStatus == .authorized else {
                popups.show(FZPopup(symbol: "bell.slash.fill", title: "Notifications are off",
                                    message: "Autofocus talks to you through notifications. Switch them on for FocuzNow in Settings.",
                                    primary: "Open Settings", onPrimary: { openSettings() }))
                return
            }
            Autofocus.notify(minutes: protections.autofocusMinutes, locked: protections.autofocusLocks, after: 4)
            sent()
            if explain {
                popups.show(FZPopup(symbol: "bell.badge.fill", title: "Incoming in 4 seconds",
                                    message: "Lock your phone to see it the way you'll see the real thing.",
                                    primary: "Okay", secondary: nil))
            }
        }
    }

    static func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }
}

// MARK: Autofocus

struct AutofocusPage: View {
    @Environment(AppModel.self) private var model
    @Environment(PopupCenter.self) private var popups
    let open: (AppTab) -> Void
    /// Which line the preview shows.
    @State private var line = 0
    @State private var sent = 0

    var body: some View {
        let protections = model.protections
        let lines = Autofocus.lines(minutes: protections.autofocusMinutes, locked: protections.autofocusLocks)
        let shown = lines[line % lines.count]
        SettingPage(symbol: "wand.and.stars", title: "Autofocus",
                    blurb: "When scrolling runs long, FocuzNow taps you on the shoulder. Or, if you'd rather, takes the apps away for 15 minutes.",
                    lit: protections.autofocus) {
            AccountSection("") {
                AccountToggleRow(symbol: "wand.and.stars", title: "Autofocus", isOn: binding)
            }
            if protections.autofocus {
                Group {
                    AccountSection("Step in after", footer: "Time in the apps on your block list, counted from midnight.") {
                        HStack(spacing: 8) {
                            ForEach([30, 60, 120, 180], id: \.self) { minutes in
                                AccountChip(title: GoalDial.format(minutes), selected: protections.autofocusMinutes == minutes) {
                                    model.protections.autofocusMinutes = minutes
                                }
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(14)
                    }
                    AccountSection("Then") {
                        HStack(spacing: 10) {
                            AutofocusOption(symbol: "bell.fill", title: "Just nudge me", detail: "A notification. You decide.",
                                            selected: !protections.autofocusLocks) { model.protections.autofocusLocks = false }
                            AutofocusOption(symbol: "lock.fill", title: "Lock them", detail: "15 minutes off, no arguing.",
                                            selected: protections.autofocusLocks) { model.protections.autofocusLocks = true }
                        }
                        .padding(14)
                    }
                    AccountSection("What it sounds like") {
                        VStack(spacing: 12) {
                            NudgePreview(title: shown.title, message: shown.body)
                                .id(line)
                                .transition(.blurRise)
                                .onTapGesture { withAnimation(.spring(duration: 0.45)) { line += 1 } }
                            HStack(spacing: 10) {
                                Button {
                                    withAnimation(.spring(duration: 0.45)) { line += 1 }
                                } label: {
                                    Label("Another one", systemImage: "shuffle")
                                }
                                .buttonStyle(FZGlassButtonStyle(height: 44))
                                Button {
                                    AccountActions.sendTestNudge(popups, protections, explain: true) { sent += 1 }
                                } label: {
                                    Label("Send me one", systemImage: "paperplane.fill")
                                }
                                .buttonStyle(FZGlassButtonStyle(height: 44))
                            }
                        }
                        .padding(14)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.spring(duration: 0.45), value: protections.autofocus)
        .sensoryFeedback(.success, trigger: sent)
    }

    private var binding: Binding<Bool> {
        Binding {
            model.protections.autofocus
        } set: { on in
            if on {
                turnOn()
            } else {
                popups.withPin("Switching autofocus off needs your PIN.") { model.protections.autofocus = false }
            }
        }
    }

    private func turnOn() {
        guard BlockList.count(model.selection) > 0 else {
            popups.show(FZPopup(symbol: "square.stack.3d.up.fill", title: "Pick your time sinks first",
                                message: "Autofocus watches the apps on your block list. Choose them in Focus, then come back.",
                                primary: "Pick apps", onPrimary: { open(.focus) }))
            return
        }
        AccountActions.withScreenTime(popups) {
            Task {
                _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
                withAnimation(.spring(duration: 0.45)) { model.protections.autofocus = true }
            }
        }
    }
}

// MARK: Uninstall protection

struct UninstallProtectionPage: View {
    @Environment(AppModel.self) private var model
    @Environment(PopupCenter.self) private var popups

    var body: some View {
        SettingPage(symbol: "lock.shield", title: "Uninstall protection",
                    blurb: "Deleting the app is the oldest trick in the book. While a block is on, it stops working.",
                    lit: model.protections.uninstallProtection) {
            AccountSection("") {
                AccountToggleRow(symbol: "lock.shield", title: "Uninstall protection", isOn: binding)
            }
            AccountSection("How it works") {
                SettingNote(symbol: "lock.fill", text: "While anything is blocked (a session, your daily block, autofocus), no app can be deleted. FocuzNow included.")
                AccountDivider()
                SettingNote(symbol: "hand.tap.fill", text: "Holding an icon only offers Remove from Home Screen. Settings → General → iPhone Storage can't delete either.")
                AccountDivider()
                SettingNote(symbol: "clock.fill", text: "It can't be switched off during a block. Afterwards it needs your PIN, if you've set one.")
                AccountDivider()
                SettingNote(symbol: "info.circle.fill", text: "One thing no app can stop: switching FocuzNow off in Settings → Screen Time. Hopefully that's enough effort to make you think twice.")
            }
        }
    }

    private var binding: Binding<Bool> {
        Binding {
            model.protections.uninstallProtection
        } set: { on in
            if on {
                AccountActions.withScreenTime(popups) { model.protections.uninstallProtection = true }
            } else if Protections.isBlocking {
                popups.show(FZPopup(symbol: "lock.shield.fill", title: "Not while you're blocked",
                                    message: "Uninstall protection can come off once this block ends. That's kind of the point.",
                                    primary: "Fair enough", secondary: nil))
            } else {
                popups.withPin("Switching uninstall protection off needs your PIN.") { model.protections.uninstallProtection = false }
            }
        }
    }
}

// MARK: The adult site filter

struct AdultFilterPage: View {
    @Environment(AppModel.self) private var model
    @Environment(PopupCenter.self) private var popups

    var body: some View {
        SettingPage(symbol: "eye.slash", title: "Adult site filter",
                    blurb: "Keeps adult sites out of Safari and your apps, all day, not just while you focus.",
                    lit: model.protections.adultFilter) {
            AccountSection("") {
                AccountToggleRow(symbol: "eye.slash", title: "Adult site filter", isOn: binding)
            }
            AccountSection("How it works") {
                SettingNote(symbol: "apple.logo", text: "It's Apple's own filter, the same one Screen Time uses. FocuzNow never sees what you browse.")
                AccountDivider()
                SettingNote(symbol: "safari.fill", text: "Works in Safari and in apps that show web pages.")
                AccountDivider()
                SettingNote(symbol: "hand.raised.fill", text: "Switching it off needs your PIN (if you've set one) and a long press.")
            }
        }
    }

    private var binding: Binding<Bool> {
        Binding {
            model.protections.adultFilter
        } set: { on in
            if on {
                AccountActions.withScreenTime(popups) { model.protections.adultFilter = true }
            } else {
                popups.withPin("Switching the filter off needs your PIN.") {
                    popups.show(FZPopup(symbol: "eye", tint: Color(hex: 0xF2CC86), title: "Turn the filter off?",
                                        message: "Adult sites will load again in Safari and in apps.",
                                        primary: "Hold to turn it off", destructive: true, secondary: "Keep it on",
                                        onPrimary: { model.protections.adultFilter = false }))
                }
            }
        }
    }
}

// MARK: PIN code

struct PinPage: View {
    @Environment(PopupCenter.self) private var popups
    @State private var on = PinLock.isSet
    @State private var resetAt = PinLock.resetAt

    var body: some View {
        SettingPage(symbol: "circle.grid.3x3", title: "PIN code",
                    blurb: "Four digits between you and the ways out. Pick something you'll remember, or let a friend pick it and keep it from you.",
                    lit: on) {
            AccountSection("") {
                if on {
                    Button(action: change) {
                        AccountRow(symbol: "arrow.triangle.2.circlepath", title: "Change PIN", chevron: false)
                    }
                    AccountDivider()
                    Button(action: switchOff) {
                        AccountRow(symbol: "xmark.circle", title: "Switch it off", chevron: false, tint: Theme.danger)
                    }
                } else {
                    Button(action: set) {
                        AccountRow(symbol: "plus.circle", title: "Set a PIN", chevron: false)
                    }
                }
            }
            if let resetAt {
                AccountSection("Forgot it?", footer: "Remember it before then and nothing changes.") {
                    SettingNote(symbol: "hourglass", text: "It switches itself off \(resetAt.formatted(date: .abbreviated, time: .shortened)). The wait is on purpose: long enough for the urge to pass.")
                }
            }
            AccountSection("Asked for before") {
                SettingNote(symbol: "flag.checkered", text: "Ending a session early")
                AccountDivider()
                SettingNote(symbol: "lock.open", text: "Switching autofocus, uninstall protection or the filter off")
                AccountDivider()
                SettingNote(symbol: "rectangle.portrait.and.arrow.right", text: "Signing out or deleting your account")
            }
            AccountSection("Forgetting it") {
                SettingNote(symbol: "questionmark.circle", text: "Tap Forgot? on the keypad. Your PIN switches itself off 24 hours later. The emergency pass never needs it.")
            }
        }
        .onAppear(perform: refresh)
    }

    private func refresh() {
        on = PinLock.isSet
        resetAt = PinLock.resetAt
    }

    private func set() {
        choose(title: "Set a PIN", message: "Four digits, twice. That's it.")
    }

    private func change() {
        popups.withPin("Enter the PIN you have now.") {
            choose(title: "New PIN", message: "Four new digits. The old one works until you've typed these twice.")
        }
    }

    private func switchOff() {
        popups.withPin("Enter your PIN to switch it off.") {
            PinLock.clear()
            withAnimation(.spring(duration: 0.4)) { refresh() }
        }
    }

    private func choose(title: String, message: String) {
        popups.show(FZPopup(symbol: "circle.grid.3x3.fill", title: title, message: message, secondary: "Cancel",
                            extra: AnyView(PinPad(mode: .create) {
                                withAnimation(.spring(duration: 0.4)) { refresh() }
                                popups.show(FZPopup(symbol: "checkmark", title: "PIN's on",
                                                    message: "Ending early, switching protections off and signing out now need it.",
                                                    primary: "Nice", secondary: nil))
                            })))
    }
}

// MARK: Developer mode

struct DeveloperModePage: View {
    @Environment(AppModel.self) private var model
    @Environment(PopupCenter.self) private var popups
    @AppStorage("devMode") private var devMode = false
    @AppStorage("onboarded") private var onboarded = true
    @AppStorage("onboardingStep") private var onboardingStep = 0
    @State private var sent = 0

    var body: some View {
        SettingPage(symbol: "hammer", title: "Developer mode",
                    blurb: "For testing, for the curious, and for when something's acting up. Nothing in here is dangerous.",
                    lit: devMode) {
            AccountSection("") {
                AccountToggleRow(symbol: "hammer", title: "Developer mode", isOn: $devMode)
            }
            if devMode {
                AccountSection("Tools") {
                    NavigationLink { DeveloperView() } label: {
                        AccountRow(symbol: "wrench.and.screwdriver", title: "Developer tools", detail: "Permissions, Live Activity, Screen Time, diagnostics.")
                    }
                    AccountDivider()
                    Button {
                        onboardingStep = 0
                        onboarded = false
                    } label: {
                        AccountRow(symbol: "arrow.counterclockwise", title: "Replay the intro", chevron: false)
                    }
                    AccountDivider()
                    Button {
                        AccountActions.sendTestNudge(popups, model.protections, explain: false) { sent += 1 }
                    } label: {
                        AccountRow(symbol: "bell.badge", title: "Test an autofocus nudge", detail: "Arrives in 4 seconds.", chevron: false)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.spring(duration: 0.4), value: devMode)
        .sensoryFeedback(.success, trigger: sent)
    }
}
