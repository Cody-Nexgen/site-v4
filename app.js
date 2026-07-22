const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const header = $('.site-header');
const menuToggle = $('.menu-toggle');
const navLinks = $('#nav-links');
const focusToggle = $('#focus-toggle');
const appMain = $('.app-main');
const taskCount = $('#task-count');
const dialog = $('.command-dialog');
const commandSearch = $('#command-search');

// Adapted from nikdelvin/liquid-glass (MIT): a size-aware SVG displacement
// map is generated for every glass surface, then used as a backdrop filter.
const getLiquidDisplacementMap = ({ height, width, radius, depth }) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <style>.mix { mix-blend-mode: screen; }</style>
    <defs>
      <linearGradient id="Y" x1="0" x2="0" y1="${Math.ceil((radius / height) * 15)}%" y2="${Math.floor(100 - (radius / height) * 15)}%">
        <stop offset="0%" stop-color="#0F0"/><stop offset="100%" stop-color="#000"/>
      </linearGradient>
      <linearGradient id="X" x1="${Math.ceil((radius / width) * 15)}%" x2="${Math.floor(100 - (radius / width) * 15)}%" y1="0" y2="0">
        <stop offset="0%" stop-color="#F00"/><stop offset="100%" stop-color="#000"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="#808080"/>
    <g filter="blur(2px)">
      <rect width="${width}" height="${height}" fill="#000080"/>
      <rect width="${width}" height="${height}" fill="url(#Y)" class="mix"/>
      <rect width="${width}" height="${height}" fill="url(#X)" class="mix"/>
      <rect x="${depth}" y="${depth}" width="${width - 2 * depth}" height="${height - 2 * depth}" rx="${radius}" ry="${radius}" fill="#808080" filter="blur(${depth}px)"/>
    </g>
  </svg>`);

const getLiquidDisplacementFilter = ({ height, width, radius, depth, strength = 100, chromaticAberration = 0 }) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="displace" color-interpolation-filters="sRGB">
        <feImage width="${width}" height="${height}" href="${getLiquidDisplacementMap({ height, width, radius, depth })}" result="displacementMap"/>
        <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength + chromaticAberration * 2}" xChannelSelector="R" yChannelSelector="G"/>
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedR"/>
        <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength + chromaticAberration}" xChannelSelector="R" yChannelSelector="G"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedG"/>
        <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength}" xChannelSelector="R" yChannelSelector="G"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="displacedB"/>
        <feBlend in="displacedR" in2="displacedG" mode="screen"/><feBlend in2="displacedB" mode="screen"/>
      </filter>
    </defs>
  </svg>`) + '#displace';

const supportsBackdropFilterUrl = (() => {
  const test = document.createElement('div');
  test.style.cssText = 'backdrop-filter: url(#test)';
  return test.style.backdropFilter === 'url("#test")' || test.style.backdropFilter === 'url(#test)';
})();

const enhanceLiquidGlass = (element, options) => {
  if (!element || element.dataset.liquidGlass === 'ready') return;
  element.dataset.liquidGlass = 'ready';
  element.classList.add('liquid-glass');

  const filterLayer = document.createElement('span');
  filterLayer.className = 'lg-filter-layer';
  filterLayer.setAttribute('aria-hidden', 'true');
  const glassBox = document.createElement('span');
  glassBox.className = 'glass-box';
  glassBox.style.setProperty('--glass-tint', options.tint);
  filterLayer.appendChild(glassBox);
  element.prepend(filterLayer);

  let frame;
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (width < 2 || height < 2) return;
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
      const depth = Math.max(1, Math.min(options.depth, Math.floor(width / 3), Math.floor(height / 3)));
      if (supportsBackdropFilterUrl) {
        const filter = getLiquidDisplacementFilter({ width, height, radius, depth, strength: options.strength, chromaticAberration: options.cab });
        const value = `blur(${options.blur / 2}px) url('${filter}') blur(${options.blur}px) brightness(${options.brightness}) saturate(${options.saturate})`;
        glassBox.style.backdropFilter = value;
        element.dataset.liquidMode = 'displacement';
      } else {
        const fallback = `blur(${Math.max(12, width / 34)}px) brightness(${options.brightness}) saturate(${options.saturate})`;
        glassBox.style.webkitBackdropFilter = fallback;
        glassBox.style.backdropFilter = fallback;
        element.dataset.liquidMode = 'blur-fallback';
      }
    });
  };
  redraw();
  new ResizeObserver(redraw).observe(element);
};

