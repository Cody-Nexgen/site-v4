# FocuzNow for iPhone & iPad: the plan

Status: **planning** (2026-10-03). Nothing built yet. The owner has a Mac and an Apple Developer account.

Goals the owner set:
- The **whole FocuzNow**, not only FocuzPass, with **app blocking** as the headline feature.
- **Native Liquid Glass** on iOS 26 and later, while still running on **iOS 18** (the minimum).
- **iPad** support that feels made for iPad, not a stretched phone app.

---

## 1. The big decisions

| Decision | Pick | Why |
|---|---|---|
| UI framework | **SwiftUI, fully native** (Swift 6, Xcode 26) | Liquid Glass, Screen Time, widgets, Live Activities and AutoFill are all Swift-only APIs. React Native would put a JS layer between us and every feature that matters. |
| Minimum OS | **iOS / iPadOS 18.0** | Gives us `TabView(.sidebarAdaptable)`, Control Center controls, the new `Tab` API and SwiftData. iOS 26 features are switched on with `if #available(iOS 26, *)`. |
| Glass | **Real glass on 26, material on 18** | One `fzGlass()` modifier picks `.glassEffect` on 26, `.ultraThinMaterial` on 18. See §3. |
| Backend | **The same Supabase project** | Same accounts, same `user_workspace_state` sync blob, same edge functions (coach, places, friends, delete-account). |
| Supabase client | `supabase-swift` (SPM) **or** plain `URLSession` | **Needs the owner's OK** (it's a dependency). Plain REST works too, it's just more code. |
| Local data | **SwiftData** (on-device cache + offline queue) | Ships with iOS 17+, no dependency. |
| Where the code lives | `ios/` in this repo | Xcode 16+ "folder-synchronized groups": any file dropped into a target folder is built automatically, so new Swift files don't need project-file edits. |

---

## 2. App structure (targets)

```
ios/
  FocuzNow.xcodeproj
  FocuzNow/                  ← the app (iPhone + iPad, iOS 18+)
  FocuzNowKit/               ← Swift package shared by everything below
      Models/                   Codable mirrors of the TS types (lists, todos, schedules, vault items…)
      Sync/                     Supabase auth + workspace-state sync
      Crypto/                   FocuzPass crypto (must match src/src/lib/focuzPass/crypto.ts byte for byte)
      Design/                   colors, type, fzGlass(), Beam Z mark
  Extensions/
      FocusMonitor/          ← DeviceActivityMonitor: turns blocking on/off on schedule
      FocusShield/           ← ShieldConfiguration: the "this app is blocked" screen (our design)
      FocusShieldAction/     ← ShieldAction: what the shield's buttons do
      FocusReport/           ← DeviceActivityReport: Screen Time charts inside our UI
      Widgets/               ← widgets, the Live Activity, the Control Center control
      PassAutoFill/          ← AutoFill credential provider (FocuzPass passwords + passkeys)
```

Everything shares data through the App Group **`group.com.focuznow.shared`** and the keychain access group **`$(TeamID).com.focuznow.shared`**.

### Entitlements / capabilities

| Capability | For | Needs Apple approval? |
|---|---|---|
| **Family Controls** | app blocking | **Development: no** (works on your own phone from Xcode). **Distribution: yes.** Request it at developer.apple.com/contact/request/family-controls-distribution. **Request it now.** Every target that touches Screen Time needs it (app + 4 extensions). |
| App Groups | sharing between app and extensions | no |
| Keychain Sharing | FocuzPass key for the AutoFill extension | no |
| AutoFill Credential Provider | FocuzPass in the QuickType bar | no |
| Sign in with Apple | **required by App Review** once Google sign-in is offered (guideline 4.8) | no |
| Push Notifications + Time Sensitive | session end, friends, reminders | no |
| Associated Domains | `webcredentials:focuznow.com`, `applinks:focuznow.com` | no, but the **website must serve `/.well-known/apple-app-site-association`** (a website deploy) |

