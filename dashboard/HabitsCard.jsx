// HabitsCard.jsx — weekly habit grid
const HABITS = [
  { id: 1, name: 'Read 20 min',  streak: 14, days: [1,1,1,1,1,1,0] },
  { id: 2, name: 'Walk 30 min',  streak: 6,  days: [1,0,1,1,1,1,0] },
  { id: 3, name: 'Journal',      streak: 3,  days: [0,0,1,1,1,1,0] },
  { id: 4, name: 'No phone AM',  streak: 11, days: [1,1,1,1,1,0,0] },
];

const HabitsCard = () => (
  <section className="card">
    <div className="card-head">
      <h4 className="t-display-sm">Habits</h4>
      <span className="eyebrow">this week</span>
    </div>
    <div className="habit-grid">
      <div className="habit-grid-head">
        <span></span>
        {['M','T','W','T','F','S','S'].map((d,i) => <span key={i} className="hg-day mono">{d}</span>)}
        <span className="hg-streak mono">↗</span>
      </div>
      {HABITS.map(h => (
        <div className="habit-row" key={h.id}>
          <span className="habit-name">{h.name}</span>
          {h.days.map((d,i) => (
            <span key={i} className={`hg-cell ${d ? 'on' : 'off'}`}>{d ? '●' : ''}</span>
          ))}
          <span className="habit-streak mono">{h.streak}d</span>
        </div>
      ))}
    </div>
  </section>
);

Object.assign(window, { HabitsCard });
