"use client";

import React, { useEffect, useState } from "react";
import { IconShieldLock, IconArrowLeft, IconClock } from "@tabler/icons-react";

export default function BlockedPage() {
    const [blockedUrl, setBlockedUrl] = useState("");
    const [cleanedSite, setCleanedSite] = useState("");
    const [reason, setReason] = useState("You blocked this site to stay focused");

    useEffect(() => {
        // Get URL from query parameter
        const params = new URLSearchParams(window.location.search);
        const url = params.get('url') || '';
        setBlockedUrl(url);

        // Clean the URL
        const cleaned = cleanUrl(url);
        setCleanedSite(cleaned);
    }, []);

    const cleanUrl = (url: string): string => {
        if (!url) return 'this site';

        try {
            // Remove protocol
            let cleaned = url.replace(/^(https?:\/\/)/, '');

            // Remove www.
            cleaned = cleaned.replace(/^www\./, '');

            // Remove common TLDs and everything after
            cleaned = cleaned.split(/[\/\?#]/)[0]; // Remove path, query, hash
            cleaned = cleaned.replace(/\.(com|org|net|io|co|edu|gov|mil).*$/, '');

            return cleaned || 'this site';
        } catch (e) {
            return 'this site';
        }
    };

    const handleGoBack = () => {
        window.history.back();
    };

    const motivationalMessages = [
        "Stay focused! You blocked this site for a reason.",
        "Your future self will thank you for staying on track.",
        "Deep work requires deep focus. Keep going!",
        "Every moment of focus is an investment in your goals.",
        "You're building something great. Don't let distractions win."
    ];

    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    return (
        <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black text-white flex items-center justify-center p-6 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            {/* Main content */}
            <div className="relative z-10 max-w-2xl w-full">
                {/* Icon */}
                <div className="flex justify-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="relative">
                        <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-xl animate-pulse"></div>
                        <div className="relative w-32 h-32 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-2xl shadow-purple-900/50">
                            <IconShieldLock className="w-16 h-16 text-white" strokeWidth={1.5} />
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
                        Site Blocked
                    </h1>
                    <div className="inline-block px-6 py-3 bg-purple-900/30 border border-purple-500/30 rounded-full backdrop-blur-sm">
                        <p className="text-2xl md:text-3xl font-semibold text-purple-300 uppercase tracking-wider">
                            {cleanedSite}
                        </p>
                    </div>
                </div>

                {/* Motivational message */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                    <p className="text-xl text-neutral-300 leading-relaxed max-w-lg mx-auto">
                        {randomMessage}
                    </p>
                </div>

                {/* Reason card */}
                <div className="mb-8 p-6 bg-neutral-900/50 border border-white/10 rounded-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                            <IconClock className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white mb-1">Why is this blocked?</h3>
                            <p className="text-neutral-400 text-sm">{reason}</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                    <button
                        onClick={handleGoBack}
                        className="flex-1 h-14 bg-white text-black hover:bg-neutral-200 font-semibold text-lg shadow-xl shadow-purple-900/20 transition-all duration-300 hover:scale-105 rounded-xl flex items-center justify-center"
                    >
                        <IconArrowLeft className="w-5 h-5 mr-2" />
                        Go Back
                    </button>

                    {/* Pro feature: Temporary unblock */}
                    <button
                        className="flex-1 h-14 border border-purple-500/30 text-purple-300 hover:bg-purple-900/20 font-semibold text-lg backdrop-blur-sm relative overflow-hidden group rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled
                    >
                        <span className="relative z-10">Unblock Temporarily</span>
                        <div className="absolute top-1 right-1 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded">
                            PRO
                        </div>
                    </button>
                </div>

                {/* Footer hint */}
                <div className="text-center mt-8 animate-in fade-in duration-700 delay-500">
                    <p className="text-sm text-neutral-500">
                        Manage your blocked sites in the{" "}
                        <a href="chrome-extension://YOUR_EXTENSION_ID/popup.html" className="text-purple-400 hover:text-purple-300 underline">
                            FocuzNow extension
                        </a>
                    </p>
                </div>
            </div>

            {/* Decorative elements */}
            <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
        </div>
    );
}
