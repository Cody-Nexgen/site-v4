// focuznow-mockups.jsx — realistic animated product mockups for each tool
const { useState: useS, useEffect: useE, useRef: useR } = React;

/* small helper: a faux browser/app window chrome */
function Win({ title, children, w, accent, style = {} }) {
  return (
    <div className="panel panel-edge" style={{ width: w, overflow: 'hidden', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 15px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ width: 11, height: 11, borderRadius: 99, background: '#ff5f57' }}></span>
        <span style={{ width: 11, height: 11, borderRadius: 99, background: '#febc2e' }}></span>
        <span style={{ width: 11, height: 11, borderRadius: 99, background: '#28c840' }}></span>
        {title && <span style={{ marginLeft: 8, fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{title}</span>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ============ POMODORO RING ============ */
function PomodoroRing({ size = 168, total = 1500, accent = 'var(--violet-br)', auto = true, label = 'Deep Work' }) {
  const [t, setT] = useS(900);
  useE(() => {
    if (!auto) return;
    const id = setInterval(() => setT(v => (v <= 0 ? total : v - 1)), 1000);
    return () => clearInterval(id);
  }, [auto]);
  const r = size / 2 - 12, c = 2 * Math.PI * r;
  const frac = t / total;
  const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={accent} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.6))' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', letterSpacing: '.12em', textTransform: 'uppercase' }}>{label}</div>
        <div className="" style={{ fontFamily: 'var(--display)', fontSize: size * 0.22, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2 }}>{mm}:{ss}</div>
      </div>
    </div>
  );
}

/* ============ BLOCKLIST ============ */
function BlocklistMock({ w = 360 }) {
  const init = [
    { s: 'x.com', on: true }, { s: 'reddit.com', on: true },
    { s: 'instagram.com', on: true }, { s: 'tiktok.com', on: true },
    { s: 'news.ycombinator.com', on: false },
  ];
  const [rows, setRows] = useS(init);
  const toggle = (i) => setRows(rs => rs.map((r, j) => j === i ? { ...r, on: !r.on } : r));
  const count = rows.filter(r => r.on).length;
  return (
    <Win title="focuznow · blocklist" w={w}>
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span className="icon-badge" style={{ width: 34, height: 34, borderRadius: 9 }}><Icon name="ban" size={18} /></span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Blocklist</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{count} sites blocked</div>
            </div>
          </div>
          <span className="chip" style={{ fontSize: 11.5 }}><span className="dot dot-g"></span>Active</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)', fontSize: 13, color: 'var(--muted)' }}>
            <Icon name="plus" size={15} color="var(--violet-br)" /> add a site to block…
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={r.s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: r.on ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: r.on ? 'rgba(248,113,113,0.18)' : 'var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5 }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--muted)' }}>{r.s[0].toUpperCase()}</span>
                {r.s}
              </div>
              <button onClick={() => toggle(i)} data-mag style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>
                <span style={{ width: 38, height: 22, borderRadius: 999, background: r.on ? 'var(--violet)' : 'rgba(255,255,255,0.12)', display: 'inline-block', position: 'relative', transition: 'background .2s' }}>
                  <span style={{ position: 'absolute', top: 3, left: r.on ? 19 : 3, width: 16, height: 16, borderRadius: 999, background: '#fff', transition: 'left .2s' }}></span>
                </span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </Win>
  );
}

