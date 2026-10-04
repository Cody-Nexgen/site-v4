import SwiftUI
import WidgetKit

@main
struct FocuzNowWidgets: WidgetBundle {
    var body: some Widget {
        StartFocusWidget()
    }
}

/// Phase 0 placeholder. Phase 2 makes it start a session (App Intent) and adds the Live Activity
/// and the Control Center control.
struct StartFocusWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "StartFocus", provider: StartFocusProvider()) { _ in
            VStack(spacing: 6) {
                Image(systemName: "bolt.fill").font(.title2)
                Text("Start focus").font(.caption.weight(.semibold))
            }
            .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Start focus")
        .description("Jump into a FocuzNow session.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}

struct StartFocusEntry: TimelineEntry {
    let date: Date
}

struct StartFocusProvider: TimelineProvider {
    func placeholder(in context: Context) -> StartFocusEntry { StartFocusEntry(date: .now) }

    func getSnapshot(in context: Context, completion: @escaping (StartFocusEntry) -> Void) {
        completion(StartFocusEntry(date: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StartFocusEntry>) -> Void) {
        completion(Timeline(entries: [StartFocusEntry(date: .now)], policy: .never))
    }
}