---

## 3. Design: FocuzNow + Liquid Glass

### The rule
**Glass is for things that float over content** (the tab bar, toolbars, the running-timer bar, floating buttons, sheets). **Content stays solid** with FocuzNow's own colors: lists, cards and the vault. That's Apple's guidance too, and it keeps the Clean Desk feel from the extension.

### `fzGlass()`: one modifier, two OS versions
```swift
extension View {
    @ViewBuilder func fzGlass<S: Shape>(in shape: S, interactive: Bool = false) -> some View {
        if #available(iOS 26, *) {
            self.glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }
}
```
- Buttons: `.buttonStyle(.glass)` / `.glassProminent` on 26, our own bordered style on 18.
- Groups of glass buttons go in a `GlassEffectContainer` (26) so they blend and **morph** (`glassEffectID` + `@Namespace`), for example the Start button morphing into the Pause / Stop pair.
- **Free on 26:** system bars, the tab bar, sheets, menus and search turn into Liquid Glass automatically when built with Xcode 26. **Never** set `UIDesignRequiresCompatibility` in Info.plist (it turns glass off).
- iOS 26 extras behind `#available`:
  - `.tabBarMinimizeBehavior(.onScrollDown)`;
  - `tabViewBottomAccessory` (the running timer; see Focus below);
  - `.backgroundExtensionEffect()` under the iPad sidebar.

### Tokens
The `--fz-*` CSS tokens become **Asset Catalog color sets** with light and dark values (`fzBg`, `fzPanel`, `fzText1…4`, `fzBorder`, `fzAccent`), plus the vault and tag palette and the pastel letter-tile hues (same `tileHue` math as `displayName.ts`). The accent stays white/ink like the extension. The icons are the FocuzNow solid set (wallet W3, safe V14, Archive, Deleted) drawn as SF-Symbols-style custom symbols, so they scale with Dynamic Type.

### App icon
The Beam Z mark built in **Icon Composer** (Xcode 26) as a layered `.icon`, which gives iOS 26 its light / dark / tinted / clear looks. Check that the build also has a flat icon for iOS 18.

---

## 4. Navigation and layouts

### iPhone: 5 tabs
```
┌──────────────────────────────┐
│ (M)  Today            [+]   │ ← avatar = "You" sheet; glass toolbar
│                              │
│   …content…                  │
│                              │
│ ┌──────────────────────────┐ │
│ │ ● Deep work  18:42  ❚❚   │ │ ← running timer (bottom accessory on 26)
│ └──────────────────────────┘ │
│  Today  Focus  Plan  Pass  ✦ │ ← glass tab bar; ✦ = Coach
└──────────────────────────────┘
```
- **Today:** focus score ring, today's goal, a big **Start focus** button, next calendar event, top 3 to-dos, habit checkboxes and the streak.
- **Focus:** the timer plus blocking. The session picker has presets ("Deep work 50/10", "School", custom). It shows what's blocked (apps via `FamilyActivityPicker`, sites from the synced blocklist), schedules, and the emergency override rules.
- **Plan:** a segmented Lists / Calendar control. Lists match the extension's lists; Calendar has day, week and month views, events, groups and scheduling links (read and edit).
- **Pass:** FocuzPass. Face ID unlock, the vault list, item detail, copy, and the AutoFill setup guide.
- **Coach:** AI coach chat, using `Tab(role: .search)`-style placement on 26 so it sits on its own like Apple's search tab.
- **"You" sheet** (from the avatar): stats, achievements, challenges, friends and focus rooms, Forest, the Shop, settings, Pro, and sign out.

### iPad: sidebar + split views
`TabView` with `.tabViewStyle(.sidebarAdaptable)` turns the same tabs into a **sidebar** on iPad (users can collapse it back to a tab bar), with "You" sections as their own sidebar rows.

