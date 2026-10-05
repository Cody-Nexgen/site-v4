# Before the polish round (2026-10-05)

The versions from commit 4927ff6, just before: the orb's NaN fix, the five-tab iPhone bar, the
pull-down push-in, press glow, bottom-sheet popups with hold-to-confirm, and the score on the ground.

| file | goes back to |
|---|---|
| `FZKit.swift` | `ios/App/Design/FZKit.swift` (centred popups, always-on glow) |
| `FocusOrb.metal` | `ios/App/Design/FocusOrb.metal` (has the atan2(0, 0) NaN: the orb draws black on iPhone) |
| `OrbWorld.metal` | `ios/App/Design/OrbWorld.metal` (no push) |
| `OrbStage.swift`, `OrbStageParts.swift` | `ios/App/Design/` |
| `RootView.swift` | `ios/App/RootView.swift` (one TabView; You ends up under "More" on iPhone) |
| `TodayView.swift` | `ios/App/Screens/TodayView.swift` (score in a glass card, sky on pull-down) |

Copy back, then run `cd ios && xcodegen`. Keep the new `FocusOrb.metal` unless you want the bug back.
