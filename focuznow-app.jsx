// focuznow-app.jsx — cursor, magnetic FX, nav, hero, CTA, footer, mount
const { useState: uS, useEffect: uE, useRef: uR } = React;

/* cursor disabled */
function useCursor() {}

/* ---------------- nav ---------------- */
function Nav() {
  const [scrolled, setScrolled] = uS(false);
  uE(() => {
    const f = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', f, { passive: true }); f();
    return () => window.removeEventListener('scroll', f);
  }, []);
  return (
    <nav className={'nav' + (scrolled ? ' scrolled' : '')}>
      <div className="nav-inner">
        <div className="wordmark"><span className="logo-mark"></span>focuznow</div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#lockdown">Nuclear Lockdown</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#" className="btn btn-ghost" style={{ padding: '10px 14px' }}>Sign in</a>
          <a href="#" className="btn btn-primary" data-mag style={{ padding: '11px 18px' }}>Add to Chrome</a>
        </div>
      </div>
    </nav>
  );
}

/* ---------------- hero ---------------- */
function Hero() {
  const stageRef = uR(null);
  uE(() => {
    const el = stageRef.current; if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        el.querySelectorAll('.f-panel').forEach(p => {
          const d = parseFloat(p.dataset.depth || '0.5');
          p.style.transform = `translateY(${(-y * d * 0.12).toFixed(1)}px)`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <header className="hero">
      <div className="grid-bg grid-mask-top"></div>
      <div className="spotlight" style={{ top: -120, left: '50%', transform: 'translateX(-50%)', width: 900, height: 600 }}></div>
      <div className="wrap">
        <div className="hero-grid">
          <div>
            <Reveal><span className="chip"><span className="dot dot-g"></span>v2.4 — now with an AI Coach</span></Reveal>
            <Reveal delay={1}><h1 style={{ marginTop: 24 }}>Your browser,<br />finally <span className="grad-text">on your side.</span></h1></Reveal>
            <Reveal delay={2}><p className="hero-sub">Blocklists, nuclear lockdown, habits, a calendar, and an AI coach — one extension that turns endless distraction into deep, deliberate work.</p></Reveal>
            <Reveal delay={2} className="hero-cta">
              <a href="#" className="btn btn-primary btn-lg" data-mag><Icon name="globe" size={18} />Add to Chrome — Free</a>
              <a href="#features" className="btn btn-lg" data-mag>See the suite <Icon name="arrow" size={17} /></a>
            </Reveal>
            <Reveal delay={3} className="hero-proof">
              <span><Icon name="check" size={15} color="var(--violet-br)" />No account needed</span>
              <span><Icon name="check" size={15} color="var(--violet-br)" />Works offline</span>
              <span><Icon name="check" size={15} color="var(--violet-br)" />Private by default</span>
            </Reveal>
          </div>
          <div className="hero-stage" ref={stageRef}>
            <HeroScene />
          </div>
        </div>
        <Reveal delay={3} style={{ marginTop: 70, display: 'flex', alignItems: 'center', gap: 28, justifyContent: 'center', flexWrap: 'wrap', opacity: 0.7 }}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--mono)', letterSpacing: '.12em', textTransform: 'uppercase' }}>Trusted by focused people at</span>
          {['Northbeam', 'Vellum', 'Ardent Labs', 'Quanta', 'Mirable'].map(n => (
            <span key={n} style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 16, color: 'var(--text-2)' }}>{n}</span>
          ))}
        </Reveal>
      </div>
    </header>
  );
}

