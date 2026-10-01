"use client";
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { IconBrandGoogle, IconEye, IconEyeOff, IconCheck, IconArrowLeft } from "@tabler/icons-react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import "@fontsource-variable/inter/opsz.css";
import "./landing/landing.css";
import { syncSessionWithExtension } from "@/lib/extension-utils";
import { getOAuthRedirectUrl } from "@/lib/auth-redirect";
import {
  clearAuthErrorFromUrl,
  fetchSignInMethods,
  googleLoginBlockedMessage,
  passwordLoginBlockedMessage,
} from "@/lib/auth-providers";
import { BlurWords } from "@focuz/components/auth/BlurWords";
import { FocusPull } from "@focuz/components/auth/FocusPull";
import { loadDisplayFont } from "./landing/fonts";
import { Mark } from "./landing/Mark";

loadDisplayFont();

// TOGGLE THIS TO FALSE TO STOP LOGS
const DEBUG_MODE = true;

const EASE = [0.16, 1, 0.3, 1] as const;

interface LoginPageProps {
  onBack: () => void;
  onLoginSuccess: () => void;
  onForgotPassword?: () => void;
  initialLoginState?: boolean;
}

/** Plain-language versions of the errors people actually hit. Anything else is shown as-is. */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again, or reset your password.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the code we sent.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many tries in a row. Wait a minute, then try again.";
  if (m.includes("user already registered")) return "An account with this email already exists. Log in instead.";
  if (m.includes("token has expired") || (m.includes("otp") && m.includes("invalid"))) return "That code is wrong or has expired. Check the latest email we sent.";
  return message;
}

/* ── small form pieces, in the landing page's style ────────────────────── */

const fieldClass =
  "h-11 w-full rounded-[10px] bg-[oklch(1_0_0/0.035)] px-3.5 text-[15px] text-[var(--l-text-1)] outline-none shadow-[inset_0_0_0_1px_var(--l-border-strong)] transition-shadow duration-200 placeholder:text-[var(--l-text-4)] hover:shadow-[inset_0_0_0_1px_oklch(0.955_0.003_275/0.22)] focus:shadow-[inset_0_0_0_1px_var(--l-text-3),0_0_0_4px_oklch(1_0_0/0.05)] focus-visible:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-[540] text-[var(--l-text-2)]">{label}</span>
      {children}
    </label>
  );
}

function Check({ id, checked, onChange, required, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="relative mt-0.5 flex">
        <input
          type="checkbox"
          id={id}
          required={required}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-[18px] cursor-pointer appearance-none rounded-[5px] bg-[oklch(1_0_0/0.035)] shadow-[inset_0_0_0_1px_var(--l-border-strong)] transition-colors checked:bg-[var(--l-text-1)] checked:shadow-none"
        />
        <IconCheck size={12} stroke={3} className="pointer-events-none absolute left-[3px] top-[3px] text-[var(--l-on-light)] opacity-0 peer-checked:opacity-100" />
      </span>
      <label htmlFor={id} className="cursor-pointer select-none text-[13.5px] leading-[1.5] text-[var(--l-text-3)]">
        {children}
      </label>
    </div>
  );
}

function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

function ErrorNote({ message }: { message: string }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[10px] bg-[oklch(0.72_0.15_25/0.1)] px-3.5 py-3 text-[14px] leading-[1.45] text-[oklch(0.84_0.09_25)] shadow-[inset_0_0_0_1px_oklch(0.72_0.15_25/0.25)]"
    >
      {friendlyError(message)}
    </motion.div>
  );
}

/* ── the stage: shader + "Built for ___" ──────────────────────────────── */

function AuthStage({ onBack }: { onBack: () => void }) {
  const headlineRef = useRef<HTMLDivElement>(null);

  return (
    <section aria-label="FocuzNow" className="relative hidden min-w-0 flex-1 overflow-hidden lg:block">
      <FocusPull className="absolute inset-0" clearRef={headlineRef} ink="oklch(0.118 0.003 275)" paper="oklch(0.83 0.004 275)" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-[var(--l-bg)] opacity-80" />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-10 py-8">
        <button type="button" onClick={onBack} className="flex items-center gap-2.5 rounded-lg" aria-label="FocuzNow home">
          <Mark size={28} />
          <span className="text-[16px] font-[620] tracking-[-0.03em]">FocuzNow</span>
        </button>
        <button type="button" onClick={onBack} className="fzl-link flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-[500]">
          <IconArrowLeft size={15} />
          Back to site
        </button>
      </div>

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-10 xl:px-16">
        <div ref={headlineRef} className="inline-block">
          <h2 className="fzl-display text-[clamp(3rem,5vw,5.25rem)] [text-shadow:0_2px_30px_var(--l-bg)]">
            <span className="block text-[var(--l-text-3)]">Built for</span>
            <BlurWords className="block" />
          </h2>
        </div>
      </div>

      <p className="absolute bottom-10 left-10 max-w-[25rem] text-[15px] leading-[1.55] text-[var(--l-text-3)] xl:left-16">
        Blocks distractions, runs your focus sessions, and keeps your plans and passwords in one place.
      </p>
    </section>
  );
}

