import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ArrowLeft,
    Bot,
    Check,
    ChevronLeft,
    ChevronRight,
    Compass,
    Copy,
    Image as ImageIcon,
    Loader2,
    MessageSquare,
    MoreHorizontal,
    Paperclip,
    Pencil,
    PanelLeft,
    RefreshCw,
    Search,
    Send,
    Settings,
    SquarePen,
    Trash2,
    X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { invokeAuthedFunction } from '../lib/supabaseFunctions';
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

/** One past state of a user turn — captured whenever it is edited or regenerated. */
type MessageVariant = {
    userContent: string;
    following: CoachMessage[];
};

type CoachMessage = {
    role: 'user' | 'assistant';
    content: string;
    streaming?: boolean;
    actions?: CoachAction[];
    actionUi?: CoachActionUiItem[];
    showUpgrade?: boolean;
    imageUrl?: string;
    /** Present on user messages that have been edited/regenerated at least once. */
    variants?: MessageVariant[];
    activeVariantIndex?: number;
};

type LibraryImage = { id: string; url: string; name: string; extractedText?: string };

type SidebarView = 'chats' | 'library' | 'explore';

function stripAnalyticsActions(actions: CoachAction[], analyticsApproved: boolean): CoachAction[] {
    if (!analyticsApproved) return actions;
    return actions.filter((a) => a.action_type !== 'read_analytics');
}

function findUserIndexBefore(messages: CoachMessage[], idx: number): number {
    for (let i = idx; i >= 0; i--) {
        if (messages[i]?.role === 'user') return i;
    }
    return -1;
}

type ChatSession = { id: string; title: string; updated_at?: string };

const EXPLORE_CAPABILITIES: {
    title: string;
    description: string;
    slot: string;
}[] = [
    {
        title: 'Auto-schedule your day',
        description:
            'Turn your daily goal, tasks, and calendar into an optimal deep-work timeline in one message.',
        slot: 'auto-schedule-infographic.png',
    },
    {
        title: 'One-tap focus lockdown',
        description:
            'Ask the coach to block distracting sites or start a nuclear lockdown when you need to lock in.',
        slot: 'site-blocking-infographic.png',
    },
    {
        title: 'Habit & Pomodoro coaching',
        description:
            'Build streak-friendly habits and dial in your focus/break timers with a quick chat.',
        slot: 'habit-pomodoro-infographic.png',
    },
    {
        title: 'Screen-time insights',
        description:
            'Share your analytics (opt-in) so the coach can give personalized, data-backed suggestions.',
        slot: 'analytics-infographic.png',
    },
];

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

/** Small popup menu shown under each finished AI reply — currently just "Try again". */
function AssistantMenu({ onRegenerate, disabled }: { onRegenerate: () => void; disabled?: boolean }) {
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
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
                className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-30"
                aria-label="More options"
            >
                <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-1 z-30 w-36 rounded-lg border border-white/10 bg-[#2a2a2a] shadow-xl py-1 text-sm">
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onRegenerate();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.06] text-neutral-200"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Try again
                    </button>
                </div>
            )}
        </div>
    );
}

