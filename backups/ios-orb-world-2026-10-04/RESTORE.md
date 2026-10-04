# Before the orb's world (2026-10-04)

Backed up before the world around the orb: the photo relit by the orb (`OrbWorld.metal`), fog,
parallax, floating rocks, the wide shot and the camera flying in, scattered lights, touch.

To go back, copy each file over its original:
- `OrbStage.swift` → `ios/App/Design/OrbStage.swift`
- `FocusOrb.swift`, `FocusOrb.metal` → `ios/App/Design/` (no touch)
- `FocusOnboarding.swift` → `ios/App/Onboarding/` (the orb forms on the pedestal, no wide shot)
- `TodayView.swift` → `ios/App/Screens/`
- `render-orb.mjs` → `ios/Tools/`

Then delete `ios/App/Design/OrbWorld.metal`, `ios/App/Design/OrbStageParts.swift`,
`ios/Tools/stage-preview/`, and the `OrbStageWide` and `OrbRock0`–`OrbRock5` sets in
`ios/App/Assets.xcassets`, and run `xcodegen`.
