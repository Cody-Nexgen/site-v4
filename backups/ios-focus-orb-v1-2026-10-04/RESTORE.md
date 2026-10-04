# Focus orb v1 (Canvas strands), backed up 2026-10-04

Replaced by the GPU orb (`ios/App/Design/FocusOrb.swift` + `FocusOrb.metal`).

To go back: copy `FocusOrb.swift` from here over `ios/App/Design/FocusOrb.swift` and delete
`ios/App/Design/FocusOrb.metal`. The API is the same (`FocusOrb(energy:size:)`), so nothing else
changes. `FocusOrb.prepare()` would no longer exist: remove its call in `FocusOnboarding.swift`.
