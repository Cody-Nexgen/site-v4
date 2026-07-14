"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IconLock, IconEye, IconEyeOff, IconCheck } from "@tabler/icons-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedInput } from "@/components/ui/AnimatedInput";

type Props = {
  onSuccess: () => void;
};

export default function ResetPasswordPage({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(false);
  const [strength, setStrength] = useState(0);

  useEffect(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    setStrength(score);
  }, [password]);

  useEffect(() => {
    let cancelled = false;

    const verifyRecoverySession = async () => {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token")) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          setReady(!!session);
          setChecking(false);
          if (session) {
            window.history.replaceState({}, "", window.location.pathname);
          }
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        setReady(!!session);
        setChecking(false);
      }
    };

    void verifyRecoverySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
        setChecking(false);
        window.history.replaceState({}, "", window.location.pathname);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (strength < 4) {
      setError("Password is too weak. Use 8+ characters with upper, lower, number, and symbol.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      window.setTimeout(() => onSuccess(), 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not update password.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Verifying reset link…</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
        <GlassCard className="p-8 max-w-md text-center">
          <h1 className="text-xl font-black text-white mb-2">Link expired or invalid</h1>
          <p className="text-sm text-neutral-500 mb-6">
            Request a new password reset from the sign-in page.
          </p>
          <NeonButton type="button" onClick={onSuccess}>
            Go to sign in
          </NeonButton>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <GlassCard className="p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <IconCheck size={28} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-black text-white">Password updated</h1>
              <p className="text-sm text-neutral-400">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black text-white mb-1">Choose a new password</h1>
              <p className="text-sm text-neutral-500 mb-6">Use a strong password you haven&apos;t used here before.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <AnimatedInput
                    icon={<IconLock size={18} />}
                    type={showPassword ? "text" : "password"}
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>

                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        strength >= i ? "bg-purple-500" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>

                <AnimatedInput
                  icon={<IconLock size={18} />}
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />

                {error && (
                  <p className="text-sm text-red-400 font-medium" role="alert">
                    {error}
                  </p>
                )}

                <NeonButton type="submit" disabled={loading} className="w-full">
                  {loading ? "Updating…" : "Update password"}
                </NeonButton>
              </form>
            </>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
