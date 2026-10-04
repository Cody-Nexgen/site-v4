# Restore the title-sequence onboarding (replaced 2026-10-04)

1. Copy `TitleSequenceOnboarding.swift` to `ios/App/Onboarding/` and `Reel.swift` to `ios/App/Design/`.
2. In `ios/App/Onboarding/OnboardingFlow.swift`, make `OnboardingFlow` show `TitleSequenceOnboarding()`.
3. Run `xcodegen` in `ios/`. Spec: `docs/ios-title-sequence.md`.