function CoachUserHeader({
    profile,
    engineState,
    sessionEmail,
    onOpenAccount,
}: {
    profile: UserProfile | null;
    engineState: { profileName?: string; profileAvatar?: string };
    sessionEmail?: string;
    onOpenAccount: () => void;
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
        <button
            type="button"
            onClick={onOpenAccount}
            className="w-full p-3 border-b border-white/[0.06] flex items-center gap-3 min-w-0 text-left hover:bg-white/[0.04] transition-colors"
        >
            {avatarUrl ? (
                <img src={avatarUrl} alt="" className={PROFILE_AVATAR_IMG_CLASS} />
            ) : (
                <div className={PROFILE_AVATAR_FALLBACK_CLASS}>{initial}</div>
            )}
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-neutral-500 truncate">@{username}</p>
            </div>
            <Settings className="w-4 h-4 text-neutral-600 shrink-0" />
        </button>
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
    const [sidebarView, setSidebarView] = useState<SidebarView>('chats');
    const [chatAnalyticsApproved, setChatAnalyticsApproved] = useState(false);
    const chatAnalyticsApprovedRef = useRef(false);
    const analyticsContinueQuestionRef = useRef<string | null>(null);
    const continueAfterAnalyticsRef = useRef<((question: string) => void) | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasConversation = messages.some((m) => m.role === 'user');
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const initialPromptSentRef = useRef(false);

    // Message-turn editing / regenerating / browsing variants.
    const [expandedUserIdx, setExpandedUserIdx] = useState<number | null>(null);
    const [editingUserIdx, setEditingUserIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState('');
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    // Library / attachments (client-side only — the coach API is text-only today).
    const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
    const [pendingAttachment, setPendingAttachment] = useState<LibraryImage | null>(null);
    const [ocrBusy, setOcrBusy] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            setSidebarView('chats');
            setExpandedUserIdx(null);
            setEditingUserIdx(null);
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
            setSidebarView('chats');
            setExpandedUserIdx(null);
            setEditingUserIdx(null);
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

    /** Core send/stream pipeline. `baseMessages` is the exact message list to keep as-is
     * (it must already include the new user turn, except for silent continuations). */
    const sendTurn = async (
        apiUserContent: string,
        baseMessages: CoachMessage[],
        opts?: { isContinuation?: boolean },
    ) => {
        await syncSubscriptionFromDb();
        const tier = useAuthStore.getState().subscriptionTier;

        if (tier !== 'pro') {
            if (opts?.isContinuation) return;
            setMessages([...baseMessages, { role: 'assistant', content: '', streaming: true }]);
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
            return;
        }

        if (!opts?.isContinuation) {
            analyticsContinueQuestionRef.current = apiUserContent;
        }

        const historyForApi = [
            ...baseMessages.filter((m) => !m.streaming).map((m) => ({ role: m.role, content: m.content })),
            ...(opts?.isContinuation ? [{ role: 'user' as const, content: apiUserContent }] : []),
        ];

        setMessages([
            ...baseMessages.filter((m) => !m.streaming),
            { role: 'assistant', content: '', streaming: true },
        ]);
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

    const handleSend = async (
        textOverride?: string,
        opts?: { continueAfterAnalytics?: string },
    ) => {
        const continueQuestion = opts?.continueAfterAnalytics?.trim();
        const rawText = (continueQuestion ?? textOverride ?? input).trim();
        if (!rawText || streaming) return;

        const attachment = continueQuestion ? null : pendingAttachment;
        const ocrBlock = attachment?.extractedText?.trim()
            ? `\n\n[Image text]\n${attachment.extractedText.trim()}`
            : '';
        const userMsg = rawText;
        const apiUserContent = attachment
            ? `${rawText}${ocrBlock}`
            : rawText;

        if (!continueQuestion) {
            setInput('');
            setPendingAttachment(null);
        }

        if (continueQuestion) {
            const base = messages.filter((m) => !m.streaming);
            const continueContent = `The user already asked: "${continueQuestion}". Screen time analytics are approved. Continue your previous answer and fully address their question — do not ask for approval again.`;
            await sendTurn(continueContent, base, { isContinuation: true });
            return;
        }

        const base = messages.filter((m) => !m.streaming);
        await sendTurn(apiUserContent, [
            ...base,
            {
                role: 'user',
                content: userMsg,
                imageUrl: attachment?.url,
            },
        ]);
    };

    /** Edit (newUserContent set) or regenerate (newUserContent null) the turn starting at `userIdx`.
     * Records the previous state as a browsable variant and forgets everything after this turn. */
    const runTurnVariant = async (userIdx: number, newUserContent: string | null) => {
        if (streaming || userIdx < 0) return;
        const current = messages;
        const userMsg = current[userIdx];
        if (!userMsg || userMsg.role !== 'user') return;

        const followingNow = current.slice(userIdx + 1).filter((m) => !m.streaming);
        const baseVariants: MessageVariant[] = userMsg.variants?.length
            ? userMsg.variants
            : [{ userContent: userMsg.content, following: followingNow }];
        const activeIdx = userMsg.activeVariantIndex ?? baseVariants.length - 1;
        const syncedVariants = baseVariants.map((v, i) =>
            i === activeIdx ? { userContent: userMsg.content, following: followingNow } : v,
        );

        const displayUserContent = newUserContent ?? userMsg.content;
        const nextVariants = [...syncedVariants, { userContent: displayUserContent, following: [] }];
        const newActiveIdx = nextVariants.length - 1;

        const priorMessages = current.slice(0, userIdx);
        const updatedUserMsg: CoachMessage = {
            ...userMsg,
            content: displayUserContent,
            variants: nextVariants,
            activeVariantIndex: newActiveIdx,
        };

        setExpandedUserIdx(null);
        setEditingUserIdx(null);
        setErrorState(null);

        await sendTurn(displayUserContent, [...priorMessages, updatedUserMsg]);
    };

    /** Browse to the previous/next stored variant of a turn without calling the API. */
    const browseVariant = (userIdx: number, direction: -1 | 1) => {
        setMessages((prev) => {
            const userMsg = prev[userIdx];
            if (!userMsg?.variants?.length) return prev;
            const followingNow = prev.slice(userIdx + 1).filter((m) => !m.streaming);
            const activeIdx = userMsg.activeVariantIndex ?? userMsg.variants.length - 1;
            const syncedVariants = userMsg.variants.map((v, i) =>
                i === activeIdx ? { userContent: userMsg.content, following: followingNow } : v,
            );
            const nextIdx = Math.min(Math.max(activeIdx + direction, 0), syncedVariants.length - 1);
            if (nextIdx === activeIdx) return prev;
            const target = syncedVariants[nextIdx];
            const newUserMsg: CoachMessage = {
                ...userMsg,
                content: target.userContent,
                variants: syncedVariants,
                activeVariantIndex: nextIdx,
            };
            return [...prev.slice(0, userIdx), newUserMsg, ...target.following];
        });
    };

    const copyToClipboard = async (text: string, idx: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIdx(idx);
            window.setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1500);
        } catch (e) {
            console.warn('[AiCoach] copy failed', e);
        }
    };

    const handleAttachFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img: LibraryImage = {
                id: crypto.randomUUID(),
                url: String(reader.result),
                name: file.name,
            };
            setLibraryImages((prev) => [img, ...prev]);
            setPendingAttachment(img);
            void (async () => {
                const token = session?.access_token;
                if (!token || !img.url.startsWith('data:image/')) return;
                setOcrBusy(true);
                try {
                    const { data, error } = await invokeAuthedFunction<{ text?: string; error?: string }>(
                        'extract-image-text',
                        token,
                        { imageDataUrl: img.url },
                    );
                    if (!error && data?.text) {
                        setPendingAttachment((prev) =>
                            prev && prev.id === img.id ? { ...prev, extractedText: data.text } : prev,
                        );
                        setLibraryImages((prev) =>
                            prev.map((item) =>
                                item.id === img.id ? { ...item, extractedText: data.text } : item,
                            ),
                        );
                    }
                } catch (e) {
                    console.warn('[AiCoach] OCR failed', e);
                } finally {
                    setOcrBusy(false);
                }
            })();
        };
        reader.readAsDataURL(file);
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

    const currentTitle = sessions.find((s) => s.id === sessionId)?.title || (hasConversation ? 'Chat' : 'AI Coach');

    return (
        <div className={`${embedded ? 'relative h-full min-h-0' : 'fixed inset-0 z-[200]'} flex min-h-0 overflow-hidden bg-[#0a0a0b] text-neutral-100`}>
            {errorState && <ErrorOverlay error={errorState} onClose={() => setErrorState(null)} />}

            {embedded && embeddedSidebarOpen && (
                <button
                    type="button"
                    aria-label="Close chat history"
                    onClick={() => setEmbeddedSidebarOpen(false)}
                    className="absolute inset-0 z-10 bg-black/45 xl:hidden"
                />
            )}

            {/* Inner AI Coach sidebar — internal scroll only, never resizes the outer workspace/page. */}
            <aside
                className={`w-[260px] shrink-0 flex flex-col min-h-0 bg-[#111113] border-r border-white/[0.06] ${
                    embedded
                        ? `absolute inset-y-0 left-0 z-20 transition-transform xl:relative xl:z-auto xl:translate-x-0 ${
                            embeddedSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                        }`
                        : ''
                }`}
            >
                <CoachUserHeader
                    profile={profile}
                    engineState={engineState}
                    sessionEmail={session?.user?.email}
                    onOpenAccount={onOpenAccount}
                />

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

                <div className="p-2 grid grid-cols-2 gap-1 border-b border-white/[0.04]">
                    <button
                        type="button"
                        onClick={() => setSidebarView('chats')}
                        className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                            sidebarView === 'chats'
                                ? 'bg-white/[0.1] text-white'
                                : 'text-neutral-400 hover:bg-white/[0.06] hover:text-white'
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chats
                    </button>
                    <button
                        type="button"
                        onClick={() => setSidebarView('library')}
                        className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                            sidebarView === 'library'
                                ? 'bg-white/[0.1] text-white'
                                : 'text-neutral-400 hover:bg-white/[0.06] hover:text-white'
                        }`}
                    >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Library
                    </button>
                    <button
                        type="button"
                        onClick={() => setSidebarView('explore')}
                        className={`col-span-2 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                            sidebarView === 'explore'
                                ? 'bg-white/[0.1] text-white'
                                : 'text-neutral-400 hover:bg-white/[0.06] hover:text-white'
                        }`}
                    >
                        <Compass className="w-3.5 h-3.5" />
                        Explore
                    </button>
                </div>

                {sidebarView === 'chats' && (
                    <>
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

                        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
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
                    </>
                )}

                {sidebarView === 'library' && (
                    <div className="flex-1 min-h-0 overflow-y-auto p-3">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                                Library
                            </p>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs font-medium text-violet-400 hover:text-violet-300"
                            >
                                Upload
                            </button>
                        </div>
                        {libraryImages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-10 px-4 rounded-xl border border-dashed border-white/10">
                                <ImageIcon className="w-8 h-8 text-neutral-600 mb-3" />
                                <p className="text-sm text-neutral-400">You can upload images</p>
                                <p className="text-xs text-neutral-600 mt-1">
                                    Attach screenshots or references from the chat input below.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {libraryImages.map((img) => (
                                    <div
                                        key={img.id}
                                        className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-[#1a1a1a]"
                                        title={img.name}
                                    >
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {sidebarView === 'explore' && (
                    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
                            Explore what the coach can do
                        </p>
                        {EXPLORE_CAPABILITIES.map((cap) => (
                            <div
                                key={cap.title}
                                className="rounded-xl border border-white/[0.08] bg-[#161618] overflow-hidden"
                            >
                                {/* Placeholder infographic slot — see components/aiCoachInfographicPrompts.md */}
                                <div className="aspect-[16/9] flex flex-col items-center justify-center gap-1.5 border-b border-white/[0.06] bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-transparent">
                                    <ImageIcon className="w-5 h-5 text-neutral-600" />
                                    <span className="text-[10px] text-neutral-600">{cap.slot}</span>
                                </div>
                                <div className="p-3">
                                    <p className="text-sm font-medium text-white">{cap.title}</p>
                                    <p className="text-xs text-neutral-500 mt-1">{cap.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </aside>

            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0d0d0d]">
                <header className="shrink-0 flex items-center justify-between gap-2 border-b border-white/[0.05] px-3 sm:px-4 h-12">
                    <div className="flex items-center gap-1.5 min-w-0">
                        {embedded && (
                            <button
                                type="button"
                                onClick={() => setEmbeddedSidebarOpen(true)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200 xl:hidden shrink-0"
                                aria-label="Open chat history"
                            >
                                <PanelLeft size={14} />
                            </button>
                        )}
                        <span className="text-sm font-medium text-white truncate">{currentTitle}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 shrink-0">
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${
                                streaming ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                            }`}
                        />
                        {streaming ? 'Thinking…' : 'Online'}
                    </div>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto">
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
                        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
                            {messages.map((msg, idx) => {
                                if (msg.role === 'user') {
                                    const isEditing = editingUserIdx === idx;
                                    const isExpanded = expandedUserIdx === idx;
                                    const variantCount = msg.variants?.length ?? 0;
                                    const variantPos = (msg.activeVariantIndex ?? 0) + 1;
                                    return (
                                        <div key={idx} className="flex justify-end">
                                            <div className="max-w-[88%] flex flex-col items-end min-w-0">
                                                {isEditing ? (
                                                    <div className="w-full min-w-[260px] rounded-[1.25rem] border border-white/10 bg-[#1c1c1c] p-3">
                                                        <textarea
                                                            autoFocus
                                                            value={editDraft}
                                                            onChange={(e) => setEditDraft(e.target.value)}
                                                            rows={3}
                                                            className="w-full bg-transparent border-none outline-none resize-none text-[15px] text-white placeholder:text-neutral-500"
                                                        />
                                                        <div className="flex justify-end gap-2 mt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingUserIdx(null)}
                                                                className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:bg-white/[0.06]"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = editDraft.trim();
                                                                    setEditingUserIdx(null);
                                                                    if (next && next !== msg.content) {
                                                                        void runTurnVariant(idx, next);
                                                                    }
                                                                }}
                                                                disabled={!editDraft.trim()}
                                                                className="px-3 py-1.5 rounded-lg text-xs bg-white text-black font-semibold hover:bg-neutral-200 disabled:opacity-40"
                                                            >
                                                                Save &amp; submit
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-left max-w-full bg-[#2f2f2f] rounded-[1.25rem] px-4 py-2.5 text-white text-[15px] leading-relaxed">
                                                        {msg.imageUrl && (
                                                            <img
                                                                src={msg.imageUrl}
                                                                alt=""
                                                                className="mb-2 max-h-56 w-full rounded-xl object-cover border border-white/10"
                                                            />
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setExpandedUserIdx((v) => (v === idx ? null : idx))
                                                            }
                                                            className="w-full text-left whitespace-pre-wrap break-words hover:opacity-90 transition-opacity"
                                                        >
                                                            {msg.content}
                                                        </button>
                                                    </div>
                                                )}

                                                {isExpanded && !isEditing && (
                                                    <div className="flex items-center gap-0.5 mt-1.5 px-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(msg.content, idx)}
                                                            className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.08]"
                                                            aria-label="Copy"
                                                        >
                                                            {copiedIdx === idx ? (
                                                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                            ) : (
                                                                <Copy className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingUserIdx(idx);
                                                                setEditDraft(msg.content);
                                                            }}
                                                            className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.08]"
                                                            aria-label="Edit prompt"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        {variantCount > 1 && (
                                                            <div className="flex items-center gap-0.5 ml-1 text-xs text-neutral-500">
                                                                <button
                                                                    type="button"
                                                                    disabled={variantPos <= 1}
                                                                    onClick={() => browseVariant(idx, -1)}
                                                                    className="p-1 rounded hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-transparent"
                                                                    aria-label="Previous version"
                                                                >
                                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                                </button>
                                                                <span className="tabular-nums">
                                                                    {variantPos}/{variantCount}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    disabled={variantPos >= variantCount}
                                                                    onClick={() => browseVariant(idx, 1)}
                                                                    className="p-1 rounded hover:bg-white/[0.08] disabled:opacity-30 disabled:hover:bg-transparent"
                                                                    aria-label="Next version"
                                                                >
                                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idx} className="flex justify-start gap-3">
                                        <div className="w-7 h-7 rounded-full shrink-0 mt-0.5 flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                        <div className="max-w-[88%] min-w-0 text-[15px] leading-relaxed">
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
                                            {!msg.streaming && msg.content && (
                                                <div className="flex items-center gap-0.5 mt-2 -ml-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(msg.content, idx)}
                                                        className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.08]"
                                                        aria-label="Copy"
                                                    >
                                                        {copiedIdx === idx ? (
                                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                    <AssistantMenu
                                                        disabled={streaming}
                                                        onRegenerate={() =>
                                                            void runTurnVariant(
                                                                findUserIndexBefore(messages, idx),
                                                                null,
                                                            )
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                <footer className="shrink-0 px-4 sm:px-6 pb-6 pt-3">
                    <div className="max-w-3xl mx-auto">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleAttachFile(file);
                                e.target.value = '';
                            }}
                        />

                        {pendingAttachment && (
                            <div className="mb-3 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#1a1a1a]">
                                <div className="relative">
                                    <img
                                        src={pendingAttachment.url}
                                        alt={pendingAttachment.name}
                                        className="max-h-64 w-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setPendingAttachment(null)}
                                        aria-label="Remove attachment"
                                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/60 text-neutral-200 backdrop-blur"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <div className="px-3 py-2 text-[11px] text-neutral-500">
                                    {ocrBusy
                                        ? 'Extracting text…'
                                        : pendingAttachment.extractedText
                                          ? 'Text extracted — it will be sent with your question'
                                          : pendingAttachment.name}
                                </div>
                            </div>
                        )}

                        <div className={`flex items-end gap-2 rounded-[1.75rem] border border-white/[0.08] bg-[#2a2a2a] px-2 py-2 shadow-lg ${pendingAttachment ? 'min-h-[4.5rem]' : ''}`}>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2.5 rounded-full hover:bg-white/[0.08] text-neutral-400 mb-0.5"
                                aria-label="Attach image"
                            >
                                <Paperclip className="w-5 h-5" />
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
