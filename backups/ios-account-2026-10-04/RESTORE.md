# Before the account tab (2026-10-04)

Copies of the files the "You" account tab changed, taken just before the change:

| file | goes back to |
|---|---|
| `YouScreens.swift` | `ios/App/Screens/YouScreens.swift` (the old Settings screen and the "You" sheet) |
| `RootView.swift` | `ios/App/RootView.swift` (Coach as the fifth tab) |
| `AppModel.swift` | `ios/App/Model/AppModel.swift` |
| `TodayView.swift` | `ios/App/Screens/TodayView.swift` |
| `ActiveSessionView.swift` | `ios/App/Screens/ActiveSessionView.swift` |
| `DeveloperView.swift` | `ios/App/Screens/DeveloperView.swift` |
| `Components.swift` | `ios/App/Design/Components.swift` |
| `FZKit.swift` | `ios/App/Design/FZKit.swift` |

To restore: copy them back over the current files, then delete `ios/App/Screens/AccountView.swift`,
`ios/App/Screens/AccountParts.swift` and `ios/App/Model/PinLock.swift`, and run `cd ios && xcodegen`.
`ios/Shared/Blocking/Protections.swift` can stay (nothing else needs it once AccountView is gone).