```
┌───────────┬───────────────────┬──────────────────────────────┐
│ FocuzNow  │ All Items   7     │  [Li]  Linear                │
│ Today     │ Gi GitHub         │  Username  maya              │
│ Focus     │ Li Linear    ◀    │  Password  ••••••••   Copy   │
│ Plan      │ No Notion         │  Website   linear.app        │
│ Pass  ◀   │ …                 │                              │
│ Coach     │                   │                              │
│ ───────── │                   │                              │
│ Stats     │                   │                              │
│ Friends…  │                   │                              │
└───────────┴───────────────────┴──────────────────────────────┘
```
- **Pass:** `NavigationSplitView` with three columns (vaults/tags | list | item), the same as Clean Desk.
- **Plan:** Lists = sidebar | list | detail. Calendar gets a real week grid with a mini-month in the sidebar.
- **Today:** a 2–3 column dashboard grid (like the web dashboard) instead of one column.
- **Focus:** the timer on the left, blocking setup on the right.
- **iPad-only extras:**
  - keyboard shortcuts (`⌘N` new item, `⌘F` search, `⌘⇧F` start focus) and pointer hover effects;
  - multiple windows (two windows open at once, for example a vault and a calendar);
  - Stage Manager resizing, plus iPadOS 26's free windows and the menu bar via `.commands {}`.
- Size classes decide the layout, never "is this an iPad", so a narrow iPad window gets the phone layout and it just works.

### Shared extras
- **Widgets:**
  - Today ring, Next event, Quick start (interactive: a tap starts focus through an App Intent).
  - Lock Screen widgets.
  - **StandBy** support.
- **Live Activity + Dynamic Island:** the running session countdown and the blocked count, with pause/stop buttons (App Intents).
- **Control Center control** (iOS 18 `ControlWidget`): "Start focus" from Control Center or the Action button.
- **Focus filter** (`SetFocusFilterIntent`): turning on the iPhone's own "Work" Focus can start a FocuzNow session.
- **Shortcuts / Siri:** "Start a 25-minute focus" via App Intents.

---

## 5. App blocking (Screen Time): how it works and its quirks

