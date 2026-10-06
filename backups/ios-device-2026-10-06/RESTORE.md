# Before the timer device, the colour wheel and the lit glass buttons (2026-10-06)

The versions just before: the 3D glass-ring dial on Focus (`FocusDial`), the five cool prism colours
(mint to rose), the prism-ring button outlines, and Focus in its old light/dark look.

Copy each file back over the one of the same name: `ios/App/Design/` (`OrbShared.h`, `LitKit.swift`,
`StageView.metal`, `FocusDial.swift`, `FocusDial.metal`) and `ios/App/Screens/` (`FocusSetupView.swift`,
`TodayView.swift`), and `ios/Tools/stage-preview/page.js`. Delete `ios/App/Design/FocusTimer.swift`,
`ios/App/Design/FocusTimer.metal` and `ios/Tools/render-device.mjs`; take `ios/Tools/render-dial.mjs`,
`ios/App/Design/FocusOrb.swift` and `ios/App/Screens/ActiveSessionView.swift` from git at the commit
before. Then `cd ios && xcodegen`.
