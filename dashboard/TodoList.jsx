// TodoList.jsx — today's to-do card
const TodoList = () => {
  const [items, setItems] = React.useState([
    { id: 1, t: 'Draft Q3 review',          tag: '~25m', done: false, src: 'notion' },
    { id: 2, t: 'Reply to design feedback', tag: '~10m', done: false },
    { id: 3, t: 'Triage inbox',             tag: '~15m', done: true  },
    { id: 4, t: 'Plan tomorrow',            tag: '~5m',  done: false },
  ]);
  const toggle = (id) => setItems(xs => xs.map(x => x.id === id ? { ...x, done: !x.done } : x));

  return (
    <section className="card">
      <div className="card-head">
        <h4 className="t-display-sm">Today</h4>
        <span className="eyebrow">{items.filter(i => !i.done).length} left</span>
      </div>
      <div className="todo-list">
        {items.map(i => (
          <div className="todo-row" key={i.id} onClick={() => toggle(i.id)}>
            <button className={`rcheck ${i.done ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); toggle(i.id); }}>
              {i.done && <i data-lucide="check" style={{ width: 12, height: 12 }}></i>}
            </button>
            <span className="todo-title" style={{ textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--mute)' : 'var(--ink)' }}>{i.t}</span>
            {i.src && <span className="todo-src"><i data-lucide="database" style={{ width: 11, height: 11 }}></i> notion</span>}
            <span className="todo-tag mono">{i.tag}</span>
          </div>
        ))}
      </div>
      <div className="card-foot">
        <input className="input input-sm" placeholder="Add a task…" style={{ flex: 1 }}/>
        <button className="btn btn-primary-sm">Add</button>
      </div>
    </section>
  );
};

Object.assign(window, { TodoList });
