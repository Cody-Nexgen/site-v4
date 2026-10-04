# Before the orb stage (2026-10-04)

Backed up before: the bare-Z splash, the orb forming on the pedestal in the onboarding, and Today
rebuilt around the same stage (the owner's dashboard mockup).

To go back, copy each file over its original:
- `TodayView.swift` → `ios/App/Screens/TodayView.swift` (the lighthouse Today)
- `SplashView.swift` → `ios/App/SplashView.swift` (the lighthouse launch splash)
- `FocusOnboarding.swift` → `ios/App/Onboarding/FocusOnboarding.swift` (orb on black, no pedestal)
- `BeamZ.swift` → `ios/App/Design/BeamZ.swift` (the Z always in its tile)
- `RootView.swift` → `ios/App/RootView.swift`
- `project.yml` → `ios/project.yml` (launch screen colour)

Then delete `ios/App/Design/OrbStage.swift` and `ios/App/Assets.xcassets`, and run `xcodegen`.
