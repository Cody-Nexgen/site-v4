// SessionPanel.jsx — the large focus-session control on the Today view
const SessionPanel = ({ running, remainingSec, totalSec, onToggle, onReset }) => {
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');
  const pct = Math.max(0, Math.min(1, remainingSec / totalSec));
  const r = 92, c = 2 * Math.PI * r;

  return (
    <section className="session card-large">
      <div className="session-head">
        <span className="eyebrow">Current session</span>
        <span className="badge mono">{running ? 'RUNNING' : 'PAUSED'}</span>
      </div>
      <div className="session-body">
        <div className="session-ring">
          <svg viewBox="0 0 200 200" width="200" height="200">
            <circle cx="100" cy="100" r={r} stroke="var(--hairline)" strokeWidth="4" fill="none"/>
            <circle cx="100" cy="100" r={r} stroke="var(--primary)" strokeWidth="4" fill="none"
              strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
              transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 500ms linear' }}/>
          </svg>
          <div className="session-ring-text">
            <span className="t-display-xl mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</span>
            <span className="eyebrow" style={{ marginTop: 4 }}>session 2 of 4 · 25m work</span>
          </div>
        </div>
        <div className="session-meta">
          <h3 className="t-display-md" style={{ marginBottom: 8 }}>Draft Q3 review.</h3>
          <p className="t-body-md" style={{ color: 'var(--body)', marginBottom: 16 }}>
            Block list active. 6 sites paused until session ends.
          </p>
          <div className="session-controls">
            <button className="btn btn-primary" onClick={onToggle}>
              {running ? 'Pause' : 'Resume'}
            </button>
            <button className="btn btn-secondary" onClick={onReset}>End session</button>
          </div>
        </div>
      </div>
    </section>
  );
};

Object.assign(window, { SessionPanel });
