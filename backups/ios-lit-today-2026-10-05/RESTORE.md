# Before Today's lower half went "lit by the orb" (2026-10-05)

Today under the orb as it was after the third performance round (commit before the lit redesign):
the white Start button, the grey Today card with icon rows, the friends card and the Swift Charts
day wave.

Copy `TodayView.swift` back over `ios/App/Screens/TodayView.swift` and `DayWave.swift` over
`ios/App/Design/DayWave.swift`. `ios/App/Design/LitKit.swift` can stay (nothing else breaks without
it being used) or be deleted. Then `cd ios && xcodegen`.
