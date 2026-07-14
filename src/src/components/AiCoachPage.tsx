import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ArrowLeft,
    Loader2,
    MoreHorizontal,
    Pencil,
    PanelLeft,
    Plus,
    Search,
    Send,
    SquarePen,
    Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { streamAiCoachChat } from '../lib/aiCoachApi';
import {
    approveCoachAnalytics,
    executeSingleCoachAction,
    normalizeActions,
} from '../lib/aiCoachActions';
import { buildCoachContext, getAnalyticsConsent } from '../lib/aiCoachContext';
import type { CoachAction } from '../lib/aiCoachTypes';
import { isProSubscriptionError } from '../lib/proAccess';
import { fetchMyProfile, type UserProfile } from '../lib/profileApi';
import {
    PROFILE_AVATAR_FALLBACK_CLASS,
    PROFILE_AVATAR_IMG_CLASS,
} from '../lib/profileAvatar';
import {
    getChatAnalyticsApproved,
    setChatAnalyticsApproved as persistChatAnalyticsApproved,
} from '../lib/aiCoachContext';
import {
    AI_COACH_HELP_WORDS,
    type AiCoachModelId,
} from '../lib/aiCoachModels';
import {
    CoachActionConfirmCard,
    type CoachActionUiItem,
} from './CoachActionConfirmCard';
import { CoachActionPreview } from './CoachActionPreview';
import { ErrorOverlay } from './ChatInterface';
import { pickFreeTierCoachReply } from '../lib/aiCoachFreeTier';

type CoachMessage = {
    role: 'user' | 'assistant';
    content: string;
    streaming?: boolean;
    actions?: CoachAction[];
    actionUi?: CoachActionUiItem[];
    showUpgrade?: boolean;
};

function stripAnalyticsActions(actions: CoachAction[], analyticsApproved: boolean): CoachAction[] {
    if (!analyticsApproved) return actions;
    return actions.filter((a) => a.action_type !== 'read_analytics');
}

type ChatSession = { id: string; title: string; updated_at?: string };

