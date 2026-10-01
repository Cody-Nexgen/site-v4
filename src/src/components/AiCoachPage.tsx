import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Copy,
    FileText,
    MoreHorizontal,
    Pencil,
    PanelLeft,
    RefreshCw,
    ThumbsDown,
    ThumbsUp,
    Trash2,
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
    getChatAnalyticsApproved,
    setChatAnalyticsApproved as persistChatAnalyticsApproved,
} from '../lib/aiCoachContext';
import {
    AI_COACH_MODELS,
    labelForModel,
    modelIdForLabel,
    type AiCoachModelId,
} from '../lib/aiCoachModels';
import {
    CoachActionConfirmCard,
    type CoachActionUiItem,
} from './CoachActionConfirmCard';
import { CoachActionPreview } from './CoachActionPreview';
import { pickFreeTierCoachReply } from '../lib/aiCoachFreeTier';
import { BeamZMark, useSmoothReveal } from './BeamZMark';
import { fallbackTitleFromMessage } from '../lib/chatTitle';
import { PromptInput, type AttachmentItem } from './ui/ai-chat-input';
import { CoachSidebar, type CoachSidebarView } from './coach/CoachSidebar';
import { ThinkAperture } from './coach/ThinkRing';
import { CoachLibrary } from './coach/CoachLibrary';
import { CoachDocCard, CoachDocViewer, type OpenDoc } from './coach/CoachDocs';
import { docFileName, docId, extractDocs, splitReply } from '../lib/coach/docBlocks';
import {
    createDoc,
    saveDoc,
    saveImage,
    updateLibraryItem,
    useCoachLibrary,
    type LibraryItem,
} from '../lib/coach/library';
import { pickGreeting, topDistraction } from '../lib/coach/greeting';
import {
    estimateTokens,
    readCoachUsage,
    recordCoachTokens,
    usageLimitHit,
    usagePercent,
} from '../lib/coach/usage';
import { IconButton } from './fz/IconButton';
import { Dialog } from './fz/Dialog';
import { Button } from './fz/Button';
import { ToastProvider, useToast } from './fz/Toast';
import { DUR, EASE, reducedMotion } from '../lib/motion';
import {
    appendTurn as demoAppendTurn,
    createSession as demoCreateSession,
    deleteSession as demoDeleteSession,
    isCoachDemo,
    listSessions as demoListSessions,
    loadMessages as demoLoadMessages,
    renameSession as demoRenameSession,
    demoTitleFor,
    streamDemoReply,
} from '../lib/coach/demoCoach';

/** One past state of a user turn — captured whenever it is edited or regenerated. */
type MessageVariant = {
    userContent: string;
    following: CoachMessage[];
};

type CoachAttachmentChip = { name: string; isText: boolean; url?: string };

/** Wall-clock ms, kept out of render-scope analysis (only called from event handlers). */
const nowMs = () => Date.now();

type CoachMessage = {
    role: 'user' | 'assistant';
    content: string;
    streaming?: boolean;
    actions?: CoachAction[];
    actionUi?: CoachActionUiItem[];
    showUpgrade?: boolean;
    imageUrl?: string;
    attachments?: CoachAttachmentChip[];
    /** Sent with FocuzAI Think: shows the lens + "Thinking…" row. */
    think?: boolean;
    /** Fake "thinking" lines (demo / think model). */
    thinkingLines?: string[];
    thinkingDone?: boolean;
    thinkingMs?: number;
    /** Present on user messages that have been edited/regenerated at least once. */
    variants?: MessageVariant[];
    activeVariantIndex?: number;
};

/** Downscale/compress screenshots so OCR edge payloads stay under limits. */
async function compressImageForOcr(file: File, maxEdge = 1600, quality = 0.82): Promise<string> {
    const rawUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read image'));
        reader.readAsDataURL(file);
    });
    if (!rawUrl.startsWith('data:image/')) throw new Error('Not an image file');

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        bitmap.close();
        return rawUrl;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const out = canvas.toDataURL('image/jpeg', quality);
    return out.length < rawUrl.length ? out : rawUrl;
}

function stripAnalyticsActions(actions: CoachAction[], analyticsApproved: boolean): CoachAction[] {
    if (!analyticsApproved) return actions;
    return actions.filter((a) => a.action_type !== 'read_analytics');
}

function CoachStreamBody({
    content,
    streaming,
    savedIds,
    onOpenDoc,
}: {
    content: string;
    streaming?: boolean;
    savedIds?: Set<string>;
    onOpenDoc?: (doc: OpenDoc) => void;
}) {
    const shown = useSmoothReveal(content, streaming);
    if (!shown && streaming) {
        return <div className="min-h-6" aria-live="polite" aria-label="FocuzNow is thinking" />;
    }
    if (!shown) return null;
    const segments = splitReply(shown);
    return (
        <>
            {segments.map((seg, i) => {
                const last = i === segments.length - 1;
                if (seg.kind === 'text') {
                    return (
                        <div
                            key={i}
                            className={`coach-stream-body prose prose-invert prose-sm max-w-none prose-p:my-1 ${streaming && last ? 'streaming' : ''}`}
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
                        </div>
                    );
                }
                const { doc } = seg;
                const id = docId(doc);
                return (
                    <CoachDocCard
                        key={i}
                        title={doc.title}
                        docType={doc.docType}
                        lines={doc.markdown ? doc.markdown.split('\n').length : 0}
                        writing={!doc.complete}
                        saved={Boolean(savedIds?.has(id))}
                        onOpen={() =>
                            onOpenDoc?.({
                                id: savedIds?.has(id) ? id : undefined,
                                title: doc.title,
                                docType: doc.docType,
                                markdown: doc.markdown,
                            })
                        }
                    />
                );
            })}
        </>
    );
}

function findUserIndexBefore(messages: CoachMessage[], idx: number): number {
    for (let i = idx; i >= 0; i--) {
        if (messages[i]?.role === 'user') return i;
    }
    return -1;
}

type ChatSession = { id: string; title: string; updated_at?: string };

/**
 * "Thinking…" row on the Think model: a lens that spins while it reasons and
 * closes into a check when the answer starts. Steps show live, then fold away
 * (the chevron brings them back).
 */
