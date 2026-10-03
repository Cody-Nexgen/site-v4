import SwiftUI

struct PlanView: View {
    var body: some View {
        PlaceholderPage(title: "Plan", symbol: "checklist", note: "Lists and your calendar (Phase 3).")
    }
}

struct PassView: View {
    var body: some View {
        PlaceholderPage(title: "Pass", symbol: "key.fill", note: "FocuzPass with Face ID and AutoFill (Phase 5).")
    }
}

struct CoachView: View {
    var body: some View {
        PlaceholderPage(title: "Coach", symbol: "sparkles", note: "Your AI coach (Phase 4).")
    }
}

struct PlaceholderPage: View {
    let title: String
    let symbol: String
    let note: String

    var body: some View {
        ContentUnavailableView(title, systemImage: symbol, description: Text(note))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.fzBg)
            .navigationTitle(title)
    }
}

/// iPhone: the pages that don't get a tab, behind the avatar on Today.
struct YouSheet: View {
    let open: (AppTab) -> Void

    var body: some View {
        NavigationStack {
            List {
                row("Stats", "chart.bar", .stats)
                row("Friends", "person.2", .friends)
                row("Forest", "tree", .forest)
                row("Focuz Shop", "bag", .shop)
                row("Settings", "gearshape", .settings)
            }
            .navigationTitle("You")
        }
        .presentationDetents([.medium, .large])
    }

    private func row(_ title: String, _ symbol: String, _ tab: AppTab) -> some View {
        Button { open(tab) } label: { Label(title, systemImage: symbol) }
    }
}