export default function LoginPage({ onBack, onLoginSuccess, onForgotPassword, initialLoginState = true }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(initialLoginState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP Verification State
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [token, setToken] = useState("");

  // Error State
  const [error, setError] = useState<string | null>(null);

  // Password Strength
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    const oauthErr = clearAuthErrorFromUrl();
    if (oauthErr) {
      handleError(oauthErr);
    }
  }, []);

  useEffect(() => {
    validatePassword(password);
  }, [password]);

  useEffect(() => {
    const previous = document.title;
    document.title = isLogin ? "Log in · FocuzNow" : "Create your account · FocuzNow";
    return () => {
      document.title = previous;
    };
  }, [isLogin]);

  const validatePassword = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    setPasswordStrength(score);
  };

  const handleError = (msg: string) => {
    if (DEBUG_MODE) console.error(msg);
    setError(msg);
    setLoading(false);
  };

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    setError(null);
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isLogin && !termsAccepted) {
        handleError("You must agree to the Terms of Service and Privacy Policy.");
        return;
      }

      if (email.trim()) {
        const methods = await fetchSignInMethods(email);
        const blocked = googleLoginBlockedMessage(methods);
        if (blocked) {
          handleError(blocked);
          return;
        }
      }

      if (!isLogin) {
        try {
          localStorage.setItem(
            "focuznow_pending_signup_prefs",
            JSON.stringify({
              marketing_opt_in: marketingOptIn,
              terms_accepted: true,
            }),
          );
        } catch {
          /* ignore */
        }
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(),
        },
      });
      if (error) throw error;
    } catch (err: any) {
      handleError(err.message || "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const methods = await fetchSignInMethods(email);
        const blocked = passwordLoginBlockedMessage(methods);
        if (blocked) {
          throw new Error(blocked);
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (data.session) {
          syncSessionWithExtension(data.session);
          onLoginSuccess();
        }
      } else {
        // SIGNUP FLOW
        if (!email || !password || !firstName || !lastName) {
          throw new Error("Please fill in all fields.");
        }
        if (!termsAccepted) {
          throw new Error("You must agree to the Terms of Service and Privacy Policy.");
        }
        if (passwordStrength < 4) {
          throw new Error("Password is too weak. Please meet requirements.");
        }

        const methods = await fetchSignInMethods(email);
        if (methods.includes('google') && !methods.includes('email')) {
          throw new Error('An account with this email already uses Google. Sign in with Google instead.');
        }
        if (methods.includes('email')) {
          throw new Error('An account with this email already exists. Sign in with your password.');
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              terms_accepted: true,
              terms_accepted_at: new Date().toISOString(),
              marketing_opt_in: marketingOptIn,
            },
          },
        });

        if (error) throw error;

        setLoading(false);
        setShowOtpInput(true);
      }
    } catch (err: any) {
      if (err.message === "Failed to fetch") {
        handleError("Network connection error. Please check your internet.");
      } else {
        handleError(err.message || "An unexpected error occurred");
      }
    } finally {
      if (!showOtpInput) setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanToken = token.trim();

    if (!cleanToken) {
      setError("Please enter the verification code.");
      setLoading(false);
      return;
    }

    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email,
        token: cleanToken,
        type: 'signup',
      });

      if (error) {
        // Retry logic omitted for brevity, keeping it simple for now
        throw error;
      }

      if (data.session) {
        syncSessionWithExtension(data.session);
        onLoginSuccess();
      }

    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  const strengthLabel =
    passwordStrength >= 5 ? "Strong password" : passwordStrength >= 4 ? "Good enough" : "Use 8+ characters with upper and lower case, a number and a symbol";

  return (
    <MotionConfig reducedMotion="user">
      <div className="fzl fixed inset-0 z-[200] flex overflow-hidden">
        <AuthStage onBack={onBack} />

        <main className="relative flex w-full min-w-0 flex-col overflow-y-auto [scrollbar-width:thin] lg:w-[min(560px,44vw)] lg:shrink-0" style={{ boxShadow: "inset 1px 0 0 var(--l-border)" }}>
          <div className="flex items-center justify-between px-6 py-6 lg:hidden">
            <button type="button" onClick={onBack} className="flex items-center gap-2.5 rounded-lg" aria-label="FocuzNow home">
              <Mark size={26} />
              <span className="text-[16px] font-[620] tracking-[-0.03em]">FocuzNow</span>
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center px-6 py-12">
            <AnimatePresence mode="wait" initial={false}>
              {showOtpInput ? (
                <motion.div key="otp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease: EASE }}>
                  <h1 className="fzl-display text-[40px] leading-[1.02]">Check your email.</h1>
                  <p className="mt-3 text-[15px] leading-[1.55] text-[var(--l-text-3)]">
                    We sent a code to <span className="text-[var(--l-text-1)]">{email}</span>. Enter it to finish creating your account.
                  </p>

                  <form onSubmit={handleVerifyOtp} className="mt-8 space-y-5">
                    <Field label="Verification code">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="12345678"
                        maxLength={8}
                        autoFocus
                        className={`${fieldClass} h-14 text-center font-mono text-[24px] tracking-[0.35em]`}
                      />
                    </Field>
                    {error && <ErrorNote message={error} />}
                    <button type="submit" disabled={loading} className="fzl-btn fzl-btn-primary w-full disabled:opacity-60">
                      {loading ? <Spinner /> : "Verify and continue"}
                    </button>
                    <button type="button" onClick={() => setShowOtpInput(false)} className="fzl-link flex w-full items-center justify-center gap-1.5 text-[14px]">
                      <IconArrowLeft size={15} />
                      Back to sign up
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div key={isLogin ? "login" : "signup"} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.45, ease: EASE }}>
                  <h1 className="fzl-display text-[40px] leading-[1.02]">{isLogin ? "Welcome back." : "Create your account."}</h1>
                  <p className="mt-3 text-[15px] leading-[1.55] text-[var(--l-text-3)]">
                    {isLogin ? "Log in to pick up where you left off." : "Free to start. Your blocking works offline; an account syncs it everywhere."}
                  </p>

                  <button type="button" onClick={handleGoogleLogin} disabled={loading} className="fzl-btn fzl-btn-ghost mt-8 w-full disabled:opacity-60">
                    <IconBrandGoogle size={18} />
                    Continue with Google
                  </button>

                  <div className="my-6 flex items-center gap-3 text-[12.5px] text-[var(--l-text-4)]">
                    <span className="h-px flex-1 bg-[var(--l-border)]" />
                    or with email
                    <span className="h-px flex-1 bg-[var(--l-border)]" />
                  </div>

                  <form onSubmit={handleAuth} className="space-y-4">
                    {!isLogin && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="First name">
                          <input type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldClass} />
                        </Field>
                        <Field label="Last name">
                          <input type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldClass} />
                        </Field>
                      </div>
                    )}

                    <Field label="Email">
                      <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={fieldClass} />
                    </Field>

                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <label htmlFor="fz-password" className="text-[13px] font-[540] text-[var(--l-text-2)]">Password</label>
                        {isLogin && onForgotPassword && (
                          <button type="button" onClick={onForgotPassword} className="fzl-link text-[13px]">
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="fz-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={isLogin ? "current-password" : "new-password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`${fieldClass} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--l-text-4)] transition-colors hover:text-[var(--l-text-1)]"
                        >
                          {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                        </button>
                      </div>

                      {!isLogin && (
                        <div className="mt-2.5">
                          <div className="flex h-1 gap-1" aria-hidden>
                            {[1, 2, 3, 4].map((step) => (
                              <span
                                key={step}
                                className="flex-1 rounded-full transition-colors duration-300"
                                style={{ background: passwordStrength >= step ? "var(--l-text-1)" : "oklch(1 0 0 / 0.08)" }}
                              />
                            ))}
                          </div>
                          <p className="mt-1.5 text-[12.5px] text-[var(--l-text-4)]">{strengthLabel}</p>
                        </div>
                      )}
                    </div>

                    {!isLogin && (
                      <div className="space-y-3 pt-1">
                        <Check id="terms" checked={termsAccepted} onChange={setTermsAccepted} required>
                          I agree to the{" "}
                          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-[var(--l-text-1)] underline underline-offset-2">
                            Terms of Service
                          </a>{" "}
                          and{" "}
                          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-[var(--l-text-1)] underline underline-offset-2">
                            Privacy Policy
                          </a>
                        </Check>
                        <Check id="marketing" checked={marketingOptIn} onChange={setMarketingOptIn}>
                          Send me productivity tips, feature updates, and occasional offers by email.
                        </Check>
                      </div>
                    )}

                    {error && <ErrorNote message={error} />}

                    <button type="submit" disabled={loading} className="fzl-btn fzl-btn-primary w-full disabled:opacity-60">
                      {loading ? <Spinner /> : isLogin ? "Log in" : "Create account"}
                    </button>
                  </form>

                  <p className="mt-8 text-center text-[14px] text-[var(--l-text-3)]">
                    {isLogin ? "New to FocuzNow? " : "Already have an account? "}
                    <button type="button" onClick={() => switchMode(!isLogin)} className="font-[560] text-[var(--l-text-1)] underline decoration-[var(--l-text-4)] underline-offset-4 transition-colors hover:decoration-[var(--l-text-1)]">
                      {isLogin ? "Create an account" : "Log in"}
                    </button>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}
