"use client";

import React from "react";
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import type { BetaProfile } from "@/lib/beta-profile";
import { IconDownload, IconClockHour4, IconLogout } from "@tabler/icons-react";

type BetaLandingPageProps = {
  session: any;
  profile: BetaProfile | null;
  applying: boolean;
  onApply: () => void;
  onLogin: () => void;
  onDownload: () => void;
  onLogout: () => void;
};

export default function BetaLandingPage({
  session,
  profile,
  applying,
  onApply,
  onLogin,
  onDownload,
  onLogout,
}: BetaLandingPageProps) {
  const isLoggedIn = !!session?.user;
  const isApproved = profile?.is_approved === true;
  const isPending = isLoggedIn && !isApproved;

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-sans selection:bg-purple-500/30">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">
            Focuz<span className="text-purple-500">Now</span>
            <span className="ml-2 text-xs font-medium text-purple-400 border border-purple-500/30 rounded-full px-2 py-0.5">
              Beta
            </span>
          </span>

          <div className="flex items-center gap-3">
            {isApproved ? (
              <button
                onClick={onDownload}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors"
              >
                <IconDownload size={16} />
                Download FocuzNow
              </button>
            ) : isPending ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                <IconClockHour4 size={16} />
                You&apos;re on the waitlist
              </span>
            ) : (
              <>
                <button
                  onClick={onApply}
                  disabled={applying}
                  className="px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {applying ? "Applying..." : "Apply for Beta"}
                </button>
                <button
                  onClick={onLogin}
                  className="px-5 py-2 rounded-full border border-neutral-700 hover:bg-neutral-900 text-neutral-300 text-sm font-medium transition-colors"
                >
                  Login
                </button>
              </>
            )}

            {isLoggedIn && (
              <button
                onClick={onLogout}
                className="p-2 rounded-full text-neutral-500 hover:text-white hover:bg-neutral-900 transition-colors"
                title="Sign out"
              >
                <IconLogout size={18} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <header className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-black to-black pointer-events-none" />

        <div className="z-10 w-full max-w-5xl px-6 flex flex-col items-center">
          <div className="h-[14rem] md:h-[24rem] flex items-center justify-center w-full">
            <TextHoverEffect text="FOCUZNOW" />
          </div>

          <div className="text-center -mt-10 md:-mt-16 space-y-6 flex flex-col items-center max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">
              Join the private beta
            </h1>
            <p className="text-neutral-400 text-lg leading-relaxed">
              FocuzNow helps you understand how you work online — locally, privately,
              and without judgment. Apply for early access and help shape the product
              before public launch.
            </p>

            {isApproved ? (
              <div className="mt-4 p-6 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-center w-full max-w-md">
                <p className="text-purple-200 mb-4">
                  You&apos;re approved! Download the latest beta build below.
                </p>
                <button
                  onClick={onDownload}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all"
                >
                  <IconDownload size={18} />
                  Download FocuzNow
                </button>
              </div>
            ) : isPending ? (
              <div className="mt-4 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center w-full max-w-md">
                <div className="inline-flex items-center gap-2 text-amber-300 font-semibold mb-2">
                  <IconClockHour4 size={20} />
                  You&apos;re on the waitlist
                </div>
                <p className="text-neutral-400 text-sm">
                  Thanks for applying
                  {profile?.applied_at
                    ? ` on ${new Date(profile.applied_at).toLocaleDateString()}`
                    : ""}
                  . We&apos;ll email you when your access is approved.
                </p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <button
                  onClick={onApply}
                  disabled={applying}
                  className="px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold transition-all"
                >
                  {applying ? "Submitting..." : "Apply for Beta Access"}
                </button>
                {!isLoggedIn && (
                  <button
                    onClick={onLogin}
                    className="px-8 py-3 rounded-full border border-neutral-700 hover:bg-neutral-900 text-neutral-300 font-medium transition-all"
                  >
                    Already applied? Login
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="py-20 bg-neutral-950 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
            How the beta works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Apply",
                desc: "Create an account and submit your beta application.",
              },
              {
                step: "2",
                title: "Get approved",
                desc: "Our team reviews applications and grants access manually.",
              },
              {
                step: "3",
                title: "Download & test",
                desc: "Approved testers get a secure download link to the latest build.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-6 rounded-2xl bg-neutral-900/50 border border-white/5 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-purple-900/40 text-purple-400 flex items-center justify-center font-bold mx-auto mb-4 border border-purple-500/20">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-neutral-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-white/5 text-center text-sm text-neutral-600">
        <p>&copy; 2026 FocuzNow. Beta program — access by invitation only.</p>
      </footer>
    </div>
  );
}
