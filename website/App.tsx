"use client";

import React, { useState, useEffect, lazy, Suspense } from "react";
import { LoaderThree } from "@/components/ui/loader";
import LoginPage from "@/components/login-page";
import ForgotPasswordPage from "@/components/forgot-password-page";
import ResetPasswordPage from "@/components/reset-password-page";
import { supabase } from "@/lib/supabase";
import {
  syncSessionWithExtension,
  redirectToExtension,
  shouldHandoffToExtension,
  clearExtensionOAuthParam,
} from "@/lib/extension-utils";
import ExtensionHandoffScreen from "@/components/extension-handoff-screen";
import { isBillingReturnQuery } from "@/lib/billing-urls";
import WebOptionsApp from "@/components/WebOptionsApp";
import CalendarPage from "@/components/calendar-page";
import ManageSubscriptionPage from "@/components/manage-subscription";
import BlockedPage from "@/components/blocked-page";
import OnboardingModal from "@/components/onboarding-modal";
import ScheduleBookingPage from "@/components/schedule-booking-page";
import PublicProfilePage from "@/components/public-profile-page";
import { isScheduleRoute, getPublicProfileUsername, isPublicProfileRoute } from "@/lib/routing";
import { clearAuthErrorFromUrl } from "@/lib/auth-providers";
import { isBetaTesterSite } from "@/lib/site-mode";
import BetaApp from "@/components/beta/beta-app";

// The landing page (and its shader) is its own chunk. Start fetching it right away on the
// home page so it is ready by the time the session check finishes.
const loadLandingPage = () => import("@/components/landing/LandingPage");
const LandingPage = lazy(loadLandingPage);
const PwCodePage = lazy(() => import("@/components/pwcode-page"));
if (typeof window !== "undefined" && window.location.pathname === "/") void loadLandingPage();

