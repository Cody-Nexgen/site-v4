import { useState, useEffect, useRef } from 'react';
import { Button } from '@focuz/components/ui/button';
import { Input } from '@focuz/components/ui/input';
import { Badge } from '@focuz/components/ui/badge';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '@focuz/lib/store';
import { BILLING_RETURN_URL } from '@focuz/lib/billingUrls';
import { invokeAuthedFunction } from '@focuz/lib/supabaseFunctions';
import { Loader2, Send, ArrowLeft, Clock, Ban, Check, Zap, Sparkles, AlertTriangle, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Types ---
export interface ActionPreviewData {
    action_type: 'timer' | 'block' | 'unblock' | 'blocks_list' | 'change_setting';
    data: {
        domain?: string;
        domains?: string[];
        minutes?: number;
        blocks?: string[];
        setting_name?: string;
        new_value?: boolean;
        success?: boolean;
        message?: string;
    };
}

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    action_data?: ActionPreviewData;
}

interface ActionPreviewProps {
    data: ActionPreviewData;
}

// --- Components ---

export const PaywallOverlay = ({ onClose, onUpgrade }: { onClose: () => void, onUpgrade: () => void }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
        >
            <div className="relative mb-8">
                {/* Rotating Gradient Border */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 opacity-75 blur-sm"
                />

                {/* Icon Container */}
                <div className="relative w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-white/10 shadow-2xl">
                    <Zap className="w-10 h-10 text-purple-400 fill-purple-400/20" />

                    {/* Floating Sparkles */}
                    <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-2 -right-2"
                    >
                        <Sparkles className="w-6 h-6 text-yellow-400 fill-yellow-400/20" />
                    </motion.div>
                </div>
            </div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                <h2 className="text-2xl font-bold text-white mb-2">Unlock AI Coach</h2>
                <p className="text-zinc-400 text-sm mb-6 max-w-[260px] mx-auto">
                    Get personalized productivity advice, smart blocking, and focus strategies powered by AI.
                </p>

                <div className="space-y-3 mb-8 text-left max-w-[240px] mx-auto">
                    <div className="flex items-center gap-3 text-sm text-zinc-300">
                        <Check className="w-4 h-4 text-purple-400" />
                        <span>Smart website blocking</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-300">
                        <Check className="w-4 h-4 text-purple-400" />
                        <span>Focus timer integration</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-300">
                        <Check className="w-4 h-4 text-purple-400" />
                        <span>Unlimited AI chats</span>
                    </div>
                </div>

                <div className="space-y-3 w-full max-w-[260px]">
                    <Button
                        onClick={onUpgrade}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold h-11 shadow-lg shadow-purple-900/20"
                    >
                        Upgrade to Pro
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                        Maybe later
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export const ErrorOverlay = ({ onClose, error }: { onClose: () => void, error: string }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
        >
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-zinc-400 text-sm mb-6 max-w-[280px] mx-auto">
                {error}
            </p>

            <div className="space-y-3 w-full max-w-[260px]">
                <Button
                    onClick={() => window.open('https://discord.gg/your-discord-link', '_blank')}
                    variant="outline"
                    className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Report on Discord
                </Button>
                <Button
                    variant="ghost"
                    onClick={onClose}
                    className="text-zinc-500 hover:text-zinc-300"
                >
                    Close
                </Button>
            </div>
        </motion.div>
    );
};

export const ActionPreview: React.FC<ActionPreviewProps> = ({ data }) => {
    if (!data?.action_type || !data.data) return null;

    if (data.action_type === 'timer') {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                className="mt-2 p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg flex items-center gap-2"
            >
                <Clock size={18} className="text-purple-400" />
                <div className="flex-1">
                    <p className="text-xs font-medium text-purple-300">Timer Set</p>
                    <p className="text-xs text-zinc-400">
                        {data.data.domain} blocked for {data.data.minutes} min
                    </p>
                </div>
                <Check size={14} className="text-green-400" />
            </motion.div>
        );
    }

    if (data.action_type === 'block') {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                className="mt-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg"
            >
                <div className="flex items-center gap-2 mb-2">
                    <Ban size={18} className="text-red-400" />
                    <p className="text-xs font-medium text-red-300">Sites Blocked</p>
                </div>
                <div className="flex flex-wrap gap-1">
                    {data.data.domains?.map((domain, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded">
                            {domain}
                        </span>
                    ))}
                </div>
            </motion.div>
        );
    }

    if (data.action_type === 'unblock') {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                className="mt-2 p-3 bg-green-900/30 border border-green-500/30 rounded-lg"
            >
                <div className="flex items-center gap-2 mb-2">
                    <Check size={18} className="text-green-400" />
                    <p className="text-xs font-medium text-green-300">Sites Unblocked</p>
                </div>
                <div className="flex flex-wrap gap-1">
                    {data.data.domains?.map((domain, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                            {domain}
                        </span>
                    ))}
                </div>
            </motion.div>
        );
    }

    if (data.action_type === 'blocks_list') {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                className="mt-2 p-3 bg-zinc-800/50 border border-zinc-600/30 rounded-lg"
            >
                <p className="text-xs font-medium text-zinc-300 mb-2">Active Blocks</p>
                {data.data.blocks && data.data.blocks.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {data.data.blocks.map((domain, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded">
                                {domain}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-zinc-500">No sites currently blocked</p>
                )}
            </motion.div>
        );
    }

    if (data.action_type === 'change_setting') {
        return (
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                className="mt-2 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg flex items-center gap-2"
            >
                <Sparkles size={18} className="text-blue-400" />
                <div className="flex-1">
                    <p className="text-xs font-medium text-blue-300">Setting Changed</p>
                    <p className="text-xs text-zinc-400">
                        {data.data.setting_name} set to {data.data.new_value?.toString()}
                    </p>
                </div>
                <Check size={14} className="text-green-400" />
            </motion.div>
        );
    }

    return null;
};

