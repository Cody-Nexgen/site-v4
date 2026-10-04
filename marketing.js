const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');
const clock = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;

/* Header + reveal */
const header = $('.site-header');
const onScroll = () => header?.classList.toggle('scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
if (!reducedMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  $$('.rv').forEach((el) => io.observe(el));
} else {
  $$('.rv').forEach((el) => el.classList.add('in'));
}

/* ---------- Motion scenes ---------- */
const sceneScripts = {};
const startScene = (root, script) => {
  let timers = [];
  let loops = [];
  const el = (name) => root.querySelector(`[data-el="${name}"]`);
  const cursor = root.querySelector('.cursor');
  const api = {
    el,
    at: (ms, fn) => timers.push(setTimeout(fn, ms)),
    every: (ms, fn) => { const id = setInterval(fn, ms); loops.push(id); return id; },
    stop: (id) => clearInterval(id),
    point(target, ox = 0.5, oy = 0.5) {
      const r = root.getBoundingClientRect();
      const t = (typeof target === 'string' ? el(target) : target).getBoundingClientRect();
      return [t.left - r.left + t.width * ox, t.top - r.top + t.height * oy];
    },
    move(target, ox, oy) {
      if (!cursor) return;
      const [x, y] = api.point(target, ox, oy);
      cursor.style.setProperty('--cx', `${x}px`);
      cursor.style.setProperty('--cy', `${y}px`);
    },
    park(x = 0.82, y = 1.1) {
      if (!cursor) return;
      cursor.style.setProperty('--cx', `${root.clientWidth * x}px`);
      cursor.style.setProperty('--cy', `${root.clientHeight * y}px`);
    },
    click(fn) {
      cursor?.classList.remove('click');
      void cursor?.offsetWidth;
      cursor?.classList.add('click');
      fn?.();
    },
    type(target, text, speed = 45, done) {
      const node = typeof target === 'string' ? el(target) : target;
      let i = 0;
      node.textContent = '';
      const id = api.every(speed, () => {
        i += 1;
        node.textContent = text.slice(0, i);
        if (i >= text.length) { api.stop(id); done?.(); }
      });
    },
  };
  const clear = () => { timers.forEach(clearTimeout); loops.forEach(clearInterval); timers = []; loops = []; };
  const play = () => { clear(); const length = script(api, root); timers.push(setTimeout(play, length)); };
  return { play, stop: clear };
};

sceneScripts.hero = (s) => {
  const ring = s.el('ring');
  const time = s.el('time');
  const btn = s.el('start');
  const state = s.el('state');
  const blocked = s.el('blocked');
  const toast = s.el('toast');
  const task = s.el('task');
  let left = 50 * 60;
  let count = 12;
  ring.style.setProperty('--p', 0); time.textContent = clock(left); btn.classList.remove('running');
  s.el('startLabel').textContent = 'Start session'; state.textContent = 'Ready'; state.classList.remove('live');
  blocked.textContent = count; toast.classList.remove('show'); task.classList.remove('done', 'hl');
  s.park(0.7, 1.15);
  const bumpBlocked = () => { count += 1; blocked.textContent = count; blocked.classList.remove('bump'); void blocked.offsetWidth; blocked.classList.add('bump'); };
  const showToast = (site, fav) => { s.el('toastSite').textContent = `${site} blocked`; s.el('toastFav').className = `fav ${fav}`; toast.classList.add('show'); bumpBlocked(); };
  s.at(500, () => s.move('start', 0.3, 0.6));
  s.at(1500, () => s.click(() => {
    btn.classList.add('running'); s.el('startLabel').textContent = 'Pause'; state.textContent = 'Deep work'; state.classList.add('live');
    s.every(90, () => { left = Math.max(0, left - 6); time.textContent = clock(left); ring.style.setProperty('--p', 1 - left / 3000); });
  }));
  s.at(2300, () => s.park(0.62, 1.15));
  s.at(3300, () => showToast('youtube.com/shorts', 'yt'));
  s.at(5600, () => toast.classList.remove('show'));
  s.at(6200, () => { task.classList.add('hl'); s.move('task', 0.08, 0.5); });
  s.at(7100, () => s.click(() => task.classList.add('done')));
  s.at(7600, () => { task.classList.remove('hl'); s.park(0.75, 1.15); });
  s.at(8400, () => showToast('instagram.com/reels', 'ig'));
  s.at(10700, () => toast.classList.remove('show'));
  return 12000;
};

sceneScripts.block = (s) => {
  const shorts = s.el('shorts');
  const hidden = s.el('hidden');
  const page = s.el('page');
  const popup = s.el('popup');
  const sw = s.el('sw');
  const url = s.el('url');
  const urlText = s.el('urlText');
  shorts.classList.remove('gone'); hidden.classList.remove('show'); page.classList.remove('show');
  popup.classList.add('hide'); sw.classList.remove('on'); urlText.textContent = 'youtube.com'; url.classList.remove('typing'); s.el('ext').classList.remove('on');
  s.park(0.5, 1.15);
  s.at(500, () => s.move('ext'));
  s.at(1400, () => s.click(() => { popup.classList.remove('hide'); s.el('ext').classList.add('on'); }));
  s.at(2000, () => s.move('sw'));
  s.at(2900, () => s.click(() => sw.classList.add('on')));
  s.at(3300, () => { shorts.classList.add('gone'); hidden.classList.add('show'); });
  s.at(4400, () => { popup.classList.add('hide'); s.el('ext').classList.remove('on'); s.move('url', 0.35, 0.5); });
  s.at(5400, () => s.click(() => { url.classList.add('typing'); urlText.textContent = ''; }));
  s.at(5700, () => s.type(urlText, 'reddit.com', 70));
  s.at(6800, () => { url.classList.remove('typing'); page.classList.add('show'); s.park(0.6, 1.15); });
  return 11500;
};

sceneScripts.focus = (s) => {
  const ring = s.el('ring');
  const time = s.el('time');
  const btn = s.el('btn');
  const caret = s.el('caret');
  let left = 50 * 60;
  ring.style.setProperty('--p', 0); time.textContent = clock(left); btn.classList.remove('running'); btn.lastChild.textContent = 'Start';
  s.el('plan').textContent = ''; caret.hidden = false; s.el('state').textContent = 'Ready';
  ['l1', 'l2', 'l3'].forEach((n) => { s.el(n).textContent = ''; });
  s.el('blocked').textContent = '0'; s.el('saved').textContent = '0';
  s.park(0.3, 1.15);
  s.at(300, () => s.type('plan', 'Write the launch post', 55));
  s.at(1800, () => { caret.hidden = true; s.move('btn'); });
  s.at(2700, () => s.click(() => {
    btn.classList.add('running'); btn.lastChild.textContent = 'Pause'; s.el('state').textContent = 'Deep work';
    s.every(100, () => { left = Math.max(0, left - 9); time.textContent = clock(left); ring.style.setProperty('--p', 1 - left / 3000); });
  }));
  s.at(3300, () => s.move('l1', 0.1, 0.5));
  s.at(4000, () => s.type('l1', 'Email Sam about the deck', 40, () => { s.el('saved').textContent = '1'; }));
  s.at(5600, () => { s.el('blocked').textContent = '1'; });
  s.at(6200, () => s.type('l2', 'Check pricing copy after this', 40, () => { s.el('saved').textContent = '2'; }));
  s.at(8000, () => { s.el('blocked').textContent = '2'; });
  s.at(8600, () => s.type('l3', 'No Slack until 11', 40, () => { s.el('saved').textContent = '3'; }));
  s.at(9800, () => s.park(0.3, 1.15));
  return 12500;
};

sceneScripts.plan = (s, root) => {
  const task = s.el('task');
  const ghost = s.el('ghost');
  const drop = s.el('drop');
  const placeGhost = (target) => {
    const [x, y] = s.point(target, 0, 0);
    ghost.style.setProperty('--gx', `${x}px`);
    ghost.style.setProperty('--gy', `${y}px`);
  };
  ghost.style.transition = 'none'; placeGhost(task); void ghost.offsetWidth; ghost.style.transition = '';
  ghost.classList.remove('show'); task.classList.remove('lift'); drop.classList.remove('hint', 'placed'); s.el('when').textContent = '50m';
  s.park(0.6, 1.15);
  s.at(500, () => s.move(task, 0.25, 0.5));
  s.at(1400, () => s.click(() => { ghost.classList.add('show'); task.classList.add('lift'); drop.classList.add('hint'); }));
  s.at(1700, () => {
    const [tx, ty] = s.point(task, 0.25, 0.5);
    const [gx, gy] = s.point(task, 0, 0);
    const [dx, dy] = s.point(drop, 0, 0);
    ghost.style.setProperty('--gx', `${dx}px`); ghost.style.setProperty('--gy', `${dy}px`);
    const cursor = root.querySelector('.cursor');
    cursor.style.setProperty('--cx', `${dx + (tx - gx)}px`); cursor.style.setProperty('--cy', `${dy + (ty - gy)}px`);
  });
  s.at(2800, () => s.click(() => { ghost.classList.remove('show'); drop.classList.remove('hint'); drop.classList.add('placed'); task.classList.remove('lift'); s.el('when').textContent = 'Tue 9:00'; }));
  s.at(3600, () => s.park(0.6, 1.15));
  return 8000;
};

sceneScripts.insights = (s, root) => {
  root.querySelector('.ins').classList.remove('grow');
  const q = s.el('q');
  const a = s.el('a');
  q.classList.remove('show'); a.classList.remove('show'); s.el('aText').textContent = '';
  s.at(300, () => root.querySelector('.ins').classList.add('grow'));
  s.at(2200, () => q.classList.add('show'));
  s.at(3000, () => { a.classList.add('show'); s.type('aText', 'Your best focus is 9–11 AM, and YouTube took 1h 12m after lunch. Protect the morning with a 90-minute block and schedule Shorts off until 3.', 22); });
  return 11000;
};

sceneScripts.forest = (s, root) => {
  const trees = $$('.tr', root);
  let n = 0;
  trees.forEach((t) => t.classList.remove('up'));
  s.el('tip').classList.remove('show');
  s.el('count').textContent = '0';
  trees.forEach((t, i) => s.at(400 + i * 420, () => { t.classList.add('up'); n += 1; s.el('count').textContent = String(n); }));
  s.at(400 + trees.length * 420 + 200, () => s.el('tip').classList.add('show'));
  return 400 + trees.length * 420 + 3600;
};

sceneScripts.room = (s, root) => {
  const seats = $$('.seat', root);
  const you = s.el('you');
  const join = s.el('join');
  seats.forEach((seat, i) => seat.classList.toggle('in', i < 2));
  join.textContent = 'Join'; join.classList.add('ab-primary'); s.el('count').textContent = '2 focusing';
  s.park(0.7, 1.15);
  s.at(900, () => { seats[2].classList.add('in'); s.el('count').textContent = '3 focusing'; });
  s.at(1800, () => s.move(join));
  s.at(2700, () => s.click(() => { you.classList.add('in'); join.textContent = 'Leave'; join.classList.remove('ab-primary'); s.el('count').textContent = '4 focusing'; }));
  s.at(3400, () => s.park(0.7, 1.15));
  s.at(4600, () => { seats[4].classList.add('in'); s.el('count').textContent = '5 focusing'; });
  return 9000;
};

const scenes = $$('[data-scene]').map((root) => {
  const script = sceneScripts[root.dataset.scene];
  return script ? { root, scene: startScene(root, (api) => script(api, root)), playing: false } : null;
}).filter(Boolean);

if (!reducedMotion && scenes.length) {
  const sceneObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    const item = scenes.find((x) => x.root === entry.target);
    if (!item) return;
    if (entry.isIntersecting && !item.playing) { item.playing = true; item.scene.play(); }
    else if (!entry.isIntersecting && item.playing) { item.playing = false; item.scene.stop(); }
  }), { threshold: 0.35 });
  scenes.forEach((x) => sceneObserver.observe(x.root));
  document.addEventListener('visibilitychange', () => scenes.forEach((x) => {
    if (document.hidden && x.playing) { x.playing = false; x.scene.stop(); }
  }));
} else {
  $$('.ins').forEach((el) => el.classList.add('grow'));
  $$('.tr').forEach((el) => el.classList.add('up'));
}