// -----------------------------------------------------------------------------
// MAIN APP
// -----------------------------------------------------------------------------
function FocuzNowApp() {
  const [currentView, setCurrentView] = useState<
    | "landing"
    | "login"
    | "forgot_password"
    | "reset_password"
    | "dashboard"
    | "calendar"
    | "manage_subscription"
    | "blocked"
    | "schedule"
    | "public_profile"
    | "pwcode"
  >("landing");
  const [session, setSession] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  const [loginDefaultState, setLoginDefaultState] = useState(() => {
    if (typeof window === "undefined") return true;
    const path = window.location.pathname.replace(/\/$/, "");
    const hash = window.location.hash;
    return !(path === "/signup" || hash === "#signup");
  });

  const [loading, setLoading] = useState(true);
  const [extensionHandoff, setExtensionHandoff] = useState<"idle" | "redirecting" | "done">("idle");

  const beginExtensionHandoff = () => {
    if (!shouldHandoffToExtension()) return false;
    clearExtensionOAuthParam();
    setExtensionHandoff("redirecting");
    return true;
  };

  useEffect(() => {
    if (extensionHandoff !== "redirecting" || !session) return;

    syncSessionWithExtension(session);

    const timer = window.setTimeout(() => {
      redirectToExtension();
      setExtensionHandoff("done");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [extensionHandoff, session]);

  useEffect(() => {
    const checkSessionAndRoute = async () => {
      const oauthError = clearAuthErrorFromUrl();
      if (oauthError) {
        console.warn('[App] OAuth error from redirect:', oauthError);
      }

      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      const path = window.location.pathname.replace(/\/$/, "");
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      const viewQuery = searchParams.get("view");

      const isDashboardPath =
        path === "/app" ||
        path.startsWith("/app/") ||
        path === "/dashboard" ||
        hash === "#dashboard" ||
        viewQuery === "dashboard";
      const isCalendarPath =
        path === "/calendar" ||
        path.startsWith("/calendar/") ||
        hash === "#calendar" ||
        viewQuery === "calendar";
      const isManageSubPath = path === "/manage_subscription" || hash === "#manage_subscription" || viewQuery === "manage_subscription";
      const isBlockedPath = path === "/blocked" || hash === "#blocked" || viewQuery === "blocked";
      const isLoginPath = path === "/login" || path === "/signup" || hash === "#login" || hash === "#signup" || viewQuery === "login" || viewQuery === "signup";
      const isForgotPasswordPath = path === "/forgot-password";
      const isPwCodePath = path === "/pwcode";
      const isResetPasswordPath = path === "/reset-password";
      const isSchedulePath = /^\/schedule\/[^/]+/.test(path);
      const publicProfileUser = getPublicProfileUsername();

      if (isPwCodePath) {
        setCurrentView("pwcode");
        setLoading(false);
        return;
      }

      if (isForgotPasswordPath) {
        setCurrentView("forgot_password");
        setLoading(false);
        return;
      }

      if (isResetPasswordPath) {
        setCurrentView("reset_password");
        setLoading(false);
        return;
      }

      if (isSchedulePath) {
        setCurrentView("schedule");
        setLoading(false);
        return;
      }

      if (publicProfileUser) {
        setCurrentView("public_profile");
        setLoading(false);
        return;
      }

      if (session) {
        const billingReturn = isBillingReturnQuery(window.location.search);

        try {
          const raw = localStorage.getItem("focuznow_pending_signup_prefs");
          if (raw) {
            const prefs = JSON.parse(raw) as { marketing_opt_in?: boolean; terms_accepted?: boolean };
            localStorage.removeItem("focuznow_pending_signup_prefs");
            const meta = session.user.user_metadata || {};
            if (meta.terms_accepted == null || meta.marketing_opt_in == null) {
              void supabase.auth.updateUser({
                data: {
                  terms_accepted: prefs.terms_accepted ?? true,
                  terms_accepted_at: new Date().toISOString(),
                  marketing_opt_in: Boolean(prefs.marketing_opt_in),
                },
              });
            }
          }
        } catch {
          /* ignore */
        }

        if (
          !isSchedulePath &&
          !billingReturn &&
          beginExtensionHandoff()
        ) {
          setLoading(false);
          return;
        }

        if (!isSchedulePath) {
          syncSessionWithExtension(session);
        }

        // Check for new user (created within last minute)
        if (session.user.created_at && new Date(session.user.created_at).getTime() > Date.now() - 60000) {
          setShowOnboarding(true);
        }

        if (isCalendarPath) {
          setCurrentView("calendar");
        } else if (isDashboardPath) {
          setCurrentView("dashboard");
        } else if (isManageSubPath) {
          setCurrentView("manage_subscription");
        } else if (isBlockedPath) {
          setCurrentView("blocked");
        } else if (isLoginPath) {
          setCurrentView("dashboard");
          window.history.replaceState({}, "", "/dashboard");
        } else {
          setCurrentView("landing");
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session && !isScheduleRoute()) {
        syncSessionWithExtension(session);
      }
      if (event === "SIGNED_IN" && session && !isScheduleRoute()) {
        beginExtensionHandoff();
      }
      if (isScheduleRoute()) {
        setCurrentView("schedule");
        setLoading(false);
      } else if (isPublicProfileRoute()) {
        setCurrentView("public_profile");
        setLoading(false);
      }
    });

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
      subscription.unsubscribe();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const goForgotPassword = () => {
    setCurrentView("forgot_password");
    window.history.pushState({}, "", "/forgot-password");
  };

  const goResetPassword = () => {
    setCurrentView("reset_password");
    window.history.pushState({}, "", "/reset-password");
  };

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

  const goCalendar = () => {
    if (!session) {
      goLogin();
      return;
    }
    setCurrentView("calendar");
    window.history.pushState({}, "", "/calendar");
  };

  const goManageSubscription = () => {
    if (!session) {
      goLogin();
      return;
    }
    setCurrentView("manage_subscription");
    window.history.pushState({}, "", "/manage_subscription");
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

  if (extensionHandoff !== "idle" && session) {
    return <ExtensionHandoffScreen phase={extensionHandoff === "done" ? "done" : "redirecting"} />;
  }

  if (currentView === "pwcode") {
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
        <PwCodePage />
      </Suspense>
    );
  }

  if (currentView === "schedule") {
    return <ScheduleBookingPage />;
  }

  if (currentView === "public_profile") {
    const handle = getPublicProfileUsername();
    if (handle) return <PublicProfilePage username={handle} />;
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
  // DASHBOARD (REDIRECTING)
  // ---------------------------------------------------------------------------
  if (currentView === "dashboard" && session) {
    return (
      <WebOptionsApp
        onLogout={() => {
          supabase.auth.signOut().then(() => goLanding());
        }}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // CALENDAR
  // ---------------------------------------------------------------------------
  if (currentView === "calendar" && session) {
    return <CalendarPage session={session} onBack={goDashboard} />;
  }

  // ---------------------------------------------------------------------------
  // LOGIN PAGE
  // ---------------------------------------------------------------------------
  if (currentView === "forgot_password") {
    return <ForgotPasswordPage onBack={goLogin} />;
  }

  if (currentView === "reset_password") {
    return (
      <ResetPasswordPage
        onSuccess={() => {
          goLogin();
        }}
      />
    );
  }

  if (currentView === "login") {
    return (
      <LoginPage
        onBack={goLanding}
        onForgotPassword={goForgotPassword}
        onLoginSuccess={() => {
          supabase.auth.getSession().then(({ data }) => {
            if (!data.session) return;
            setSession(data.session);
            syncSessionWithExtension(data.session);
            if (beginExtensionHandoff()) return;
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
    <>
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <LandingPage
          signedIn={Boolean(session)}
          onGetStarted={goSignup}
          onLogin={goLogin}
          onOpenDashboard={goDashboard}
        />
      </Suspense>

      {/* Onboarding & Dev Mode */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => setShowOnboarding(false)}
      />

      {isDevMode && (
        <div className="fixed bottom-4 right-4 bg-black border border-blue-500 text-blue-400 px-4 py-2 rounded-lg shadow-lg z-50 font-mono text-xs animate-in slide-in-from-bottom-2">
          <div className="font-bold mb-1">DEV MODE ACTIVE</div>
          <div className="opacity-70">Run onboarding() in console</div>
        </div>
      )}
    </>
  );
}

/** Booking pages skip auth/dashboard routing entirely so guests are never redirected home. */
export default function App() {
  if (typeof window !== "undefined" && isScheduleRoute()) {
    return <ScheduleBookingPage />;
  }
  if (typeof window !== "undefined" && isBetaTesterSite()) {
    return <BetaApp />;
  }
  return <FocuzNowApp />;
}