const liquidSurfaces = [
  ['.real-sidebar', { depth: 14, strength: 74, cab: 2.8, blur: .55, brightness: 1.1, saturate: 1.65, tint: 'rgba(7, 8, 14, .075)' }],
  ['.real-main', { depth: 16, strength: 48, cab: 1.5, blur: .4, brightness: 1.05, saturate: 1.42, tint: 'rgba(6, 7, 13, .055)' }],
  ['.real-stat-grid article, .activity-card, .real-task-card, .habit-preview', { depth: 8, strength: 32, cab: 1.25, blur: .25, brightness: 1.06, saturate: 1.42, tint: 'rgba(8, 9, 16, .105)' }],
];
liquidSurfaces.forEach(([selector, options]) => $$(selector).forEach((element) => enhanceLiquidGlass(element, options)));

// Deterministic fallback for browsers that suspend discrete animation states.
setTimeout(() => $('.intro')?.classList.add('intro-complete'), reducedMotionSafe() ? 0 : 2150);

function reducedMotionSafe() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const updateHeader = () => header.classList.toggle('scrolled', scrollY > 20);
updateHeader();
addEventListener('scroll', updateHeader, { passive: true });

// The orbit mark is a single complete gesture: on exit, let the dot land at
// twelve instead of freezing midway around the ring.
$$('.brand, .real-account').forEach((container) => {
  const orbit = $('.brand-orbit svg, .real-extension-logo svg', container);
  if (!orbit || reducedMotionSafe()) return;
  let hovering = false;
  let settling = false;
  const start = () => {
    hovering = true;
    settling = false;
    orbit.classList.remove('orbit-finishing');
  };
  const finish = () => {
    hovering = false;
    settling = true;
    orbit.classList.add('orbit-finishing');
  };
  container.addEventListener('pointerenter', start);
  container.addEventListener('pointerleave', finish);
  container.addEventListener('focusin', start);
  container.addEventListener('focusout', finish);
  orbit.addEventListener('animationiteration', () => {
    if (settling && !hovering) {
      settling = false;
      orbit.classList.remove('orbit-finishing');
    }
  });
});

menuToggle?.addEventListener('click', () => {
  const next = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(next));
  navLinks.classList.toggle('open', next);
});

$$('.nav-links a').forEach((link) => link.addEventListener('click', () => {
  menuToggle?.setAttribute('aria-expanded', 'false');
  navLinks.classList.remove('open');
}));

focusToggle?.addEventListener('click', () => {
  const next = focusToggle.getAttribute('aria-checked') !== 'true';
  focusToggle.setAttribute('aria-checked', String(next));
  appMain.classList.toggle('focused', next);
});

$$('.task-check').forEach((button) => button.addEventListener('click', () => {
  const task = button.closest('.task');
  task.classList.toggle('completed');
  const remaining = $$('.task:not(.completed)').length + 1;
  taskCount.textContent = String(remaining);
  button.setAttribute('aria-label', task.classList.contains('completed') ? 'Mark task incomplete' : `Complete ${$('h3', task).textContent}`);
}));

$$('.day-strip button').forEach((button) => button.addEventListener('click', () => {
  $$('.day-strip button').forEach((day) => day.setAttribute('aria-selected', 'false'));
  button.setAttribute('aria-selected', 'true');
  const dayNumber = $('b', button).textContent;
  $('.date-label').textContent = `${button.dataset.day === 'M' ? 'MONDAY' : button.dataset.day === 'W' ? 'WEDNESDAY' : button.dataset.day === 'F' ? 'FRIDAY' : 'TUESDAY'}, JUNE ${dayNumber}`;
}));

