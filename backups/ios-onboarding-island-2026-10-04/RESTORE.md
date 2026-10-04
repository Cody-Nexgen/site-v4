# Restore the Island onboarding (replaced by the title sequence, 2026-10-04)

1. Copy `IslandOnboarding.swift` and `OnboardingFlow.swift` back into `ios/App/Onboarding/`.
2. Delete `ios/App/Onboarding/TitleSequenceOnboarding.swift` and `ios/App/Design/Reel.swift`.
3. Run `xcodegen` in `ios/`.

`ios/App/Design/IslandStage.swift` was kept (Developer tools and `FlowLayout` use it).
