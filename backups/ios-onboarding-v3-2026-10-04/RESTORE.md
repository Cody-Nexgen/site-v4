# Restore the v3 onboarding (before UI v4 "Island", 2026-10-04)

These are the files as they were before the Island onboarding, the Live Activity and real blocking
were added.

To go back:
1. Copy `App/Onboarding/OnboardingFlow.swift`, `App/AppModel.swift` (to `ios/App/Model/`),
   `App/Screens/YouScreens.swift` and `App/FocuzNowApp.swift` back into `ios/App/`.
2. Copy `Extensions/FocusMonitorExtension.swift` to `ios/Extensions/FocusMonitor/` and
   `Extensions/FocuzNowWidgets.swift` to `ios/Extensions/Widgets/`.
3. Copy `project.yml` back to `ios/`.
4. Delete `ios/Shared/`, `ios/App/Onboarding/IslandOnboarding.swift`,
   `ios/App/Design/IslandStage.swift`, `ios/App/Model/LiveFocus.swift`,
   `ios/App/Screens/DeveloperView.swift` and `ios/Extensions/Widgets/FocusLiveActivity.swift`.
5. Run `xcodegen` in `ios/`.
