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

## What you should see (Phase 0)

- **iPhone:** five tabs (Today, Focus, Plan, Pass, Coach). On iOS 26 the tab bar is Liquid Glass and shrinks when you scroll down; on iOS 18 it's the normal bar. Today has a glass **Start focus** button and the person icon (top left) opens the "You" sheet.
- **iPad:** a sidebar with the same tabs plus a **You** section (Stats, Friends, Forest, Shop, Settings). Today shows two columns.
- **Focus tab → Allow Screen Time:** the system asks for Face ID/passcode, then the row says **Allowed**. This proves the Family Controls entitlement works. *(It never works in the Simulator, only on a real device.)*
- Long-press the home screen → add the **FocuzNow** widget ("Start focus").
- Settings → General → AutoFill & Passwords: **FocuzPass** shows in the list (it only says "coming soon" for now).

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