function ThinkingRow({ lines, done, ms }: { lines: string[]; done: boolean; ms?: number }) {
    const [userOpen, setUserOpen] = useState<boolean | null>(null);
    const open = userOpen ?? !done;
    const hasLines = lines.length > 0;
    const label = done ? (ms ? `Thought for ${Math.max(1, Math.round(ms / 1000))}s` : 'Thought it through') : 'Thinking…';
    const fade = reducedMotion.safe({ duration: 0.3, ease: [0.22, 0.8, 0.24, 1] as const });
    return (
        <div className="mb-3">
            <button
                type="button"
                onClick={() => hasLines && setUserOpen(!open)}
                aria-expanded={hasLines ? open : undefined}
                className={`flex items-center gap-2 text-[13px] text-[var(--fz-text-3)] transition-colors ${hasLines ? 'hover:text-[var(--fz-text-2)]' : 'cursor-default'}`}
            >
                <span className="text-[var(--fz-text-2)]">
                    <ThinkAperture done={done} />
                </span>
                <span className="fz-think-label" data-live={!done} aria-live="polite">
                    {label}
                </span>
                {hasLines && (
                    <ChevronDown size={13} strokeWidth={1.75} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
            </button>
            <AnimatePresence initial={false}>
                {open && hasLines && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={fade}
                        className="overflow-hidden"
                    >
                        <div className="ml-[7px] mt-2 space-y-1 border-l border-[var(--fz-border)] pl-3">
                            {lines.map((l, i) => (
                                <motion.p
                                    key={i}
                                    initial={reducedMotion.matches() ? false : { opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={fade}
                                    className="text-[13px] text-[var(--fz-text-3)]"
                                >
                                    {l}
                                </motion.p>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function AiCoachPage(props: {
    onBack: () => void;
    onOpenAccount: () => void;
    initialPrompt?: string | null;
    onPromptConsumed?: () => void;
    embedded?: boolean;
}) {
    return (
        <ToastProvider>
            <AiCoachPageInner {...props} />
        </ToastProvider>
    );
}

function AiCoachPageInner({
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
    const { toast } = useToast();
    const demo = useMemo(() => isCoachDemo(), []);
    const [messages, setMessages] = useState<CoachMessage[]>([]);
    const [streaming, setStreaming] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [model, setModel] = useState<AiCoachModelId>(() => {
        try {
            const saved = window.localStorage.getItem('focuznow-coach-model');
            if (saved === 'gemini-2.5-pro' || saved === 'gemini-2.5-flash') return saved;
        } catch { /* ignore */ }
        return 'gemini-2.5-flash';
    });
    const applyModel = useCallback((id: AiCoachModelId) => {
        setModel(id);
        try {
            window.localStorage.setItem('focuznow-coach-model', id);
        } catch { /* ignore */ }
    }, []);
    const [usageTick, setUsageTick] = useState(0);
    const coachUsage = useMemo(() => readCoachUsage(), [usageTick]);
    const [errorState, setErrorState] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [embeddedSidebarOpen, setEmbeddedSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
        try {
            return window.localStorage.getItem('focuznow-coach-sidebar') === 'collapsed';
        } catch {
            return false;
        }
    });
    const [sidebarView, setSidebarView] = useState<CoachSidebarView>('chats');
    const [chatAnalyticsApproved, setChatAnalyticsApproved] = useState(false);
    const chatAnalyticsApprovedRef = useRef(false);
    const analyticsContinueQuestionRef = useRef<string | null>(null);
    const continueAfterAnalyticsRef = useRef<((question: string) => void) | null>(null);
    const localStreamTimerRef = useRef(0);
    const abortRef = useRef<AbortController | null>(null);
    const thinkStartRef = useRef(0);
    const hasConversation = messages.some((m) => m.role === 'user');
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const initialPromptSentRef = useRef(false);

    // Message-turn editing / regenerating / browsing variants.
    const [expandedUserIdx, setExpandedUserIdx] = useState<number | null>(null);
    const [editingUserIdx, setEditingUserIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState('');
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [ratedIdx, setRatedIdx] = useState<{ idx: number; up: boolean } | null>(null);

    // Header state
    const [listScrolled, setListScrolled] = useState(false);
    const [nearBottom, setNearBottom] = useState(true);
    const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
    const [renamingHeader, setRenamingHeader] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const headerMenuRef = useRef<HTMLDivElement>(null);
    const headerRenameRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLDivElement>(null);

    // Library (images + coach documents, persisted locally) and the open document pane.
    const libraryItems = useCoachLibrary();
    const savedDocIds = useMemo(
        () => new Set((libraryItems ?? []).filter((i) => i.kind === 'doc').map((i) => i.id)),
        [libraryItems],
    );
    const [openDoc, setOpenDoc] = useState<OpenDoc | null>(null);
    const [docPaneW, setDocPaneW] = useState(560);
    const [docOverlay, setDocOverlay] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLElement>(null);
    const docCollapsedSidebarRef = useRef(false);
    /** Open a document: split view when the chat keeps >= 480px (collapsing the
     *  coach sidebar if that's what it takes, like artifacts), else an overlay. */
    const showDoc = useCallback(
        (doc: OpenDoc) => {
            const cw = rootRef.current?.clientWidth ?? window.innerWidth;
            const mainW = mainRef.current?.clientWidth ?? cw;
            const paneW = Math.round(Math.min(620, Math.max(420, cw * 0.42)));
            // Inline coach-sidebar width as laid out right now (0 when collapsed/overlaid).
            const sidebarW = Math.max(0, cw - mainW - (openDoc && !docOverlay ? docPaneW : 0));
            const MIN_CHAT = 480;
            if (cw - sidebarW - paneW >= MIN_CHAT) {
                setDocOverlay(false);
            } else if (sidebarW && cw - paneW >= MIN_CHAT) {
                docCollapsedSidebarRef.current = true;
                setSidebarCollapsed(true);
                setDocOverlay(false);
            } else {
                setDocOverlay(true);
            }
            setDocPaneW(paneW);
            setOpenDoc(doc);
        },
        [openDoc, docOverlay, docPaneW],
    );
    const closeDoc = useCallback(() => {
        setOpenDoc(null);
        if (docCollapsedSidebarRef.current) {
            docCollapsedSidebarRef.current = false;
            setSidebarCollapsed(false);
        }
    }, []);
    /** Chat cards open the Library copy when saved, so edits and favorites show. */
    const openDocFromChat = (d: OpenDoc) => {
        const item = d.id ? libraryItems?.find((i) => i.id === d.id) : undefined;
        showDoc(
            item?.kind === 'doc'
                ? { id: item.id, title: item.title, docType: item.docType, markdown: item.markdown, favorite: item.favorite }
                : d,
        );
    };
    // Turn queued behind startNewChat so it sends with the fresh session state.
    const [queuedTurn, setQueuedTurn] = useState<{ api: string; message: CoachMessage } | null>(null);

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
        [chatAnalyticsApproved, fetchEngineState, messages, sessionId, syncChatAnalyticsFlag],
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

    /* ---------- scrolling ---------- */

    const onScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setListScrolled(el.scrollTop > 0);
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
        setNearBottom(dist < 120);
    }, []);

    useEffect(() => {
        if (nearBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
    }, [messages, nearBottom]);

    useEffect(() => () => window.clearInterval(localStreamTimerRef.current), []);

    /* ---------- sessions ---------- */

    const loadSessions = useCallback(async () => {
        if (demo) {
            setSessions(demoListSessions());
            return;
        }
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!s?.user) return;
        const { data } = await supabase
            .from('ai_chat_sessions')
            .select('id, title, updated_at')
            .eq('user_id', s.user.id)
            .order('updated_at', { ascending: false })
            .limit(40);
        setSessions((data as ChatSession[]) || []);
    }, [demo]);

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
            if (demo) {
                setMessages(demoLoadMessages(sid).map((m) => ({ role: m.role, content: m.content })));
                return;
            }
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
        [demo],
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

    const resetToEmpty = useCallback(() => {
        setSidebarView('chats');
        setExpandedUserIdx(null);
        setEditingUserIdx(null);
        setSessionId(null);
        setMessages([]);
        setChatAnalyticsApproved(false);
        chatAnalyticsApprovedRef.current = false;
    }, []);

    const startNewChat = useCallback(async () => {
        setEmbeddedSidebarOpen(false);
        if (demo) {
            const s = demoCreateSession();
            resetToEmpty();
            setSessionId(s.id);
            void loadSessions();
            return;
        }
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!s?.user) return;
        const { data } = await supabase
            .from('ai_chat_sessions')
            .insert({ user_id: s.user.id, title: 'New chat' })
            .select('id')
            .single();
        if (data?.id) {
            resetToEmpty();
            setSessionId(data.id);
            void loadSessions();
        }
    }, [demo, loadSessions, resetToEmpty]);

    const renameChat = useCallback(
        async (id: string, nextTitle: string) => {
            const next = nextTitle.trim().slice(0, 80);
            if (!next) return;
            if (demo) {
                demoRenameSession(id, next);
            } else {
                await supabase.from('ai_chat_sessions').update({ title: next }).eq('id', id);
            }
            void loadSessions();
        },
        [demo, loadSessions],
    );

    const deleteChat = useCallback(
        async (id: string) => {
            if (demo) {
                demoDeleteSession(id);
            } else {
                await supabase.from('ai_chat_messages').delete().eq('session_id', id);
                await supabase.from('ai_chat_sessions').delete().eq('id', id);
            }
            if (sessionId === id) {
                setSessionId(null);
                setMessages([]);
            }
            void loadSessions();
        },
        [demo, loadSessions, sessionId],
    );

    const stopStreaming = useCallback(() => {
        abortRef.current?.abort();
        window.clearInterval(localStreamTimerRef.current);
        setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false, thinkingDone: true } : m)));
        setStreaming(false);
    }, []);

    /** Save any finished documents in a reply to the Library and open the first. */
    const persistReplyDocs = async (content: string, chatId: string | null) => {
        const docs = extractDocs(content);
        if (!docs.length) return;
        const saved = await Promise.all(docs.map((d) => saveDoc(d, chatId)));
        const first = saved[0];
        showDoc({ id: first.id, title: first.title, docType: first.docType, markdown: first.markdown, favorite: first.favorite });
    };

    /* ---------- send pipeline ---------- */

    /** Core send/stream pipeline. `baseMessages` must already include the new user turn. */
    const sendTurn = async (
        apiUserContent: string,
        baseMessages: CoachMessage[],
        opts?: { isContinuation?: boolean },
    ) => {
        const lastUser = [...baseMessages].reverse().find((m) => m.role === 'user');
        const isThink = model === 'gemini-2.5-pro';
        /** Count a finished reply's tokens toward the fair-use budgets. */
        const recordTokens = (tokens: number) => {
            recordCoachTokens(tokens, isThink);
            setUsageTick((t) => t + 1);
        };

        // Fair-use token budgets keep the Pro plan profitable at $8 — block
        // before the message ever renders once a budget is used up.
        if (!opts?.isContinuation) {
            if (!demo) {
                const tierNow: 'free' | 'pro' =
                    useAuthStore.getState().subscriptionTier === 'pro' ? 'pro' : 'free';
                const hit = usageLimitHit(tierNow, isThink);
                if (hit === 'thinkDay') {
                    setErrorState(
                        tierNow === 'pro'
                            ? "You've hit today's FocuzAI Think limit — switch to FocuzAI or try again tomorrow."
                            : 'FocuzAI Think is a Pro feature. Upgrade in Account.',
                    );
                    return;
                }
                if (hit) {
                    setErrorState(
                        hit === 'day'
                            ? "You've hit today's FocuzAI limit. It resets at midnight."
                            : "You've hit this week's FocuzAI limit. It resets next week.",
                    );
                    return;
                }
            }
        }

        const optimisticTitle =
            !opts?.isContinuation && lastUser
                ? demo
                    ? demoTitleFor(lastUser.content)
                    : fallbackTitleFromMessage(lastUser.content)
                : null;
        const applyOptimisticTitle = (sid: string | null) => {
            if (!sid || !optimisticTitle || optimisticTitle === 'New chat') return;
            setSessions((prev) => {
                const exists = prev.some((s) => s.id === sid);
                if (exists) {
                    return prev.map((s) =>
                        s.id === sid && (!s.title || s.title === 'New chat')
                            ? { ...s, title: optimisticTitle }
                            : s,
                    );
                }
                return [{ id: sid, title: optimisticTitle }, ...prev];
            });
        };

        /* ---- demo path: local store + fake streaming ---- */
        if (demo) {
            let sid = sessionId;
            if (!sid) {
                sid = demoCreateSession().id;
                setSessionId(sid);
            }
            applyOptimisticTitle(sid);
            const controller = new AbortController();
            abortRef.current = controller;
            thinkStartRef.current = nowMs();
            setMessages([
                ...baseMessages.filter((m) => !m.streaming),
                { role: 'assistant', content: '', streaming: true, thinkingLines: [], think: model === 'gemini-2.5-pro' },
            ]);
            setStreaming(true);
            setErrorState(null);
            const sidFinal = sid;
            const userText = lastUser?.content ?? apiUserContent;
            const textAttachments = (lastUser?.attachments ?? [])
                .filter((a) => a.isText)
                .map((a) => ({ name: a.name, textContent: '' }));
            streamDemoReply({
                model,
                text: apiUserContent || userText,
                attachments: textAttachments.length ? textAttachments : undefined,
                signal: controller.signal,
                onThinking: (lines, done) => {
                    setMessages((prev) => {
                        const i = prev.length - 1;
                        if (i < 0 || !prev[i]?.streaming) return prev;
                        const next = [...prev];
                        next[i] = {
                            ...next[i],
                            thinkingLines: lines,
                            thinkingDone: done,
                            thinkingMs: Date.now() - thinkStartRef.current,
                        };
                        return next;
                    });
                },
                onDelta: (visible) => {
                    setMessages((prev) => {
                        const i = prev.length - 1;
                        if (i < 0 || !prev[i]?.streaming) return prev;
                        const next = [...prev];
                        next[i] = { ...next[i], content: visible };
                        return next;
                    });
                },
                onDone: (full) => {
                    setMessages((prev) => {
                        const last = prev[prev.length - 1];
                        const base = prev.filter((m) => !m.streaming);
                        return [
                            ...base,
                            {
                                role: 'assistant',
                                content: full,
                                think: last?.think,
                                thinkingLines: last?.thinkingLines,
                                thinkingDone: true,
                                thinkingMs: last?.thinkingMs,
                            },
                        ];
                    });
                    demoAppendTurn(sidFinal, userText, full);
                    recordTokens(estimateTokens(apiUserContent, full));
                    void persistReplyDocs(full, sidFinal);
                    if (optimisticTitle && optimisticTitle !== 'New chat') {
                        demoRenameSession(sidFinal, optimisticTitle);
                    }
                    void loadSessions();
                    setStreaming(false);
                },
            });
            return;
        }

        await syncSubscriptionFromDb();
        const tier = useAuthStore.getState().subscriptionTier;

        if (tier !== 'pro') {
            if (opts?.isContinuation) return;
            setMessages([...baseMessages, { role: 'assistant', content: '', streaming: true }]);
            setStreaming(true);
            const reply = pickFreeTierCoachReply();
            window.clearInterval(localStreamTimerRef.current);
            const startAt = Date.now() + 420;
            let i = 0;
            localStreamTimerRef.current = window.setInterval(() => {
                if (Date.now() < startAt) return;
                i = Math.min(reply.length, i + 3);
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (!last?.streaming) return prev;
                    const next = [...prev];
                    next[next.length - 1] = { ...last, content: reply.slice(0, i) };
                    return next;
                });
                if (i >= reply.length) {
                    window.clearInterval(localStreamTimerRef.current);
                    setMessages((prev) => {
                        const base = prev.filter((m) => !m.streaming);
                        return [...base, { role: 'assistant', content: reply, showUpgrade: true }];
                    });
                    setStreaming(false);
                }
            }, 18);
            return;
        }

        if (!opts?.isContinuation) {
            analyticsContinueQuestionRef.current = apiUserContent;
        }

        const historyForApi = [
            ...baseMessages
                .filter((m) => !m.streaming)
                .map((m, idx, arr) => {
                    // Last user turn may carry OCR-enriched apiUserContent while UI content stays clean.
                    if (
                        !opts?.isContinuation &&
                        idx === arr.length - 1 &&
                        m.role === 'user' &&
                        apiUserContent
                    ) {
                        return { role: m.role, content: apiUserContent };
                    }
                    return { role: m.role, content: m.content };
                }),
            ...(opts?.isContinuation ? [{ role: 'user' as const, content: apiUserContent }] : []),
        ];

        thinkStartRef.current = nowMs();
        setMessages([
            ...baseMessages.filter((m) => !m.streaming),
            { role: 'assistant', content: '', streaming: true, think: model === 'gemini-2.5-pro' },
        ]);
        setStreaming(true);
        setErrorState(null);

        let activeSessionId = sessionId;
        applyOptimisticTitle(sessionId);
        const analyticsApproved =
            chatAnalyticsApprovedRef.current ||
            chatAnalyticsApproved ||
            getChatAnalyticsApproved(sessionId) ||
            (await getAnalyticsConsent());
        const coachContext = await buildCoachContext(analyticsApproved);
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await streamAiCoachChat({
                model,
                messages: historyForApi,
                sessionId: activeSessionId,
                coachContext,
                signal: controller.signal,
                callbacks: {
                    onSession: (id) => {
                        activeSessionId = id;
                        setSessionId(id);
                        applyOptimisticTitle(id);
                        if (chatAnalyticsApprovedRef.current) {
                            persistChatAnalyticsApproved(id, true);
                        }
                    },
                    onToken: (_chunk, visible) => {
                        setMessages((prev) => {
                            const i = prev.length - 1;
                            if (i < 0 || !prev[i]?.streaming) return prev;
                            const next = [...prev];
                            const cur = next[i];
                            next[i] = {
                                ...cur,
                                content: visible,
                                // Think time = until the answer starts arriving.
                                thinkingMs: cur.think && cur.thinkingMs == null ? Date.now() - thinkStartRef.current : cur.thinkingMs,
                            };
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
                                const streamed = prev.find((m) => m.streaming);
                                const withoutStream = prev.filter((m) => !m.streaming);
                                return [
                                    ...withoutStream,
                                    {
                                        role: 'assistant',
                                        content: payload.content,
                                        actions,
                                        actionUi,
                                        think: streamed?.think,
                                        thinkingMs: streamed?.thinkingMs ?? (streamed?.think ? Date.now() - thinkStartRef.current : undefined),
                                    },
                                ];
                            });
                            void persistReplyDocs(payload.content, activeSessionId);
                            recordTokens(
                                payload.usage?.total ??
                                    estimateTokens(
                                        historyForApi.map((m) => m.content).join(''),
                                        payload.content,
                                    ),
                            );

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
                            } else {
                                applyOptimisticTitle(activeSessionId);
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
                            setErrorState(msg || 'AI Coach is a Pro feature.');
                        } else {
                            setErrorState(msg || 'AI Coach request failed.');
                        }
                    },
                },
            });
        } catch (e) {
            if ((e as DOMException)?.name === 'AbortError') {
                setMessages((prev) =>
                    prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
                );
            } else {
                console.error('[AiCoach] send failed', e);
                setMessages((prev) => prev.filter((m) => !m.streaming));
                setErrorState(e instanceof Error ? e.message : 'Could not send message.');
            }
        }

        setStreaming(false);
    };

    /** Entry point from the PromptInput composer. */
    const handleComposerSubmit = async (
        text: string,
        meta: { model: string; attachments: AttachmentItem[] },
    ) => {
        const rawText = text.trim();
        if ((!rawText && !meta.attachments.length) || streaming) return;

        const imageAtt = meta.attachments.find((a) => !a.isText);
        const textAtts = meta.attachments.filter((a) => a.isText);

        let apiUserContent = rawText;
        let imageUrl: string | undefined;
        const chips: CoachAttachmentChip[] = meta.attachments.map((a) => ({
            name: a.file.name,
            isText: a.isText,
            url: a.isText ? undefined : a.url,
        }));

        if (textAtts.length) {
            const blocks = await Promise.all(
                textAtts.map(async (a) => {
                    const content = a.textContent ?? (await a.file.text().catch(() => ''));
                    return `[User attached a file: ${a.file.name}]\n[File content]\n${content.slice(0, 20_000)}`;
                }),
            );
            apiUserContent += `\n\n${blocks.join('\n\n')}`;
        }

        if (imageAtt) {
            try {
                imageUrl = await compressImageForOcr(imageAtt.file);
                void saveImage(imageUrl, imageAtt.file.name, sessionId);
                if (!demo && session?.access_token) {
                    try {
                        const { data, error } = await invokeAuthedFunction<{
                            text?: string;
                            error?: string;
                            ok?: boolean;
                        }>('extract-image-text', session.access_token, { imageDataUrl: imageUrl });
                        const ocr = String(data?.text || '').trim();
                        apiUserContent += `\n\n[User attached an image: ${imageAtt.file.name}]\n[Image text]\n${
                            !error && ocr ? ocr : '(OCR found no readable text.)'
                        }`;
                    } catch {
                        apiUserContent += `\n\n[User attached an image: ${imageAtt.file.name}]`;
                    }
                } else {
                    apiUserContent += `\n\n[User attached an image: ${imageAtt.file.name}]`;
                }
            } catch (e) {
                setErrorState(e instanceof Error ? e.message : 'Could not load that image');
            }
        }

        const base = messages.filter((m) => !m.streaming);
        await sendTurn(apiUserContent, [
            ...base,
            {
                role: 'user',
                content: rawText || imageAtt?.file.name || 'Attachment',
                imageUrl,
                attachments: chips.length ? chips : undefined,
            },
        ]);
    };

    const handleSend = async (
        textOverride?: string,
        opts?: { continueAfterAnalytics?: string },
    ) => {
        const continueQuestion = opts?.continueAfterAnalytics?.trim();
        const rawText = (continueQuestion ?? textOverride ?? '').trim();
        if (!rawText || streaming) return;

        if (continueQuestion) {
            const base = messages.filter((m) => !m.streaming);
            const continueContent = `The user already asked: "${continueQuestion}". Screen time analytics are approved. Continue your previous answer and fully address their question — do not ask for approval again.`;
            await sendTurn(continueContent, base, { isContinuation: true });
            return;
        }

        const base = messages.filter((m) => !m.streaming);
        await sendTurn(rawText, [...base, { role: 'user', content: rawText }]);
    };

    /** Edit (newUserContent set) or regenerate (newUserContent null) the turn starting at `userIdx`. */
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

    continueAfterAnalyticsRef.current = (question: string) => {
        void handleSend(undefined, { continueAfterAnalytics: question });
    };

    useEffect(() => {
        if (initialPrompt && !initialPromptSentRef.current) {
            setPendingPrompt(initialPrompt);
        }
    }, [initialPrompt]);

    useEffect(() => {
        if (!pendingPrompt || streaming || (!demo && !session?.user) || initialPromptSentRef.current) return;
        initialPromptSentRef.current = true;
        const prompt = pendingPrompt;
        setPendingPrompt(null);
        onPromptConsumed?.();
        void (async () => {
            await startNewChat();
            void handleSend(prompt);
        })();
    }, [pendingPrompt, streaming, session?.user, demo, onPromptConsumed, startNewChat]);

    useEffect(() => {
        if (!queuedTurn || streaming) return;
        const q = queuedTurn;
        setQueuedTurn(null);
        setSidebarView('chats');
        void sendTurn(q.api, [q.message]);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per queued turn
    }, [queuedTurn]);

    // Close header menu on outside click.
    useEffect(() => {
        if (!headerMenuOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
                setHeaderMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [headerMenuOpen]);

    useEffect(() => {
        if (renamingHeader) {
            headerRenameRef.current?.focus();
            headerRenameRef.current?.select();
        }
    }, [renamingHeader]);

    const firstUserMessage = messages.find((m) => m.role === 'user')?.content;
    const activeSession = sessions.find((s) => s.id === sessionId);
    const currentTitle =
        activeSession?.title ||
        (hasConversation
            ? firstUserMessage
                ? fallbackTitleFromMessage(firstUserMessage)
                : 'Chat'
            : 'AI Coach');

    const displayName =
        profile?.displayName?.trim() ||
        engineState.profileName?.trim() ||
        session?.user?.user_metadata?.full_name?.trim() ||
        session?.user?.email?.split('@')[0] ||
        'there';
    const firstName = displayName.split(' ')[0];
    const streak = useAuthStore((s) => s.streak);
    const bestStreak = useAuthStore((s) => s.bestStreak);
    const statsHistory = useAuthStore((s) => s.last7DaysStats);
    // Seeded per mount AND reseeded each time a conversation closes back to the
    // empty state, so the greeting and suggestions change on every visit.
    const [greetingNonce, setGreetingNonce] = useState(() => Math.floor(Math.random() * 233280));
    const hadConversationRef = useRef(false);
    useEffect(() => {
        if (hasConversation) {
            hadConversationRef.current = true;
            return;
        }
        if (hadConversationRef.current) {
            hadConversationRef.current = false;
            setGreetingNonce(Math.floor(Math.random() * 233280));
        }
    }, [hasConversation]);
    const greeting = useMemo(() => {
        const now = new Date();
        const today = statsHistory[statsHistory.length - 1];
        const top = topDistraction(today?.sites);
        const plan = engineState.dailyPlanner ?? [];
        const pomo = engineState.pomodoroSettings;
        let s = greetingNonce;
        return pickGreeting(
            {
                now,
                name: firstName,
                streak,
                bestStreak,
                nuclearActive: Boolean(engineState.nuclearState?.active && engineState.nuclearState.endTime > now.getTime()),
                pomodorosToday: pomo?.lastDate === now.toDateString() ? pomo.sessionsCompleted ?? 0 : 0,
                planDone: plan.filter((p) => p.done).length,
                planTotal: plan.length,
                screenMsToday: today?.total ?? 0,
                topSite: top,
                chatCount: sessions.length,
            },
            () => (s = (s * 9301 + 49297) % 233280) / 233280,
        );
        // Recompute only when the inputs that change the *kind* of greeting settle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [greetingNonce, firstName, streak, bestStreak, sessions.length > 0, engineState.nuclearState?.active, statsHistory.length]);
    const isPro = useAuthStore.getState().subscriptionTier === 'pro' || demo;
    const planLabel = isPro ? 'Pro' : 'Free';
    const coachPct = usagePercent(coachUsage, isPro ? 'pro' : 'free');

    const clearAllChats = useCallback(async () => {
        for (const s of sessions) {
            // eslint-disable-next-line no-await-in-loop
            await deleteChat(s.id);
        }
        setSessionId(null);
        setMessages([]);
    }, [sessions, deleteChat]);

    const springEnter = reducedMotion.safe({
        type: 'spring',
        stiffness: 500,
        damping: 40,
        mass: 0.9,
    });
    const fadeUp = reducedMotion.safe({ duration: DUR.base, ease: [...EASE.out] });

    const composer = (
        <motion.div
            ref={composerRef}
            layoutId="coach-composer"
            transition={springEnter}
            className="w-full"
            style={{ maxWidth: hasConversation ? undefined : 720 }}
        >
            <PromptInput
                onSubmit={(text, meta) => void handleComposerSubmit(text, meta)}
                isStreaming={streaming}
                onStop={stopStreaming}
                models={AI_COACH_MODELS.map((m) => m.label)}
                model={labelForModel(model)}
                onModelChange={(label) => applyModel(modelIdForLabel(label))}
                placeholder="Ask your coach anything"
                collapsedWidth={720}
                expandedWidth={720}
                startExpanded
                collapsible={false}
                onError={(msg) => toast(msg)}
                className="w-full"
            />
        </motion.div>
    );

    const messageList = (
        <div className="mx-auto w-full max-w-[720px] px-4 pb-8 pt-6 sm:px-6">
            {messages.map((msg, idx) => {
                if (msg.role === 'user') {
                    const isEditing = editingUserIdx === idx;
                    const isExpanded = expandedUserIdx === idx;
                    const variantCount = msg.variants?.length ?? 0;
                    const variantPos = (msg.activeVariantIndex ?? 0) + 1;
                    return (
                        <motion.div
                            key={idx}
                            initial={reducedMotion.matches() ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={springEnter}
                            className="mb-6 flex justify-end"
                        >
                            <div className="flex min-w-0 max-w-[88%] flex-col items-end">
                                {isEditing ? (
                                    <div className="w-full min-w-[260px] rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-3">
                                        <textarea
                                            autoFocus
                                            value={editDraft}
                                            onChange={(e) => setEditDraft(e.target.value)}
                                            rows={3}
                                            className="w-full resize-none border-none bg-transparent text-[15px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)]"
                                        />
                                        <div className="mt-2 flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditingUserIdx(null)}
                                                className="rounded-lg px-3 py-1.5 text-xs text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)]"
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
                                                className="rounded-lg bg-[var(--fz-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--fz-accent-fg)] shadow-[var(--fz-btn-edge)] disabled:opacity-40"
                                            >
                                                Save &amp; submit
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="max-w-full rounded-[18px] bg-[var(--fz-bg-raised)] px-4 py-2.5 text-left text-[15px] leading-relaxed text-[var(--fz-text-1)]">
                                        {msg.attachments?.map((a, ai) =>
                                            a.isText ? (
                                                <span
                                                    key={ai}
                                                    className="mb-2 mr-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-app)] px-2 py-1 text-[12px] text-[var(--fz-text-2)]"
                                                >
                                                    <FileText size={12} strokeWidth={1.5} />
                                                    {a.name}
                                                </span>
                                            ) : null,
                                        )}
                                        {msg.imageUrl && (
                                            <img
                                                src={msg.imageUrl}
                                                alt=""
                                                className="mb-2 max-h-56 w-full rounded-lg border border-[var(--fz-border)] object-cover"
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedUserIdx((v) => (v === idx ? null : idx))
                                            }
                                            className="w-full whitespace-pre-wrap break-words text-left transition-opacity hover:opacity-90"
                                        >
                                            {msg.content}
                                        </button>
                                    </div>
                                )}

                                {isExpanded && !isEditing && (
                                    <div className="mt-1.5 flex items-center gap-0.5 px-1">
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(msg.content, idx)}
                                            className="rounded-lg p-1.5 text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                            aria-label="Copy"
                                        >
                                            {copiedIdx === idx ? (
                                                <Check className="size-3.5 text-[var(--fz-success)]" />
                                            ) : (
                                                <Copy className="size-3.5" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingUserIdx(idx);
                                                setEditDraft(msg.content);
                                            }}
                                            className="rounded-lg p-1.5 text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                            aria-label="Edit prompt"
                                        >
                                            <Pencil className="size-3.5" />
                                        </button>
                                        {variantCount > 1 && (
                                            <div className="ml-1 flex items-center gap-0.5 text-xs text-[var(--fz-text-3)]">
                                                <button
                                                    type="button"
                                                    disabled={variantPos <= 1}
                                                    onClick={() => browseVariant(idx, -1)}
                                                    className="rounded p-1 hover:bg-[var(--fz-bg-hover)] disabled:opacity-30 disabled:hover:bg-transparent"
                                                    aria-label="Previous version"
                                                >
                                                    <ChevronLeft className="size-3.5" />
                                                </button>
                                                <span className="tabular-nums">
                                                    {variantPos}/{variantCount}
                                                </span>
                                                <button
                                                    type="button"
                                                    disabled={variantPos >= variantCount}
                                                    onClick={() => browseVariant(idx, 1)}
                                                    className="rounded p-1 hover:bg-[var(--fz-bg-hover)] disabled:opacity-30 disabled:hover:bg-transparent"
                                                    aria-label="Next version"
                                                >
                                                    <ChevronRight className="size-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                }

                return (
                    <div key={idx} className="mb-6 flex justify-start gap-3">
                        <BeamZMark
                            size={24}
                            animated={Boolean(msg.streaming)}
                            className="mt-1 shrink-0"
                            title="FocuzNow Coach"
                        />
                        <div className="min-w-0 max-w-[88%] text-[15px] leading-[1.65] text-[var(--fz-text-1)]">
                            {(msg.think || (msg.thinkingLines?.length ?? 0) > 0) && (
                                <ThinkingRow
                                    lines={msg.thinkingLines ?? []}
                                    done={Boolean(msg.thinkingDone || !msg.streaming || msg.content)}
                                    ms={msg.thinkingMs}
                                />
                            )}
                            <CoachStreamBody
                                content={msg.content}
                                streaming={msg.streaming}
                                savedIds={savedDocIds}
                                onOpenDoc={openDocFromChat}
                            />
                            {msg.actionUi?.some(
                                (i) => i.status === 'pending' || i.status === 'running',
                            ) ? (
                                <CoachActionConfirmCard
                                    items={msg.actionUi}
                                    onAllowAll={() =>
                                        void applyCoachActionsAt(idx, msg.actionUi!)
                                    }
                                    onDenyAll={() => denyCoachActionsAt(idx)}
                                />
                            ) : null}
                            {msg.actionUi
                                ?.filter((i) => i.status === 'done')
                                .map((item) => (
                                    <CoachActionPreview key={item.id} action={item.action} />
                                ))}
                            {!msg.actionUi?.length &&
                                msg.actions?.map((act, ai) =>
                                    act ? <CoachActionPreview key={ai} action={act} /> : null,
                                )}
                            {msg.showUpgrade ? (
                                <div className="mt-4 border-t border-[var(--fz-border)] pt-4">
                                    <Button variant="primary" onClick={onOpenAccount}>
                                        Upgrade to Pro in Account
                                    </Button>
                                </div>
                            ) : null}
                            {!msg.streaming && msg.content && (
                                <motion.div
                                    initial={reducedMotion.matches() ? false : { opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={fadeUp}
                                    className="-ml-1.5 mt-2 flex items-center gap-0.5"
                                >
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(msg.content, idx)}
                                        className="rounded-lg p-1.5 text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                        aria-label="Copy"
                                    >
                                        {copiedIdx === idx ? (
                                            <Check className="size-3.5 text-[var(--fz-success)]" />
                                        ) : (
                                            <Copy className="size-3.5" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={streaming}
                                        onClick={() =>
                                            void runTurnVariant(
                                                findUserIndexBefore(messages, idx),
                                                null,
                                            )
                                        }
                                        className="rounded-lg p-1.5 text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] disabled:opacity-30"
                                        aria-label="Try again"
                                    >
                                        <RefreshCw className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRatedIdx({ idx, up: true })}
                                        className={`rounded-lg p-1.5 hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] ${
                                            ratedIdx?.idx === idx && ratedIdx.up
                                                ? 'text-[var(--fz-text-1)]'
                                                : 'text-[var(--fz-text-3)]'
                                        }`}
                                        aria-label="Good response"
                                    >
                                        <ThumbsUp className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRatedIdx({ idx, up: false })}
                                        className={`rounded-lg p-1.5 hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] ${
                                            ratedIdx && ratedIdx.idx === idx && !ratedIdx.up
                                                ? 'text-[var(--fz-text-1)]'
                                                : 'text-[var(--fz-text-3)]'
                                        }`}
                                        aria-label="Bad response"
                                    >
                                        <ThumbsDown className="size-3.5" />
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>
    );

    /** New chat, then send a turn once the fresh session state has rendered. */
    const startChatWith = async (api: string, message: CoachMessage) => {
        if (streaming) return;
        await startNewChat();
        setQueuedTurn({ api, message });
    };

    const chatAbout = (item: LibraryItem) => {
        if (item.kind === 'doc') {
            const name = docFileName(item.title);
            void startChatWith(
                `Let's work on my document "${item.title}".\n\n[User attached a file: ${name}]\n[File content]\n${item.markdown.slice(0, 20_000)}`,
                {
                    role: 'user',
                    content: `Let's work on "${item.title}".`,
                    attachments: [{ name, isText: true }],
                },
            );
        } else {
            void startChatWith(`Let's talk about this image.\n\n[User attached an image: ${item.title}]`, {
                role: 'user',
                content: 'Let’s talk about this image.',
                imageUrl: item.dataUrl,
                attachments: [{ name: item.title, isText: false, url: item.dataUrl }],
            });
        }
    };

    const libraryPane = (
        <CoachLibrary
            items={libraryItems}
            onOpenDoc={(d) =>
                showDoc({ id: d.id, title: d.title, docType: d.docType, markdown: d.markdown, favorite: d.favorite })
            }
            onChatAbout={chatAbout}
            onUploadFiles={(files) => {
                void (async () => {
                    for (const file of files) {
                        try {
                            await saveImage(await compressImageForOcr(file), file.name);
                        } catch (err) {
                            setErrorState(err instanceof Error ? err.message : 'Could not load image');
                        }
                    }
                })();
            }}
            onNewBlankDoc={() => {
                void createDoc('Untitled document', 'notes', '# Untitled document\n\n').then((d) =>
                    showDoc({ id: d.id, title: d.title, docType: d.docType, markdown: d.markdown }),
                );
            }}
            onAskCoach={(prompt) => void startChatWith(prompt, { role: 'user', content: prompt })}
        />
    );

    const sidebarCollapsedNow = sidebarCollapsed;
    const showOverlaySidebar = embedded && embeddedSidebarOpen;

    return (
        <div
            ref={rootRef}
            className={`${
                embedded ? 'relative h-full min-h-0' : 'fixed inset-0 z-[50]'
            } flex min-h-0 overflow-hidden bg-[var(--fz-bg-panel)] text-[var(--fz-text-1)]`}
        >
            {showOverlaySidebar && (
                <button
                    type="button"
                    aria-label="Close chat history"
                    onClick={() => setEmbeddedSidebarOpen(false)}
                    className="absolute inset-0 z-10 bg-black/45 xl:hidden"
                />
            )}

            {/* Inner AI Coach sidebar */}
            <motion.div
                animate={{ width: sidebarCollapsedNow ? 0 : 260 }}
                initial={false}
                transition={reducedMotion.safe({ duration: DUR.base, ease: [...EASE.standard] })}
                className={`shrink-0 overflow-hidden ${
                    embedded
                        ? `absolute inset-y-0 left-0 z-20 transition-transform xl:relative xl:z-auto xl:translate-x-0 ${
                              embeddedSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                          }`
                        : ''
                }`}
            >
                <CoachSidebar
                    chats={sessions}
                    activeChatId={sessionId}
                    view={sidebarView}
                    onViewChange={setSidebarView}
                    onNewChat={() => void startNewChat()}
                    onSelectChat={(id) => void loadChatHistory(id)}
                    onRenameChat={(id, title) => void renameChat(id, title)}
                    onDeleteChat={(id) => void deleteChat(id)}
                    userName={displayName}
                    userPlan={planLabel}
                    onOpenAccount={onOpenAccount}
                    modelOptions={AI_COACH_MODELS.map((m) => m.label)}
                    model={labelForModel(model)}
                    onModelChange={(label) => applyModel(modelIdForLabel(label))}
                    usage={{ dayPct: coachPct.day, weekPct: coachPct.week, thinkPct: coachPct.think, isPro }}
                    onClearChats={() => void clearAllChats()}
                    onCollapse={() => {
                        setEmbeddedSidebarOpen(false);
                        setSidebarCollapsed(true);
                        try {
                            window.localStorage.setItem('focuznow-coach-sidebar', 'collapsed');
                        } catch { /* ignore */ }
                    }}
                    onRowClick={() => setEmbeddedSidebarOpen(false)}
                />
            </motion.div>

            <main ref={mainRef} className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--fz-bg-panel)]">
                <header
                    className={`flex h-12 shrink-0 items-center justify-between gap-2 px-3 sm:px-4 ${
                        listScrolled ? 'border-b border-[var(--fz-border)]' : ''
                    }`}
                >
                    <div className="flex min-w-0 items-center gap-1.5">
                        {(embedded || sidebarCollapsedNow) && (
                            <IconButton
                                icon={<PanelLeft size={14} />}
                                tooltip="Open sidebar"
                                tooltipSide="bottom"
                                className={embedded && !sidebarCollapsedNow ? 'xl:hidden' : ''}
                                onClick={() => {
                                    setSidebarCollapsed(false);
                                    try {
                                        window.localStorage.removeItem('focuznow-coach-sidebar');
                                    } catch { /* ignore */ }
                                    if (embedded) setEmbeddedSidebarOpen(true);
                                }}
                            />
                        )}
                        {renamingHeader ? (
                            <input
                                ref={headerRenameRef}
                                defaultValue={currentTitle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const v = (e.target as HTMLInputElement).value;
                                        setRenamingHeader(false);
                                        if (sessionId) void renameChat(sessionId, v);
                                    }
                                    if (e.key === 'Escape') setRenamingHeader(false);
                                }}
                                onBlur={(e) => {
                                    setRenamingHeader(false);
                                    if (sessionId) void renameChat(sessionId, e.target.value);
                                }}
                                className="h-7 w-64 rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-2 text-[14px] text-[var(--fz-text-1)] outline-none focus:border-[var(--fz-border-strong)]"
                            />
                        ) : hasConversation && sidebarView === 'chats' ? (
                            <span className="truncate text-[14px] font-medium text-[var(--fz-text-1)]">
                                {currentTitle}
                            </span>
                        ) : null}
                    </div>
                    {sessionId && hasConversation && sidebarView === 'chats' && (
                        <div ref={headerMenuRef} className="relative shrink-0">
                            <IconButton
                                icon={<MoreHorizontal size={15} />}
                                tooltip="Chat options"
                                tooltipSide="bottom"
                                onClick={() => setHeaderMenuOpen((v) => !v)}
                            />
                            {headerMenuOpen && (
                                <div
                                    className="absolute right-0 top-full z-50 mt-1 w-36 rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1 backdrop-blur"
                                    style={{ boxShadow: 'var(--fz-elev-card)' }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHeaderMenuOpen(false);
                                            setRenamingHeader(true);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-[var(--fz-text-2)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                    >
                                        <Pencil className="size-3.5" />
                                        Rename
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHeaderMenuOpen(false);
                                            setConfirmDeleteOpen(true);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-[var(--fz-danger)] hover:bg-[var(--fz-bg-hover)]"
                                    >
                                        <Trash2 className="size-3.5" />
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </header>

                {/* Content */}
                {sidebarView === 'library' ? (
                    <div className="min-h-0 flex-1 overflow-y-auto">{libraryPane}</div>
                ) : !hasConversation ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
                        <motion.div
                            key="empty-state"
                            exit={reducedMotion.matches() ? { opacity: 0 } : { opacity: 0, y: -12 }}
                            transition={fadeUp}
                            className="w-full max-w-[720px]"
                        >
                            <h1
                                key={greeting.id}
                                aria-label={greeting.title}
                                className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--fz-text-1)]"
                            >
                                {greeting.title.split(' ').map((word, i) => (
                                    <motion.span
                                        key={i}
                                        aria-hidden
                                        className="inline-block whitespace-pre"
                                        initial={reducedMotion.matches() ? false : { opacity: 0, y: 6, filter: 'blur(4px)' }}
                                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                        transition={reducedMotion.safe({ delay: i * 0.045, duration: 0.45, ease: [0.16, 1, 0.3, 1] })}
                                    >
                                        {word}{' '}
                                    </motion.span>
                                ))}
                            </h1>
                            <motion.p
                                className="mt-2 text-[15px] text-[var(--fz-text-3)]"
                                initial={reducedMotion.matches() ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={reducedMotion.safe({ delay: 0.25, duration: 0.4 })}
                            >
                                {greeting.sub}
                            </motion.p>
                            <div className="mt-6">{composer}</div>
                        </motion.div>
                    </div>
                ) : (
                    <>
                        <div
                            ref={scrollRef}
                            onScroll={onScroll}
                            className="min-h-0 flex-1 overflow-y-auto"
                            // Fade the list itself into the dock (no painted overlay, so the
                            // Think backdrop shows through cleanly).
                            style={{
                                maskImage: 'linear-gradient(180deg, #000 calc(100% - 32px), transparent)',
                                WebkitMaskImage: 'linear-gradient(180deg, #000 calc(100% - 32px), transparent)',
                            }}
                        >
                            {messageList}
                        </div>
                        {/* Composer dock */}
                        <div className="relative shrink-0">
                            {!nearBottom && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                        setNearBottom(true);
                                    }}
                                    aria-label="Jump to latest"
                                    className="absolute -top-12 left-1/2 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] text-[var(--fz-text-2)] shadow-[var(--fz-elev-card)] transition-colors hover:text-[var(--fz-text-1)]"
                                >
                                    <ChevronDown size={15} />
                                </button>
                            )}
                            <div className="mx-auto w-full max-w-[720px] px-4 pb-2 sm:px-6">
                                {composer}
                                <p className="mt-1.5 text-center text-[11px] text-[var(--fz-text-4)]">
                                    FocuzAI can make mistakes. Check important info.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </main>

            {/* Document pane (artifact) — split view on wide screens, overlay on narrow */}
            <AnimatePresence initial={false}>
                {openDoc && (
                    <motion.aside
                        key="coach-doc"
                        initial={docOverlay ? { x: 24, opacity: 0 } : { width: 0 }}
                        animate={docOverlay ? { x: 0, opacity: 1 } : { width: docPaneW }}
                        exit={docOverlay ? { x: 24, opacity: 0 } : { width: 0 }}
                        transition={reducedMotion.safe({ duration: DUR.slow, ease: [...EASE.standard] })}
                        className={`shrink-0 overflow-hidden border-l border-[var(--fz-border)] bg-[var(--fz-bg-panel)] ${
                            docOverlay ? 'absolute inset-y-0 right-0 z-30 w-full max-w-[640px]' : 'relative h-full'
                        }`}
                        style={docOverlay ? { boxShadow: 'var(--fz-shadow-overlay)' } : undefined}
                        aria-label="Document"
                    >
                        <div className="h-full" style={docOverlay ? undefined : { width: docPaneW }}>
                            <CoachDocViewer
                                key={openDoc.id ?? `unsaved:${openDoc.title}`}
                                doc={openDoc}
                                onClose={closeDoc}
                                onChatAbout={() => {
                                    const item = libraryItems?.find((i) => i.id === openDoc.id);
                                    chatAbout(
                                        item ?? {
                                            id: docId(openDoc),
                                            kind: 'doc',
                                            title: openDoc.title,
                                            docType: openDoc.docType,
                                            markdown: openDoc.markdown,
                                            createdAt: Date.now(),
                                            updatedAt: Date.now(),
                                        },
                                    );
                                }}
                                onSave={(next) => {
                                    void (async () => {
                                        if (openDoc.id) {
                                            await updateLibraryItem(openDoc.id, next);
                                            setOpenDoc({ ...openDoc, ...next });
                                        } else {
                                            const saved = await saveDoc({ ...openDoc, ...next });
                                            setOpenDoc({ ...openDoc, ...next, id: saved.id });
                                        }
                                    })();
                                }}
                                onToggleFavorite={() => {
                                    if (!openDoc.id) return;
                                    void updateLibraryItem(openDoc.id, { favorite: !openDoc.favorite });
                                    setOpenDoc({ ...openDoc, favorite: !openDoc.favorite });
                                }}
                            />
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {errorState && (
                <div className="absolute bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] px-4 py-2.5 text-[13px] text-[var(--fz-text-1)] shadow-[var(--fz-elev-card)]">
                    <span>{errorState}</span>
                    <button
                        type="button"
                        onClick={() => setErrorState(null)}
                        className="ml-3 text-[var(--fz-text-3)] hover:text-[var(--fz-text-1)]"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <Dialog
                open={confirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                title="Delete chat"
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger-solid"
                            onClick={() => {
                                if (sessionId) void deleteChat(sessionId);
                                setConfirmDeleteOpen(false);
                            }}
                        >
                            Delete
                        </Button>
                    </>
                }
            >
                <p className="text-[14px] text-[var(--fz-text-2)]">
                    This chat will be permanently deleted.
                </p>
            </Dialog>
        </div>
    );
}