function HelpWordSwitcher() {
    const [index, setIndex] = useState(0);
    const word = AI_COACH_HELP_WORDS[index];

    useEffect(() => {
        const id = window.setInterval(() => {
            setIndex((i) => (i + 1) % AI_COACH_HELP_WORDS.length);
        }, 3000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <span className="inline-block align-baseline text-left">
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={word}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="inline-block text-white whitespace-nowrap"
                >
                    {word}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}


function ChatRowMenu({
    onRename,
    onDelete,
}: {
    onRename: () => void;
    onDelete: () => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    return (
        <div ref={ref} className="relative shrink-0">
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
                className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Chat options"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-white/10 bg-[#2a2a2a] shadow-xl py-1 text-sm">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            onRename();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.06] text-neutral-200"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            onDelete();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.06] text-red-400"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
}

function CoachUserFooter({
    profile,
    engineState,
    sessionEmail,
}: {
    profile: UserProfile | null;
    engineState: { profileName?: string; profileAvatar?: string };
    sessionEmail?: string;
}) {
    const avatarUrl = profile?.avatarUrl || engineState.profileAvatar;
    const displayName =
        profile?.displayName?.trim() ||
        engineState.profileName?.trim() ||
        sessionEmail?.split('@')[0] ||
        'User';
    const username =
        profile?.username?.trim() ||
        sessionEmail?.split('@')[0]?.toLowerCase() ||
        'user';
    const initial = displayName.charAt(0).toUpperCase() || 'F';

    return (
        <div className="p-3 border-t border-white/[0.06] flex items-center gap-3 min-w-0">
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className={PROFILE_AVATAR_IMG_CLASS} />
            ) : (
                <div className={PROFILE_AVATAR_FALLBACK_CLASS}>{initial}</div>
            )}
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-neutral-500 truncate">@{username}</p>
            </div>
        </div>
    );
}

export default function AiCoachPage({
    onBack,
    onOpenAccount,
    initialPrompt,
    onPromptConsumed,
    embedded = false,
}: {
    onBack: () => void;
    onOpenAccount: () => void;
    initialPrompt?: string | null;
    onPromptConsumed?: () => void;
    embedded?: boolean;
}) {
    const { session, engineState, syncSubscriptionFromDb, fetchEngineState } = useAuthStore();
    const [messages, setMessages] = useState<CoachMessage[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const model: AiCoachModelId = 'gemini-2.5-flash';
    const [errorState, setErrorState] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [embeddedSidebarOpen, setEmbeddedSidebarOpen] = useState(false);
    const [chatAnalyticsApproved, setChatAnalyticsApproved] = useState(false);
    const chatAnalyticsApprovedRef = useRef(false);
    const analyticsContinueQuestionRef = useRef<string | null>(null);
    const continueAfterAnalyticsRef = useRef<((question: string) => void) | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasConversation = messages.some((m) => m.role === 'user');
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const initialPromptSentRef = useRef(false);

    const buildActionUi = useCallback((actions: CoachAction[]): CoachActionUiItem[] => {
        return actions.map((action) => ({
            id: crypto.randomUUID(),
            action: { action_type: action.action_type, data: { ...action.data } },
            status: 'pending' as const,
        }));
    }, []);

    const syncChatAnalyticsFlag = useCallback((sid: string | null, approved: boolean) => {
        persistChatAnalyticsApproved(sid, approved);
        setChatAnalyticsApproved(approved);
        chatAnalyticsApprovedRef.current = approved;
    }, []);

    const applyCoachActionsAt = useCallback(
        async (messageIndex: number, actionUi: CoachActionUiItem[]) => {
            const alreadyApproved =
                chatAnalyticsApprovedRef.current ||
                chatAnalyticsApproved ||
                getChatAnalyticsApproved(sessionId) ||
                (await getAnalyticsConsent());

            const pending = actionUi.filter(
                (i) =>
                    i.status === 'pending' &&
                    !(alreadyApproved && i.action.action_type === 'read_analytics'),
            );
            if (!pending.length) return;

            const hadAnalyticsRequest = pending.some(
                (i) => i.action.action_type === 'read_analytics',
            );
            const priorUser =
                messages[messageIndex - 1]?.role === 'user'
                    ? messages[messageIndex - 1].content
                    : analyticsContinueQuestionRef.current;
            if (hadAnalyticsRequest && priorUser) {
                analyticsContinueQuestionRef.current = priorUser;
            }

            setMessages((prev) => {
                const next = [...prev];
                const row = next[messageIndex];
                if (!row?.actionUi) return prev;
                next[messageIndex] = {
                    ...row,
                    actionUi: row.actionUi.map((i) =>
                        i.status === 'pending' ? { ...i, status: 'running' as const } : i,
                    ),
                };
                return next;
            });

            const handlers = { fetchEngineState: () => void fetchEngineState() };
            const updatedUi = actionUi.map((i) => ({ ...i, action: { ...i.action, data: { ...i.action.data } } }));
            let analyticsApprovedNow = false;

            for (const item of pending) {
                const uiIdx = updatedUi.findIndex((u) => u.id === item.id);
                if (uiIdx < 0) continue;
                try {
                    if (item.action.action_type === 'read_analytics') {
                        await approveCoachAnalytics();
                        syncChatAnalyticsFlag(sessionId, true);
                        analyticsApprovedNow = true;
                    }
                    const result = await executeSingleCoachAction(
                        {
                            action_type: item.action.action_type,
                            data: { ...item.action.data },
                        },
                        handlers,
                    );
                    updatedUi[uiIdx] = { ...updatedUi[uiIdx], action: result, status: 'done' };
                } catch (e) {
                    updatedUi[uiIdx] = {
                        ...updatedUi[uiIdx],
                        status: 'error',
                        error: e instanceof Error ? e.message : 'Action failed',
                    };
                }
            }

            setMessages((prev) => {
                const next = [...prev];
                const row = next[messageIndex];
                if (!row) return prev;
                next[messageIndex] = {
                    ...row,
                    actionUi: updatedUi,
                    actions: updatedUi.filter((i) => i.status === 'done').map((i) => i.action),
                };
                return next;
            });

            if (
                hadAnalyticsRequest &&
                analyticsApprovedNow &&
                analyticsContinueQuestionRef.current
            ) {
                const question = analyticsContinueQuestionRef.current;
                analyticsContinueQuestionRef.current = null;
                continueAfterAnalyticsRef.current?.(question);
            }
        },
        [fetchEngineState, messages, sessionId, syncChatAnalyticsFlag],
    );

    const denyCoachActionsAt = useCallback((messageIndex: number) => {
        setMessages((prev) => {
            const next = [...prev];
            const row = next[messageIndex];
            if (!row?.actionUi) return prev;
            next[messageIndex] = {
                ...row,
                actionUi: row.actionUi.map((i) =>
                    i.status === 'pending' ? { ...i, status: 'denied' as const } : i,
                ),
            };
            return next;
        });
    }, []);

    const filteredSessions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return sessions;
        return sessions.filter((s) => s.title.toLowerCase().includes(q));
    }, [sessions, searchQuery]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, streaming, scrollToBottom]);

    const loadSessions = useCallback(async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!s?.user) return;
        const { data } = await supabase
            .from('ai_chat_sessions')
            .select('id, title, updated_at')
            .eq('user_id', s.user.id)
            .order('updated_at', { ascending: false })
            .limit(40);
        setSessions((data as ChatSession[]) || []);
    }, []);

    const loadChatHistory = useCallback(
        async (sid: string | null) => {
            if (!sid) {
                setSessionId(null);
                setMessages([]);
                setChatAnalyticsApproved(false);
                chatAnalyticsApprovedRef.current = false;
                analyticsContinueQuestionRef.current = null;
                return;
            }
            setSessionId(sid);
            const sessionApproved =
                getChatAnalyticsApproved(sid) || (await getAnalyticsConsent());
            setChatAnalyticsApproved(sessionApproved);
            chatAnalyticsApprovedRef.current = sessionApproved;
            const { data: msgs } = await supabase
                .from('ai_chat_messages')
                .select('*')
                .eq('session_id', sid)
                .order('created_at', { ascending: true });

            if (msgs?.length) {
                setMessages(
                    msgs.map((m) => ({
                        role: m.role as 'user' | 'assistant',
                        content: m.content,
                        actions: normalizeActions(m.action_data),
                    })),
                );
            } else {
                setMessages([]);
            }
        },
        [],
    );

    useEffect(() => {
        void loadSessions();
    }, [loadSessions]);

    useEffect(() => {
        if (session?.user?.id) void syncSubscriptionFromDb();
    }, [session?.user?.id, syncSubscriptionFromDb]);

    useEffect(() => {
        if (!session?.access_token || !session.refresh_token) return;
        void fetchMyProfile(supabase, {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        })
            .then((p) => {
                if (p) setProfile(p);
            })
            .catch((e) => console.warn('[AiCoach] profile load failed', e));
    }, [session?.access_token, session?.refresh_token]);

    const startNewChat = async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!s?.user) return;
        const { data } = await supabase
            .from('ai_chat_sessions')
            .insert({ user_id: s.user.id, title: 'New chat' })
            .select('id')
            .single();
        if (data?.id) {
            setSessionId(data.id);
            setMessages([]);
            setChatAnalyticsApproved(false);
            chatAnalyticsApprovedRef.current = false;
            void loadSessions();
        }
    };

    const renameChat = async (id: string, currentTitle: string) => {
        const next = window.prompt('Rename chat', currentTitle);
        if (!next?.trim()) return;
        await supabase
            .from('ai_chat_sessions')
            .update({ title: next.trim().slice(0, 80) })
            .eq('id', id);
        void loadSessions();
    };

    const deleteChat = async (id: string) => {
        if (!window.confirm('Delete this chat permanently?')) return;
        await supabase.from('ai_chat_messages').delete().eq('session_id', id);
        await supabase.from('ai_chat_sessions').delete().eq('id', id);
        if (sessionId === id) {
            setSessionId(null);
            setMessages([]);
        }
        void loadSessions();
    };

    const handleSend = async (
        textOverride?: string,
        opts?: { continueAfterAnalytics?: string },
    ) => {
        const continueQuestion = opts?.continueAfterAnalytics?.trim();
        const userMsg = (continueQuestion ?? textOverride ?? input).trim();
        if (!userMsg || streaming) return;

        await syncSubscriptionFromDb();
        const tier = useAuthStore.getState().subscriptionTier;
        if (tier !== 'pro') {
            if (!continueQuestion) {
                setInput('');
                setMessages((prev) => [
                    ...prev.filter((m) => !m.streaming),
                    { role: 'user', content: userMsg },
                    { role: 'assistant', content: '', streaming: true },
                ]);
                setStreaming(true);
                const delay = 500 + Math.floor(Math.random() * 500);
                window.setTimeout(() => {
                    setMessages((prev) => {
                        const base = prev.filter((m) => !m.streaming);
                        return [
                            ...base,
                            {
                                role: 'assistant',
                                content: pickFreeTierCoachReply(),
                                showUpgrade: true,
                            },
                        ];
                    });
                    setStreaming(false);
                }, delay);
            }
            return;
        }

        if (!continueQuestion) {
            setInput('');
            analyticsContinueQuestionRef.current = userMsg;
        }

        const apiUserContent = continueQuestion
            ? `The user already asked: "${continueQuestion}". Screen time analytics are approved. Continue your previous answer and fully address their question — do not ask for approval again.`
            : userMsg;

        const historyForApi = [
            ...messages.filter((m) => !m.streaming),
            { role: 'user' as const, content: apiUserContent },
        ];

        setMessages((prev) => {
            const base = prev.filter((m) => !m.streaming);
            if (continueQuestion) {
                return [...base, { role: 'assistant', content: '', streaming: true }];
            }
            return [
                ...base,
                { role: 'user', content: userMsg },
                { role: 'assistant', content: '', streaming: true },
            ];
        });
        setStreaming(true);
        setErrorState(null);

        let activeSessionId = sessionId;
        const analyticsApproved =
            chatAnalyticsApprovedRef.current ||
            chatAnalyticsApproved ||
            getChatAnalyticsApproved(sessionId) ||
            (await getAnalyticsConsent());
        const coachContext = await buildCoachContext(analyticsApproved);

        try {
        await streamAiCoachChat({
            model,
            messages: historyForApi,
            sessionId: activeSessionId,
            coachContext,
            callbacks: {
                onSession: (id) => {
                    activeSessionId = id;
                    setSessionId(id);
                    if (chatAnalyticsApprovedRef.current) {
                        persistChatAnalyticsApproved(id, true);
                    }
                },
                onToken: (_chunk, visible) => {
                    setMessages((prev) => {
                        const i = prev.length - 1;
                        if (i < 0 || !prev[i]?.streaming) return prev;
                        const next = [...prev];
                        next[i] = { ...next[i], content: visible };
                        return next;
                    });
                },
                onDone: async (payload) => {
                    try {
                        activeSessionId = payload.session_id || activeSessionId;
                        setSessionId(activeSessionId);
                        const raw = payload.actions?.length
                            ? payload.actions
                            : payload.action_data;
                        const approvedForActions =
                            chatAnalyticsApprovedRef.current ||
                            chatAnalyticsApproved ||
                            getChatAnalyticsApproved(activeSessionId) ||
                            (await getAnalyticsConsent());
                        const actions = stripAnalyticsActions(
                            normalizeActions(raw),
                            approvedForActions,
                        );
                        const actionUi = actions.length ? buildActionUi(actions) : undefined;

                        setMessages((prev) => {
                            const withoutStream = prev.filter((m) => !m.streaming);
                            return [
                                ...withoutStream,
                                {
                                    role: 'assistant',
                                    content: payload.content,
                                    actions,
                                    actionUi,
                                },
                            ];
                        });

                        if (payload.title) {
                            setSessions((prev) => {
                                const exists = prev.some((s) => s.id === activeSessionId);
                                if (exists) {
                                    return prev.map((s) =>
                                        s.id === activeSessionId ? { ...s, title: payload.title! } : s,
                                    );
                                }
                                return [
                                    { id: activeSessionId!, title: payload.title! },
                                    ...prev,
                                ];
                            });
                        }
                        void loadSessions();
                    } catch (e) {
                        console.error('[AiCoach] onDone failed', e);
                        setMessages((prev) => prev.filter((m) => !m.streaming));
                        setErrorState(
                            e instanceof Error ? e.message : 'Could not apply coach actions.',
                        );
                    }
                },
                onError: (msg, code) => {
                    setMessages((prev) => prev.filter((m) => !m.streaming));
                    if (isProSubscriptionError(msg, code)) {
                        onBack();
                    } else {
                        setErrorState(msg || 'AI Coach request failed.');
                    }
                },
            },
        });
        } catch (e) {
            console.error('[AiCoach] send failed', e);
            setMessages((prev) => prev.filter((m) => !m.streaming));
            setErrorState(e instanceof Error ? e.message : 'Could not send message.');
        }

        setStreaming(false);
    };

    continueAfterAnalyticsRef.current = (question: string) => {
        void handleSend(undefined, { continueAfterAnalytics: question });
    };

    useEffect(() => {
        if (initialPrompt && !initialPromptSentRef.current) {
            setPendingPrompt(initialPrompt);
        }
    }, [initialPrompt]);

    useEffect(() => {
        if (!pendingPrompt || streaming || !session?.user || initialPromptSentRef.current) return;
        initialPromptSentRef.current = true;
        const prompt = pendingPrompt;
        setPendingPrompt(null);
        onPromptConsumed?.();
        void (async () => {
            await startNewChat();
            void handleSend(prompt);
        })();
    }, [pendingPrompt, streaming, session?.user, onPromptConsumed]);

    const quickPrompts = [
        { label: 'Auto-schedule today', text: 'Build an optimal deep work schedule for today from my goal, tasks, and calendar. Use planner_set and calendar_add_events.' },
        { label: 'Block gaming sites', text: 'Block common gaming sites for me so I can focus.' },
        { label: 'Nuclear lockdown', text: 'Start nuclear lockdown on all blocked sites for 60 minutes.' },
        { label: 'Pro theme', text: 'Switch my theme to Pro Gold.' },
        { label: 'My analytics', text: 'Read my screen time analytics for the last week and suggest one improvement.' },
    ];

    return (
        <div className={`${embedded ? 'relative h-full min-h-0' : 'fixed inset-0 z-[200]'} flex bg-[#0a0a0b] text-neutral-100`}>
            {errorState && <ErrorOverlay error={errorState} onClose={() => setErrorState(null)} />}

            {embedded && embeddedSidebarOpen && (
                <button
                    type="button"
                    aria-label="Close chat history"
                    onClick={() => setEmbeddedSidebarOpen(false)}
                    className="absolute inset-0 z-10 bg-black/45 xl:hidden"
                />
            )}

            <aside
                className={`w-[260px] shrink-0 flex flex-col bg-[#111113] border-r border-white/[0.06] ${
                    embedded
                        ? `absolute inset-y-0 left-0 z-20 transition-transform xl:relative xl:z-auto xl:translate-x-0 ${
                            embeddedSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                        }`
                        : ''
                }`}
            >
                <div className="p-2 flex items-center gap-1 border-b border-white/[0.04]">
                    {!embedded && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2 rounded-md hover:bg-white/[0.05] text-neutral-500 hover:text-neutral-200"
                            title="Back to FocuzNow"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setEmbeddedSidebarOpen(false);
                            void startNewChat();
                        }}
                        className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.08]"
                    >
                        <SquarePen className="w-4 h-4 shrink-0" />
                        New chat
                    </button>
                </div>

                <div className="p-2">
                    {showSearch ? (
                        <input
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => {
                                if (!searchQuery) setShowSearch(false);
                            }}
                            placeholder="Search chats…"
                            className="w-full px-3 py-2 rounded-lg bg-[#2a2a2a] border border-white/10 text-sm outline-none"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowSearch(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:bg-white/[0.06]"
                        >
                            <Search className="w-4 h-4" />
                            Search chats
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                    {filteredSessions.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-neutral-600">No chats yet</p>
                    ) : (
                        filteredSessions.map((s) => (
                            <div
                                key={s.id}
                                className={`group flex items-center gap-0.5 rounded-lg ${
                                    sessionId === s.id ? 'bg-white/[0.1]' : 'hover:bg-white/[0.06]'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEmbeddedSidebarOpen(false);
                                        void loadChatHistory(s.id);
                                    }}
                                    className="flex-1 text-left px-3 py-2.5 text-sm truncate text-neutral-300 group-hover:text-white"
                                >
                                    {s.title || 'New chat'}
                                </button>
                                <ChatRowMenu
                                    onRename={() => void renameChat(s.id, s.title)}
                                    onDelete={() => void deleteChat(s.id)}
                                />
                            </div>
                        ))
                    )}
                </div>

                <CoachUserFooter
                    profile={profile}
                    engineState={engineState}
                    sessionEmail={session?.user?.email}
                />
            </aside>

            <main className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d]">
                {embedded && (
                    <header className="flex h-10 shrink-0 items-center border-b border-white/[0.05] px-2 xl:hidden">
                        <button
                            type="button"
                            onClick={() => setEmbeddedSidebarOpen(true)}
                            className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
                        >
                            <PanelLeft size={14} />
                            Chats
                        </button>
                    </header>
                )}

                <div className="flex-1 overflow-y-auto">
                    {!hasConversation ? (
                        <div className="flex flex-col items-center justify-center min-h-full px-6 py-16">
                            <h1 className="text-3xl sm:text-[2rem] font-normal text-neutral-100 text-center leading-snug">
                                Let me help with <HelpWordSwitcher />
                            </h1>
                            <p className="mt-4 text-sm text-neutral-500 max-w-md text-center">
                                Block or unblock sites, nuclear lockdown, themes, habits, pomodoro, in-app creator
                                blocks, calendar links, and settings — plus analytics when you approve sharing.
                            </p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[88%] text-[15px] leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-[#2f2f2f] rounded-[1.25rem] px-4 py-2.5 text-white'
                                                : 'text-neutral-100'
                                        }`}
                                    >
                                        {msg.role === 'user' ? (
                                            msg.content
                                        ) : (
                                            <>
                                                <div className="prose prose-invert prose-sm max-w-none prose-p:my-1">
                                                    {msg.content ? (
                                                        msg.streaming ? (
                                                            <p className="whitespace-pre-wrap text-neutral-100 m-0">
                                                                {msg.content}
                                                            </p>
                                                        ) : (
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        )
                                                    ) : msg.streaming ? (
                                                        <span className="inline-flex gap-1 text-neutral-500">
                                                            <span className="animate-pulse">●</span>
                                                            <span className="animate-pulse [animation-delay:150ms]">●</span>
                                                            <span className="animate-pulse [animation-delay:300ms]">●</span>
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {msg.actionUi?.some(
                                                    (i) =>
                                                        i.status === 'pending' ||
                                                        i.status === 'running',
                                                ) ? (
                                                    <CoachActionConfirmCard
                                                        items={msg.actionUi}
                                                        onAllowAll={() =>
                                                            void applyCoachActionsAt(
                                                                idx,
                                                                msg.actionUi!,
                                                            )
                                                        }
                                                        onDenyAll={() =>
                                                            denyCoachActionsAt(idx)
                                                        }
                                                    />
                                                ) : null}
                                                {msg.actionUi
                                                    ?.filter((i) => i.status === 'done')
                                                    .map((item) => (
                                                        <CoachActionPreview
                                                            key={item.id}
                                                            action={item.action}
                                                        />
                                                    ))}
                                                {!msg.actionUi?.length &&
                                                    msg.actions?.map((act, ai) =>
                                                        act ? (
                                                            <CoachActionPreview
                                                                key={ai}
                                                                action={act}
                                                            />
                                                        ) : null,
                                                    )}
                                                {msg.showUpgrade ? (
                                                    <div className="mt-4 pt-4 border-t border-white/10">
                                                        <button
                                                            type="button"
                                                            onClick={onOpenAccount}
                                                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-colors"
                                                        >
                                                            Upgrade to Pro in Account
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                <footer className="shrink-0 px-4 sm:px-6 pb-6 pt-3">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-end gap-2 rounded-[1.75rem] bg-[#2a2a2a] border border-white/[0.08] px-2 py-2 shadow-lg">
                            <button
                                type="button"
                                className="p-2.5 rounded-full hover:bg-white/[0.08] text-neutral-400 mb-0.5"
                                aria-label="New chat"
                                onClick={() => void startNewChat()}
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        void handleSend();
                                    }
                                }}
                                placeholder="Ask anything"
                                rows={1}
                                className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] text-white placeholder:text-neutral-500 py-2.5 max-h-32 min-h-[44px]"
                            />
                            <button
                                type="button"
                                onClick={() => void handleSend()}
                                disabled={streaming || !input.trim()}
                                className="p-2.5 rounded-full bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:bg-neutral-600 disabled:text-neutral-400 mb-0.5 transition-colors"
                                aria-label="Send"
                            >
                                {streaming ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>

                        {!hasConversation && (
                            <div className="flex flex-wrap justify-center gap-2 mt-5">
                                {quickPrompts.map((q) => (
                                    <button
                                        key={q.label}
                                        type="button"
                                        onClick={() => void handleSend(q.text)}
                                        className="px-4 py-2 rounded-full border border-white/[0.08] bg-[#1a1a1a] text-sm text-neutral-400 hover:bg-[#2a2a2a] hover:text-white transition-colors"
                                    >
                                        {q.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </footer>
            </main>
        </div>
    );
}
