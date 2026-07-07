"use client";

import { motion } from "framer-motion";
import {
    IconArrowRight,
    IconBrandChrome,
    IconCheck,
    IconDownload,
    IconRefresh,
    IconShield,
    IconSparkles,
} from "@tabler/icons-react";
import { CHROME_EXTENSION_STORE_URL } from "@/lib/site-config";

type Props = {
    onLogout: () => void;
    onRefresh?: () => void;
};

const STEPS = [
    {
        icon: IconDownload,
        title: "Install the extension",
        body: "Add FocuzNow from the Chrome Web Store on this browser profile.",
    },
    {
        icon: IconRefresh,
        title: "Refresh this page",
        body: "We’ll detect the extension and connect your account automatically.",
    },
    {
        icon: IconShield,
        title: "Open your workspace",
        body: "Your dashboard, blocklists, and focus data live in the extension.",
    },
];

export default function ExtensionRequiredScreen({ onLogout, onRefresh }: Props) {
    const refresh = onRefresh ?? (() => window.location.reload());

    return (
        <motion.div
            className="min-h-screen bg-[#07070a] text-white flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[120px]" />
                <motion.div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-indigo-600/10 blur-[100px]" />
            </div>

            <motion.div
                className="relative z-10 w-full max-w-2xl"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="mb-8 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                        <IconBrandChrome size={22} className="text-violet-300" />
                    </div>
                    <motion.div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-400/90">
                            One more step
                        </p>
                        <h1 className="text-xl font-bold tracking-tight">Connect the extension</h1>
                    </motion.div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-[#0e0e12]/90 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50">
                    <div className="border-b border-white/[0.06] px-6 py-5 sm:px-8">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-900/40">
                                <IconSparkles size={24} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold leading-snug sm:text-xl">
                                    FocuzNow runs in your browser
                                </h2>
                                <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed max-w-md">
                                    The web dashboard syncs with the Chrome extension. Install it to
                                    block sites, track focus, and keep your session in sync.
                                </p>
                            </div>
                        </div>
                    </div>

                    <ol className="divide-y divide-white/[0.05] px-6 sm:px-8">
                        {STEPS.map((step, i) => (
                            <li key={step.title} className="flex gap-4 py-5 first:pt-6 last:pb-6">
                                <div className="flex flex-col items-center">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 text-violet-300">
                                        <step.icon size={18} stroke={1.75} />
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className="mt-2 h-full min-h-[1.5rem] w-px bg-white/10" />
                                    )}
                                </div>
                                <div className="pb-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                                        Step {i + 1}
                                    </p>
                                    <p className="font-semibold text-zinc-100">{step.title}</p>
                                    <p className="mt-0.5 text-sm text-zinc-500">{step.body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-black/20 px-6 py-5 sm:flex-row sm:px-8">
                        <a
                            href={CHROME_EXTENSION_STORE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:bg-zinc-100 active:scale-[0.98]"
                        >
                            <IconBrandChrome size={18} />
                            Install extension
                            <IconArrowRight size={16} className="opacity-60" />
                        </a>
                        <button
                            type="button"
                            onClick={refresh}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] active:scale-[0.98]"
                        >
                            <IconRefresh size={18} />
                            Check again
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 px-1">
                    <p className="flex items-center gap-2 text-xs text-zinc-500">
                        <IconCheck size={14} className="text-emerald-500/80" />
                        Signed in — extension connects on detect
                    </p>
                    <button
                        type="button"
                        onClick={onLogout}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition"
                    >
                        Sign out
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
