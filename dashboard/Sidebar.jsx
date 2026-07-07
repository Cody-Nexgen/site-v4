// Sidebar.jsx — left vertical nav for the dashboard
const SidebarItem = ({ icon, label, active, count }) => (
  <div className={`sb-item ${active ? 'is-active' : ''}`}>
    <i data-lucide={icon} className="sb-ic"></i>
    <span className="sb-label">{label}</span>
    {count !== undefined && <span className="sb-count mono">{count}</span>}
  </div>
);

const Sidebar = ({ active, onChange }) => {
  const items = [
    { id: 'today',   label: 'Today',     icon: 'circle-dot' },
    { id: 'todos',   label: 'To-do',     icon: 'list-checks', count: 4 },
    { id: 'habits',  label: 'Habits',    icon: 'flame' },
    { id: 'blocks',  label: 'Blocks',    icon: 'shield' },
    { id: 'stats',   label: 'Stats',     icon: 'bar-chart-3' },
    { id: 'notes',   label: 'Notes',     icon: 'notebook-text' },
  ];
  const integrations = [
    { id: 'notion',  label: 'Notion',    icon: 'database' },
    { id: 'calendar',label: 'Calendar',  icon: 'calendar' },
  ];

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <span className="logo-mark">
          <svg viewBox="0 0 32 32" fill="none" width="18" height="18"><circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2"/><circle cx="16" cy="3" r="3" fill="currentColor"/></svg>
          focuznow.
        </span>
      </div>
      <nav className="sb-nav">
        {items.map(i => (
          <div key={i.id} onClick={() => onChange(i.id)} style={{ cursor: 'pointer' }}>
            <SidebarItem {...i} active={active === i.id}/>
          </div>
        ))}
        <div className="sb-section">
          <span className="eyebrow">Integrations</span>
        </div>
        {integrations.map(i => (
          <div key={i.id}><SidebarItem {...i}/></div>
        ))}
      </nav>
      <div className="sb-foot">
        <div className="sb-user">
          <div className="avatar">AK</div>
          <div className="sb-user-meta">
            <span className="sb-user-name">Alex Kim</span>
            <span className="sb-user-plan mono">PRO</span>
          </div>
          <i data-lucide="chevrons-up-down" className="sb-user-chev"></i>
        </div>
      </div>
    </aside>
  );
};

Object.assign(window, { Sidebar, SidebarItem });
