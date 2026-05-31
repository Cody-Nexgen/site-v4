// focuznow-ui.jsx — icons, hooks, small shared primitives
const { useState, useEffect, useRef, useCallback } = React;

/* ---- line icons (lucide-ish, 24x24 stroke) ---- */
const P = (d) => d;
const ICONS = {
  shield:    'M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z',
  lock:      'M6 11h12v9H6z|M8 11V8a4 4 0 0 1 8 0v3',
  ban:       'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M5.6 5.6l12.8 12.8',
  calendar:  'M4 6h16v15H4z|M4 10h16|M8 3v4|M16 3v4',
  bot:       'M12 7V4|M9 12h.01|M15 12h.01|M5 9h14v9H5z|M9 18l-1 3|M15 18l1 3',
  check:     'M4 12l5 5L20 6',
  clock:     'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M12 7v5l3 2',
  flame:     'M12 3c1 3-2 4-2 7a2 2 0 1 0 4 0c0-1 0-1 1-2 1 2 2 3 2 5a5 5 0 1 1-10 0c0-4 3-6 5-10z',
  note:      'M5 4h10l4 4v12H5z|M14 4v4h4|M8 12h8|M8 16h5',
  chart:     'M4 20V10|M10 20V4|M16 20v-7|M22 20H2',
  youtube:   'M3 8.5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z|M10 9.5l5 3-5 3z',
  settings:  'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z|M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5H9.6L9.2 5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4.8l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.06-.33.1-.66.1-1z',
  zap:       'M13 3L4 14h7l-1 7 9-11h-7z',
  link:      'M9 15l6-6|M10 7l1-1a4 4 0 0 1 6 6l-1 1|M14 17l-1 1a4 4 0 0 1-6-6l1-1',
  arrow:     'M5 12h14|M13 6l6 6-6 6',
  sparkle:   'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  plus:      'M12 5v14|M5 12h14',
  x:         'M6 6l12 12|M18 6L6 18',
  eye:       'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z|M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  globe:     'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M3 12h18|M12 3c2.5 2.5 2.5 15.5 0 18|M12 3c-2.5 2.5-2.5 15.5 0 18',
};
function Icon({ name, size = 22, stroke = 2, color, style, fill }) {
  const segs = (ICONS[name] || '').split('|');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color || 'currentColor'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style}>
      {segs.map((d, i) => <path key={i} d={d} fill={fill || 'none'} />)}
    </svg>
  );
}

/* ---- reveal on scroll (scroll-listener based — IO is unreliable in preview iframes) ---- */
function useInView(opts = {}) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const frac = opts.threshold ?? 0.12;
    let raf = 0, done = false;
    const check = () => {
      if (done) return true;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // consider visible once its top crosses (1-frac) of the viewport
      const trigger = vh * (1 - Math.min(frac, 0.4));
      if (r.top < trigger && r.bottom > 0) { done = true; setSeen(true); return true; }
      return false;
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { if (check()) cleanup(); });
    };
    const cleanup = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    if (check()) return cleanup;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // rAF-based post-paint checks — reliable in all iframe/preview contexts
    let raf1 = requestAnimationFrame(() => { if (!done) check(); });
    let raf2 = requestAnimationFrame(() => requestAnimationFrame(() => { if (!done) check(); }));
    return () => { cleanup(); cancelAnimationFrame(raf); cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, []);
  return [ref, seen];
}

// <Reveal> wrapper — fades + lifts children when scrolled into view
function Reveal({ children, delay = 0, as = 'div', className = '', style = {} }) {
  const [ref, seen] = useInView();
  const Tag = as;
  const dcls = delay ? ` reveal-d${delay}` : '';
  return <Tag ref={ref} className={`reveal${seen ? ' in' : ''}${dcls} ${className}`} style={style}>{children}</Tag>;
}

/* ---- parallax: translateY based on element's progress through viewport ---- */
function useParallax(strength = 30) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        const center = r.top + r.height / 2;
        const p = (center - vh / 2) / vh; // -1..1 roughly
        el.style.transform = `translateY(${(-p * strength).toFixed(1)}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [strength]);
  return ref;
}

/* ---- count-up number when in view ---- */
function CountUp({ to, suffix = '', prefix = '', dur = 1400, decimals = 0 }) {
  const [ref, seen] = useInView({ threshold: 0.5 });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!seen) return;
    let start = 0; const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(to * e);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [seen]);
  return <span ref={ref}>{prefix}{val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

Object.assign(window, { Icon, useInView, Reveal, useParallax, CountUp });
