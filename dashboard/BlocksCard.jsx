// BlocksCard.jsx — blocked-sites table
const BLOCKS = [
  { site: 'youtube.com', mode: 'while focusing', visits: 0,  time: '0m' },
  { site: 'twitter.com', mode: 'always',         visits: 0,  time: '0m' },
  { site: 'reddit.com',  mode: 'scheduled',      visits: 2,  time: '4m' },
  { site: 'news.ycombinator.com', mode: 'while focusing', visits: 0, time: '0m' },
  { site: 'instagram.com', mode: 'always',       visits: 0,  time: '0m' },
];

const BlocksCard = () => (
  <section className="card">
    <div className="card-head">
      <h4 className="t-display-sm">Block list</h4>
      <button className="btn btn-secondary-sm">Add site</button>
    </div>
    <table className="dtable">
      <thead>
        <tr><th>Site</th><th>Mode</th><th>Attempts</th><th>Time saved</th></tr>
      </thead>
      <tbody>
        {BLOCKS.map((b, i) => (
          <tr key={i}>
            <td><span className="favicon"><i data-lucide="globe" style={{ width: 12, height: 12 }}></i></span>{b.site}</td>
            <td><span className="badge">{b.mode}</span></td>
            <td className="mono num">{b.visits}</td>
            <td className="mono num">{b.time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

Object.assign(window, { BlocksCard });
