import SwiftUI

enum AppTab: Hashable {
    case today, focus, plan, pass, coach
    case stats, friends, forest, shop, customize, settings
}

/// Onboarding the first time, then the app. Also drives the session clock.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("onboarded") private var onboarded = false
    @AppStorage("appearance") private var appearance = "system"

    /// Only on launches where you're already set up (onboarding opens on its own lighthouse).
    @State private var splash = UserDefaults.standard.bool(forKey: "onboarded")

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Group {
                if onboarded {
                    MainTabs()
                        .transition(.opacity.combined(with: .scale(scale: 1.04)))
                } else {
                    OnboardingFlow()
                        .transition(.opacity)
                }
            }
            .animation(.smooth(duration: 0.8), value: onboarded)
            if splash {
                SplashView { splash = false }
                    .zIndex(1)
            }
        }
        .background(Color.black)
        .preferredColorScheme(appearance == "light" ? .light : appearance == "dark" ? .dark : nil)
        .onReceive(clock) { _ in model.tick() }
    }
}

/// Five tabs on iPhone; on iPad the same TabView becomes a sidebar (`.sidebarAdaptable`) with the
/// "You" pages as their own rows. On iPhone those live in the sheet behind the avatar instead.
private struct MainTabs: View {
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var tab: AppTab = .today
    @State private var showYou = false

    var body: some View {
        @Bindable var model = model
        TabView(selection: $tab) {
            Tab("Today", systemImage: "sun.max.fill", value: AppTab.today) {
                NavigationStack { TodayView(showYou: $showYou, startFocus: { tab = .focus }) }
            }
            Tab("Focus", systemImage: "scope", value: AppTab.focus) {
                NavigationStack { FocusSetupView() }
            }
            Tab("Plan", systemImage: "checklist", value: AppTab.plan) {
                NavigationStack { PlanView() }
            }
            Tab("Pass", systemImage: "key.fill", value: AppTab.pass) {
                PassView()
            }
            Tab("Coach", systemImage: "sparkles", value: AppTab.coach) {
                NavigationStack { CoachView() }
            }

            TabSection("You") {
                Tab("Stats", systemImage: "chart.bar.fill", value: AppTab.stats) {
                    NavigationStack { StatsView() }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Friends", systemImage: "person.2.fill", value: AppTab.friends) {
                    NavigationStack { FriendsView() }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Forest", systemImage: "tree.fill", value: AppTab.forest) {
                    NavigationStack { ForestView() }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Shop", systemImage: "bag.fill", value: AppTab.shop) {
                    NavigationStack { ShopView() }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Customize", systemImage: "paintbrush.fill", value: AppTab.customize) {
                    NavigationStack { CustomizeView() }
                }
                .defaultVisibility(.hidden, for: .tabBar)
                Tab("Settings", systemImage: "gearshape.fill", value: AppTab.settings) {
                    NavigationStack { SettingsView() }
                }
                .defaultVisibility(.hidden, for: .tabBar)
            }
        }
        .tabViewStyle(.sidebarAdaptable)
        .tint(Color.fzInk)
        .fzMinimizeTabBarOnScroll()
        .modifier(SessionAccessory(session: model.session, compact: sizeClass != .regular) { model.showSession = true })
        .sheet(isPresented: $showYou) {
            YouSheet().environment(model)
        }
        .fullScreenCover(isPresented: $model.showSession) {
            ActiveSessionView().environment(model)
        }
    }
}

/// The running session above the tab bar: the tab bar's own accessory on iOS 26, a floating glass
/// bar on iOS 18.
private struct SessionAccessory: ViewModifier {
    let session: FocusSession?
    let compact: Bool
    let open: () -> Void

    func body(content: Content) -> some View {
        if let session {
            if #available(iOS 26, *) {
                content.tabViewBottomAccessory {
                    SessionBar(session: session, open: open)
                }
            } else {
                content.overlay(alignment: .bottom) {
                    SessionBar(session: session, open: open)
                        .fzGlass(in: Capsule())
                        .padding(.horizontal, 14)
                        .padding(.bottom, compact ? 58 : 14)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        } else {
            content
        }
    }
}
