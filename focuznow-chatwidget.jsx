// focuznow-chatwidget.jsx — floating AI Coach chat widget (Groq streaming via /api/chat)
const { useState: useCS, useEffect: useCE, useRef: useCR } = React;

const STARTERS = [
  "I keep losing afternoons to Twitter — fix me.",
  "Build me a focus schedule for deep work.",
  "What's the best way to use Nuclear Lockdown?",
  "Help me stop checking my phone constantly.",
];

function ChatWidget() {
  const [open, setOpen] = useCS(false);
  const [messages, setMessages] = useCS(() => {
    try { return JSON.parse(localStorage.getItem('fn-chat') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useCS('');
  const [streaming, setStreaming] = useCS(false);
  const [error, setError] = useCS('');
  const bottomRef = useCR(null);
  const inputRef = useCR(null);
  const abortRef = useCR(null);

  // persist to localStorage
  useCE(() => {
    if (messages.length) localStorage.setItem('fn-chat', JSON.stringify(messages.slice(-40)));
  }, [messages]);

  // scroll to bottom on new message
  useCE(() => {
    if (bottomRef.current) {
      bottomRef.current.parentElement.scrollTop = bottomRef.current.offsetTop;
    }
  }, [messages, streaming]);

  // focus input when opened
  useCE(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || streaming) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', content };
    const next = [...messages, userMsg];
    setMessages(next);
    setStreaming(true);

    // placeholder assistant message to stream into
    setMessages(m => [...m, { role: 'assistant', content: '' }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages(m => {
                const copy = [...m];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + delta };
                return copy;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        // user cancelled
      } else {
        setError(e.message || 'Something went wrong. Is the Groq API key set in Vercel?');
        // remove empty assistant placeholder
        setMessages(m => m[m.length - 1]?.content === '' ? m.slice(0, -1) : m);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clear = () => { setMessages([]); localStorage.removeItem('fn-chat'); };
  const stop = () => { abortRef.current?.abort(); };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? 'rgba(109,40,217,0.9)' : 'linear-gradient(150deg, #9d6bff, #6d28d9)',
          border: '1px solid rgba(167,139,250,0.5)',
          boxShadow: '0 8px 32px rgba(109,40,217,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all .25s',
        }}
        title="AI Coach"
      >
        {open
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7V4"/><path d="M9 12h.01M15 12h.01"/><path d="M5 9h14v9H5z"/><path d="M9 18l-1 3M15 18l1 3"/></svg>
        }
        {!open && messages.length === 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#a78bfa', border: '2px solid var(--bg)', animation: 'blink 2s ease-in-out infinite' }}></span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 28, zIndex: 999,
          width: 'min(420px, calc(100vw - 40px))', height: 'min(560px, calc(100vh - 130px))',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, #111118 0%, #0a0a10 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.2)',
          overflow: 'hidden',
          animation: 'panelIn .22s cubic-bezier(.2,.8,.2,1)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(150deg,#9d6bff,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7V4"/><path d="M9 12h.01M15 12h.01"/><path d="M5 9h14v9H5z"/><path d="M9 18l-1 3M15 18l1 3"/></svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15 }}>AI Coach</div>
                <div style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', display: 'inline-block' }}></span>
                  {streaming ? 'thinking…' : 'ready · llama-3.3-70b'}
                </div>
              </div>
            </div>
            <button onClick={clear} title="Clear chat" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 6, borderRadius: 8, color: 'rgba(255,255,255,0.35)', transition: 'color .2s' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6"/><path d="M8 6V4h8v2"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ textAlign: 'center', padding: '24px 0 10px' }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 17, fontWeight: 600, marginBottom: 6 }}>How can I help you focus?</div>
                  <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>Ask me anything about focus, habits, or your Focuznow settings.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {STARTERS.map(s => (
                    <button key={s} onClick={() => send(s)} style={{ textAlign: 'left', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 11, padding: '11px 14px', fontSize: 13.5, color: 'rgba(255,255,255,0.7)', transition: 'all .2s', fontFamily: 'var(--body)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '11px 15px', borderRadius: 14, fontSize: 14.5, lineHeight: 1.6,
                  background: m.role === 'user' ? 'rgba(255,255,255,0.07)' : 'linear-gradient(180deg, rgba(139,92,246,0.2), rgba(109,40,217,0.15))',
                  border: '1px solid', borderColor: m.role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(139,92,246,0.35)',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 14,
                  borderBottomLeftRadius: m.role === 'user' ? 14 : 4,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.content || (streaming && i === messages.length - 1 ? (
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      {[0,1,2].map(j => <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(167,139,250,0.8)', animation: `blink 1s ${j*0.15}s infinite` }}></span>)}
                    </span>
                  ) : '…')}
                </div>
              </div>
            ))}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 11, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', fontSize: 13, color: '#fca5a5' }}>
                ⚠ {error}
              </div>
            )}
            <div ref={bottomRef}></div>
          </div>

          {/* Input */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 13, padding: '10px 12px', transition: 'border-color .2s' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask your coach anything…"
                rows={1}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
                  color: 'var(--text)', fontFamily: 'var(--body)', fontSize: 14.5, lineHeight: 1.5,
                  maxHeight: 120, overflowY: 'auto',
                }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
              />
              {streaming
                ? <button onClick={stop} style={{ cursor: 'pointer', background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 9, padding: '8px', color: '#fca5a5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                  </button>
                : <button onClick={() => send()} disabled={!input.trim()} style={{ cursor: input.trim() ? 'pointer' : 'default', background: input.trim() ? 'linear-gradient(150deg,#9d6bff,#6d28d9)' : 'rgba(255,255,255,0.06)', border: '1px solid', borderColor: input.trim() ? 'rgba(167,139,250,0.5)' : 'transparent', borderRadius: 9, padding: '8px', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  </button>
              }
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.2)', marginTop: 8, textAlign: 'center' }}>Powered by Groq · llama-3.3-70b-versatile</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes panelIn { from { opacity: 0; transform: scale(0.95) translateY(14px); } to { opacity: 1; transform: none; } }
      `}</style>
    </>
  );
}

Object.assign(window, { ChatWidget });
