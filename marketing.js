const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');
const formatClock = (seconds) => `${pad(Math.floor(seconds / 60))}:${pad(Math.floor(seconds % 60))}`;

/* Today label in the hero dashboard */
const todayLabel = $('[data-today]');
if (todayLabel) todayLabel.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/* Hero window tilt: flattens as you scroll */
const tiltWindow = $('[data-tilt]');
const header = $('.site-header');
let ticking = false;
const onScroll = () => {
  ticking = false;
  header?.classList.toggle('scrolled', scrollY > 12);
  if (tiltWindow && !reducedMotion) {
    const progress = Math.min(1, Math.max(0, scrollY / 520));
    tiltWindow.style.setProperty('--tilt', `${14 - progress * 14}deg`);
    tiltWindow.style.setProperty('--tilt-scale', String(0.96 + progress * 0.04));
  }
  updateScrub();
  updateTourProgress();
};
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

/* Scroll-scrubbed statement: words light up as the section passes */
const scrub = $('[data-scrub]');
let scrubWords = [];
if (scrub) {
  const wrapWords = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { fragment.append(part); return; }
          const word = document.createElement('span');
          word.className = 'w';
          word.textContent = part;
          fragment.append(word);
        });
        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        wrapWords(child);
      }
    });
  };
  wrapWords(scrub);
  scrubWords = $$('.w', scrub);
}
const chips = $$('.dchip');
function updateScrub() {
  if (!scrub) return;
  const rect = scrub.getBoundingClientRect();
  const start = innerHeight * 0.85;
  const end = innerHeight * 0.3;
  const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, (start - rect.top) / (start - end + rect.height * 0.6)));
  const lit = Math.round(progress * scrubWords.length);
  scrubWords.forEach((word, index) => word.classList.toggle('lit', index < lit));
  chips.forEach((chip, index) => chip.classList.toggle('struck', progress > 0.55 + index * 0.08));
}

/* Reveal-on-scroll */
const revealTargets = $$('.reveal-up, .bento-card, [data-bars]');
if (!reducedMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      if (entry.target.matches('[data-bars]')) entry.target.classList.add('grown');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
  $$('.steps .step, .bento .bento-card').forEach((el, i) => el.style.setProperty('--stagger', `${(i % 3) * 0.08}s`));
  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('in', 'grown'));
}

/* Bento spotlight follows the pointer */
$$('.bento-card').forEach((card) => card.addEventListener('pointermove', (event) => {
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
  card.style.setProperty('--my', `${event.clientY - rect.top}px`);
}));

/* Generic countdown helper */
const createTimer = ({ seconds, onTick, onDone }) => {
  let total = seconds;
  let remaining = seconds;
  let handle = null;
  const tick = () => {
    remaining = Math.max(0, remaining - 1);
    onTick(remaining, total);
    if (remaining === 0) { stop(); onDone?.(); }
  };
  const start = () => { if (handle) return; handle = setInterval(tick, 1000); };
  const stop = () => { clearInterval(handle); handle = null; };
  const reset = (next = total) => { stop(); total = next; remaining = next; onTick(remaining, total); };
  return { start, stop, reset, get running() { return Boolean(handle); } };
};

/* Hero dashboard focus session */
const heroButton = $('[data-hero-session]');
const heroTime = $('[data-hero-time]');
const heroRing = $('[data-hero-ring]');
const heroState = $('[data-hero-state]');
if (heroButton && heroTime && heroRing) {
  const heroTimer = createTimer({
    seconds: 25 * 60,
    onTick: (left, total) => { heroTime.textContent = formatClock(left); heroRing.style.setProperty('--p', String(1 - left / total)); },
    onDone: () => { heroState.textContent = 'Done'; },
  });
  heroButton.addEventListener('click', () => {
    const label = heroButton.querySelector('span');
    if (heroTimer.running) {
      heroTimer.stop();
      heroButton.classList.remove('running');
      label.textContent = 'Resume';
      heroState.textContent = 'Paused';
    } else {
      heroTimer.start();
      heroButton.classList.add('running');
      label.textContent = 'Pause';
      heroState.textContent = 'Focusing';
    }
  });
}

