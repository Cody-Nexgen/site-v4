"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { IconMail, IconLock, IconEye, IconEyeOff } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { ErrorModal } from "@/components/ui/error-modal";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { getBetaAuthRedirectUrl } from "@/lib/beta-auth-redirect";
import { ensureBetaApplication } from "@/lib/beta-profile";

type BetaLoginPageProps = {
  mode: "login" | "signup";
  onBack: () => void;
  onSuccess: () => void;
};

export default function BetaLoginPage({ mode, onBack, onSuccess }: BetaLoginPageProps) {
  const [isLogin, setIsLogin] = useState(mode === "login");

  useEffect(() => {
    setIsLogin(mode === "login");
  }, [mode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const handleError = (msg: string) => {
    setError(msg);
    setShowErrorModal(true);
    setLoading(false);
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data.session) onSuccess();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getBetaAuthRedirectUrl(),
          },
        });
        if (signUpError) throw signUpError;

        if (data.session?.user) {
          await ensureBetaApplication(
            data.session.user.id,
            data.session.user.email ?? null,
          );
          onSuccess();
        } else {
          setMagicLinkSent(true);
        }
      }
    } catch (err: any) {
      handleError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      handleError("Enter your email to receive a magic link.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getBetaAuthRedirectUrl(),
          shouldCreateUser: !isLogin ? true : undefined,
        },
      });
      if (otpError) throw otpError;
      setMagicLinkSent(true);
    } catch (err: any) {
      handleError(err.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex bg-[#09090b] text-white font-sans">
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        error={error}
      />

      <div className="w-full flex flex-col justify-center items-center p-6 sm:p-12 overflow-y-auto relative">
        <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[60%] bg-purple-900/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <button
            onClick={onBack}
            className="mb-8 text-sm text-neutral-500 hover:text-white transition-colors"
          >
            ← Back
          </button>

          {magicLinkSent ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold mb-2">Check your email</h1>
              <p className="text-neutral-400 mb-6">
                We sent a link to <span className="text-white">{email}</span>.
                Click it to sign in — you&apos;ll be redirected back here.
              </p>
              <button
                onClick={onBack}
                className="text-purple-400 hover:text-purple-300 text-sm underline underline-offset-4"
              >
                Return to beta page
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold mb-2">
                {isLogin ? "Beta login" : "Apply for beta"}
              </h1>
              <p className="text-neutral-400 mb-8">
                {isLogin
                  ? "Sign in to check your beta status or download the app."
                  : "Create an account to join the beta waitlist."}
              </p>

              <form onSubmit={handlePasswordAuth} className="space-y-5">
                <AnimatedInput
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<IconMail size={18} />}
                />

                <div className="relative">
                  <AnimatedInput
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<IconLock size={18} />}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white z-10"
                  >
                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>

                <NeonButton
                  type="submit"
                  loading={loading}
                  className="w-full"
                  glowColor="rgba(168, 85, 247, 0.5)"
                >
                  {isLogin ? "Log in" : "Create account & apply"}
                </NeonButton>
              </form>

              <div className="my-8 flex items-center gap-4 text-xs text-neutral-600 font-medium uppercase tracking-widest">
                <div className="h-px bg-white/10 flex-1" />
                <span>Or</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <NeonButton
                variant="secondary"
                onClick={handleMagicLink}
                loading={loading}
                className="w-full"
              >
                Send magic link
              </NeonButton>

              <p className="mt-8 text-center text-neutral-400 text-sm">
                {isLogin ? "Need to apply? " : "Already have an account? "}
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-4"
                >
                  {isLogin ? "Sign up" : "Log in"}
                </button>
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
