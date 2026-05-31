// focuznow-sections.jsx — feature rows, scrolly lockdown, grid, stats, pricing

/* a standard alternating feature row */
function FeatureRow({ flip, eyebrow, icon, title, body, bullets, visual }) {
  return (
    <div className={'feature-row' + (flip ? ' flip' : '')}>
      <Reveal className="feature-copy" style={flip ? { order: 2 } : {}}>
        <div className="eyebrow"><Icon name={icon} size={15} /> &nbsp;{eyebrow}</div>
        <h3>{title}</h3>
        <p>{body}</p>
        {bullets && <ul className="feature-list">
          {bullets.map((b, i) => <li key={i}><Icon name="check" size={18} />{b}</li>)}
        </ul>}
      </Reveal>
      <Reveal delay={1} className="feature-visual">{visual}</Reveal>
    </div>
  );
}

/* ============ NUCLEAR LOCKDOWN — pinned scrolly ============ */
function LockdownScrolly() {
  const ref = React.useRef(null);
  const [p, setP] = React.useState(0);
  React.useEffect(() => {
    const onScroll = () => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress through the tall scrolly container
      const total = el.offsetHeight - vh;
      const passed = Math.min(Math.max(-r.top, 0), total);
      setP(total > 0 ? passed / total : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const steps = [
    { t: 'Pick your targets', d: 'Your blocklist only — or the entire internet. Every http and https URL you name goes dark.' },
    { t: 'Set the duration', d: 'Twenty minutes or a whole weekend. You decide the sentence before it begins.' },
    { t: 'Seal it shut', d: 'Hit start and the timer is locked. No edits, no pause, no “just five minutes.” Real commitment.' },
  ];
  const active = p < 0.4 ? 0 : p < 0.72 ? 1 : 2;

  return (
    <section ref={ref} className="scrolly" style={{ height: '280vh', background: 'var(--bg-2)' }}>
      <div className="scrolly-sticky">
        <div className="grid-bg grid-mask-top" style={{ opacity: 0.5 }}></div>
        <div className="horizon" style={{ top: '14%', opacity: 0.4 }}></div>
        <div className="wrap" style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
            <div>
              <div className="eyebrow"><Icon name="lock" size={15} /> &nbsp;Nuclear Lockdown</div>
              <h2 style={{ fontSize: 'clamp(34px,4vw,58px)', lineHeight: 1.02, margin: '18px 0 30px' }}>
                When you mean it,<br /><span className="grad-text">mean it.</span>
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {steps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, padding: '16px 0', opacity: active === i ? 1 : 0.32, transition: 'opacity .4s', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: active === i ? 'var(--violet-br)' : 'var(--muted)', marginTop: 2, transition: 'color .4s' }}>0{i + 1}</div>
                    <div>
                      <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 19, marginBottom: 5 }}>{s.t}</div>
                      <div style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.55, maxWidth: 380 }}>{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <LockdownMock progress={p} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ SECONDARY FEATURE GRID ============ */
function SecondaryGrid() {
  const items = [
    { icon: 'clock', t: 'Pomodoro', d: 'A fully customizable focus timer. Set your intervals, breaks, and long-break cadence — then lock in.' },
    { icon: 'flame', t: 'Habits', d: 'Build streaks that stick. Check in once a day and watch the chain grow longer than your excuses.' },
    { icon: 'chart', t: 'Statistics', d: 'See exactly where your time went on every site, every day — and scroll back through history.' },
    { icon: 'note', t: 'Scratches', d: 'Frictionless little notes. Spin up as many as you want, capture a thought, get back to work.' },
    { icon: 'settings', t: 'Settings', d: 'Themes, custom block messages, unblock challenges, a draggable site timer, and granular tracking.' },
    { icon: 'shield', t: 'Unblock Challenge', d: 'Make breaking focus deliberately annoying. Solve a challenge before any site unlocks early.' },
  ];
  return (
    <section style={{ padding: '100px 0' }}>
      <div className="wrap">
        <Reveal className="section-head" style={{ textAlign: 'center', margin: '0 auto 56px' }}>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>The rest of the suite</div>
          <h2>Everything else you need,<br />in the same tab.</h2>
        </Reveal>
        <div className="cardgrid">
          {items.map((it, i) => (
            <Reveal key={it.t} delay={(i % 3) + 1} className="minicard" as="div">
              <span className="icon-badge"><Icon name={it.icon} size={22} /></span>
              <h4>{it.t}</h4>
              <p>{it.d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ STATS BAND ============ */
function StatsBand() {
  return (
    <section style={{ padding: '40px 0' }}>
      <div className="wrap">
        <Reveal className="stats">
          <div><div className="num grad-text"><CountUp to={60} suffix="k+" /></div><div className="lbl">Focused minds</div></div>
          <div><div className="num grad-text"><CountUp to={4.2} decimals={1} suffix="h" /></div><div className="lbl">Saved per user / week</div></div>
          <div><div className="num grad-text"><CountUp to={11} suffix="" /></div><div className="lbl">Tools in one extension</div></div>
          <div><div className="num grad-text"><CountUp to={4.9} decimals={1} /></div><div className="lbl">Average rating</div></div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ PRICING ============ */
function Pricing() {
  const free = ['Blocklist & site blocking', 'Pomodoro timer', 'Habits & Scratches', 'Basic statistics (7 days)', 'Light & dark themes'];
  const pro = ['Everything in Free', 'Nuclear Lockdown', 'AI Coach (agentic)', 'Full calendar & scheduling links', 'YouTube Shorts & creator blocking', 'Unlimited history & exports', 'Unblock challenges & custom themes'];
  return (
    <section id="pricing" style={{ padding: '100px 0' }}>
      <div className="wrap">
        <Reveal className="section-head" style={{ textAlign: 'center', margin: '0 auto 50px' }}>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>Pricing</div>
          <h2>Start free. Go nuclear when ready.</h2>
          <p style={{ margin: '14px auto 0' }}>No account needed to start. Upgrade only when you want the heavy machinery.</p>
        </Reveal>
        <div className="pricing-grid">
          <Reveal className="price-card" as="div">
            <div style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 600 }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
              <span className="price-amt">$0</span><span style={{ color: 'var(--muted)', fontSize: 15 }}>forever</span>
            </div>
            <ul className="price-feats">{free.map(f => <li key={f}><Icon name="check" size={18} />{f}</li>)}</ul>
            <button className="btn" data-mag style={{ width: '100%', justifyContent: 'center' }}>Add to Chrome</button>
          </Reveal>
          <Reveal delay={1} className="price-card pro" as="div">
            <span className="badge-pop">Most popular</span>
            <div style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 600 }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
              <span className="price-amt">$5</span><span style={{ color: 'var(--muted)', fontSize: 15 }}>/ month</span>
            </div>
            <ul className="price-feats">{pro.map(f => <li key={f}><Icon name="check" size={18} />{f}</li>)}</ul>
            <button className="btn btn-primary" data-mag style={{ width: '100%', justifyContent: 'center' }}>Go Pro</button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { FeatureRow, LockdownScrolly, SecondaryGrid, StatsBand, Pricing });