/* ---------------- features composition ---------------- */
function Features() {
  return (
    <section id="features" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <Reveal className="section-head">
          <div className="eyebrow">The toolkit</div>
          <h2>One extension.<br />Your whole focus stack.</h2>
          <p>Each tool is built to pull its weight on its own — together they become the operating system for your attention.</p>
        </Reveal>

        <div className="divider-fade"></div>

        <FeatureRow
          eyebrow="Blocklist" icon="ban"
          title="Block the noise in one click."
          body="Name any site and it goes quiet. Toggle distractions on and off instantly, group them, and let Focuznow stand guard the moment temptation strikes."
          bullets={['Unlimited sites, instant on/off toggles', 'Custom block message when you slip', 'Wildcards & path-level blocking']}
          visual={<BlocklistMock w={360} />}
        />

        <FeatureRow
          flip
          eyebrow="YouTube Blocking" icon="youtube"
          title="Keep YouTube. Lose the rabbit hole."
          body="You don't have to nuke the whole site to escape the spiral. Kill Shorts entirely and hide the specific creators that keep stealing your evenings."
          bullets={['One switch to remove the Shorts shelf', 'Hide individual channels & creators', 'Recommendations stay calm and on-topic']}
          visual={<YouTubeMock w={400} />}
        />

        <FeatureRow
          eyebrow="Calendar" icon="calendar"
          title="A calendar that bends to you."
          body="Create event groups, recolor everything, and set dates and times exactly how you think. Generate meeting links and share scheduling links so people book straight into your day."
          bullets={['Color-coded event groups', 'Built-in meeting links', 'Public scheduling links for bookings']}
          visual={<CalendarMock w={440} />}
        />

        <FeatureRow
          flip
          eyebrow="AI Coach" icon="bot"
          title="An agent that runs your settings for you."
          body="Tell your coach what's going wrong and it acts — editing blocklists, scheduling lockdowns, starting timers, and nudging you back on track. It can touch almost every setting in the suite."
          bullets={['Agentic — changes settings on your behalf', 'Coaches you through the rough afternoons', 'Always one message away']}
          visual={<AICoachMock w={440} />}
        />
      </div>

      <div id="lockdown"><LockdownScrolly /></div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
function FAQ() {
  const qs = [
    ['Is Focuznow really free?', 'Yes — the core suite (blocklist, Pomodoro, habits, scratches, basic stats) is free forever, no account required. Pro unlocks Nuclear Lockdown, the AI Coach, the full calendar, and unlimited history.'],
    ['Can I undo a Nuclear Lockdown?', 'No — that\'s the point. Once you seal a lockdown it runs until the timer ends. You set the terms before it starts; after that, there\'s no off switch.'],
    ['Is my data private?', 'Your tracking and stats live on your device by default. We don\'t sell your data, and most of the suite works completely offline.'],
    ['Which browsers are supported?', 'Focuznow is a browser extension for Chrome and Firefox, with the same feature set across both.'],
  ];
  const [open, setOpen] = uS(0);
  return (
    <section id="faq" style={{ padding: '100px 0' }}>
      <div className="wrap" style={{ maxWidth: 820 }}>
        <Reveal className="section-head" style={{ textAlign: 'center', margin: '0 auto 44px' }}>
          <div className="eyebrow" style={{ justifyContent: 'center' }}>FAQ</div>
          <h2>Good questions.</h2>
        </Reveal>
        {qs.map(([q, a], i) => (
          <Reveal key={i} as="div">
            <div data-mag onClick={() => setOpen(open === i ? -1 : i)} style={{ padding: '22px 4px', borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 19 }}>{q}</span>
                <span style={{ transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform .25s', color: 'var(--violet-br)', flexShrink: 0 }}><Icon name="plus" size={22} /></span>
              </div>
              <div style={{ maxHeight: open === i ? 200 : 0, overflow: 'hidden', transition: 'max-height .35s ease, margin .35s', marginTop: open === i ? 14 : 0 }}>
                <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 660 }}>{a}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- CTA ---------------- */
function CTABand() {
  return (
    <section className="cta-band">
      <div className="grid-bg" style={{ opacity: 0.5, maskImage: 'radial-gradient(80% 90% at 50% 50%, #000 20%, transparent 70%)', WebkitMaskImage: 'radial-gradient(80% 90% at 50% 50%, #000 20%, transparent 70%)' }}></div>
      <div className="spotlight" style={{ top: -60, left: '50%', transform: 'translateX(-50%)', width: 760, height: 460 }}></div>
      <div className="wrap" style={{ position: 'relative' }}>
        <Reveal><div className="eyebrow" style={{ justifyContent: 'center' }}>Get back your hours</div></Reveal>
        <Reveal delay={1}><h2 style={{ margin: '20px 0 26px' }}>Stop scrolling.<br />Start <span className="grad-text">doing.</span></h2></Reveal>
        <Reveal delay={2}><p style={{ fontSize: 19, color: 'var(--text-2)', maxWidth: 520, margin: '0 auto 34px', lineHeight: 1.55 }}>Install Focuznow in seconds and take the next afternoon back.</p></Reveal>
        <Reveal delay={2} style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#" className="btn btn-primary btn-lg" data-mag><Icon name="globe" size={18} />Add to Chrome — Free</a>
          <a href="#pricing" className="btn btn-lg" data-mag>Compare plans</a>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- footer ---------------- */
function Footer() {
  const cols = [
    ['Product', [['Features', '#features'], ['Nuclear Lockdown', '#lockdown'], ['Pricing', '#pricing'], ['Changelog', '#']]],
    ['Company', [['About', '#'], ['Blog', '#'], ['Careers', '#'], ['Contact', '#']]],
    ['Legal', [['Terms of Service', 'terms.html'], ['Privacy Policy', 'privacy.html'], ['Cookie Policy', '#']]],
  ];
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="wordmark" style={{ marginBottom: 16 }}><span className="logo-mark"></span>focuznow</div>
            <p style={{ fontSize: 14.5, color: 'var(--muted)', maxWidth: 280, lineHeight: 1.6 }}>The all-in-one focus suite for your browser. Get back your hours.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {['X', 'in', 'gh'].map(s => <span key={s} data-mag style={{ width: 36, height: 36, borderRadius: 9, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>{s}</span>)}
            </div>
          </div>
          {cols.map(([h, links]) => (
            <div key={h}>
              <h5>{h}</h5>
              <ul>{links.map(([l, href]) => <li key={l}><a href={href}>{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 Focuznow. All rights reserved.</span>
          <span style={{ display: 'flex', gap: 22 }}>
            <a href="terms.html" style={{ color: 'var(--muted)' }}>Terms</a>
            <a href="privacy.html" style={{ color: 'var(--muted)' }}>Privacy</a>
            <span>Made for people with better things to do.</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- app ---------------- */
function App() {
  useCursor();
  return (
    <>
      <Nav />
      <Hero />
      <StatsBand />
      <Features />
      <SecondaryGrid />
      <Pricing />
      <FAQ />
      <CTABand />
      <Footer />
      <ChatWidget />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