/* Animated counters */
$$('[data-count]').forEach((el) => {
  if (reducedMotion) return;
  const target = Number(el.dataset.count);
  const startTime = performance.now() + 900;
  const step = (now) => {
    const t = Math.min(1, Math.max(0, (now - startTime) / 1400));
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
});

/* ---------- Product tour ---------- */
const tabs = $$('[data-tab]');
const panels = $$('[data-panel]');
const tour = $('#tour');
const tourProgress = $('.tour-progress');
const activatePanel = (name, { focus = false } = {}) => {
  tabs.forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  panels.forEach((panel) => {
    const active = panel.dataset.panel === name;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
  if (name === 'insights') startInsights();
};
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activatePanel(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    activatePanel(tabs[(index + delta + tabs.length) % tabs.length].dataset.tab, { focus: true });
  });
});
function updateTourProgress() {
  if (!tour || !tourProgress) return;
  const rect = tour.getBoundingClientRect();
  const progress = Math.min(1, Math.max(0, (innerHeight * 0.6 - rect.top) / rect.height));
  tourProgress.style.setProperty('--tp', progress.toFixed(3));
}

/* Block: toggles + Nuclear Lockdown */
$$('[data-toggle]').forEach((button) => button.addEventListener('click', () => {
  button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
}));
const nuke = $('[data-nuke]');
if (nuke) {
  let minutes = 30;
  const live = $('[data-nuke-live]', nuke);
  const time = $('[data-nuke-time]', nuke);
  const go = $('[data-nuke-go]', nuke);
  $$('[data-nuke-min]', nuke).forEach((option) => option.addEventListener('click', () => {
    minutes = Number(option.dataset.nukeMin);
    $$('[data-nuke-min]', nuke).forEach((o) => o.setAttribute('aria-checked', String(o === option)));
  }));
  const nukeTimer = createTimer({
    seconds: minutes * 60,
    onTick: (left) => { time.textContent = formatClock(left); },
    onDone: () => { nuke.classList.remove('locked'); live.hidden = true; go.disabled = false; go.querySelector('span').textContent = 'Activate lockdown'; },
  });
  go.addEventListener('click', () => {
    if (nuke.classList.contains('locked')) return;
    nukeTimer.reset(minutes * 60);
    nukeTimer.start();
    nuke.classList.add('locked');
    live.hidden = false;
    go.disabled = true;
    go.querySelector('span').textContent = 'Locked — no overrides';
  });
}

/* Focus: session timer */
const focusTime = $('[data-focus-time]');
const focusRing = $('[data-focus-ring]');
const focusToggle = $('[data-focus-toggle]');
const focusLabel = $('[data-focus-label]');
const timerCard = $('.timer-card');
if (focusTime && focusToggle) {
  let length = 25;
  const focusTimer = createTimer({
    seconds: length * 60,
    onTick: (left, total) => { focusTime.textContent = formatClock(left); focusRing.style.setProperty('--p', String(1 - left / total)); },
    onDone: () => { focusLabel.textContent = 'Session complete — nice work'; timerCard.classList.remove('running'); focusToggle.querySelector('span').textContent = 'Start session'; },
  });
  focusToggle.addEventListener('click', () => {
    const label = focusToggle.querySelector('span');
    if (focusTimer.running) {
      focusTimer.stop();
      timerCard.classList.remove('running');
      label.textContent = 'Resume';
      focusLabel.textContent = 'Paused';
    } else {
      focusTimer.start();
      timerCard.classList.add('running');
      label.textContent = 'Pause';
      focusLabel.textContent = 'Focusing · distractions blocked';
    }
  });
  $('[data-focus-reset]')?.addEventListener('click', () => {
    focusTimer.reset(length * 60);
    timerCard.classList.remove('running');
    focusToggle.querySelector('span').textContent = 'Start session';
    focusLabel.textContent = 'Ready when you are';
  });
  $$('[data-len]').forEach((option) => option.addEventListener('click', () => {
    length = Number(option.dataset.len);
    $$('[data-len]').forEach((o) => o.setAttribute('aria-checked', String(o === option)));
    focusTimer.reset(length * 60);
    timerCard.classList.remove('running');
    focusToggle.querySelector('span').textContent = 'Start session';
    focusLabel.textContent = 'Ready when you are';
  }));
}

/* Plan: tasks + scheduling */
const taskCount = $('[data-task-count]');
const updateTaskCount = () => {
  const tasks = $$('[data-task]');
  if (taskCount) taskCount.textContent = `${tasks.filter((t) => t.classList.contains('done')).length} of ${tasks.length} done`;
};
$$('[data-task]').forEach((task) => task.addEventListener('click', (event) => {
  const schedule = event.target.closest('[data-schedule]');
  if (schedule) {
    if (schedule.classList.contains('scheduled')) return;
    schedule.classList.add('scheduled');
    schedule.textContent = 'Tue 9:00 ✓';
    const event_ = $('[data-ev-new]');
    if (event_) event_.hidden = false;
    return;
  }
  task.classList.toggle('done');
  updateTaskCount();
}));

