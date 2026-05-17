"use client";

import React, { useState, useEffect } from "react";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { Tooltip } from "@/components/ui/tooltip-card";
import { LoaderThree } from "@/components/ui/loader";
import { FloatingNav } from "@/components/ui/floating-navbar";
import { TypewriterEffectSmooth } from "@/components/ui/typewriter-effect";
import { LinkPreview } from "@/components/ui/link-preview";
import FeaturesList from "@/components/features-list";
import LoginPage from "@/components/login-page";
import { AiChatWidget } from "@/components/ai-chat-widget";
import { IconBrandGoogle, IconEye, IconEyeOff, IconCheck, IconMail, IconLock, IconUser, IconHome, IconChartBar, IconCurrencyDollar } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { syncSessionWithExtension, redirectToExtension } from "@/lib/extension-utils";
import DashboardPage from "@/components/dashboard-page";
import ManageSubscriptionPage from "@/components/manage-subscription";
import BlockedPage from "@/components/blocked-page";
import OnboardingModal from "@/components/onboarding-modal";
// -----------------------------------------------------------------------------
// SAFE PLACEHOLDER DASHBOARD
// -----------------------------------------------------------------------------
function DashboardUnavailable({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-xl"
      >
        <div className="bg-zinc-900/40 backdrop-blur-3xl border border-white/5 p-12 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] text-center flex flex-col items-center">
          {/* Animated Icon Container */}
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-20 animate-pulse rounded-full" />
            <div className="relative w-24 h-24 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl">
              <IconLock size={48} className="text-white" />
            </div>

            {/* Pulsing rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-purple-500/20 rounded-full animate-ping" />
          </div>

          <h1 className="text-4xl font-black mb-4 tracking-tight leading-tight">
            Extension <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Required</span>
          </h1>

          <p className="text-zinc-400 text-lg mb-10 max-w-sm font-medium leading-relaxed">
            Please install the FocuzNow extension to sync your focus sessions and access your dashboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-8 py-5 rounded-2xl bg-white text-black font-black text-lg hover:bg-zinc-200 active:scale-95 transition-all shadow-xl"
            >
              Refresh Page
            </button>

            <button
              onClick={onLogout}
              className="flex-1 px-8 py-5 rounded-2xl bg-zinc-800/50 text-white font-bold text-lg hover:bg-zinc-800 border border-white/5 active:scale-95 transition-all"
            >
              Sign Out
            </button>
          </div>

          <p className="mt-8 text-xs text-zinc-600 font-bold uppercase tracking-widest">
            Browser integration is mandatory for safety
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN APP
// -----------------------------------------------------------------------------
export default function App() {
  const [currentView, setCurrentView] = useState<
    "landing" | "login" | "dashboard" | "manage_subscription" | "blocked" | "notion-auth"
  >("landing");
  const [session, setSession] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [hasExtension, setHasExtension] = useState(() => {
    if (typeof document === 'undefined') return false;
    return !!document.documentElement.getAttribute('data-focuznow-extension');
  });

  const [loginDefaultState, setLoginDefaultState] = useState(() => {
    if (typeof window === "undefined") return true;
    const path = window.location.pathname.replace(/\/$/, "");
    const hash = window.location.hash;
    return !(path === "/signup" || hash === "#signup");
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSessionAndRoute = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      const path = window.location.pathname.replace(/\/$/, "");
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      const viewQuery = searchParams.get("view");

      const isDashboardPath = path === "/dashboard" || hash === "#dashboard" || viewQuery === "dashboard";
      const isManageSubPath = path === "/manage_subscription" || hash === "#manage_subscription" || viewQuery === "manage_subscription";
      const isBlockedPath = path === "/blocked" || hash === "#blocked" || viewQuery === "blocked";
      const isLoginPath = path === "/login" || path === "/signup" || hash === "#login" || hash === "#signup" || viewQuery === "login" || viewQuery === "signup";
      const isNotionAuth = path === "/notion-auth" || viewQuery === "notion-auth";

      if (isNotionAuth) {
        setCurrentView("notion-auth");
        setLoading(false);
        return; // Skip authentication logic entirely for the proxy
      }

      if (session) {
        syncSessionWithExtension(session);

        // Immediate Redirection Logic
        if (document.documentElement.getAttribute('data-focuznow-extension')) {
          console.log('[App] Session + Extension detected. Redirecting...');
          redirectToExtension();
          setLoading(false); // Stop loading and allow redirect to happen
          return;
        }

        // Check for new user (created within last minute)
        if (session.user.created_at && new Date(session.user.created_at).getTime() > Date.now() - 60000) {
          setShowOnboarding(true);
        }

        if (isDashboardPath) {
          setCurrentView("dashboard");
        } else if (isManageSubPath) {
          setCurrentView("manage_subscription");
        } else if (isBlockedPath) {
          setCurrentView("blocked");
        } else {
          setCurrentView("dashboard");
          window.history.pushState({}, "", "/dashboard");
        }
      } else {
        if (isManageSubPath) {
          setCurrentView("login");
          window.history.pushState({}, "", "/login");
        } else if (isBlockedPath) {
          setCurrentView("blocked");
        } else if (isLoginPath) {
          setCurrentView("login");
        } else {
          setCurrentView("landing");
        }
      }
      setLoading(false);
    };

    checkSessionAndRoute();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) syncSessionWithExtension(session);
    });

    // Listen for Extension Ready
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FOCUZNOW_EXTENSION_READY' || event.data?.type === 'FOCUZNOW_EXTENSION_PONG') {
        console.log('[Web] Extension detected via message!');
        setHasExtension(true);
      }
    };
    window.addEventListener("message", handleMessage);

    // Initial Check
    if (document.documentElement.getAttribute('data-focuznow-extension')) {
      setHasExtension(true);
    }

    // Ping the extension periodically until it responds
    const pingInterval = setInterval(() => {
      const isDetected = !!document.documentElement.getAttribute('data-focuznow-extension');
      if (isDetected) {
        console.log('[Web] Extension detected via attribute scan!');
        setHasExtension(true);
        clearInterval(pingInterval);
      }
      window.postMessage({ type: 'FOCUZNOW_WEB_PING' }, '*');
    }, 200); // More aggressive ping (200ms)

    // Dev Mode & Onboarding Trigger
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "Escape") {
        setIsDevMode(prev => !prev);
        console.log("Dev Mode Toggled");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    (window as any).onboarding = () => setShowOnboarding(true);

    return () => {
      clearInterval(pingInterval);
      subscription.unsubscribe();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // When session AND extension are both ready, trigger the final redirect out of here
  useEffect(() => {
    if (session && hasExtension && currentView === "dashboard") {
      console.log('[App] Session + Extension confirmed. Redirecting out...');
      redirectToExtension();
    }
  }, [session, hasExtension, currentView]);

  const navItems = [
    {
      name: "Features",
      link: "#features",
      icon: (
        <IconChartBar className="h-4 w-4 text-neutral-500 dark:text-white" />
      ),
    },
    {
      name: "How it Works",
      link: "#how-it-works",
      icon: <IconHome className="h-4 w-4 text-neutral-500 dark:text-white" />,
    },
    {
      name: "Pricing",
      link: "#pricing",
      icon: (
        <IconCurrencyDollar className="h-4 w-4 text-neutral-500 dark:text-white" />
      ),
    },
  ];

  const typewriterWords = [
    { text: "Local-first" },
    { text: "analytics" },
    { text: "for" },
    { text: "deep" },
    { text: "work.", className: "text-purple-500 dark:text-purple-500" },
  ];

  const goLogin = () => {
    setLoginDefaultState(true);
    setCurrentView("login");
    window.history.pushState({}, "", "/login");
  };

  const goSignup = () => {
    setLoginDefaultState(false);
    setCurrentView("login");
    window.history.pushState({}, "", "/signup");
  };

  const goLanding = () => {
    setCurrentView("landing");
    window.history.pushState({}, "", "/");
  };

  const goDashboard = () => {
    setCurrentView("dashboard");
    window.history.pushState({}, "", "/dashboard");
  };

  const goManageSubscription = () => {
    if (!session) {
      goLogin();
      return;
    }
    setCurrentView("manage_subscription");
    window.history.pushState({}, "", "/manage_subscription");
  };

  const handleInstallClick = () => {
    if (document.documentElement.getAttribute('data-focuznow-extension')) {
      alert("Extension is already installed! Open it from your browser toolbar.");
    } else {
      window.open('https://chrome.google.com/webstore/detail/your-extension-id', '_blank');
    }
  };

  // ---------------------------------------------------------------------------
  // LOADING SCREEN
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black">
        <LoaderThree className="h-screen" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MANAGE SUBSCRIPTION
  // ---------------------------------------------------------------------------
  if (currentView === "manage_subscription" && session) {
    return <ManageSubscriptionPage session={session} onBack={goDashboard} />;
  }

  if (currentView === "blocked") {
    return <BlockedPage />;
  }

  // ---------------------------------------------------------------------------
  // NOTION OAUTH PROXY
  // ---------------------------------------------------------------------------
  if (currentView === "notion-auth") {
    // When the component mounts or renders, we process the redirect immediately
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const extId = params.get("state");

      if (code && extId) {
        // Safe Bridge: Redirect directly to the extension's options page
        window.location.href = `chrome-extension://${extId}/src/options/index.html?notion_code=${code}`;
      }
    }

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-10">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Connecting to Notion...</h1>
        <p className="text-neutral-500 text-sm">Please wait while we redirect you back to FocuzNow.</p>
        <p className="text-neutral-700 text-xs mt-4">Proxying token back to extension</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // DASHBOARD (REDIRECTING)
  // ---------------------------------------------------------------------------
  if (currentView === "dashboard" && session) {
    if (hasExtension) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-10">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-purple-500 rounded-full animate-spin" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Authenticating...</h1>
          <p className="text-neutral-500 text-sm">Passing session to FocuzNow Extension.</p>
        </div>
      );
    }

    return (
      <DashboardUnavailable onLogout={() => {
        supabase.auth.signOut().then(() => goLanding());
      }} />
    );
  }

  // ---------------------------------------------------------------------------
  // LOGIN PAGE
  // ---------------------------------------------------------------------------
  if (currentView === "login") {
    return (
      <LoginPage
        onBack={goLanding}
        onLoginSuccess={() => {
          // Check for session again before redirecting
          supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
              syncSessionWithExtension(data.session);
              if (document.documentElement.getAttribute('data-focuznow-extension')) {
                redirectToExtension();
              }
            }
            goDashboard();
          });
        }}
        initialLoginState={loginDefaultState}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // LANDING PAGE
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-black text-neutral-200 font-sans selection:bg-purple-500/30">
      <FloatingNav navItems={navItems} onLoginClick={goLogin} />
      <AiChatWidget />

      {/* HERO SECTION */}
      <header className="relative flex flex-col items-center justify-center min-h-[90vh] overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-black to-black pointer-events-none" />

        <div className="z-10 w-full max-w-5xl px-4 flex flex-col items-center">
          <div className="h-[20rem] md:h-[40rem] flex items-center justify-center w-full">
            <TextHoverEffect text="FOCUZNOW" />
          </div>

          <div className="text-center -mt-20 md:-mt-40 space-y-6 flex flex-col items-center">
            <TypewriterEffectSmooth words={typewriterWords} />
            <p className="max-w-xl mx-auto text-neutral-400 text-lg">
              Your focus data, finally useful. Local-first analytics that turn
              your browsing chaos into personalized focus strategies. No cloud.
              No judgment. Just insights.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <button
                onClick={handleInstallClick}
                className="px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all transform hover:scale-105"
              >
                Add to Chrome - Free
              </button>
              <button className="px-8 py-3 rounded-full border border-neutral-700 hover:bg-neutral-900 text-neutral-300 font-medium transition-all flex items-center gap-2">
                <span>▶</span> Watch Demo
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-4">
              1,250 people improved their focus this week
            </p>
          </div>
        </div>
      </header>

      {/* Stats Section */}
      <section className="py-20 bg-neutral-950 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mb-16">
            <div className="p-6 rounded-2xl bg-neutral-900/50 border border-white/5">
              <p className="text-neutral-500 text-sm mb-2">Focus Score</p>
              <p className="text-4xl font-bold text-white">87/100</p>
            </div>
            <div className="p-6 rounded-2xl bg-neutral-900/50 border border-white/5">
              <p className="text-neutral-500 text-sm mb-2">Time Saved</p>
              <p className="text-4xl font-bold text-purple-400">2h 34m</p>
            </div>
            <div className="p-6 rounded-2xl bg-neutral-900/50 border border-white/5">
              <p className="text-neutral-500 text-sm mb-2">Current Streak</p>
              <p className="text-4xl font-bold text-white">12 days</p>
            </div>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              You're not lazy. <br />
              <span className="text-purple-500">
                Your browser is just too interesting.
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                label: "Average daily social media time",
                value: "2.5 hours",
                icon: "📱",
              },
              { label: "Tab switches per hour", value: "47", icon: "🔄" },
              { label: "Average focus duration", value: "11 minutes", icon: "⏱️" },
              { label: "When you finally close YouTube", value: "3am", icon: "🌙" },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-6 rounded-xl bg-black border border-neutral-800 hover:border-purple-500/30 transition-colors"
              >
                <div className="text-2xl mb-4">{stat.icon}</div>
                <div className="text-xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-neutral-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Personas */}
      <section className="py-24 px-6 bg-black">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 text-neutral-200">
            The Usual Suspects
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="text-4xl mb-4">🌀</div>
              <h3 className="text-xl font-bold text-white mb-2">The Rabbit Hole</h3>
              <p className="text-neutral-400">
                Started with one tutorial, ended on ancient alien theories.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="text-4xl mb-4">🗂️</div>
              <h3 className="text-xl font-bold text-white mb-2">The Tab Hoarder</h3>
              <p className="text-neutral-400">
                67 tabs open, 3 are actually useful.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-neutral-900 border border-neutral-800">
              <div className="text-4xl mb-4">🔄</div>
              <h3 className="text-xl font-bold text-white mb-2">
                The Context Switcher
              </h3>
              <p className="text-neutral-400">
                Email → Slack → Twitter → Wait, what was I doing?
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features List */}
      <section id="features" className="py-12 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-5xl font-bold text-center text-white mb-12">
            Intelligence meets{" "}
            <span className="text-purple-500">privacy</span>.
          </h2>
          <FeaturesList />
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 px-6 bg-black relative">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">
            Three steps to focus clarity
          </h2>
          <div className="space-y-12">
            {[
              {
                step: "Step 1",
                title: "Install in 10 seconds",
                desc: "One click. No signup required.",
              },
              {
                step: "Step 2",
                title: "Browse normally for 24 hours",
                desc: "We learn your patterns silently.",
              },
              {
                step: "Step 3",
                title: "Receive your first insight",
                desc: "Actionable advice by day two.",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-900/30 text-purple-400 flex items-center justify-center font-bold border border-purple-500/20">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{item.title}</h3>
                  <p className="text-neutral-400 mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-neutral-950 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Start free. Upgrade when you're ready.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col">
              <h3 className="text-2xl font-bold text-white mb-2">Free Forever</h3>
              <div className="text-4xl font-bold text-white mb-6">
                $0<span className="text-lg text-neutral-500 font-normal">/month</span>
              </div>
              <p className="text-neutral-400 mb-8">Perfect for getting started</p>

              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Core tracking",
                  "Daily focus score",
                  "Top 5 site analytics",
                  "Basic weekly reports",
                  "Chrome extension",
                ].map((feat, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-neutral-300"
                  >
                    <span className="text-purple-500">✓</span> {feat}
                  </li>
                ))}
              </ul>

              <button className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-neutral-200 transition-colors">
                Start Free →
              </button>
            </div>

            {/* Pro Plan */}
            <div className="p-8 rounded-3xl bg-neutral-900 border border-purple-500/30 relative flex flex-col">
              <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">
                MOST POPULAR
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
              <div className="text-4xl font-bold text-white mb-6">
                $8<span className="text-lg text-neutral-500 font-normal">/month</span>
              </div>
              <p className="text-neutral-400 mb-8">Everything in Free, plus:</p>

              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "AI-powered daily insights",
                  "Unlimited site tracking",
                  "Custom focus goals",
                  "Advanced analytics",
                  "Calendar integration",
                  "Priority support",
                ].map((feat, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-neutral-300"
                  >
                    <span className="text-purple-400">✓</span> {feat}
                  </li>
                ))}
              </ul>

              <button
                onClick={goSignup}
                className="w-full py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 transition-colors"
              >
                Start 7-Day Trial →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-black">
        <div className="max-w-3xl mx-auto text-center leading-loose text-lg md:text-2xl text-neutral-400">
          <div className="mb-12">
            Real focus wins. Just ask{" "}
            <Tooltip
              containerClassName="text-white decoration-purple-500 decoration-2 underline underline-offset-4"
              content={
                <div>
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200"
                    alt="Sarah K."
                    className="aspect-square w-full rounded-sm object-cover"
                  />
                  <div className="my-4 flex flex-col">
                    <p className="text-lg font-bold">Sarah K.</p>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      Software Engineer. Cut Reddit time by 73%.
                    </p>
                  </div>
                </div>
              }
            >
              <span className="cursor-pointer font-bold hover:text-purple-400 transition-colors">
                Sarah
              </span>
            </Tooltip>
            , who cut her Reddit time by 73% in two weeks. "The AI insights are
            scary accurate."
          </div>

          <div>
            Even{" "}
            <Tooltip
              containerClassName="text-white decoration-purple-500 decoration-2 underline underline-offset-4"
              content={
                <div className="">
                  <blockquote className="mb-4 text-neutral-700 dark:text-neutral-300 italic">
                    "This extension understood my procrastination patterns
                    better than I do."
                  </blockquote>
                  <div className="flex items-center gap-2">
                    <img
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200"
                      alt="Marcus J."
                      className="size-8 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        Marcus J.
                      </p>
                      <p className="text-[10px] text-neutral-600 dark:text-neutral-400">
                        PhD Student
                      </p>
                    </div>
                  </div>
                </div>
              }
            >
              <span className="cursor-pointer font-bold hover:text-purple-400 transition-colors">
                Marcus
              </span>
            </Tooltip>{" "}
            finally finished his thesis using Focuznow.
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="py-20 border-t border-white/10 bg-neutral-950 text-center">
        <h2 className="text-3xl font-bold text-white mb-6">
          Ready to reclaim your focus?
        </h2>
        <p className="text-neutral-400 mb-8">
          Join 1,247 people who took control this week.
        </p>

        <button
          onClick={handleInstallClick}
          className="px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:bg-neutral-200 transition-colors mb-4"
        >
          Add to Chrome - Start Free
        </button>

        <div className="flex justify-center gap-6 text-sm text-neutral-500 mt-6">
          <span>No Credit Card Required</span>
          <span>Setup in 60 Seconds</span>
          <span>Cancel Anytime</span>
        </div>

        <div className="mt-20 border-t border-white/5 pt-12 flex flex-col md:flex-row justify-between items-center max-w-6xl mx-auto px-6 text-sm text-neutral-600">
          <div className="flex gap-6 mb-4 md:mb-0">
            <a href="/privacy.html" className="hover:text-purple-500 transition-colors">
              Privacy
            </a>
            <a href="/terms.html" className="hover:text-purple-500 transition-colors">
              Terms
            </a>
            <a href="mailto:support@focuznow.com" className="hover:text-purple-500 transition-colors">
              Support
            </a>
          </div>
          <p>&copy; 2026 FocuzNow, Inc. All rights reserved.</p>
        </div>
      </footer>

      {/* Onboarding & Dev Mode */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => setShowOnboarding(false)}
      />

      {isDevMode && (
        <div className="fixed bottom-4 right-4 bg-black border border-purple-500 text-purple-400 px-4 py-2 rounded-lg shadow-lg z-50 font-mono text-xs animate-in slide-in-from-bottom-2">
          <div className="font-bold mb-1">DEV MODE ACTIVE</div>
          <div className="opacity-70">Run onboarding() in console</div>
        </div>
      )}
    </div>
  );
}
