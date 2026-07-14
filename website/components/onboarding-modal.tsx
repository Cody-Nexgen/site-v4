"use client";

import React, { useState } from "react";
import { IconArrowRight, IconCheck, IconX } from "@tabler/icons-react";
import { supabase } from "@/lib/supabase";

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

const FOCUS_CHALLENGES = [
    { id: "procrastination", label: "Procrastination" },
    { id: "social_media", label: "Social media distractions" },
    { id: "consistency", label: "Staying consistent" },
    { id: "time_management", label: "Time management" },
    { id: "studying", label: "Studying" },
] as const;

const FOCUS_GOALS = [
    { id: "study_more", label: "Study more" },
    { id: "build_habits", label: "Build habits" },
    { id: "work_better", label: "Work better" },
    { id: "reduce_screen_time", label: "Reduce screen time" },
] as const;

export default function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
    const [step, setStep] = useState(1);
    const [challenge, setChallenge] = useState<string | null>(null);
    const [goal, setGoal] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const totalSteps = 3;
    const canAdvance =
        (step === 1 && challenge !== null) ||
        (step === 2 && goal !== null) ||
        step === 3;

    const persistPrefs = async () => {
        setSaving(true);
        try {
            await supabase.auth.updateUser({
                data: {
                    focus_challenge: challenge,
                    focus_goal: goal,
                    onboarding_completed_at: new Date().toISOString(),
                },
            });
        } catch {
            /* non-blocking — still finish onboarding */
        } finally {
            setSaving(false);
        }
    };

    const handleNext = async () => {
        if (!canAdvance || saving) return;
        if (step < totalSteps) {
            setStep(step + 1);
            return;
        }
        await persistPrefs();
        onComplete();
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-purple-900/20">
                <div className="h-1 bg-neutral-900 w-full">
                    <div
                        className="h-full bg-purple-600 transition-all duration-500 ease-out"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>

                <div className="p-8 sm:p-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 text-neutral-500 hover:text-white p-2"
                        aria-label="Close"
                    >
                        <IconX size={20} />
                    </button>

                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                            <div className="space-y-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                                    Personalize · 1 of 2
                                </p>
                                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-snug">
                                    What is your biggest focus challenge?
                                </h2>
                                <p className="text-neutral-400 text-sm leading-relaxed">
                                    We&apos;ll tailor tips and emails around what gets in your way.
                                </p>
                            </div>
                            <div className="grid gap-2.5">
                                {FOCUS_CHALLENGES.map((item) => {
                                    const selected = challenge === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setChallenge(item.id)}
                                            className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm transition-colors ${
                                                selected
                                                    ? "border-purple-500/60 bg-purple-500/10 text-white"
                                                    : "border-white/10 bg-white/[0.02] text-neutral-300 hover:border-white/20 hover:bg-white/[0.04]"
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                            <div className="space-y-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                                    Personalize · 2 of 2
                                </p>
                                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-snug">
                                    What are you trying to accomplish?
                                </h2>
                                <p className="text-neutral-400 text-sm leading-relaxed">
                                    Pick a goal so your setup and tips stay relevant.
                                </p>
                            </div>
                            <div className="grid gap-2.5">
                                {FOCUS_GOALS.map((item) => {
                                    const selected = goal === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setGoal(item.id)}
                                            className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm transition-colors ${
                                                selected
                                                    ? "border-purple-500/60 bg-purple-500/10 text-white"
                                                    : "border-white/10 bg-white/[0.02] text-neutral-300 hover:border-white/20 hover:bg-white/[0.04]"
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center space-y-6 py-4 animate-in slide-in-from-right-8 duration-500">
                            <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto text-purple-300">
                                <IconCheck size={32} />
                            </div>
                            <div className="space-y-3">
                                <h2 className="text-3xl font-semibold tracking-tight text-white">You&apos;re ready</h2>
                                <p className="text-neutral-400 text-base leading-relaxed max-w-sm mx-auto">
                                    Open the FocuzNow extension to start your first session. We&apos;ll send tips that match your goals.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-10 flex justify-end">
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={!canAdvance || saving}
                            className="px-8 py-3 bg-white text-black hover:bg-neutral-200 rounded-xl font-semibold flex items-center gap-2 transition-all disabled:opacity-40 disabled:hover:bg-white"
                        >
                            {step === totalSteps ? (saving ? "Saving…" : "Get started") : "Continue"}
                            <IconArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
