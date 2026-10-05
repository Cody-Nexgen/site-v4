import AuthenticationServices
import FamilyControls
import PhotosUI
import StoreKit
import SwiftUI
import UserNotifications

/// The You tab: who you are, the extras that keep you honest (autofocus, the emergency pass,
/// protections, a PIN), help when something's off, and the account itself. A night scene, like Today.
/// Every confirmation is an `FZPopup`; anything that loosens a block asks for the PIN first.
struct AccountView: View {
    @Environment(AppModel.self) private var model
    @Environment(PopupCenter.self) private var popups
    @Environment(\.openURL) private var openURL
    @AppStorage("devMode") private var devMode = false
    @AppStorage("onboarded") private var onboarded = true
    @AppStorage("onboardingStep") private var onboardingStep = 0
    let open: (AppTab) -> Void
    let openCoach: () -> Void

    @State private var editing = false
    @State private var showPro = false
    @State private var photoItem: PhotosPickerItem?
    @State private var pinOn = PinLock.isSet
    @State private var pinResetAt = PinLock.resetAt
    @State private var passesLeft = EmergencyPass.left
    @State private var passBack = EmergencyPass.nextBack
    @State private var passUntil = EmergencyPass.activeUntil
    /// Which autofocus line the preview shows.
    @State private var line = 0
    @State private var reloading = false
    @State private var restoring = false
    @State private var sentNudge = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 30) {
                header.riseIn()
                StartedCard(startedHours: model.phoneHoursGuess, todayMinutes: model.screenTimeMinutes, since: model.profile.memberSince)
                    .riseIn(delay: 0.06)
                shortcuts.riseIn(delay: 0.12)
                autofocus
                advanced
                support
                other
                account
                footer
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 40)
            .frame(maxWidth: 600)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background { backdrop }
        .buttonStyle(.plain)
        .environment(\.colorScheme, .dark)
        .toolbarColorScheme(.dark, for: .tabBar)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $editing) { ProfileEditor().environment(model) }
        .sheet(isPresented: $showPro) { ProView().environment(model) }
        .sensoryFeedback(.success, trigger: sentNudge)
        .onChange(of: photoItem) { _, item in
            Task {
                if let data = try? await item?.loadTransferable(type: Data.self) {
                    withAnimation(.smooth) { model.setProfilePhoto(data) }
                }
            }
        }
        .onAppear(perform: refresh)
        .task(id: passUntil) {
            // The ticket goes back to "Use one" when a pass runs out.
            guard let passUntil else { return }
            try? await Task.sleep(for: .seconds(max(0, passUntil.timeIntervalSinceNow) + 1))
            refresh()
        }
    }

    /// Black, with the orb's light coming from behind your photo.
    private var backdrop: some View {
        ZStack(alignment: .top) {
            Color.black
            RadialGradient(colors: [Color.fzMint.opacity(0.16), .clear], center: .center, startRadius: 0, endRadius: 260)
                .frame(width: 560, height: 520)
                .offset(y: -120)
        }
        .ignoresSafeArea()
    }

    private func refresh() {
        pinOn = PinLock.isSet
        pinResetAt = PinLock.resetAt
        passesLeft = EmergencyPass.left
        passBack = EmergencyPass.nextBack
        passUntil = EmergencyPass.activeUntil
    }

    // MARK: You

    private var header: some View {
        VStack(spacing: 16) {
            HStack {
                Text("You")
                    .font(.fzDisplay(34, weight: .bold))
                    .fzTight(34)
                    .foregroundStyle(.white)
                Spacer()
                Button("Edit") { editing = true }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 16)
                    .frame(height: 36)
                    .background(Capsule().fill(.white.opacity(0.06)))
                    .overlay(Capsule().strokeBorder(.white.opacity(0.13)))
                    .fzGlass(in: Capsule(), interactive: true)
            }
            PhotosPicker(selection: $photoItem, matching: .images) {
                ProfilePhoto(name: model.userName, image: model.profilePhoto)
            }
            .buttonStyle(.pressable)
            .accessibilityLabel("Change your photo")
            .padding(.top, 6)
            VStack(spacing: 6) {
                Text(model.userName)
                    .font(.fzDisplay(30, weight: .bold))
                    .fzTight(30)
                    .foregroundStyle(.white)
                Text(detailLine)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.6))
                if model.profile.occupation.isEmpty || model.profile.age == nil {
                    Button("Add what you do and your age") { editing = true }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.fzMint)
                        .padding(.top, 2)
                }
            }
            .multilineTextAlignment(.center)
        }
    }

    /// "@maya · Student · 16".
    private var detailLine: String {
        var parts = [model.profile.handle]
        if !model.profile.occupation.isEmpty { parts.append(model.profile.occupation) }
        if let age = model.profile.age { parts.append("\(age)") }
        return parts.joined(separator: " · ")
    }

    /// Everything that used to live behind the avatar.
    private var shortcuts: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
            Button(action: openCoach) { tile("sparkles", "Coach") }
                .buttonStyle(.pressable)
            NavigationLink { StatsView() } label: { tile("chart.bar.fill", "Stats") }
            NavigationLink { FriendsView() } label: { tile("person.2.fill", "Friends") }
            NavigationLink { ForestView() } label: { tile("tree.fill", "Forest") }
            NavigationLink { ShopView() } label: { tile("bag.fill", "Shop") }
            NavigationLink { CustomizeView() } label: { tile("paintbrush.fill", "Customize") }
        }
        .buttonStyle(.pressable)
    }

    private func tile(_ symbol: String, _ title: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.fzMint)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(Color(hex: 0x111214).opacity(0.85)))
        .fzEdgeLight(cornerRadius: 18)
    }

    // MARK: Autofocus

    private var autofocus: some View {
        let protections = model.protections
        let lines = Autofocus.lines(minutes: protections.autofocusMinutes, locked: protections.autofocusLocks)
        let shown = lines[line % lines.count]
        return AccountSection("Autofocus", footer: protections.autofocus ? "Counts time in the apps on your block list, every day from midnight." : nil) {
            AccountToggleRow(symbol: "wand.and.stars", title: "Autofocus",
                             detail: "When scrolling runs long, FocuzNow taps you on the shoulder.", isOn: autofocusBinding)
            if protections.autofocus {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 10) {
                        label("Step in after")
                        HStack(spacing: 8) {
                            ForEach([30, 60, 120, 180], id: \.self) { minutes in
                                AccountChip(title: GoalDial.format(minutes), selected: protections.autofocusMinutes == minutes) {
                                    model.protections.autofocusMinutes = minutes
                                }
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        label("Then")
                        HStack(spacing: 10) {
                            AutofocusOption(symbol: "bell.fill", title: "Just nudge me", detail: "A notification. You decide.",
                                            selected: !protections.autofocusLocks) { model.protections.autofocusLocks = false }
                            AutofocusOption(symbol: "lock.fill", title: "Lock them", detail: "15 minutes off, no arguing.",
                                            selected: protections.autofocusLocks) { model.protections.autofocusLocks = true }
                        }
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        label("What it sounds like")
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
                                sendTestNudge(explain: true)
                            } label: {
                                Label("Send me one", systemImage: "paperplane.fill")
                            }
                            .buttonStyle(FZGlassButtonStyle(height: 44))
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 18)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.spring(duration: 0.45), value: protections.autofocus)
    }

    /// A real nudge in 4 seconds, so you can lock the phone and see it like the real thing.
    private func sendTestNudge(explain: Bool) {
        Task {
            let center = UNUserNotificationCenter.current()
            _ = try? await center.requestAuthorization(options: [.alert, .sound])
            guard await center.notificationSettings().authorizationStatus == .authorized else {
                popups.show(FZPopup(symbol: "bell.slash.fill", title: "Notifications are off",
                                    message: "Autofocus talks to you through notifications. Switch them on for FocuzNow in Settings.",
                                    primary: "Open Settings",
                                    onPrimary: { openURL(URL(string: UIApplication.openSettingsURLString)!) }))
                return
            }
            Autofocus.notify(minutes: model.protections.autofocusMinutes, locked: model.protections.autofocusLocks, after: 4)
            sentNudge += 1
            if explain {
                popups.show(FZPopup(symbol: "bell.badge.fill", title: "Incoming in 4 seconds",
                                    message: "Lock your phone to see it the way you'll see the real thing.",
                                    primary: "Okay", secondary: nil))
            }
        }
    }

    private var autofocusBinding: Binding<Bool> {
        Binding {
            model.protections.autofocus
        } set: { on in
            if on {
                turnOnAutofocus()
            } else {
                popups.withPin("Switching autofocus off needs your PIN.") { model.protections.autofocus = false }
            }
        }
    }

    private func turnOnAutofocus() {
        guard BlockList.count(model.selection) > 0 else {
            popups.show(FZPopup(symbol: "square.stack.3d.up.fill", title: "Pick your time sinks first",
                                message: "Autofocus watches the apps on your block list. Choose them in Focus, then come back.",
                                primary: "Pick apps", onPrimary: { open(.focus) }))
            return
        }
        withScreenTime {
            Task {
                _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
                withAnimation(.spring(duration: 0.45)) { model.protections.autofocus = true }
            }
        }
    }

    // MARK: Advanced

    private var advanced: some View {
        AccountSection("Advanced") {
            AccountToggleRow(symbol: "lock.shield", title: "Uninstall protection",
                             detail: "While apps are blocked, nothing can be deleted. Holding an icon only offers Remove from Home Screen.",
                             isOn: uninstallBinding)
            AccountDivider()
            AccountToggleRow(symbol: "eye.slash", title: "Adult site filter",
                             detail: "Apple's own filter for adult sites, in Safari and in apps. On all the time, not just during sessions.",
                             isOn: filterBinding)
            AccountDivider()
            Button(action: pinTapped) {
                AccountRow(symbol: "circle.grid.3x3", title: "PIN code", detail: pinDetail, value: pinOn ? "On" : "Off")
            }
        }
    }

    private var pinDetail: String {
        if let pinResetAt { return "Switches itself off \(pinResetAt.formatted(date: .abbreviated, time: .shortened))." }
        return "Asked for before ending early, switching these off, or signing out."
    }

    private var uninstallBinding: Binding<Bool> {
        Binding {
            model.protections.uninstallProtection
        } set: { on in
            if on {
                withScreenTime { model.protections.uninstallProtection = true }
            } else if Protections.isBlocking {
                popups.show(FZPopup(symbol: "lock.shield.fill", title: "Not while you're blocked",
                                    message: "Uninstall protection can come off once this block ends. That's kind of the point.",
                                    primary: "Fair enough", secondary: nil))
            } else {
                popups.withPin("Switching uninstall protection off needs your PIN.") { model.protections.uninstallProtection = false }
            }
        }
    }

    private var filterBinding: Binding<Bool> {
        Binding {
            model.protections.adultFilter
        } set: { on in
            if on {
                withScreenTime { model.protections.adultFilter = true }
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

    private func pinTapped() {
        guard pinOn else {
            choosePin(title: "Set a PIN", message: "Four digits you'll remember. Or let a friend pick it and keep it from you, which works even better.")
            return
        }
        popups.show(FZPopup(symbol: "circle.grid.3x3.fill", title: "Your PIN",
                            message: "Change it, or switch it off. Either way, the current one first.",
                            primary: "Change PIN", secondary: "Switch it off",
                            onPrimary: {
                                popups.withPin("Enter the PIN you have now.") {
                                    choosePin(title: "New PIN", message: "Four new digits. The old one works until you've typed these twice.")
                                }
                            },
                            onSecondary: {
                                popups.withPin("Enter your PIN to switch it off.") {
                                    PinLock.clear()
                                    refresh()
                                }
                            }))
    }

    private func choosePin(title: String, message: String) {
        popups.show(FZPopup(symbol: "circle.grid.3x3.fill", title: title, message: message, secondary: "Cancel",
                            extra: AnyView(PinPad(mode: .create) {
                                refresh()
                                popups.show(FZPopup(symbol: "checkmark", title: "PIN's on",
                                                    message: "Ending early, switching protections off and signing out now need it.",
                                                    primary: "Nice", secondary: nil))
                            })))
    }

    // MARK: Support

    private var support: some View {
        VStack(alignment: .leading, spacing: 12) {
            AccountSection("Support") {
                Button { openURL(Self.help) } label: {
                    AccountRow(symbol: "envelope", title: "Get help", detail: "A real person reads every message.")
                }
                AccountDivider()
                Button(action: reload) {
                    AccountRow(symbol: "arrow.clockwise", title: "Reload FocuzNow",
                               detail: "Puts your blocks, schedules and filter back in place if something seems stuck.",
                               chevron: false, busy: reloading)
                }
                .disabled(reloading)
                AccountDivider()
                AccountToggleRow(symbol: "hammer", title: "Developer mode", detail: devMode ? nil : "Tools for testing. Nothing here is dangerous.", isOn: $devMode)
                if devMode {
                    VStack(spacing: 0) {
                        AccountDivider()
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
                            sendTestNudge(explain: false)
                        } label: {
                            AccountRow(symbol: "bell.badge", title: "Test an autofocus nudge", detail: "Arrives in 4 seconds.", chevron: false)
                        }
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .animation(.spring(duration: 0.4), value: devMode)

            EmergencyPassTicket(holder: model.userName, left: passesLeft, nextBack: passBack, activeUntil: passUntil, use: usePass)
        }
    }

    private func usePass() {
        refresh()
        let amber = Color(hex: 0xF2CC86)
        if let passUntil {
            popups.show(FZPopup(symbol: "timer", tint: amber, title: "You're already out",
                                message: "This pass runs until \(passUntil.formatted(date: .omitted, time: .shortened)). Go do the thing.",
                                primary: "Right", secondary: nil))
        } else if passesLeft == 0 {
            let back = passBack.map { " The next one's back \($0.formatted(.dateTime.weekday(.wide).hour().minute()))." } ?? ""
            popups.show(FZPopup(symbol: "ticket", tint: amber, title: "That's all three",
                                message: "Passes come back a week after you use them.\(back) Until then, you've got this.",
                                primary: "Okay", secondary: nil))
        } else if !Protections.isBlocking {
            popups.show(FZPopup(symbol: "ticket", tint: amber, title: "Nothing's locked right now",
                                message: "Keep this one for when you really need it.",
                                primary: "Good call", secondary: nil))
        } else {
            let after = passesLeft - 1
            popups.show(FZPopup(symbol: "ticket.fill", tint: amber, title: "Use an emergency pass?",
                                message: "Everything unlocks for \(EmergencyPass.minutes) minutes, then locks again by itself. You'll have \(after == 0 ? "none" : "\(after)") left this week.",
                                primary: "Unlock for \(EmergencyPass.minutes) minutes", secondary: "I'm okay, actually",
                                onPrimary: {
                                    guard let end = EmergencyPass.use() else { return }
                                    model.focusScore = max(0, model.focusScore - 0.2)
                                    refresh()
                                    popups.show(FZPopup(symbol: "timer", tint: amber, title: "Go, quick",
                                                        message: "Back to normal at \(end.formatted(date: .omitted, time: .shortened)). Make it count.",
                                                        primary: "On it", secondary: nil))
                                }))
        }
    }

    private func reload() {
        guard LiveFocus.screenTimeApproved else {
            popups.show(FZPopup(symbol: "hourglass", title: "FocuzNow can't block yet",
                                message: "Screen Time permission is off, so there's nothing to reload. Turn it on and try again.",
                                primary: "Allow Screen Time",
                                onPrimary: { Task { try? await AuthorizationCenter.shared.requestAuthorization(for: .individual) } }))
            return
        }
        reloading = true
        model.reloadProtections()
        Task {
            try? await Task.sleep(for: .milliseconds(900))
            reloading = false
            refresh()
            popups.show(FZPopup(symbol: "checkmark", title: "All fresh",
                                message: "Your blocks, schedules and filter are back where they should be. Still acting up? Tell us.",
                                primary: "Nice", secondary: "Get help",
                                onSecondary: { openURL(Self.help) }))
        }
    }

    // MARK: Other

    private var other: some View {
        AccountSection("Other") {
            Button { if !model.isPro { showPro = true } } label: {
                AccountRow(symbol: "seal.fill", title: "FocuzNow Pro",
                           detail: model.isPro ? nil : "More blocks, Coach Pro, every scene.",
                           value: model.isPro ? "Active" : nil, chevron: !model.isPro)
            }
            AccountDivider()
            Button(action: restore) {
                AccountRow(symbol: "arrow.down.circle", title: "Restore purchases", chevron: false, busy: restoring)
            }
            .disabled(restoring)
            AccountDivider()
            NavigationLink { AboutView() } label: { AccountRow(symbol: "light.beacon.max", title: "About FocuzNow") }
            AccountDivider()
            NavigationLink { SettingsView() } label: { AccountRow(symbol: "slider.horizontal.3", title: "Preferences", detail: "Notifications, haptics, light or dark.") }
            AccountDivider()
            NavigationLink { GuestPassView() } label: { AccountRow(symbol: "ticket", title: "Send a guest pass") }
        }
    }

    private func restore() {
        restoring = true
        Task {
            defer { restoring = false }
            do {
                try await AppStore.sync()
            } catch StoreKitError.userCancelled {
                return
            } catch {
                popups.show(FZPopup(symbol: "wifi.exclamationmark", tint: Color(hex: 0xF2CC86), title: "Couldn't reach the App Store",
                                    message: "Check your connection and give it another go.", primary: "Okay", secondary: nil))
                return
            }
            var found = false
            for await result in StoreKit.Transaction.currentEntitlements {
                if case .verified = result { found = true }
            }
            if found {
                model.isPro = true
                popups.show(FZPopup(symbol: "checkmark.seal.fill", title: "You're all set",
                                    message: "FocuzNow Pro is back on this iPhone.", primary: "Nice", secondary: nil))
            } else {
                popups.show(FZPopup(symbol: "magnifyingglass", title: "Nothing to restore",
                                    message: "We couldn't find a FocuzNow purchase on this Apple Account. If that's wrong, write to us and we'll sort it.",
                                    primary: "Okay", secondary: "Get help",
                                    onSecondary: { openURL(URL(string: "mailto:support@focuznow.com?subject=Restoring%20a%20purchase")!) }))
            }
        }
    }

    // MARK: Account

    private var account: some View {
        VStack(spacing: 14) {
            AccountSection("Account") {
                Button(action: linkApple) {
                    AccountRow(symbol: "apple.logo", title: "Apple", detail: model.profile.appleLinked ? "Linked. Sign in with Face ID." : nil,
                               value: model.profile.appleLinked ? "Linked" : "Link", chevron: false)
                }
                AccountDivider()
                Button(action: linkGoogle) {
                    HStack(spacing: 14) {
                        GoogleMark()
                            .frame(width: 36, height: 36)
                            .background(RoundedRectangle(cornerRadius: 11, style: .continuous).fill(.white.opacity(0.06)))
                            .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(.white.opacity(0.1)))
                        Text("Google")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                        Spacer()
                        Text(model.profile.googleLinked ? "Linked" : "Link")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.5))
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 13)
                    .contentShape(Rectangle())
                }
            }
            Button("Sign out", action: signOut)
                .buttonStyle(.fzGlass)
            Button("Delete account", action: deleteAccount)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.danger)
                .frame(height: 40)
        }
    }

    private func linkApple() {
        if model.profile.appleLinked {
            popups.show(FZPopup(symbol: "apple.logo", tint: .white, title: "Apple's linked",
                                message: "You can sign in with your Apple Account on any device.",
                                primary: "Hold to unlink", destructive: true, secondary: "Keep it",
                                onPrimary: { model.profile.appleLinked = false }))
            return
        }
        popups.show(FZPopup(symbol: "apple.logo", tint: .white, title: "Link your Apple Account",
                            message: "Then you can sign in with Face ID, no password to remember.",
                            secondary: "Not now",
                            extra: AnyView(AppleLinkButton {
                                model.profile.appleLinked = true
                                popups.show(FZPopup(symbol: "checkmark", title: "Linked",
                                                    message: "Next time, signing in is one tap.", primary: "Nice", secondary: nil))
                            })))
    }

    private func linkGoogle() {
        // Google needs its own sign-in SDK; it comes with accounts going live (Supabase).
        popups.show(FZPopup(symbol: "person.badge.key.fill", title: "Google's almost here",
                            message: "Linking Google switches on when accounts start syncing between devices. Apple works today.",
                            primary: "Okay", secondary: nil))
    }

    private func signOut() {
        if model.session != nil {
            popups.show(FZPopup(symbol: "timer", title: "You're mid-session",
                                message: "Finish it (or end it) first, then sign out.", primary: "Okay", secondary: nil))
            return
        }
        popups.withPin("Signing out needs your PIN.") {
            popups.show(FZPopup(symbol: "rectangle.portrait.and.arrow.right", title: "Sign out?",
                                message: "Your blocks, schedules and autofocus stop on this iPhone until you sign back in. Your profile stays here.",
                                primary: "Sign out", secondary: "Stay",
                                onPrimary: { model.signOut() }))
        }
    }

    private func deleteAccount() {
        if model.session != nil {
            popups.show(FZPopup(symbol: "timer", title: "You're mid-session",
                                message: "Finish it (or end it) first.", primary: "Okay", secondary: nil))
            return
        }
        popups.withPin("Deleting your account needs your PIN.") {
            popups.show(FZPopup(symbol: "trash.fill", tint: Theme.danger, title: "Delete everything?",
                                message: "Your profile, photo, PIN, blocks and settings are wiped from this iPhone, and you start fresh. This can't be undone.",
                                primary: "Hold to delete", destructive: true, secondary: "Keep my account",
                                onPrimary: { model.deleteAccount() }))
        }
    }

    // MARK: Bits

    private var footer: some View {
        VStack(spacing: 8) {
            BeamZMark(size: 30)
            Text("FocuzNow \(version)")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white.opacity(0.5))
            Text("Everything else can wait.")
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.35))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 6)
    }

    private func label(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.caption2.weight(.semibold))
            .tracking(1.4)
            .foregroundStyle(.white.opacity(0.45))
    }

    /// Support's inbox. (Check it's the right address before release.)
    private static let help = URL(string: "mailto:support@focuznow.com?subject=FocuzNow%20help")!

    private var version: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
    }

    /// Runs `then` once FocuzNow may use Screen Time, asking first if it hasn't yet.
    private func withScreenTime(_ then: @escaping () -> Void) {
        if LiveFocus.screenTimeApproved { then(); return }
        Task {
            try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            if LiveFocus.screenTimeApproved {
                then()
            } else {
                popups.show(FZPopup(symbol: "hourglass", title: "This needs Screen Time",
                                    message: "FocuzNow uses Apple's Screen Time to do this. You can allow it in Settings → Screen Time.",
                                    primary: "Open Settings",
                                    onPrimary: { openURL(URL(string: UIApplication.openSettingsURLString)!) }))
            }
        }
    }
}

/// Apple's own button, inside the "Link your Apple Account" popup.
private struct AppleLinkButton: View {
    let linked: () -> Void
    @Environment(PopupCenter.self) private var popups

    var body: some View {
        SignInWithAppleButton(.continue) { request in
            request.requestedScopes = [.email]
        } onCompletion: { result in
            guard case .success = result else { return }
            popups.dismiss()
            linked()
        }
        .signInWithAppleButtonStyle(.white)
        .frame(height: 54)
        .clipShape(Capsule())
        .fzBottomGlow(strength: 0.25)
        .padding(.top, 4)
    }
}
