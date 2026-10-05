# Before the prism, the plain labels and the 3D timer (2026-10-05)

The versions just before: the orb and everything under it in mint only, grey monospaced capital
labels, the flat `TimeRing` on Focus and a flat session clock.

Copy each file back over the one of the same name: `ios/App/Design/` (`OrbShared.h`,
`StageView.metal`, `StageMetalView.swift`, `OrbStage.swift`, `LitKit.swift`, `DayWave.swift`,
`Components.swift`, `FocusOrb.swift`) and `ios/App/Screens/` (`TodayView.swift`,
`FocusSetupView.swift`, `ActiveSessionView.swift`, `AboutAndPass.swift`, `AccountView.swift`,
`AccountParts.swift`). Delete `ios/App/Design/FocusDial.swift`, `ios/App/Design/FocusDial.metal`
and `ios/Tools/render-dial.mjs`. The preview tools (`ios/Tools/stage-preview/`, `render-orb.mjs`)
read a PRISM block that the old `OrbShared.h` doesn't have: take them from git at the same commit.
Then `cd ios && xcodegen`.