$$('[data-app-view]').forEach((button) => button.addEventListener('click', () => {
  $$('[data-app-view]').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  const label = button.textContent.trim().replace(/\d+$/, '').trim();
  $('#view-label').textContent = label;
  const content = $('#app-content');
  content.animate([{ opacity: .2, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' });
}));

$('[data-add-task]')?.addEventListener('click', (event) => {
  const list = event.currentTarget.closest('.task-list');
  const task = document.createElement('article');
  task.className = 'task';
  task.setAttribute('data-task', '');
  task.innerHTML = '<button class="task-check" type="button" aria-label="Complete New task"><svg viewBox="0 0 16 16"><path d="m4 8 2.5 2.5L12 5"/></svg></button><div class="task-copy"><h3>New task</h3><p>Ready to define</p><div><span class="tag">Inbox</span><span>Today</span></div></div><div class="task-owner">NM</div>';
  list.appendChild(task);
  task.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.16,1,.3,1)' });
  taskCount.textContent = String(Number(taskCount.textContent) + 1);
  $('.task-check', task).addEventListener('click', () => {
    task.classList.toggle('completed');
  });
});

// Source-accurate product preview navigation.
const activateRealView = (view) => {
  $$('[data-real-view]').forEach((button) => {
    const active = button.dataset.realView === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $$('[data-real-screen]').forEach((screen) => screen.classList.toggle('active', screen.dataset.realScreen === view));
  const activeButton = $(`[data-real-view="${view}"]`);
  if ($('#real-view-label') && activeButton) $('#real-view-label').textContent = $('span', activeButton).textContent;
};
const realAccountButton = $('[data-real-account]');
const realAccountMenu = $('#real-account-menu');
$$('.real-nav-item, .real-section-toggle').forEach((button) => {
  if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', $('span', button)?.textContent.trim() || 'Navigation item');
});
realAccountButton?.setAttribute('aria-label', 'FocuzNow account');
$$('[data-real-view]').forEach((button) => button.addEventListener('click', () => activateRealView(button.dataset.realView)));

$$('.real-section-toggle').forEach((button) => button.addEventListener('click', () => {
  const next = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(next));
}));

const closeRealAccount = () => {
  realAccountButton?.setAttribute('aria-expanded', 'false');
  if (realAccountMenu) realAccountMenu.hidden = true;
};
realAccountButton?.addEventListener('click', () => {
  const next = realAccountButton.getAttribute('aria-expanded') !== 'true';
  realAccountButton.setAttribute('aria-expanded', String(next));
  realAccountMenu.hidden = !next;
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.real-account-wrap')) closeRealAccount();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && realAccountButton?.getAttribute('aria-expanded') === 'true') {
    closeRealAccount();
    realAccountButton.focus();
  }
});

$$('.real-task').forEach((task) => task.addEventListener('click', () => {
  task.classList.toggle('done');
  $('i', task).textContent = task.classList.contains('done') ? '✓' : '';
}));

$('[data-add-real-task]')?.addEventListener('click', (event) => {
  const task = document.createElement('button');
  task.type = 'button';
  task.className = 'real-task';
  task.innerHTML = '<i></i><span>New focus task</span>';
  event.currentTarget.closest('.real-task-card').appendChild(task);
  task.animate([{ opacity: 0, transform: 'translateY(-5px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' });
  task.addEventListener('click', () => {
    task.classList.toggle('done');
    $('i', task).textContent = task.classList.contains('done') ? '✓' : '';
  });
});

// Real product demo screen choreography.
const demoLabels = { session: 'FOCUS SESSIONS', block: 'SITE MANAGEMENT', calendar: 'CALENDAR' };
const activateDemo = (view) => {
  $$('[data-demo-tab]').forEach((button) => {
    const active = button.dataset.demoTab === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  $$('[data-demo-screen]').forEach((screen) => screen.classList.toggle('active', screen.dataset.demoScreen === view));
  const demoFrame = $('.source-demo-frame');
  demoFrame.dataset.demoActive = view;
  demoFrame.scrollTop = 0;
  $('#demo-screen-label').textContent = demoLabels[view];
};
$$('[data-demo-tab]').forEach((button) => button.addEventListener('click', () => activateDemo(button.dataset.demoTab)));

let demoTimerRunning = false;
const demoTimerTotal = 3000;
let demoTimerSeconds = demoTimerTotal;
let demoTimerInterval;
const renderDemoTimer = () => {
  const minutes = Math.floor(demoTimerSeconds / 60).toString().padStart(2, '0');
  const seconds = (demoTimerSeconds % 60).toString().padStart(2, '0');
  $('#demo-timer-value').textContent = `${minutes}:${seconds}`;
  $('.timer-progress').style.strokeDashoffset = String(396 * (1 - demoTimerSeconds / demoTimerTotal));
};
renderDemoTimer();
$('#demo-timer-toggle')?.addEventListener('click', (event) => {
  demoTimerRunning = !demoTimerRunning;
  $('i', event.currentTarget).textContent = demoTimerRunning ? 'Ⅱ' : '▶';
  $('span', event.currentTarget).textContent = demoTimerRunning ? 'Pause' : 'Start';
  event.currentTarget.classList.toggle('running', demoTimerRunning);
  clearInterval(demoTimerInterval);
  if (demoTimerRunning) {
    demoTimerInterval = setInterval(() => {
      demoTimerSeconds = Math.max(0, demoTimerSeconds - 1);
      renderDemoTimer();
      if (demoTimerSeconds === 0) clearInterval(demoTimerInterval);
    }, 1000);
  }
});

$$('.platform-blockers button').forEach((button) => button.addEventListener('click', () => {
  const next = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(next));
  button.classList.toggle('on', next);
}));

$$('.calendar-view-tabs button').forEach((button) => button.addEventListener('click', () => {
  $$('.calendar-view-tabs button').forEach((view) => {
    view.classList.remove('active');
    view.setAttribute('aria-pressed', 'false');
  });
  button.classList.add('active');
  button.setAttribute('aria-pressed', 'true');
  button.closest('.week-grid').dataset.calendarView = button.textContent.trim().toLowerCase();
}));

const lockdownButton = $('[data-lockdown-toggle]');
$$('.nuclear-card>div button').forEach((button) => button.addEventListener('click', () => {
  $$('.nuclear-card>div button').forEach((duration) => duration.classList.remove('active'));
  button.classList.add('active');
  if (lockdownButton?.getAttribute('aria-pressed') !== 'true') lockdownButton.textContent = `Activate ${button.textContent.trim()} lockdown`;
}));
lockdownButton?.addEventListener('click', () => {
  const next = lockdownButton.getAttribute('aria-pressed') !== 'true';
  const duration = $('.nuclear-card>div button.active')?.textContent.trim() || '30m';
  lockdownButton.setAttribute('aria-pressed', String(next));
  lockdownButton.textContent = next ? `Lockdown active · ${duration}` : `Activate ${duration} lockdown`;
});

const calendarLayout = $('.calendar-layout');
const calendarCollapse = $('.calendar-sidebar-top button');
calendarCollapse?.setAttribute('aria-expanded', 'true');
calendarCollapse?.addEventListener('click', () => {
  const next = calendarCollapse.getAttribute('aria-expanded') !== 'true';
  calendarCollapse.setAttribute('aria-expanded', String(next));
  calendarCollapse.setAttribute('aria-label', next ? 'Collapse calendar sidebar' : 'Expand calendar sidebar');
  calendarLayout.classList.toggle('sidebar-collapsed', !next);
});

const calendarToday = new Date(2026, 6, 20, 12);
let calendarAnchor = new Date(calendarToday);
const renderCalendarWeek = () => {
  const start = new Date(calendarAnchor);
  start.setDate(calendarAnchor.getDate() - calendarAnchor.getDay());
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarAnchor);
  $('#calendar-toolbar-date').textContent = monthLabel;
  $$('.week-head>span:not(.time-gutter)').forEach((cell, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    $('b', cell).textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date).toUpperCase();
    $('small', cell).textContent = String(date.getDate());
    const selected = date.toDateString() === calendarToday.toDateString();
    cell.classList.toggle('selected', selected);
  });
};
$$('[data-calendar-shift]').forEach((button) => button.addEventListener('click', () => {
  calendarAnchor.setDate(calendarAnchor.getDate() + Number(button.dataset.calendarShift) * 7);
  renderCalendarWeek();
}));
$('[data-calendar-today]')?.addEventListener('click', () => {
  calendarAnchor = new Date(calendarToday);
  renderCalendarWeek();
});
renderCalendarWeek();

// Reveal only when causally connected to scroll position.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle('in-view', entry.isIntersecting));
  }, { rootMargin: '-8% 0px -8%', threshold: .15 });
  $$('.reveal-on-scroll').forEach((element) => observer.observe(element));
} else {
  $$('.reveal-on-scroll').forEach((element) => element.classList.add('in-view'));
}