export function ChatInterface({ onBack }: { onBack: () => void }) {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hi! I'm your AI Coach. I can help you block sites, set timers, and stay focused. What can I do for you?" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [errorState, setErrorState] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [pendingSettingChange, setPendingSettingChange] = useState<{
        setting_name: string;
        new_value: boolean;
        onConfirm: () => void;
        onCancel: () => void;
    } | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load chat history on mount
    useEffect(() => {
        console.log('[ChatInterface] Component mounted');
        loadChatHistory();
    }, []);

    const loadChatHistory = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            // Get most recent chat session
            const { data: sessions } = await supabase
                .from('ai_chat_sessions')
                .select('*')
                .eq('user_id', session.user.id)
                .order('updated_at', { ascending: false })
                .limit(1);

            if (sessions && sessions.length > 0) {
                const chatSession = sessions[0];
                setSessionId(chatSession.id);

                // Load messages
                const { data: msgs } = await supabase
                    .from('ai_chat_messages')
                    .select('*')
                    .eq('session_id', chatSession.id)
                    .order('created_at', { ascending: true });

                if (msgs && msgs.length > 0) {
                    setMessages(msgs.map(m => ({
                        role: m.role as 'user' | 'assistant',
                        content: m.content,
                        action_data: m.action_data
                    })));
                }
            } else {
                // Create new session
                const { data: newSession } = await supabase
                    .from('ai_chat_sessions')
                    .insert({ user_id: session.user.id, title: 'New Chat' })
                    .select()
                    .single();

                if (newSession) {
                    setSessionId(newSession.id);
                }
            }
        } catch (error) {
            console.error('[ChatInterface] Failed to load chat history:', error);
        }
    };

    const executeAction = async (actionData: ActionPreviewData) => {
        try {
            switch (actionData.action_type) {
                case 'timer':
                    await chrome.runtime.sendMessage({
                        type: 'TIMER_START',
                        domain: actionData.data.domain,
                        durationMinutes: actionData.data.minutes
                    });
                    console.log('[ChatInterface] Timer set:', actionData.data);
                    break;

                case 'block':
                    for (const domain of actionData.data.domains || []) {
                        await chrome.runtime.sendMessage({
                            type: 'ADD_BLOCK',
                            domain,
                            source: 'ai'
                        });
                        console.log('[ChatInterface] Blocked:', domain);
                    }
                    break;

                case 'unblock':
                    for (const domain of actionData.data.domains || []) {
                        await chrome.runtime.sendMessage({
                            type: 'REMOVE_BLOCK',
                            domain
                        });
                        console.log('[ChatInterface] Unblocked:', domain);
                    }
                    break;

                case 'blocks_list':
                    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
                    if (response?.ok && response.state?.blocklist) {
                        actionData.data.blocks = Object.keys(response.state.blocklist);
                        console.log('[ChatInterface] Active blocks:', actionData.data.blocks);
                    }
                    break;

                case 'change_setting':
                    if (actionData.data.setting_name) {
                        await new Promise<void>(resolve => {
                            setPendingSettingChange({
                                setting_name: actionData.data.setting_name!,
                                new_value: !!actionData.data.new_value,
                                onConfirm: async () => {
                                    await chrome.runtime.sendMessage({
                                        type: 'UPDATE_ENGINE_SETTINGS',
                                        settings: { [actionData.data.setting_name!]: actionData.data.new_value }
                                    });
                                    setPendingSettingChange(null);
                                    resolve();
                                },
                                onCancel: () => {
                                    setPendingSettingChange(null);
                                    resolve();
                                }
                            });
                        });
                    }
                    break;
            }
        } catch (error) {
            console.error('[ChatInterface] Failed to execute action:', error);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);
        setErrorState(null); // Clear any previous error

        try {
            // Safely get browsing history with error handling
            let historyContext = '';
            try {
                if (chrome?.history?.search) {
                    const historyItems = await chrome.history.search({ text: '', maxResults: 10 });
                    historyContext = historyItems.map(item => item.url).join(', ');
                    console.log('[ChatInterface] History context:', historyContext);
                }
            } catch (e) {
                console.warn('[ChatInterface] Could not access history:', e);
            }

            // Get screen time data
            const storage = await chrome.storage.local.get('screenTime');
            const screenTimeContext = storage.screenTime || {};
            console.log('[ChatInterface] Screen time context:', screenTimeContext);

            // STRICT CLIENT-SIDE VERIFICATION
            const { session, subscriptionTier } = useAuthStore.getState();

            // 1. Check Authentication
            if (!session) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: "Please log in to use the AI Coach."
                }]);
                setLoading(false);
                return;
            }

            // 2. Check Pro Status
            if (subscriptionTier !== 'pro') {
                console.log('[ChatInterface] Blocked non-pro user request');
                setShowPaywall(true);
                setLoading(false);
                return;
            }

            console.log('[ChatInterface] Invoking chat-with-groq edge function...');
            const { data, error } = await supabase.functions.invoke('chat-with-groq', {
                body: {
                    messages: [...messages, { role: 'user', content: userMsg }],
                    context: { history: historyContext, screenTime: screenTimeContext },
                    session_id: sessionId
                }
            });

            console.log('[ChatInterface] Edge function response:', { data, error });

            // Handle error responses (401, 403, 429, etc.)
            if (error) {
                console.error('[ChatInterface] Edge function error object:', JSON.stringify(error, null, 2));

                let isProError = false;
                let errorMessage = "Sorry, I couldn't connect to the AI coach.";

                try {
                    const errorContext = (error as any).context;
                    if (errorContext) {
                        const errorBody = typeof errorContext === 'string' ? JSON.parse(errorContext) : errorContext;
                        if (errorBody?.choices?.[0]?.message?.content) {
                            errorMessage = errorBody.choices[0].message.content;
                        } else if (errorBody?.error) {
                            errorMessage = errorBody.error;
                        }
                    }
                } catch (e) {
                    console.warn('[ChatInterface] Could not parse error context:', e);
                }

                if (data) {
                    if (data.choices?.[0]?.message?.content) {
                        errorMessage = data.choices[0].message.content;
                    } else if (data.error) {
                        errorMessage = data.error;
                    }
                }

                if (errorMessage.toLowerCase().includes('pro feature') || errorMessage.toLowerCase().includes('upgrade') || errorMessage.toLowerCase().includes('limit reached')) {
                    isProError = true;
                }

                if (isProError) {
                    setShowPaywall(true);
                } else {
                    setErrorState(errorMessage);
                }

                setLoading(false);
                return;
            }

            if (!data) {
                console.error('[ChatInterface] No data returned from edge function');
                setErrorState("No response from server. Please try again.");
                setLoading(false);
                return;
            }

            if (!data.choices || data.choices.length === 0) {
                console.error('[ChatInterface] No choices in response:', data);
                setErrorState("Empty response from server. Please try again.");
                setLoading(false);
                return;
            }

            const aiMsg = data.choices[0].message.content;
            const actionData = data.action_data;
            console.log('[ChatInterface] AI response:', aiMsg);
            console.log('[ChatInterface] Action data:', actionData);

            // We no longer manually save to Supabase here because the Edge Function handles it natively!

            if (actionData) {
                await executeAction(actionData);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: aiMsg,
                action_data: actionData
            }]);

        } catch (error: any) {
            console.error('[ChatInterface] Chat error:', error);
            setErrorState(error.message || "An unexpected error occurred. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const { subscriptionTier } = useAuthStore();

    return (
        <div className="absolute inset-0 flex flex-col bg-zinc-950">
            {/* Paywall Overlay */}
            <AnimatePresence>
                {showPaywall && (
                    <PaywallOverlay
                        onClose={() => setShowPaywall(false)}
                        onUpgrade={async () => {
                            const { upgradeToPro, subscriptionTier, syncSubscriptionFromDb, session } =
                                useAuthStore.getState();
                            if (subscriptionTier === 'pro') {
                                setShowPaywall(false);
                                if (!session?.access_token) return;
                                const { data } = await invokeAuthedFunction(
                                    'create-portal-session',
                                    session.access_token,
                                    { return_url: BILLING_RETURN_URL },
                                );
                                if (data?.url) window.open(data.url, '_blank');
                                return;
                            }
                            const result = await upgradeToPro();
                            if (result.alreadySubscribed) {
                                setShowPaywall(false);
                                await syncSubscriptionFromDb();
                            }
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Error Overlay */}
            <AnimatePresence>
                {errorState && (
                    <ErrorOverlay
                        error={errorState}
                        onClose={() => setErrorState(null)}
                    />
                )}
            </AnimatePresence>

            {/* Permission Modal */}
            <AnimatePresence>
                {pendingSettingChange && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
                    >
                        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
                            <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">Allow Change?</h2>
                            <p className="text-zinc-400 text-sm mb-6">
                                The AI Coach wants to change your setting <strong className="text-white">{pendingSettingChange.setting_name}</strong> to <strong className="text-white">{pendingSettingChange.new_value.toString()}</strong>.
                            </p>
                            <div className="flex gap-3">
                                <Button onClick={pendingSettingChange.onCancel} variant="ghost" className="flex-1">Deny</Button>
                                <Button onClick={pendingSettingChange.onConfirm} className="flex-1 bg-purple-600 hover:bg-purple-700">Allow</Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header - Fixed */}
            <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-zinc-900/50 backdrop-blur-md flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={onBack} className="text-zinc-400 hover:text-white">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="font-semibold text-white flex-1">AI Coach</span>

                {/* Conditional Badge/Button */}
                {subscriptionTier === 'pro' ? (
                    <Badge
                        variant="secondary"
                        className="bg-purple-600/20 text-purple-400 text-[10px] px-1.5 py-0 h-5 border-purple-500/20 font-bold"
                    >
                        PRO
                    </Badge>
                ) : (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] px-2 text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
                        onClick={() => setShowPaywall(true)}
                    >
                        <Zap className="w-3 h-3 mr-1" />
                        UPGRADE
                    </Button>
                )}
            </div>

            {/* Messages - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence>
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[85%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                                <div className={`p-3 rounded-lg text-sm ${msg.role === 'user'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-zinc-800 text-zinc-100'
                                    }`}>
                                    {msg.role === 'user' ? (
                                        msg.content
                                    ) : (
                                        <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                                    a: ({ node, ...props }) => <a className="text-purple-400 hover:underline" {...props} />,
                                                    code: ({ node, ...props }) => <code className="bg-black/30 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                                {msg.action_data && (
                                    <ActionPreview data={msg.action_data} />
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-zinc-800 p-3 rounded-lg">
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input - Fixed */}
            <div className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0 bg-zinc-950">
                <Input
                    placeholder="Ask me to block sites, set timers..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="bg-zinc-900 border-white/10 text-zinc-100"
                />
                <Button size="icon" onClick={handleSend} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
