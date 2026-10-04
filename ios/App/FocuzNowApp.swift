import SwiftUI

@main
struct FocuzNowApp: App {
    @State private var model: AppModel

    init() {
        let model = AppModel()
        _model = State(initialValue: model)
        // The Live Activity's End and +5 buttons run in the app's process, sometimes after iOS
        // wakes the app in the background just for them, so this is set before any view appears.
        FocusIntentBridge.handler = { action in model.handle(action) }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
        }
    }
}