/* Insights: typewriter coach reply */
let insightsStarted = false;
function startInsights() {
  if (insightsStarted) return;
  insightsStarted = true;
  $('[data-bars]')?.classList.add('grown');
  const target = $('[data-typewrite]');
  if (!target || reducedMotion) return;
  const text = target.textContent;
  target.textContent = '';
  target.classList.add('typing');
  let i = 0;
  const type = () => {
    i += 2;
    target.textContent = text.slice(0, i);
    if (i < text.length) setTimeout(type, 18);
    else target.classList.remove('typing');
  };
  setTimeout(type, 450);
}

/* Progress: forest + habits */
const forest = $('[data-forest]');
const treeCount = $('[data-tree-count]');
const treeTypes = [
  { cls: '', c1: '#6ee7b7', c2: '#047857', w: 30, h: 44 },
  { cls: 'pine', c1: '#34d399', c2: '#065f46', w: 34, h: 58 },
  { cls: '', c1: '#fda4af', c2: '#be185d', w: 32, h: 48 },
  { cls: '', c1: '#bef264', c2: '#4d7c0f', w: 28, h: 40 },
  { cls: 'pine', c1: '#6ee7b7', c2: '#065f46', w: 30, h: 64 },
  { cls: '', c1: '#fcd34d', c2: '#b45309', w: 30, h: 42 },
  { cls: '', c1: '#a5b4fc', c2: '#4338ca', w: 26, h: 36 },
];
const plantTree = (index, delay = 0) => {
  if (!forest) return;
  const type = treeTypes[index % treeTypes.length];
  const tree = document.createElement('span');
  tree.className = `tree ${type.cls}`.trim();
  tree.style.cssText = `--c1:${type.c1};--c2:${type.c2};--tw:${type.w}px;--th:${type.h}px;--td:${delay}s`;
  tree.innerHTML = '<i></i><b></b>';
  forest.append(tree);
  const trees = forest.children;
  if (trees.length > 12) trees[0].remove();
};
for (let i = 0; i < 7; i += 1) plantTree(i, i * 0.06);
let planted = 7;
$('[data-plant]')?.addEventListener('click', () => {
  plantTree(planted);
  planted += 1;
  if (treeCount) treeCount.textContent = String(planted);
});
$$('[data-habit] button').forEach((button) => button.addEventListener('click', () => {
  const on = button.classList.toggle('on');
  button.setAttribute('aria-pressed', String(on));
}));

/* Together: join room */
const room = $('[data-room]');
if (room) {
  const join = $('[data-room-join]', room);
  const seat = $('[data-seat]', room);
  const status = $('[data-room-status]', room);
  join.addEventListener('click', () => {
    const joined = join.dataset.joined === 'true';
    join.dataset.joined = String(!joined);
    seat.classList.toggle('empty', joined);
    seat.style.setProperty('--h', '30');
    seat.textContent = joined ? '+' : 'YOU';
    join.textContent = joined ? 'Join room' : 'Leave room';
    join.classList.toggle('btn-primary', joined);
    join.classList.toggle('btn-ghost', !joined);
    status.textContent = joined ? '3 people working · 41 min left in this block' : 'You’re in · 4 people working quietly';
  });
}

/* ---------- Command menu ---------- */
const dialog = $('.command-dialog');
const search = $('#command-search');
const results = $$('.dialog-result');
const empty = $('.empty-command');
let lastFocus = null;
const visibleResults = () => results.filter((r) => !r.hidden);
const setActive = (target) => results.forEach((r) => r.classList.toggle('active', r === target));
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
  empty.hidden = visible.length > 0;
  setActive(visible[0]);
}
const runCommand = (result) => {
  const command = result?.dataset.cmd;
  if (!command) return;
  closeCommand();
  if (command.startsWith('tour:')) {
    if (!tour) { location.assign('/#tour'); return; }
    activatePanel(command.slice(5));
    tour.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  } else if (command === 'coach') {
    window.openFocuzCoach?.();
  } else if (command.startsWith('#')) {
    const target = $(command);
    if (target) target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    else location.assign(`/${command}`);
  } else {
    location.assign(command);
  }
};
$$('[data-open-command]').forEach((button) => button.addEventListener('click', openCommand));
$$('[data-close-command]').forEach((button) => button.addEventListener('click', closeCommand));
search?.addEventListener('input', filterResults);
results.forEach((result) => {
  result.addEventListener('click', () => runCommand(result));
  result.addEventListener('pointermove', () => setActive(result));
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

/* Features page: highlight the category in view */
const fxLinks = $$('.fx-nav a');
if (fxLinks.length && 'IntersectionObserver' in window) {
  const groupObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      fxLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('.fx-group').forEach((group) => groupObserver.observe(group));
}

onScroll();
