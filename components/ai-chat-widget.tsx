"use client";
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { IconMessage, IconX, IconSend, IconRobot, IconPlus, IconClock, IconBan, IconCheck } from "@tabler/icons-react";
import ReactMarkdown from "https://esm.sh/react-markdown@9.0.1?external=react,react-dom";
import { supabase, supabaseUrl } from "@/lib/supabase";
import type { ChatMessage, ActionPreviewData, UsageStats } from "../lib/ai-types";

interface ActionPreviewProps {
  data: ActionPreviewData;
}

const ActionPreview: React.FC<ActionPreviewProps> = ({ data }) => {
  if (data.action_type === 'timer') {
    return (
      <div className="mt-2 p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg flex items-center gap-2">
        <IconClock size={20} className="text-purple-400" />
        <div className="flex-1">
          <p className="text-sm font-medium text-purple-300">Timer Set</p>
          <p className="text-xs text-neutral-400">
            {data.data.domain} blocked for {data.data.minutes} minutes
          </p>
        </div>
        <IconCheck size={16} className="text-green-400" />
      </div>
    );
  }

  if (data.action_type === 'block') {
    return (
      <div className="mt-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <IconBan size={20} className="text-red-400" />
          <p className="text-sm font-medium text-red-300">Sites Blocked</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {data.data.domains?.map((domain, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded">
              {domain}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (data.action_type === 'unblock') {
    return (
      <div className="mt-2 p-3 bg-green-900/30 border border-green-500/30 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <IconCheck size={20} className="text-green-400" />
          <p className="text-sm font-medium text-green-300">Sites Unblocked</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {data.data.domains?.map((domain, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
              {domain}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (data.action_type === 'blocks_list') {
    return (
      <div className="mt-2 p-3 bg-neutral-800/50 border border-neutral-600/30 rounded-lg">
        <p className="text-sm font-medium text-neutral-300 mb-2">Active Blocks</p>
        {data.data.blocks && data.data.blocks.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {data.data.blocks.map((domain, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-neutral-700 text-neutral-300 text-xs rounded">
                {domain}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500">No sites currently blocked</p>
        )}
      </div>
    );
  }

  return null;
};

export const AiChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your **FocuzNow** productivity coach. I can help you block sites, set timers, and stay focused. What can I do for you?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check authentication and load session
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await loadOrCreateSession(session.user.id);
      }
    };
    checkAuth();
  }, []);

  const loadOrCreateSession = async (userId: string) => {
    // Get most recent session
    const { data: sessions } = await supabase
      .from('ai_chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      setSessionId(session.id);

      // Load messages
      const { data: msgs } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('session_id', session.id)
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
      await createNewSession(userId);
    }
  };

  const createNewSession = async (userId: string) => {
    const { data: session } = await supabase
      .from('ai_chat_sessions')
      .insert({ user_id: userId, title: 'New Chat' })
      .select()
      .single();

    if (session) {
      setSessionId(session.id);
      setMessages([
        { role: "assistant", content: "Hi! I'm your **FocuzNow** productivity coach. I can help you block sites, set timers, and stay focused. What can I do for you?" }
      ]);
    }
  };

  const handleNewChat = async () => {
    if (!user) return;
    await createNewSession(user.id);
  };

  const handleSend = async () => {
    if (!input.trim() || !user || !sessionId) return;

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Get current browsing context from extension
      let context = { history: '', screenTime: {} };
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
          if (response?.ok) {
            // Extract context from extension state
            context = {
              history: '',
              screenTime: {}
            };
          }
        }
      } catch (e) {
        console.log('Not in extension context');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/chat-with-groq`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMsg }],
          context,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: errorData.choices?.[0]?.message?.content || "You've reached your daily usage limit. Please try again tomorrow!"
          }]);
          if (errorData.usage) {
            setUsage(errorData.usage);
          }
          return;
        }
        throw new Error(`API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiText = data.choices[0]?.message?.content || "I'm having trouble thinking right now.";
      const actionData = data.action_data;

      // Update usage stats
      if (data.usage) {
        setUsage(data.usage);
      }

      // If there's action data, execute it via extension
      if (actionData) {
        await executeAction(actionData);
      }

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: aiText,
        action_data: actionData
      }]);
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "**Error:** I couldn't process that request. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (actionData: ActionPreviewData) => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.log('Not in extension context, skipping action execution');
      return;
    }

    try {
      switch (actionData.action_type) {
        case 'timer':
          await chrome.runtime.sendMessage({
            type: 'TIMER_START',
            domain: actionData.data.domain,
            durationMinutes: actionData.data.minutes
          });
          break;

        case 'block':
          for (const domain of actionData.data.domains || []) {
            await chrome.runtime.sendMessage({
              type: 'ADD_BLOCK',
              domain
            });
          }
          break;

        case 'unblock':
          for (const domain of actionData.data.domains || []) {
            await chrome.runtime.sendMessage({
              type: 'REMOVE_BLOCK',
              domain
            });
          }
          break;

        case 'blocks_list':
          const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
          if (response?.ok && response.state?.blocklist) {
            actionData.data.blocks = Object.keys(response.state.blocklist);
          }
          break;
      }
    } catch (e) {
      console.error('Failed to execute action:', e);
    }
  };

  if (!user) {
    return (
      <button
        onClick={() => window.location.href = '/login'}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-purple-600 text-white shadow-2xl hover:bg-purple-500 transition-transform hover:scale-110 flex"
      >
        <IconMessage size={28} />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-purple-600 text-white shadow-2xl hover:bg-purple-500 transition-transform hover:scale-110 ${isOpen ? "hidden" : "flex"}`}
      >
        <IconMessage size={28} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[60] w-[350px] md:w-[400px] h-[500px] bg-[#1a1820] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-purple-900/20 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-2 flex-1">
                <div className="bg-purple-500 p-1.5 rounded-lg">
                  <IconRobot size={18} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-sm">FocuzNow Coach</h3>
                  {usage && (
                    <p className="text-xs text-neutral-400">
                      {usage.request_count}/{usage.limit} requests today
                    </p>
                  )}
                </div>
                <button
                  onClick={handleNewChat}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  title="New Chat"
                >
                  <IconPlus size={18} className="text-neutral-400" />
                </button>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-white ml-2">
                <IconX size={20} />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-900/50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] ${msg.role === "user" ? "" : "w-full"
                      }`}
                  >
                    <div
                      className={`p-3 rounded-2xl text-sm ${msg.role === "user"
                        ? "bg-purple-600 text-white rounded-tr-sm"
                        : "bg-[#2e2b38] text-neutral-200 border border-white/5 rounded-tl-sm"
                        }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.action_data && (
                      <ActionPreview data={msg.action_data} />
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#2e2b38] p-3 rounded-2xl rounded-tl-sm flex gap-1">
                    <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce delay-75" />
                    <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-[#1a1820] border-t border-white/10">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me to block sites, set timers..."
                  className="flex-1 bg-[#2e2b38] border border-transparent focus:border-purple-500 rounded-xl px-4 py-2 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <IconSend size={18} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};