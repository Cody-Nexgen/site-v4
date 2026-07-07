// StatTiles.jsx — three small stats cards under the session panel
const StatTile = ({ label, value, sub, trend }) => (
  <div className="stat-tile card">
    <div className="eyebrow">{label}</div>
    <div className="stat-value mono">{value}</div>
    {sub && <div className="stat-sub">
      {trend && <span className={`trend ${trend}`}>{trend === 'up' ? '▲' : '▼'}</span>}
      <span>{sub}</span>
    </div>}
  </div>
);

const StatTiles = () => (
  <div className="stat-row">
    <StatTile label="Today" value="1h 42m" sub="vs 1h 12m yesterday" trend="up"/>
    <StatTile label="This week" value="12h 04m" sub="vs 9h 47m last week" trend="up"/>
    <StatTile label="Streak" value="7 days" sub="best: 23 days"/>
    <StatTile label="Sites blocked" value="14" sub="last 7 days"/>
  </div>
);

Object.assign(window, { StatTile, StatTiles });
