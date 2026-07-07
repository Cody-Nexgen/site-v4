"use client";

import React, { useState, useEffect } from "react";
import { IconArrowRight, IconCheck, IconPin, IconTarget, IconX } from "@tabler/icons-react";

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

export default function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
    const [step, setStep] = useState(1);
    const [goal, setGoal] = useState("2");

    if (!isOpen) return null;

    const handleNext = () => {
        if (step < 4) {
            setStep(step + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-purple-900/20">
                {/* Progress Bar */}
                <div className="h-1 bg-neutral-900 w-full">
                    <div
                        className="h-full bg-purple-600 transition-all duration-500 ease-out"
                        style={{ width: `${(step / 4) * 100}%` }}
                    />
                </div>

                <div className="p-8">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-neutral-500 hover:text-white p-2"
                    >
                        <IconX size={20} />
                    </button>

                    {/* Step 1: Welcome */}
                    {step === 1 && (
                        <div className="text-center space-y-6 animate-in slide-in-from-right-8 duration-500">
                            <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-4xl">👋</span>
                            </div>
                            <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
                                Welcome to FocuzNow
                            </h2>
                            <p className="text-neutral-400 text-lg">
                                Your journey to distraction-free productivity starts here. Let's get you set up in less than a minute.
                            </p>
                        </div>
                    )}

                    {/* Step 2: Pin Extension */}
                    {step === 2 && (
                        <div className="text-center space-y-6 animate-in slide-in-from-right-8 duration-500">
                            <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-400">
                                <IconPin size={40} />
                            </div>
                            <h2 className="text-2xl font-bold">Pin the Extension</h2>
                            <p className="text-neutral-400">
                                For quick access to blocking and stats, pin FocuzNow to your browser toolbar.
                            </p>
                            <div className="bg-neutral-900 p-4 rounded-xl border border-white/5 text-left text-sm text-neutral-300 space-y-2">
                                <p>1. Click the <span className="text-white font-bold">Puzzle Piece 🧩</span> icon in Chrome.</p>
                                <p>2. Find <span className="text-purple-400 font-bold">FocuzNow</span>.</p>
                                <p>3. Click the <span className="text-white font-bold">Pin 📌</span> icon next to it.</p>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Set Goal */}
                    {step === 3 && (
                        <div className="text-center space-y-6 animate-in slide-in-from-right-8 duration-500">
                            <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400">
                                <IconTarget size={40} />
                            </div>
                            <h2 className="text-2xl font-bold">Set Your Daily Goal</h2>
                            <p className="text-neutral-400">
                                How many hours do you want to stay focused each day?
                            </p>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={() => setGoal(String(Math.max(1, Number(goal) - 1)))}
                                    className="w-12 h-12 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-xl font-bold"
                                >
                                    -
                                </button>
                                <div className="text-4xl font-bold w-24 text-center">
                                    {goal}h
                                </div>
                                <button
                                    onClick={() => setGoal(String(Number(goal) + 1))}
                                    className="w-12 h-12 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-xl font-bold"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Done */}
                    {step === 4 && (
                        <div className="text-center space-y-6 animate-in slide-in-from-right-8 duration-500">
                            <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-purple-600/50">
                                <IconCheck size={40} />
                            </div>
                            <h2 className="text-3xl font-bold">You're All Set!</h2>
                            <p className="text-neutral-400 text-lg">
                                FocuzNow is running in the background. Go forth and be productive!
                            </p>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-10 flex justify-end">
                        <button
                            onClick={handleNext}
                            className="px-8 py-3 bg-white text-black hover:bg-neutral-200 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105"
                        >
                            {step === 4 ? "Get Started" : "Next"}
                            <IconArrowRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
