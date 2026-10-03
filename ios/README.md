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

## What you should see (UI v2 "Into focus", mock data)

Design spec: [`docs/ios-design-spec.md`](../docs/ios-design-spec.md).

1. **Intro:**
   - blurry lights and blurry text; **tap 3×**: it sharpens, the lights gather into a glowing Z, then "FocuzNow".
   - Then a **conversation**: name, phone time, what pulls you, what you want time for. Each answer gets a reaction, and older lines blur away upward.
   - "Building your setup…" → **"Maya, FocuzNow can give you back N days this year"**.
   - Then account → Screen Time → apps → notifications → "You're in focus".
2. **Today:** the lights gather to your Focus Score (sharp at a high score), with the score, stats, the day wave, up next, and friends focusing now.
3. **Focus → Start:**
   - your **photo** (or a scene) blurs into black;
   - one clean progress track;
   - tap **Breaks** to change the length, and **Edit session** to add time;
   - the paintbrush opens Customize.
4. **Coach:** ≡ opens the chat library, "Coach Flash ⌄" opens the model cards, and messages rise in.
5. **You → Forest:** a 3D island with trees; drag it around.
6. **You → Customize:** pick a session photo, the clock style, and **your light** (the whole app re-tints).

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
