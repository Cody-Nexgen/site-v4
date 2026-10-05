# Before the stage moved into one Metal pass (2026-10-05)

The versions from commit f2f9237. To go back: copy these over the files of the same name in
`ios/App/Design/` (and `TodayView.swift` in `ios/App/Screens/`), delete `ios/App/Design/OrbShared.h`,
`StageView.metal` and `StageMetalView.swift`, remove the `.task { _ = StageGPU.shared }` line from
`ios/App/FocuzNowApp.swift` and the `_ = StageGPU.shared` line in `FocusOrb.prepare()`, then
`cd ios && xcodegen`. (Easier: OrbStage falls back to these SwiftUI effects by itself whenever
`StageGPU.shared` is nil.)
