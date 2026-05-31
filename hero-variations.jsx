// hero-variations.jsx — three hero directions for Focuznow

function Nav({ variant }) {
  return (
    <div className="nav">
      <div className="wordmark"><span className="logo-dot"></span>focuznow</div>
      <div className="nav-links">
        <span>Features</span><span>How it works</span><span>Pricing</span><span>Changelog</span>
      </div>
      <div className="nav-cta">
        <button className="btn">Sign in</button>
        <button className="btn btn-primary">Add to Chrome</button>
      </div>
    </div>
  );
}

/* ============ A · FLOATING CONSOLE ============ */
function HeroA() {
  return (
    <div className="hero">
      <div className="glow" style={{ width: 720, height: 720, background: 'rgba(109,40,217,0.35)', top: -260, left: '50%', transform: 'translateX(-50%)' }}></div>
      <div className="glow" style={{ width: 460, height: 460, background: 'rgba(139,92,246,0.22)', bottom: -180, left: '8%' }}></div>
      {/* faint grid */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.035) 1px,transparent 1px)', backgroundSize:'58px 58px', maskImage:'radial-gradient(circle at 50% 30%, #000 35%, transparent 75%)' }}></div>
      <Nav />
      <div style={{ position:'relative', zIndex:3, textAlign:'center', marginTop: 54, padding:'0 40px' }}>
        <div className="chip" style={{ marginBottom: 26 }}><span className="dotg"></span>v2.4 — now with AI Coach</div>
        <h1 className="hero-display" style={{ fontSize: 86, lineHeight: 0.98, letterSpacing:'-0.035em', fontWeight: 700, margin:'0 0 22px' }}>
          Get back <span className="grad-text">your hours.</span>
        </h1>
        <p style={{ fontSize: 20, color:'var(--muted)', maxWidth: 600, margin:'0 auto 34px', lineHeight: 1.5 }}>
          The all-in-one focus suite for your browser. Block the noise, build the habits, and finally do the work that matters.
        </p>
        <div style={{ display:'flex', gap: 14, justifyContent:'center' }}>
          <button className="btn btn-primary" style={{ fontSize: 16, padding:'14px 26px' }}>Add to Chrome — Free</button>
          <button className="btn" style={{ fontSize: 16, padding:'14px 26px' }}>Watch the film ▸</button>
        </div>
      </div>
      {/* floating console */}
      <div style={{ position:'absolute', left:'50%', bottom: -70, transform:'translateX(-50%) perspective(1600px) rotateX(26deg)', transformOrigin:'center top', width: 1040, animation:'float 7s ease-in-out infinite' }}>
        <div className="panel" style={{ padding: 18, borderRadius: 22, boxShadow:'0 40px 120px rgba(109,40,217,0.35)' }}>
          <div style={{ display:'flex', gap: 14 }}>
            <div style={{ width: 230, display:'flex', flexDirection:'column', gap: 10 }}>
              <div style={{ display:'flex', gap:7, marginBottom:4 }}>
                <span style={{width:11,height:11,borderRadius:99,background:'#ff5f57'}}></span>
                <span style={{width:11,height:11,borderRadius:99,background:'#febc2e'}}></span>
                <span style={{width:11,height:11,borderRadius:99,background:'#28c840'}}></span>
              </div>
              {['Dashboard','Blocklist','Nuclear Lockdown','Pomodoro','Habits','Calendar','AI Coach'].map((t,i)=>(
                <div key={t} style={{ fontSize: 13.5, padding:'9px 12px', borderRadius:9, color: i===2?'#fff':'var(--muted)', background: i===2?'linear-gradient(100deg,var(--violet),var(--violet-deep))':'transparent', fontWeight: i===2?600:500 }}>{t}</div>
              ))}
            </div>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap: 14 }}>
              <div style={{ display:'flex', gap: 14 }}>
                {[['Focused today','4h 12m'],['Sites blocked','38'],['Streak','12 days']].map(([l,v])=>(
                  <div key={l} className="panel" style={{ flex:1, padding:'16px 18px', borderRadius:14, background:'rgba(255,255,255,0.025)' }}>
                    <div style={{ fontSize:12.5, color:'var(--muted)' }}>{l}</div>
                    <div className="hero-display" style={{ fontSize: 28, fontWeight:600, marginTop:6 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="panel" style={{ padding: 20, borderRadius:14, background:'rgba(255,255,255,0.025)', flex:1, position:'relative', overflow:'hidden' }}>
                <div style={{ fontSize: 13.5, fontWeight:600, marginBottom: 14 }}>Focus over time</div>
                <svg viewBox="0 0 600 150" style={{ width:'100%', height: 150 }}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(139,92,246,0.5)"/><stop offset="1" stopColor="rgba(139,92,246,0)"/></linearGradient></defs>
                  <path d="M0 120 C 80 100, 120 60, 200 70 S 340 30, 420 50 S 540 20, 600 30 L 600 150 L 0 150 Z" fill="url(#g)"/>
                  <path d="M0 120 C 80 100, 120 60, 200 70 S 340 30, 420 50 S 540 20, 600 30" fill="none" stroke="var(--violet-bright)" strokeWidth="2.5"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ B · CINEMATIC SPLIT ============ */
function HeroB() {
  return (
    <div className="hero">
      <div className="glow" style={{ width: 620, height: 620, background:'rgba(124,58,237,0.32)', top:-120, right:-120 }}></div>
      <div className="glow" style={{ width: 420, height: 420, background:'rgba(139,92,246,0.18)', bottom:-160, left:-100 }}></div>
      <Nav />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', alignItems:'center', height:'calc(100% - 92px)', padding:'0 48px 0 60px', gap: 30, position:'relative', zIndex:3 }}>
        <div>
          <div className="chip" style={{ marginBottom: 26 }}>★ 4.9 · 60,000+ focused minds</div>
          <h1 className="hero-display" style={{ fontSize: 78, lineHeight: 0.96, letterSpacing:'-0.035em', fontWeight:700, margin:'0 0 24px' }}>
            Your browser,<br/>finally <span className="grad-text">on your side.</span>
          </h1>
          <p style={{ fontSize: 19, color:'var(--muted)', maxWidth: 480, lineHeight:1.55, margin:'0 0 32px' }}>
            Blocklists, nuclear lockdown, habits, a calendar, and an AI coach — one extension that turns distraction into deep work.
          </p>
          <div style={{ display:'flex', gap:14, marginBottom: 26 }}>
            <button className="btn btn-primary" style={{ fontSize:16, padding:'14px 26px' }}>Add to Chrome — Free</button>
            <button className="btn" style={{ fontSize:16, padding:'14px 26px' }}>See pricing</button>
          </div>
          <div style={{ display:'flex', gap: 22, fontSize:13.5, color:'var(--muted)' }}>
            <span>✓ No account needed</span><span>✓ Works offline</span><span>✓ Private by default</span>
          </div>
        </div>
        {/* layered panels */}
        <div style={{ position:'relative', height: 560 }}>
          <div className="panel" style={{ position:'absolute', top: 40, right: 0, width: 300, padding: 22, borderRadius:18, transform:'rotate(4deg)', animation:'floatB 6s ease-in-out infinite', boxShadow:'0 30px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom: 14 }}>Pomodoro</div>
            <div style={{ display:'flex', justifyContent:'center' }}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="64" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"/>
                <circle cx="80" cy="80" r="64" fill="none" stroke="var(--violet-bright)" strokeWidth="10" strokeLinecap="round" strokeDasharray="402" strokeDashoffset="120" transform="rotate(-90 80 80)"/>
              </svg>
            </div>
            <div className="hero-display" style={{ textAlign:'center', fontSize:30, fontWeight:600, marginTop:-104, marginBottom: 74 }}>18:42</div>
          </div>
          <div className="panel" style={{ position:'absolute', top: 4, left: 0, width: 320, padding: 20, borderRadius:18, transform:'rotate(-3deg)', animation:'float 7s ease-in-out infinite', boxShadow:'0 30px 80px rgba(0,0,0,0.5)', zIndex:2 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 14 }}><span style={{ color:'var(--violet-bright)' }}>⛔</span><span style={{ fontWeight:600, fontSize:14 }}>Blocklist active</span></div>
            {['x.com','reddit.com','youtube.com/shorts','news.ycombinator.com'].map(s=>(
              <div key={s} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderTop:'1px solid var(--border)', fontSize:13.5 }}>
                <span style={{ color:'var(--muted)' }}>{s}</span><span style={{ fontSize:11, color:'#f87171' }}>blocked</span>
              </div>
            ))}
          </div>
          <div className="panel" style={{ position:'absolute', bottom: 0, right: 30, width: 340, padding: 20, borderRadius:18, transform:'rotate(2.5deg)', animation:'floatB 8s ease-in-out infinite', boxShadow:'0 30px 80px rgba(0,0,0,0.5)', zIndex:3 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 14 }}><span style={{ fontWeight:600, fontSize:14 }}>May</span><span style={{ fontSize:12, color:'var(--muted)' }}>2026</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
              {Array.from({length:21}).map((_,i)=>{
                const on = [3,4,9,10,11,16,17].includes(i);
                const v = [5,12,18].includes(i);
                return <div key={i} style={{ aspectRatio:'1', borderRadius:7, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', color: on?'#fff':'var(--muted)', background: v?'linear-gradient(140deg,var(--violet),var(--violet-deep))':on?'rgba(139,92,246,0.18)':'transparent' }}>{i+1}</div>;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ C · THE LOCKDOWN ============ */
function HeroC() {
  return (
    <div className="hero" style={{ background:'radial-gradient(ellipse at 50% 12%, #16101f 0%, #07070b 60%)' }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(139,92,246,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,0.06) 1px,transparent 1px)', backgroundSize:'42px 42px', maskImage:'radial-gradient(circle at 50% 60%, #000 10%, transparent 70%)' }}></div>
      <Nav />
      <div style={{ position:'relative', zIndex:3, textAlign:'center', marginTop: 30 }}>
        <div className="chip" style={{ marginBottom: 22, borderColor:'rgba(248,113,113,0.4)', color:'#fca5a5' }}>◉ NUCLEAR LOCKDOWN</div>
        <h1 className="hero-display" style={{ fontSize: 72, lineHeight:0.98, letterSpacing:'-0.035em', fontWeight:700, margin:'0 0 16px' }}>
          When you mean it,<br/><span className="grad-text">mean it.</span>
        </h1>
      </div>
      {/* central lock orb */}
      <div style={{ position:'absolute', left:'50%', top:'56%', transform:'translate(-50%,-50%)', width: 360, height: 360 }}>
        <div className="glow" style={{ inset:-40, width:440, height:440, background:'rgba(124,58,237,0.45)', animation:'pulse 4s ease-in-out infinite' }}></div>
        <svg width="360" height="360" viewBox="0 0 360 360" style={{ position:'relative' }}>
          <circle cx="180" cy="180" r="150" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2"/>
          <circle cx="180" cy="180" r="120" fill="none" stroke="rgba(139,92,246,0.25)" strokeWidth="2" strokeDasharray="6 10"/>
          <circle cx="180" cy="180" r="150" fill="none" stroke="var(--violet-bright)" strokeWidth="4" strokeLinecap="round" strokeDasharray="760" style={{ animation:'ring 5s ease-in-out infinite alternate' }} transform="rotate(-90 180 180)"/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize: 44 }}>🔒</div>
          <div className="hero-display" style={{ fontSize: 52, fontWeight:600, letterSpacing:'-0.02em', marginTop: 8 }}>02:14:30</div>
          <div style={{ fontSize: 13.5, color:'var(--muted)', marginTop: 4 }}>locked · cannot be undone</div>
        </div>
      </div>
      <div style={{ position:'absolute', bottom: 60, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap: 18, zIndex:4 }}>
        <p style={{ fontSize: 18, color:'var(--muted)', maxWidth: 540, textAlign:'center', margin:0, lineHeight:1.5 }}>
          Seal away the entire internet — or just your weak spots — for a set time. No off switch. The most serious focus mode ever built.
        </p>
        <div style={{ display:'flex', gap:14 }}>
          <button className="btn btn-primary" style={{ fontSize:16, padding:'14px 26px' }}>Add to Chrome — Free</button>
          <button className="btn" style={{ fontSize:16, padding:'14px 26px' }}>Explore the suite</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HeroA, HeroB, HeroC });