// Command menu is fully keyboard navigable.
const getVisibleResults = () => $$('.dialog-result', dialog).filter((result) => !result.hidden);
let activeResult = 0;
const setActiveResult = (next) => {
  const results = getVisibleResults();
  if (!results.length) return;
  activeResult = (next + results.length) % results.length;
  results.forEach((result, index) => result.classList.toggle('active', index === activeResult));
  results[activeResult].scrollIntoView({ block: 'nearest' });
};
const openCommand = () => {
  dialog.hidden = false;
  dialog.classList.remove('closing');
  document.body.style.overflow = 'hidden';
  commandSearch.value = '';
  $$('.dialog-result', dialog).forEach((result) => result.hidden = false);
  $('.empty-command', dialog).hidden = true;
  activeResult = 0;
  setActiveResult(0);
  requestAnimationFrame(() => commandSearch.focus());
};
const closeCommand = () => {
  if (dialog.hidden) return;
  dialog.classList.add('closing');
  document.body.style.overflow = '';
  setTimeout(() => { dialog.hidden = true; dialog.classList.remove('closing'); }, reducedMotion ? 0 : 220);
};
$$('[data-open-command]').forEach((button) => button.addEventListener('click', openCommand));
$('[data-close-command]')?.addEventListener('click', closeCommand);
addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    dialog.hidden ? openCommand() : closeCommand();
  }
  if (event.key === 'Escape' && !dialog.hidden) closeCommand();
  if (!dialog.hidden && event.key === 'ArrowDown') { event.preventDefault(); setActiveResult(activeResult + 1); }
  if (!dialog.hidden && event.key === 'ArrowUp') { event.preventDefault(); setActiveResult(activeResult - 1); }
  if (!dialog.hidden && event.key === 'Enter' && document.activeElement === commandSearch) {
    event.preventDefault();
    getVisibleResults()[activeResult]?.click();
  }
});

