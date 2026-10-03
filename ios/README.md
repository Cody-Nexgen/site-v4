# FocuzNow for iPhone & iPad

Native SwiftUI, iOS/iPadOS 18+, Liquid Glass on iOS 26. The plan and every quirk: [`docs/focuznow-ios-plan.md`](../docs/focuznow-ios-plan.md).

**Status: Phase 0** (the skeleton): tabs and the iPad sidebar, glass helpers, all the extension targets, and FocuzPass crypto that opens vaults made by the browser extension.

## First time on the Mac

1. **Install Xcode 26** from the Mac App Store and open it once (it installs extra parts).
2. **Install Homebrew** if you don't have it (https://brew.sh), then XcodeGen:
   ```sh
   brew install xcodegen
   ```
3. **Get the code and make the project:**
   ```sh
   git clone <the repo> && cd site-v4
   git checkout codex/focuzpass-distinctive-vibe-1utsv7
   cd ios
   xcodegen
   open FocuzNow.xcodeproj
   ```
   `xcodegen` writes `FocuzNow.xcodeproj` from `project.yml`. **Run it again every time you pull** (the project file isn't in git, so it never conflicts).
4. **Signing:** the team is already set in `project.yml` (`DEVELOPMENT_TEAM`). Xcode → Settings → Accounts must be signed in with **the Apple ID that has the Developer Program and the Family Controls entitlement** (not the business one 😅). With automatic signing, Xcode registers the six bundle IDs and the App Group by itself.
5. **Your iPhone/iPad:** plug it in, trust the Mac, then on the device: Settings → Privacy & Security → **Developer Mode** → on (it restarts).
6. Pick your device at the top of Xcode and press **▶ Run**.

## Fonts (do this once)

The headlines use **Satoshi**, the same font as focuznow.com. Download it free from
https://www.fontshare.com/fonts/satoshi ("Download family"), and copy `Satoshi-Medium.otf`,
`Satoshi-Bold.otf` and `Satoshi-Black.otf` from its OTF folder into `ios/App/Fonts/`. Run `xcodegen`
again. Without them the app still works with a heavy system font.

## What you should see (UI v3 "Lighthouse", mock data)

Design spec: [`docs/ios-design-spec.md`](../docs/ios-design-spec.md). The old v2 is in
`backups/ios-app-v2-2026-10-03/` if you want it back (see RESTORE.md there).

1. **Intro:** a rendered lighthouse at night; the lamp switches on (you feel a tap) and the beam
   sweeps through the fog. "Everything else can wait." → **Get started**.
2. **Questions:** the lighthouse glides up into a header. Answer each one: the other answers slide
   away and **a reply for that exact answer** appears. Try different answers, they all say
   something different. The lamp gets brighter with every answer.
3. **Your plan** → press and **hold** "Hold to light the lamp": the beam brightens while you hold,
   the phone ticks faster, then a flash.
4. Save your plan → Screen Time → apps → notifications → "You're all set" → Enter flies into the app.
5. **Next launches:** the splash (lamp switches on, then the camera flies into the light).
6. **Today:** the lighthouse on top is as bright as your focus score; pull down to stretch it.
   The score counts up, the bone "Up next" card.
7. **Focus → hold to start.** The session has the lighthouse behind a huge clock; **hold for a break**.
8. Avatar → **Guest pass** (drag the ticket to tilt it), **About** (scroll down, the signature writes
   itself), **Settings**.
9. Everything should feel smooth (60 fps). If the lighthouse stutters or the phone gets warm, say so.

**First run on a phone is slow** ("LLDB is reading from device memory"): Xcode is copying debug symbols for your iOS version once. Press Continue and wait. To skip the debugger: Product → Scheme → Edit Scheme → Run → untick **Debug executable**.

## Run the crypto tests

```sh
cd ios/FocuzNowKit
swift test
```
Three tests should pass. The main one opens `Tests/FocuzNowKitTests/Fixtures/vault-v1.json`, a vault made by the browser extension's own code (`src/src/lib/focuzPass/iosFixture.test.ts`, test password only), which proves the phone reads FocuzPass vaults byte for byte.

## If something goes wrong

- **"Provisioning profile doesn't include the Family Controls entitlement"**: the entitlement isn't on the account Xcode is using yet (or you're signed in with the other Apple ID). Check developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → `com.focuznow.app` → Family Controls is ticked; then Xcode → Signing & Capabilities → "Try Again".
- **"Allow Screen Time" errors right away**: you're in the Simulator, or the build lacks the entitlement (above).
- **A build error**: copy the red error text from Xcode's Issue navigator (⌘5) and send it over; the code is written in a cloud box without Xcode, so the first build may need a fix or two.

## Layout

```
ios/
  project.yml              the Xcode project definition (XcodeGen)
  App/                     the app (SwiftUI): RootView (tabs/sidebar), Design (colours, fzGlass), Screens
  Extensions/
    FocusMonitor/          turns blocking on/off on schedule (Screen Time)
    FocusShield/           the "Stay focused" screen over blocked apps
    FocusShieldAction/     the shield's buttons
    Widgets/               widgets (Live Activity + Control Center control in Phase 2)
    PassAutoFill/          FocuzPass in the QuickType bar (Phase 5)
  FocuzNowKit/             shared Swift package: crypto, shared IDs (runs `swift test` on the Mac)
```
