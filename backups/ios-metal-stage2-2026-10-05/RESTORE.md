# Before the stage's second Metal round (2026-10-05)

The versions from commit 91a0e33, just before: the sky, stars, light shaft, ring glow, dust and
lightning moved into the Metal pass and the pass started running its own 60 fps loop; Today's scroll
stopped rebuilding the page; breaks started asking which apps to open.

Copy each back over the file of the same name: `ios/App/` (`RootView.swift`, `Design/`, `Screens/`,
`Model/`), `ios/Shared/Blocking/` (`BlockList.swift`, `Protections.swift`),
`ios/Extensions/FocusMonitor/` (`FocusMonitorExtension.swift`) and `ios/Tools/stage-preview/`
(`page.js`, `shot.mjs`). Delete `ios/App/Design/FrameRateMeter.swift`, then `cd ios && xcodegen`.