/* ============ NUCLEAR LOCKDOWN (progress-driven seal) ============ */
function LockdownMock({ progress = 0, w = 420 }) {
  // progress 0..1: 0 = configuring, 1 = fully sealed
  const sealed = progress > 0.55;
  const ringP = Math.min(progress / 0.9, 1);
  const r = 92, c = 2 * Math.PI * r;
  const remain = Math.round(8100 - 0 ); // 2:15:00
  return (
    <Win title="focuznow · nuclear lockdown" w={w} style={{ transition: 'box-shadow .4s', boxShadow: sealed ? '0 0 0 1px rgba(248,113,113,0.4), 0 30px 80px rgba(0,0,0,0.6)' : undefined }}>
      <div style={{ padding: '26px 24px', textAlign: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span className="chip" style={{ fontSize: 11.5, borderColor: sealed ? 'rgba(248,113,113,0.4)' : 'var(--line)', color: sealed ? '#fca5a5' : 'var(--text-2)' }}>
            <span className={'dot ' + (sealed ? 'dot-r' : 'dot-g')}></span>{sealed ? 'SEALED' : 'Ready'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{sealed ? 'no off switch' : 'choose duration'}</span>
        </div>
        <div style={{ position: 'relative', width: 220, height: 220, margin: '0 auto' }}>
          <svg width="220" height="220">
            <circle cx="110" cy="110" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
            <circle cx="110" cy="110" r={r} fill="none" stroke={sealed ? 'var(--red)' : 'var(--violet-br)'} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - ringP)} transform="rotate(-90 110 110)"
              style={{ transition: 'stroke-dashoffset .15s linear, stroke .4s', filter: 'drop-shadow(0 0 8px rgba(167,139,250,0.5))' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ transition: 'transform .4s, color .4s', transform: `scale(${sealed ? 1 : 0.9})`, color: sealed ? '#fca5a5' : 'var(--violet-br)' }}>
              <Icon name="lock" size={30} />
            </div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 8 }}>02:15:00</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{sealed ? 'until you are free' : 'duration set'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 22 }}>
          {['Blocklist only', 'Everything'].map((m, i) => (
            <span key={m} className="chip" style={{ fontSize: 12, borderColor: (i === 1) ? 'rgba(248,113,113,0.4)' : 'var(--line)', color: (i === 1) ? '#fca5a5' : 'var(--text-2)', background: (i === 1 && sealed) ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.02)' }}>{m}</span>
          ))}
        </div>
        <div data-mag style={{ marginTop: 18, padding: '13px', borderRadius: 11, textAlign: 'center', fontWeight: 700, fontSize: 14.5, transition: 'all .4s',
          background: sealed ? 'rgba(248,113,113,0.12)' : 'linear-gradient(180deg,#9d6bff,var(--violet-dp))',
          color: sealed ? '#fca5a5' : '#fff', border: '1px solid', borderColor: sealed ? 'rgba(248,113,113,0.3)' : 'transparent' }}>
          {sealed ? '🔒  Locked — cannot be undone' : 'Start Nuclear Lockdown'}
        </div>
      </div>
    </Win>
  );
}

/* ============ YOUTUBE BLOCKING ============ */
function YouTubeMock({ w = 400 }) {
  return (
    <Win title="youtube.com" w={w}>
      <div style={{ padding: 16 }}>
        {/* shorts row blocked */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13.5, fontWeight: 600 }}>
          <Icon name="youtube" size={18} color="var(--red)" /> Shorts
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 9, marginBottom: 18 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: 64, height: 96, borderRadius: 10, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}></div>)}
          <div style={{ position: 'absolute', inset: -4, borderRadius: 12, background: 'rgba(7,7,11,0.78)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, border: '1px solid rgba(248,113,113,0.25)' }}>
            <Icon name="ban" size={22} color="var(--red)" />
            <span style={{ fontSize: 12.5, color: '#fca5a5', fontWeight: 600 }}>Shorts blocked by Focuznow</span>
          </div>
        </div>
        {/* creator block list */}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 9, fontFamily: 'var(--mono)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Hidden creators</div>
        {[['Daily Drama', 'D'], ['Rage Bait TV', 'R'], ['Doomscroll News', 'N']].map(([n, a]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 28, height: 28, borderRadius: 99, background: 'rgba(248,113,113,0.15)', color: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{a}</span>
              <span style={{ fontSize: 13.5 }}>{n}</span>
            </div>
            <span style={{ fontSize: 11.5, color: '#fca5a5' }}>hidden</span>
          </div>
        ))}
      </div>
    </Win>
  );
}

