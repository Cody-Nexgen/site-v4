"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { IconBrandGoogle, IconEye, IconEyeOff, IconCheck, IconMail, IconLock, IconUser } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorModal } from "@/components/ui/error-modal";
import { syncSessionWithExtension } from "@/lib/extension-utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { AUTH_SLIDES } from "@/lib/auth-slides";

// TOGGLE THIS TO FALSE TO STOP LOGS
const DEBUG_MODE = true;

interface LoginPageProps {
  onBack: () => void;
  onLoginSuccess: () => void; // New prop for redirecting
  initialLoginState?: boolean;
}

export default function LoginPage({ onBack, onLoginSuccess, initialLoginState = true }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(initialLoginState);
  const [currentImage, setCurrentImage] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP Verification State
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [token, setToken] = useState("");

  // Error State
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Password Strength
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % AUTH_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    validatePassword(password);
  }, [password]);

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
    console.error(msg);
    setError(msg);
    if (!showOtpInput) {
      setShowErrorModal(true);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/?view=dashboard` : undefined,
        }
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
        // LOGIN FLOW
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        if (data.session) {
          syncSessionWithExtension(data.session);
          onLoginSuccess(); // Redirect to Dashboard
        }
      } else {
        // SIGNUP FLOW
        if (!email || !password || !firstName || !lastName) {
          throw new Error("Please fill in all fields.");
        }
        if (!termsAccepted) {
          throw new Error("You must agree to the Terms & Conditions.");
        }
        if (passwordStrength < 4) {
          throw new Error("Password is too weak. Please meet requirements.");
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
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
        onLoginSuccess(); // Redirect to Dashboard
      }

    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
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

      {/* Left Side - Image Slider */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-black">
        <button
          onClick={onBack}
          className="absolute top-8 left-8 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md border border-white/10 transition-colors text-sm font-medium"
        >
          ← Back to website
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentImage}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 z-10" />
            <img
              src={AUTH_SLIDES[currentImage].src}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-20 left-12 z-20 max-w-md">
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl sm:text-4xl font-bold leading-tight"
              >
                {AUTH_SLIDES[currentImage].title}
              </motion.h2>
              <motion.p
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.08 }}
                className="mt-3 text-lg text-zinc-300/90 leading-relaxed"
              >
                {AUTH_SLIDES[currentImage].subtitle}
              </motion.p>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="absolute bottom-8 left-12 z-20 flex gap-2">
          {AUTH_SLIDES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentImage(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentImage ? "w-8 bg-white" : "w-4 bg-white/30"}`}
            />
          ))}
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 overflow-y-auto relative">
        {/* Ambient Glow */}
        <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[60%] bg-purple-900/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="mb-10 lg:hidden">
            <span className="text-2xl font-bold tracking-tighter">Focuz<span className="text-purple-500">now</span></span>
          </div>

          {showOtpInput ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-3xl font-bold mb-2">Check your email</h1>
              <p className="text-neutral-400 mb-8">We sent a verification code to <span className="text-white font-medium">{email}</span></p>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm text-neutral-400">Verification Code</label>
                  <AnimatedInput
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="12345678"
                    className="text-center text-2xl tracking-widest"
                    maxLength={8}
                  />
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm text-center mt-2 bg-red-500/10 py-2 rounded-lg border border-red-500/20"
                    >
                      {error}
                    </motion.div>
                  )}
                </div>

                <NeonButton
                  type="submit"
                  loading={loading}
                  className="w-full"
                  glowColor="rgba(168, 85, 247, 0.5)"
                >
                  Verify Code
                </NeonButton>

                <button
                  type="button"
                  onClick={() => setShowOtpInput(false)}
                  className="w-full text-neutral-500 text-sm hover:text-white transition-colors"
                >
                  ← Back to sign up
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold mb-2">{isLogin ? "Welcome back" : "Create an account"}</h1>
              <p className="text-neutral-400 mb-8">
                {isLogin ? "Enter your details to access your workspace." : "Already have an account? "}
                {!isLogin && (
                  <button onClick={() => setIsLogin(true)} className="text-purple-400 hover:text-purple-300 underline underline-offset-4">
                    Log in
                  </button>
                )}
              </p>

              <form onSubmit={handleAuth} className="space-y-5">
                {!isLogin && (
                  <div className="flex gap-4">
                    <div className="space-y-1.5 w-1/2">
                      <AnimatedInput
                        type="text"
                        placeholder="First name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        icon={<IconUser size={18} />}
                      />
                    </div>
                    <div className="space-y-1.5 w-1/2">
                      <AnimatedInput
                        type="text"
                        placeholder="Last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        icon={<IconUser size={18} />}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <AnimatedInput
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<IconMail size={18} />}
                  />
                </div>

                <div className="space-y-1.5 relative">
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

                  {!isLogin && (
                    <div className="pt-2 space-y-2">
                      <div className="flex gap-1 h-1 w-full">
                        <div className={`h-full flex-1 rounded-full transition-colors ${passwordStrength > 0 ? 'bg-red-500' : 'bg-neutral-800'}`} />
                        <div className={`h-full flex-1 rounded-full transition-colors ${passwordStrength > 1 ? 'bg-orange-500' : 'bg-neutral-800'}`} />
                        <div className={`h-full flex-1 rounded-full transition-colors ${passwordStrength > 2 ? 'bg-yellow-500' : 'bg-neutral-800'}`} />
                        <div className={`h-full flex-1 rounded-full transition-colors ${passwordStrength > 3 ? 'bg-green-500' : 'bg-neutral-800'}`} />
                      </div>
                      <p className="text-xs text-neutral-500 text-right">
                        {passwordStrength < 4 ? "Must include uppercase, lowercase, number & symbol" : "Strong password"}
                      </p>
                    </div>
                  )}
                </div>

                {!isLogin && (
                  <div className="flex items-start gap-3">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-neutral-600 bg-[#25222e] checked:border-purple-500 checked:bg-purple-500 transition-all"
                      />
                      <IconCheck className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 w-3.5 h-3.5" />
                    </div>
                    <label htmlFor="terms" className="text-sm text-neutral-400 cursor-pointer select-none">
                      I agree to the <a href="#" className="text-white hover:underline">Terms & Conditions</a>
                    </label>
                  </div>
                )}

                <NeonButton
                  type="submit"
                  loading={loading}
                  className="w-full"
                  glowColor="rgba(168, 85, 247, 0.5)"
                >
                  {isLogin ? "Log in" : "Create account"}
                </NeonButton>
              </form>

              <div className="my-8 flex items-center gap-4 text-xs text-neutral-600 font-medium uppercase tracking-widest">
                <div className="h-px bg-white/10 flex-1" />
                <span>Or continue with</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <div className="flex gap-4">
                <NeonButton
                  variant="secondary"
                  onClick={handleGoogleLogin}
                  className="flex-1"
                >
                  <IconBrandGoogle className="w-5 h-5 mr-2" />
                  <span>Google</span>
                </NeonButton>
              </div>

              {isLogin && (
                <p className="mt-8 text-center text-neutral-400 text-sm">
                  Don't have an account?{" "}
                  <button onClick={() => setIsLogin(false)} className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-4">
                    Sign up
                  </button>
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}