/* ---------- Command menu ---------- */
const dialog = $('.command-dialog');
const search = $('#command-search');
const results = $$('.dialog-result');
const empty = $('.empty-command');
let lastFocus = null;
const visibleResults = () => results.filter((r) => !r.hidden);
const setActive = (target) => results.forEach((r) => r.classList.toggle('active', r === target));
function filterResults() {
  const query = search.value.trim().toLowerCase();
  results.forEach((r) => { r.hidden = Boolean(query) && !`${r.textContent} ${r.dataset.keywords}`.toLowerCase().includes(query); });
  $$('.dialog-body small').forEach((label) => {
    let next = label.nextElementSibling;
    let any = false;
    while (next && next.tagName !== 'SMALL') { if (next.matches('.dialog-result') && !next.hidden) any = true; next = next.nextElementSibling; }
    label.hidden = !any;
  });
  const visible = visibleResults();
  if (empty) empty.hidden = visible.length > 0;
  setActive(visible[0]);
}
const openCommand = () => {
  if (!dialog) return;
  lastFocus = document.activeElement;
  dialog.hidden = false;
  search.value = '';
  filterResults();
  requestAnimationFrame(() => search.focus());
};
const closeCommand = () => {
  if (!dialog || dialog.hidden) return;
  dialog.hidden = true;
  lastFocus?.focus?.();
};
const runCommand = (result) => {
  const command = result?.dataset.cmd;
  if (!command) return;
  closeCommand();
  if (command === 'coach') { window.openFocuzCoach?.(); return; }
  if (command.startsWith('#')) {
    const target = $(command);
    if (target) target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    else location.assign(`/${command}`);
    return;
  }
  location.assign(command);
};
$$('[data-open-command]').forEach((b) => b.addEventListener('click', openCommand));
$$('[data-close-command]').forEach((b) => b.addEventListener('click', closeCommand));
search?.addEventListener('input', filterResults);
results.forEach((r) => {
  r.addEventListener('click', () => runCommand(r));
  r.addEventListener('pointermove', () => setActive(r));
});
addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (dialog?.hidden) openCommand(); else closeCommand();
    return;
  }
  if (!dialog || dialog.hidden) return;
  if (event.key === 'Escape') { closeCommand(); return; }
  const visible = visibleResults();
  const current = visible.findIndex((r) => r.classList.contains('active'));
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const next = visible[(current + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length];
    setActive(next);
    next?.scrollIntoView({ block: 'nearest' });
  } else if (event.key === 'Enter' && document.activeElement === search) {
    event.preventDefault();
    runCommand(visible[current]);
  } else if (event.key === 'Tab') {
    event.preventDefault();
    search.focus();
  }
});

/* FAQ: one open at a time */
$$('.faq details').forEach((item) => item.addEventListener('toggle', () => {
  if (!item.open) return;
  $$('.faq details').forEach((other) => { if (other !== item) other.open = false; });
}));

/* Features page: highlight category in view */
const fxLinks = $$('.fx-nav a');
if (fxLinks.length && 'IntersectionObserver' in window) {
  const groupObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) fxLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${entry.target.id}`));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('.fx-group').forEach((g) => groupObserver.observe(g));
}
