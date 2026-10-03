import SwiftUI

enum AppTab: Hashable {
    case today, focus, plan, pass, coach
    case stats, friends, forest, shop, settings
}

/// Five tabs on iPhone; on iPad the same TabView turns into a sidebar (`.sidebarAdaptable`) with the
/// "You" pages as their own rows. On iPhone those live in the sheet behind the avatar instead.
struct RootView: View {
    @State private var tab: AppTab = .today
    @State private var showYou = false

    var body: some View {
        TabView(selection: $tab) {
            Tab("Today", systemImage: "sun.max", value: AppTab.today) {
                NavigationStack { TodayView(showYou: $showYou) }
            }
            Tab("Focus", systemImage: "timer", value: AppTab.focus) {
                NavigationStack { FocusView() }
            }
            Tab("Plan", systemImage: "checklist", value: AppTab.plan) {
                NavigationStack { PlanView() }
            }
            Tab("Pass", systemImage: "key.fill", value: AppTab.pass) {
                NavigationStack { PassView() }
            }
            Tab("Coach", systemImage: "sparkles", value: AppTab.coach) {
                NavigationStack { CoachView() }
            }

            TabSection("You") {
                Tab("Stats", systemImage: "chart.bar", value: AppTab.stats) {
                    NavigationStack { PlaceholderPage(title: "Stats", symbol: "chart.bar", note: "Focus time, streaks and your score.") }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Friends", systemImage: "person.2", value: AppTab.friends) {
                    NavigationStack { PlaceholderPage(title: "Friends", symbol: "person.2", note: "Focus rooms and the leaderboard.") }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Forest", systemImage: "tree", value: AppTab.forest) {
                    NavigationStack { PlaceholderPage(title: "Forest", symbol: "tree", note: "Every session grows a tree.") }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Shop", systemImage: "bag", value: AppTab.shop) {
                    NavigationStack { PlaceholderPage(title: "Focuz Shop", symbol: "bag", note: "Spend the coins you earn focusing.") }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Settings", systemImage: "gearshape", value: AppTab.settings) {
                    NavigationStack { PlaceholderPage(title: "Settings", symbol: "gearshape", note: "Account, theme and notifications.") }
                }
                .defaultVisibility(.hidden, for: .tabBar)
            }
        }
        .tabViewStyle(.sidebarAdaptable)
        .fzMinimizeTabBarOnScroll()
        .sheet(isPresented: $showYou) {
            YouSheet { picked in
                showYou = false
                tab = picked
            }
        }
    }
}