### How it works
1. **Ask:** `AuthorizationCenter.shared.requestAuthorization(for: .individual)`. The person approves with Face ID. No parent setup needed.
2. **Pick:** `FamilyActivityPicker` shows the system app and website picker. We get back a `FamilyActivitySelection` (app, category and web-domain tokens) and save it in the App Group (it's `Codable`).
3. **Block:** a `ManagedSettingsStore` (one per mode, for example `.init(named: .focus)`):
   - `shield.applications` and `shield.applicationCategories` for apps;
   - `shield.webDomains` for picked sites;
   - `webContent.blockedByFilter = .specific(…)` for **sites from the synced blocklist**. This is how the extension's `blocklist` reaches Safari on the phone: `WebDomain(domain: "youtube.com")` takes a plain string.
4. **Schedule:** `DeviceActivityCenter().startMonitoring(…)` with a `DeviceActivitySchedule`. The **FocusMonitor** extension turns the store on in `intervalDidStart` and clears it in `intervalDidEnd`, even when the app is closed.
5. **The shield** (FocusShield): our design, with the Beam Z, "Stay focused, Maya", the time left and a FocuzNow color. **FocusShieldAction** handles the buttons:
   - **Close**;
   - **Ask for 5 minutes**, which goes through the same emergency-override rules as the extension (challenge, cooldown, future-self note).

### The quirks (read before building)
- **Screen Time doesn't work in the Simulator.** Authorization fails there. Test on a real iPhone or iPad from day one.
- **App tokens are opaque.** We never learn *which* apps were picked: no names or bundle IDs, only tokens the system can draw (`Label(token)`). That means:
  - App picks **can't sync** to other devices or to the website, because tokens only work on the phone that made them. Each device picks its own apps.
  - Site blocking **does** sync, because `webContent` takes plain domains.
- **Minimum schedule length is 15 minutes.** A `DeviceActivitySchedule` interval shorter than that is rejected. For shorter sessions, apply the shield right away from the app and end it with the next scheduled check, a notification tap, or when the app next opens. Or simply make 15 minutes the shortest session.
- **The monitor extension gets very little memory** (a few MB). No Supabase, no big JSON, no images. It only reads a tiny settings file from the App Group and flips the store.
- **Limits:** about **50 apps** per shield and **50 web domains** per filter. Use categories for big lists and warn when the synced blocklist is over 50.
- **Usage stats are sealed:** the `DeviceActivityReport` extension can *show* Screen Time charts inside our app, but that data **can't leave** the extension: no upload, no coach context. FocuzNow's own stats count *focus sessions*, which we do own.
- **Individual authorization can be undone** by the user in Settings, and they can delete the app. That's fine for a self-control app (Opal and one sec work the same way). The future-self contract and the challenge to unblock add friction, they don't jail anyone.
- **The shield's design is limited:** an icon, a title, a subtitle, two buttons and colors. No custom SwiftUI layout. Design within that.
- **Every Screen Time target needs the Family Controls entitlement,** and distribution builds need Apple's approval for **each target's bundle ID**. List all five in the request.

---

## 6. FocuzPass on iOS: quirks

- **Crypto must match the extension byte for byte:** AES-256-GCM (CryptoKit `AES.GCM`) and PBKDF2-SHA-256 with 600,000 rounds (CommonCrypto `CCKeyDerivationPBKDF`), plus the same salt, IV and base64 layouts as `crypto.ts` / `vaultCore.ts`.
  - **Step one: export golden test files from the TS tests** (a known password, salt and ciphertext). The Swift tests must decrypt them before any UI exists.
- **Unlock with Face ID:** after one master-password unlock, keep the vault key in the keychain with `.biometryCurrentSet` access control, in the shared access group so the AutoFill extension can use it. Adding a new fingerprint or face invalidates it, by design.
- **AutoFill extension:**
  - **QuickType bar:** fill `ASCredentialIdentityStore` with **site + username only, never passwords**, so iOS can suggest logins in the QuickType bar. The extension asks for Face ID, decrypts that one item and returns it.
  - **Memory:** the extension has a tight memory limit. PBKDF2 at 600k rounds is fine, but keep it lean.
- **Passkeys** (iOS 17+ provider APIs): ES256 with CryptoKit `P256.Signing`, the same AAGUID (`6d3f2a8c-…0c34`) and the same stored format as `webauthn.ts`. A passkey saved in Chrome should then work on the phone, and the other way round.
- **Cloud sync:** the same zero-knowledge FocuzPass cloud tables (`20260929180000_focuzpass_cloud.sql`, already applied).

---

## 7. Sync and backend: quirks

- **Synced today** (the `user_workspace_state` JSON blob): blocklist, allowed sites, schedules, focus mode, emergency override settings, Pomodoro settings, to-dos, habits, daily planner, calendar events and groups, scheduling links, lists and challenges. iOS reads and writes the same keys through `upsert_my_workspace_state`.
  - **Conflicts:** the blob is last-write-wins on the whole object (`revision` bumps). Two devices editing at once can clobber each other. The iOS client must **merge per key** (re-fetch, apply only its changed keys, push), and ideally the website and extension should too.
  - **Shared models:** write the Swift `Codable` models from the TS types and keep a fixture file both sides test against.
- **Not synced today: focus history and stats** (they're local in the extension). Phone stats, streaks across devices, and the coach knowing your phone sessions all need a **new `focus_sessions` table**. That's a **database migration, so it needs the owner's explicit approval** (and never a plain `supabase db push`).
- **Auth:** email, Google and **Sign in with Apple** (required if Google is offered). Sign in with Apple needs adding to Supabase Auth providers (a dashboard setting).
- **Pro on iOS:**
  - **The rule:** Apple requires **in-app purchase (StoreKit 2)** for digital subscriptions sold inside the app. Stripe checkout can't be the in-app buy button. In the US, linking out to web checkout is currently allowed after the 2025 court ruling, but the rules keep shifting.
  - **Plan:** StoreKit 2 plus **App Store Server Notifications v2** to a new edge function that sets the same Pro flag. That likely needs a migration (approval), and the edge function would need deploying.
- **Coach:** reuse the `ai-coach-chat` function. Markdown and LaTeX: SwiftUI's built-in Markdown has no tables or math. Options:
  - a small `WKWebView` that reuses the web's KaTeX renderer (no new dependency);
  - Swift packages (MarkdownUI + SwiftMath), which need approval.

---

## 8. App Store requirements (don't get rejected)

- **Account deletion inside the app** (the `delete-account` function already exists).
- **Friends/social:** report and block user buttons, and a way to hide content (guideline 1.2).
- **Privacy manifest** (`PrivacyInfo.xcprivacy`) in the app and **every extension**, with required-reason APIs declared (UserDefaults, file timestamps). Plus App Store privacy labels.
- **Age rating questionnaire:** friends, chat and coach content affect it.
- **Family Controls distribution approval** before TestFlight or App Store builds that block apps.
- **The Developer account holder** signs the agreements and the Family Controls request. Apple requires them to be 18+.

---

## 9. Build order (phases)

| Phase | What | Done when |
|---|---|---|
| **0. Setup** | Xcode 26 project in `ios/`, the targets above, App Group, signing; **send the Family Controls distribution request**; golden crypto test files | App runs on the owner's iPhone and iPad with a blank tab shell |
| **1. Shell + design + auth** | Tabs/sidebar, `fzGlass`, colors, icon, sign in (email/Google/Apple), "You" sheet, settings | Signed in on the phone, the theme follows light/dark, glass shows on 26 and material on 18 |
| **2. Focus + blocking** ⭐ | Timer, presets, `FamilyActivityPicker`, ManagedSettings, schedules, shield + actions, emergency override, Live Activity, Control Center control, widgets | A session blocks Instagram and the synced sites, the shield shows, the Live Activity counts down, blocking ends on time with the app closed |
| **3. Today + Plan** | Dashboard, to-dos, habits, lists, calendar (iPhone + iPad layouts) | Edits sync both ways with the extension |
| **4. Coach** | Chat, models, Markdown/math | Same answers as the web coach |
| **5. FocuzPass** | Crypto, read-only vault, Face ID, then editing, then AutoFill, then passkeys | A password fills into Safari and apps from the QuickType bar |
| **6. Social + fun** | Friends, focus rooms, challenges, achievements, Forest, Shop | Parity with the extension |
| **7. Ship** | StoreKit Pro, privacy manifests, review notes, TestFlight, App Store | Approved |
| **8. Maybe** | **Safari Web Extension port** of the current Chrome extension (same JS) for in-Safari blocking and FocuzPass in Safari on iPhone, iPad and Mac | Owner decides |

Rough size: Phase 0–2 is the core (weeks). The whole list is months.

---

## 10. How we'll work (with Claude in a cloud box that can't run Xcode)
- Claude writes the Swift code into `ios/` and pushes. The owner pulls on the Mac, builds in Xcode and runs it on the device.
- Thanks to folder-synchronized groups, new files appear in Xcode without project edits. If a build fails, paste the error and Claude fixes it.
- Test steps come with every change, as with the extension. Screen Time features are tested on a real device only.

## 11. Decisions the owner needs to make
1. `supabase-swift` (dependency) or plain `URLSession`?
2. Coach math rendering: WebView with KaTeX (no dependency) or Swift packages?
3. `focus_sessions` table for cross-device stats (a migration)?
4. Bundle ID: `com.focuznow.app`? (It must be final before the Family Controls request.)
5. Pro on iOS: StoreKit only, or StoreKit plus the US web link?
