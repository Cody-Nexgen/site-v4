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
import { BeamZMark } from "@focuz/components/BeamZMark";

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
                        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-blue-500/30 bg-[#121018] px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-950/50 hover:border-blue-400/50 hover:bg-[#18141f] transition-colors"
                        aria-label="Open chat"
                    >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-600">
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
                        className="fixed bottom-6 right-6 z-[60] flex h-[min(560px,85vh)] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-white/8 bg-[#0c0b10] shadow-2xl shadow-black/60"
                    >
                        <header className="flex items-center gap-3 border-b border-white/8 bg-[#100e16] px-4 py-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-600">
                                <IconSparkles size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-white">FocuzNow Coach</h3>
                                <p className="truncate text-[11px] text-neutral-500">
                                    {user?.email ? `Signed in · ${user.email}` : "Powered by Groq · free to ask"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={clearChat}
                                className="rounded-lg p-2 text-neutral-500 hover:bg-white/6 hover:text-neutral-300"
                                title="Clear chat"
                            >
                                <IconMinus size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="rounded-lg p-2 text-neutral-500 hover:bg-white/6 hover:text-white"
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
                                        className={`max-w-[88%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                                            msg.role === "user"
                                                ? "bg-blue-600 text-white rounded-br-lg"
                                                : "bg-[#1a1822] text-neutral-200 border border-white/8 rounded-bl-lg"
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
                                    <div className="flex items-center rounded-lg px-1 py-1">
                                        <BeamZMark size={40} animated contrast="on-dark" title="FocuzNow is thinking" />
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
                            className="border-t border-white/8 bg-[#0a090d] p-3"
                        >
                            <div className="flex gap-2 rounded-lg border border-white/8 bg-[#141218] p-1 focus-within:border-blue-500/40">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about focus, blocking, habits…"
                                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
                                    disabled={loading}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !input.trim()}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-40"
                                >
                                    <IconSend size={16} />
                                </button>
                            </div>
                            {!user && (
                                <p className="mt-2 text-center text-[11px] text-neutral-600">
                                    <a href="/login" className="text-blue-400/90 hover:underline">
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
