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

## What you should see (UI v1, mock data)

Design spec: [`docs/ios-design-spec.md`](../docs/ios-design-spec.md). Everything runs on mock data for now.

1. **Onboarding** (first launch):
   - four intro pages on living gradient skies (the Beam filling up, apps getting shielded, Plan/Pass/Coach orbiting, friends);
   - **account** (Sign in with Apple, Google, or email; any button continues for now);
   - **goal** (drag the dial) → **Screen Time** → **pick apps** (the real Apple picker) → **notifications**;
   - **"You're set"** with a burst.
2. **Today:** the glowing **Beam** fills toward your goal, with the big Focus Score, the stats row, the day wave chart, up next, and friends focusing now. The **Start focus** button floats at the bottom.
3. **Focus:**
   - presets, a drag ring for the length;
   - block list (opens Apple's picker);
   - difficulty, breaks, and the scene picker.
4. **Start a session** → full-screen **scene** (Night Lake by default: stars, moon on the lake) with the countdown, timeline, block list, difficulty, **Take a break** (a calm countdown) and **End early**. Swipe it down (⌄): on iOS 26 a glass session bar sits in the tab bar; on iOS 18 it floats above it.
5. When it ends: **celebration** (sparks, the Beam jumps, coins, a tree).
6. **Plan:** week strip plus a day timeline with a "now" line; Lists; the + button adds a to-do.
7. **Pass:** Face ID lock → vault list with filters and search → item detail (copy, reveal, strength).
8. **Coach:** chat with suggestion chips and a typing indicator (a canned reply for now).
9. **You** (the avatar on Today; the sidebar on iPad): Stats (score ring, week chart, best hours), Friends (rooms and leaderboard), Forest, Shop (scenes for coins), Settings (theme, **Show onboarding again**), and Pro (paywall).
10. **iPad:** a sidebar instead of tabs, a two-column Today, list and detail side by side in Pass and Plan.

Tip: Settings → **Show onboarding again** replays the first-launch flow.

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