commandSearch?.addEventListener('input', () => {
  const query = commandSearch.value.trim().toLowerCase();
  let visible = 0;
  $$('.dialog-result', dialog).forEach((result) => {
    const matches = result.textContent.toLowerCase().includes(query);
    result.hidden = !matches;
    if (matches) visible += 1;
  });
  $('.empty-command', dialog).hidden = visible !== 0;
  activeResult = 0;
  setActiveResult(0);
});

$$('.dialog-result').forEach((result) => result.addEventListener('click', () => {
  closeCommand();
  setTimeout(() => {
    const action = result.dataset.commandAction;
    if (action === 'focus') {
      activateDemo('session');
      $('#demo')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      if (!demoTimerRunning) $('#demo-timer-toggle')?.click();
    } else if (action === 'block' || action === 'calendar') {
      activateDemo(action);
      $('#demo')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    } else if (action === 'coach') {
      window.openFocuzCoach?.();
    }
  }, reducedMotion ? 0 : 230);
}));

// Small pointer response where it communicates that the dashboard is live.
const productStage = $('.product-stage');
if (productStage && matchMedia('(pointer: fine)').matches && !reducedMotion) {
  productStage.addEventListener('pointermove', (event) => {
    const rect = productStage.getBoundingClientRect();
    productStage.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
    productStage.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
  });
}
