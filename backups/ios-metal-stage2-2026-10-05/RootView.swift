import SwiftUI

enum AppTab: Hashable {
    case today, focus, plan, pass, coach, you
    case stats, friends, forest, shop, customize
}

/// Onboarding the first time, then the app. Also drives the session clock.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @AppStorage("onboarded") private var onboarded = false
    @AppStorage("appearance") private var appearance = "system"

    /// Only on launches where you're already set up (the onboarding opens with its own Z).
    @State private var splash = UserDefaults.standard.bool(forKey: "onboarded")

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Group {
                if onboarded {
                    // A plain cross-fade: Today opens on the same orb stage the onboarding ends on.
                    MainTabs()
                        .transition(.opacity)
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
        .fzPopupHost()
        .preferredColorScheme(appearance == "light" ? .light : appearance == "dark" ? .dark : nil)
        .onReceive(clock) { _ in model.tick() }
    }
}

/// Today, Focus, Plan, Pass and You on iPhone; Coach opens as a sheet there (the sparkles on Today, or
/// You → Coach). On iPad the TabView becomes a sidebar (`.sidebarAdaptable`) with Coach in the bar and
/// the "More" pages as their own rows; on iPhone those are tiles in You.
private struct MainTabs: View {
    @Environment(AppModel.self) private var model
    @Environment(PopupCenter.self) private var popups
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var tab: AppTab = .today
    @State private var showCoach = false

    var body: some View {
        @Bindable var model = model
        Group {
            if sizeClass == .regular {
                sidebarTabs
            } else {
                phoneTabs
            }
        }
        .tint(Color.fzInk)
        .fzMinimizeTabBarOnScroll()
        .modifier(SessionAccessory(session: model.session, compact: sizeClass != .regular) { model.showSession = true })
        .sheet(isPresented: $showCoach) {
            NavigationStack { CoachView() }
                .environment(model)
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(32)
        }
        .fullScreenCover(isPresented: $model.showSession) {
            ActiveSessionView()
                .environment(model)
                .environment(popups)
        }
    }

    /// Today, with its stage stopped while Coach or a session covers it, or another tab is showing.
    private var today: some View {
        TodayView(openCoach: openCoach, startFocus: { tab = .focus }, open: { tab = $0 },
                  covered: showCoach || model.showSession || tab != .today)
    }

    private func openCoach() {
        if sizeClass == .regular { tab = .coach } else { showCoach = true }
    }

    /// Exactly five. On iPhone, tabs marked hidden still count towards the five and pushed You into a
    /// "More" tab, so the phone's TabView simply doesn't have the others.
    private var phoneTabs: some View {
        TabView(selection: $tab) {
            Tab("Today", systemImage: "sun.max.fill", value: AppTab.today) {
                NavigationStack { today }
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
            Tab("You", systemImage: "person.crop.circle.fill", value: AppTab.you) {
                NavigationStack { AccountView(open: { tab = $0 }, openCoach: openCoach) }
            }
        }
    }

    private var sidebarTabs: some View {
        TabView(selection: $tab) {
            Tab("Today", systemImage: "sun.max.fill", value: AppTab.today) {
                NavigationStack { today }
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
            Tab("You", systemImage: "person.crop.circle.fill", value: AppTab.you) {
                NavigationStack { AccountView(open: { tab = $0 }, openCoach: openCoach) }
            }

            TabSection("More") {
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
            }
        }
        .tabViewStyle(.sidebarAdaptable)
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
