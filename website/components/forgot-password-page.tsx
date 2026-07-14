"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { IconMail, IconArrowLeft, IconCheck } from "@tabler/icons-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { getPasswordResetRedirectUrl } from "@/lib/auth-redirect";
import {
  fetchSignInMethods,
  passwordLoginBlockedMessage,
} from "@/lib/auth-providers";

type Props = {
  onBack: () => void;
};

export default function ForgotPasswordPage({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      setLoading(false);
      return;
    }

    try {
      const methods = await fetchSignInMethods(trimmed);
      const blocked = passwordLoginBlockedMessage(methods);
      if (blocked) {
        setError(blocked);
        setLoading(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: getPasswordResetRedirectUrl(),
      });

      if (resetError) throw resetError;
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not send reset email.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-white mb-6 transition-colors"
        >
          <IconArrowLeft size={16} />
          Back to sign in
        </button>

        <GlassCard className="p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <IconCheck size={28} className="text-emerald-400" />
              </div>
              <h1 className="text-2xl font-black text-white">Check your email</h1>
              <p className="text-sm text-neutral-400 leading-relaxed">
                If an account exists for <span className="text-white font-semibold">{email.trim()}</span>, we sent a password reset link. The link expires in one hour.
              </p>
              <NeonButton type="button" onClick={onBack} className="w-full mt-2">
                Return to sign in
              </NeonButton>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black text-white mb-1">Reset password</h1>
              <p className="text-sm text-neutral-500 mb-6">
                Enter the email on your account. We&apos;ll send a secure reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatedInput
                  icon={<IconMail size={18} />}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />

                {error && (
                  <p className="text-sm text-red-400 font-medium" role="alert">
                    {error}
                  </p>
                )}

                <NeonButton type="submit" disabled={loading} className="w-full">
                  {loading ? "Sending…" : "Send reset link"}
                </NeonButton>
              </form>
            </>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
