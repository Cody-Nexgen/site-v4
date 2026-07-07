// DashboardApp.jsx — top-level dashboard composition
const { useState, useEffect } = React;

const TopBar = () => (
  <header className="topbar">
    <div className="topbar-search">
      <i data-lucide="search" style={{ width: 14, height: 14, color: 'var(--mute)' }}></i>
      <input placeholder="Jump to a task, site, or note…"/>
      <span className="kbd mono">⌘K</span>
    </div>
    <div className="topbar-actions">
      <button className="btn btn-nav-ghost"><i data-lucide="zap" style={{ width: 12, height: 12 }}></i> Quick start</button>
      <button className="btn btn-nav">New session</button>
    </div>
  </header>
);

const DashboardApp = () => {
  const [active, setActive] = useState('today');
  const [running, setRunning] = useState(true);
  const [remaining, setRemaining] = useState(22 * 60 + 14);

  useEffect(() => {
    const t = setInterval(() => setRemaining(r => running && r > 0 ? r - 1 : r), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => { if (window.lucide) window.lucide.createIcons(); }, [active, running]);

  return (
    <div className="dash">
      <Sidebar active={active} onChange={setActive}/>
      <main className="dash-main">
        <TopBar/>
        <div className="dash-scroll">
          <div className="dash-head">
            <div>
              <h1 className="t-display-lg">Today.</h1>
              <p className="t-body-md" style={{ color: 'var(--body)', marginTop: 4 }}>Wednesday · 14 May</p>
            </div>
            <div className="tabbar">
              <button className="btn btn-tab" aria-current="true">All</button>
              <button className="btn btn-tab">Focus</button>
              <button className="btn btn-tab">Habits</button>
              <button className="btn btn-tab">Blocked</button>
            </div>
          </div>

          <SessionPanel
            running={running}
            remainingSec={remaining}
            totalSec={25 * 60}
            onToggle={() => setRunning(r => !r)}
            onReset={() => { setRunning(false); setRemaining(25 * 60); }}
          />

          <StatTiles/>

          <div className="dash-grid">
            <TodoList/>
            <HabitsCard/>
          </div>

          <BlocksCard/>
        </div>
      </main>
    </div>
  );
};

Object.assign(window, { DashboardApp, TopBar });
