"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { LoaderThree } from "@/components/ui/loader";
import BetaLandingPage from "@/components/beta/beta-landing-page";
import BetaLoginPage from "@/components/beta/beta-login-page";
import {
  ensureBetaApplication,
  fetchBetaProfile,
  type BetaProfile,
} from "@/lib/beta-profile";

type BetaView = "landing" | "login" | "signup";

export default function BetaApp() {
  const [view, setView] = useState<BetaView>("landing");
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<BetaProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const refreshProfile = async (userId: string) => {
    const next = await fetchBetaProfile(userId);
    setProfile(next);
    return next;
  };

  useEffect(() => {
    const init = async () => {
      const path = window.location.pathname.replace(/\/$/, "");
      const hash = window.location.hash;

      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession?.user) {
        const existing = await refreshProfile(currentSession.user.id);
        if (!existing) {
          await ensureBetaApplication(
            currentSession.user.id,
            currentSession.user.email ?? null,
          );
          await refreshProfile(currentSession.user.id);
        }
      }

      if (path === "/login" || hash === "#login") {
        setView("login");
      } else if (path === "/signup" || hash === "#signup" || path === "/apply") {
        setView("signup");
      } else {
        setView("landing");
      }

      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        await refreshProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const goLanding = () => {
    setView("landing");
    window.history.replaceState({}, "", "/");
  };

  const goLogin = () => {
    setView("login");
    window.history.pushState({}, "", "/login");
  };

  const goSignup = () => {
    setView("signup");
    window.history.pushState({}, "", "/signup");
  };

  const handleApply = async () => {
    if (!session?.user) {
      goSignup();
      return;
    }

    setApplying(true);
    try {
      const next = await ensureBetaApplication(
        session.user.id,
        session.user.email ?? null,
      );
      setProfile(next);
      goLanding();
    } finally {
      setApplying(false);
    }
  };

  const handleDownload = async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession?.access_token) {
      goLogin();
      return;
    }

    const response = await fetch("/api/download", {
      headers: {
        Authorization: `Bearer ${currentSession.access_token}`,
      },
      redirect: "manual",
    });

    if (response.status === 401) {
      goLogin();
      return;
    }

    if (response.status === 403) {
      alert("Your beta access is not approved yet.");
      return;
    }

    if (response.status === 302) {
      const location = response.headers.get("Location");
      if (location) {
        window.location.href = location;
        return;
      }
    }

    if (!response.ok) {
      const text = await response.text();
      alert(text || "Download failed. Please try again.");
      return;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    goLanding();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-black">
        <LoaderThree className="h-screen" />
      </div>
    );
  }

  if (view === "login" || view === "signup") {
    return (
      <BetaLoginPage
        mode={view === "login" ? "login" : "signup"}
        onBack={goLanding}
        onSuccess={goLanding}
      />
    );
  }

  return (
    <BetaLandingPage
      session={session}
      profile={profile}
      applying={applying}
      onApply={handleApply}
      onLogin={goLogin}
      onDownload={handleDownload}
      onLogout={handleLogout}
    />
  );
}