/* ============ CALENDAR ============ */
function CalendarMock({ w = 440 }) {
  const groups = [
    { n: 'Deep Work', c: '#8b5cf6' }, { n: 'Meetings', c: '#34d399' }, { n: 'Personal', c: '#fbbf24' },
  ];
  // map of day -> group index
  const ev = { 4: 0, 5: 1, 9: 0, 11: 2, 12: 1, 16: 0, 17: 0, 18: 2, 23: 1, 24: 0 };
  return (
    <Win title="focuznow · calendar" w={w}>
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 17 }}>May 2026</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {groups.map(g => (
              <span key={g.n} style={{ fontSize: 11.5, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: g.c }}></span>{g.n}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 6 }}>
          {['S','M','T','W','T','F','S'].map((d,i) => <div key={i} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--muted)' }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
          {Array.from({ length: 28 }).map((_, i) => {
            const day = i + 1; const g = ev[day];
            return (
              <div key={i} style={{ aspectRatio: '1', borderRadius: 8, fontSize: 11.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative',
                background: g !== undefined ? groups[g].c + '22' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: g !== undefined ? groups[g].c + '55' : 'var(--line)', color: g !== undefined ? '#fff' : 'var(--muted)' }}>
                {day}
                {g !== undefined && <span style={{ position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 99, background: groups[g].c }}></span>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 11, border: '1px solid var(--line)', background: 'rgba(139,92,246,0.06)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <Icon name="link" size={17} color="var(--violet-br)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Scheduling link</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>focuznow.app/meet/alex</div>
          </div>
          <span className="chip" style={{ fontSize: 11 }}>Copy</span>
        </div>
      </div>
    </Win>
  );
}

/* ============ AI COACH (chat w/ tool calls) ============ */
function AICoachMock({ w = 440 }) {
  const msgs = [
    { role: 'user', text: "I keep losing afternoons to Twitter. Help." },
    { role: 'tool', text: 'Added x.com to your blocklist' },
    { role: 'tool', text: 'Scheduled Nuclear Lockdown · 1–4pm weekdays' },
    { role: 'ai', text: "Done. I blocked x.com and set a recurring lockdown for your weak window. Want me to start a Pomodoro now?" },
  ];
  const [shown, setShown] = useS(0);
  const [ref, seen] = useInView({ threshold: 0.4 });
  useE(() => {
    if (!seen) return;
    if (shown >= msgs.length) return;
    const id = setTimeout(() => setShown(s => s + 1), shown === 0 ? 300 : 850);
    return () => clearTimeout(id);
  }, [seen, shown]);
  return (
    <div ref={ref}>
    <Win title="focuznow · ai coach" w={w}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 280 }}>
        {msgs.slice(0, shown).map((m, i) => {
          if (m.role === 'tool') return (
            <div key={i} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'var(--violet-br)', padding: '8px 12px', borderRadius: 9, border: '1px solid rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.08)', fontFamily: 'var(--mono)' }}>
              <Icon name="zap" size={14} fill="var(--violet-br)" color="var(--violet-br)" /> {m.text}
            </div>
          );
          const me = m.role === 'user';
          return (
            <div key={i} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '82%', padding: '11px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.5,
              background: me ? 'rgba(255,255,255,0.06)' : 'linear-gradient(180deg, rgba(139,92,246,0.22), rgba(109,40,217,0.18))',
              border: '1px solid', borderColor: me ? 'var(--line)' : 'rgba(139,92,246,0.35)',
              borderBottomRightRadius: me ? 4 : 14, borderBottomLeftRadius: me ? 14 : 4 }}>
              {m.text}
            </div>
          );
        })}
        {shown < msgs.length && <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '11px 14px' }}>
          {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--muted)', animation: `blink 1s ${i*0.15}s infinite` }}></span>)}
        </div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '1px solid var(--line)' }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>Ask your coach anything…</div>
        <span className="icon-badge" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon name="sparkle" size={16} fill="var(--violet-br)" /></span>
      </div>
    </Win>
    </div>
  );
}

/* ============ HERO SCENE (layered floating panels — Hero B) ============ */
function HeroScene() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* main calendar-ish app behind */}
      <div className="f-panel" data-depth="0.4" style={{ top: 22, left: '2%', width: 'min(330px, 78%)', zIndex: 1, animation: 'float 8s ease-in-out infinite' }}>
        <BlocklistMock w={'100%'} />
      </div>
      <div className="f-panel" data-depth="0.9" style={{ top: 0, right: 0, width: 'min(250px,62%)', zIndex: 3, animation: 'floatB 7s ease-in-out infinite' }}>
        <div className="panel panel-edge" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 12, letterSpacing: '.1em', textTransform: 'uppercase' }}>Pomodoro</div>
          <PomodoroRing size={150} />
          <div style={{ display: 'flex', gap: 7, marginTop: 16 }}>
            <span className="chip" style={{ fontSize: 11 }}>25 · 5</span>
            <span className="chip" style={{ fontSize: 11, background: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.35)', color: 'var(--violet-br)' }}>Focus</span>
          </div>
        </div>
      </div>
      <div className="f-panel" data-depth="0.65" style={{ bottom: 0, right: '6%', width: 'min(290px,70%)', zIndex: 2, animation: 'floatB 9s ease-in-out infinite' }}>
        <div className="panel panel-edge" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 14 }}>May</span>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>2026</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
            {Array.from({ length: 21 }).map((_, i) => {
              const ev = { 3: '#8b5cf6', 4: '#34d399', 9: '#8b5cf6', 11: '#fbbf24', 12: '#34d399', 16: '#8b5cf6', 17: '#8b5cf6' };
              const c = ev[i];
              return <div key={i} style={{ aspectRatio: '1', borderRadius: 6, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c ? c + '2a' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: c ? c + '55' : 'var(--line)', color: c ? '#fff' : 'var(--muted)' }}>{i + 1}</div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Win, PomodoroRing, BlocklistMock, LockdownMock, YouTubeMock, CalendarMock, AICoachMock, HeroScene });
