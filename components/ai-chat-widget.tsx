"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconMessage,
    IconX,
    IconSend,
    IconSparkles,
    IconMinus,
} from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";
import { postChatMessage } from "@/lib/chat-api";
import type { ChatMessage } from "@/lib/ai-types";

const WELCOME: ChatMessage = {
    role: "assistant",
    content:
        "Hi — I'm **FocuzNow Coach**. Ask about focus habits, blocking distractions, or how to get the most from the extension.",
};

export function AiChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<{ email?: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
            setUser(session?.user ?? null);
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
        setInput("");
        setMessages(nextMessages);
        setLoading(true);

        const result = await postChatMessage(
            nextMessages.map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
            })),
        );

        if (result.ok) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: result.content },
            ]);
        } else {
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `Sorry — I couldn't reply right now.\n\n${result.error}`,
                },
            ]);
        }

        setLoading(false);
    };

    const clearChat = () => setMessages([WELCOME]);

    return (
        <>
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        type="button"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-violet-500/30 bg-[#121018] px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-950/50 hover:border-violet-400/50 hover:bg-[#18141f] transition-colors"
                        aria-label="Open chat"
                    >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600">
                            <IconMessage size={18} />
                        </span>
                        Ask FocuzNow
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.96 }}
                        transition={{ type: "spring", damping: 26, stiffness: 320 }}
                        className="fixed bottom-6 right-6 z-[60] flex h-[min(560px,85vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0b10] shadow-2xl shadow-black/60"
                    >
                        <header className="flex items-center gap-3 border-b border-white/[0.06] bg-[#100e16] px-4 py-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
                                <IconSparkles size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-white">FocuzNow Coach</h3>
                                <p className="truncate text-[11px] text-zinc-500">
                                    {user?.email ? `Signed in · ${user.email}` : "Powered by Groq · free to ask"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={clearChat}
                                className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                                title="Clear chat"
                            >
                                <IconMinus size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
                                aria-label="Close"
                            >
                                <IconX size={18} />
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                                            msg.role === "user"
                                                ? "bg-violet-600 text-white rounded-br-md"
                                                : "bg-[#1a1822] text-zinc-200 border border-white/[0.06] rounded-bl-md"
                                        }`}
                                    >
                                        {msg.role === "assistant" ? (
                                            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            msg.content
                                        )}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="flex gap-1 rounded-2xl rounded-bl-md border border-white/[0.06] bg-[#1a1822] px-4 py-3">
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:120ms]" />
                                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:240ms]" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                void handleSend();
                            }}
                            className="border-t border-white/[0.06] bg-[#0a090d] p-3"
                        >
                            <div className="flex gap-2 rounded-xl border border-white/[0.08] bg-[#141218] p-1 focus-within:border-violet-500/40">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about focus, blocking, habits…"
                                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
                                    disabled={loading}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !input.trim()}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-40"
                                >
                                    <IconSend size={16} />
                                </button>
                            </div>
                            {!user && (
                                <p className="mt-2 text-center text-[10px] text-zinc-600">
                                    <a href="/login" className="text-violet-400/90 hover:underline">
                                        Sign in
                                    </a>{" "}
                                    to sync with your extension account
                                </p>
                            )}
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
