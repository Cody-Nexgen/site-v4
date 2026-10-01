/**
 * FocuzPass form companion.
 *
 * Runs in an isolated content-script world, renders inside Shadow DOM, and only submits after
 * the user explicitly chooses an item. Site logins remain exact-host scoped.
 */

import { holdExtensionAnchor, releaseExtensionAnchor } from './extensionAnchor';
import { currentPasskeyOffer, watchPasskeyOffer, type PasskeyOffer } from './passkeyOffer';

type AutofillItem = {
    id: string;
    type: 'login' | 'card' | 'custom';
    kind?: string;
    title: string;
    identity: string;
    domain?: string;
    password?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    fields?: Record<string, string>;
    authMethod?: string;
    mark: string;
    markTone: string;
};

type LoginMatch = AutofillItem & { type: 'login' };

type FieldRole =
    | 'username' | 'password' | 'email' | 'phone'
    | 'name' | 'given-name' | 'family-name' | 'organization'
    | 'address-line1' | 'address-line2' | 'city' | 'region' | 'postal-code' | 'country'
    | 'cardholder' | 'card-number' | 'card-expiry' | 'card-exp-month' | 'card-exp-year' | 'cvv'
    | 'birth-date' | 'credential' | 'unknown';

type PageContext = {
    state: 'unconfigured' | 'locked' | 'ready';
    domain: string;
    matches: LoginMatch[];
    items: AutofillItem[];
};

type PendingLogin = {
    available: boolean;
    domain?: string;
    title?: string;
    identity?: string;
    faviconUrl?: string;
    accountCreation?: boolean;
    /** Same domain+identity saved with a different password → update variant. */
    update?: boolean;
};

type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string };

type FillableControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type FieldControl = {
    host: HTMLDivElement;
    shadow: ShadowRoot;
    button: HTMLButtonElement;
    target: HTMLElement;
    virtualRole?: FieldRole;
    /** Which glyph the button currently shows, so state refreshes don't re-render it. */
    mode?: 'ready' | 'locked';
};

type ControlState = 'checking' | 'locked' | 'ready';

type VaultStatus = {
    configured: boolean;
    unlocked: boolean;
};

const FIELD_HOST_ATTR = 'data-focuzpass-field-host';
const POPOVER_HOST_ID = 'focuzpass-popover-host';
const SAVE_HOST_ID = 'focuzpass-save-host';
const SUBMIT_DEBOUNCE_MS = 1800;

/** Lucide icon paths (24×24, stroke) — same set the dashboard uses. */
const ICON_PATHS = {
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    keyRound: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    rotateCw: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    userRound: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    creditCard: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    externalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
    shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    enter: '<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/>',
} as const;

type IconName = keyof typeof ICON_PATHS;

function icon(name: IconName): string {
    return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;
}

/** The FocuzNow Beam Z mark (same path as components/BeamZMark.tsx). */
const BRAND_MARK = '<svg class="brand" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0A0B0D"/><path d="M20 17.8 H47.2 V22.2 L22.8 41.8 H47.2 L44 46.2 H16.8 V41.8 L29.2 22.2 H16.8 Z" fill="#F4F2EE" stroke="#F4F2EE" stroke-width="1.6" stroke-linejoin="round"/></svg>';

const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';

function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

type OverlayTheme = 'dark' | 'light';
const COLOR_MODE_KEY = 'dashboardColorMode';

/** Follow the dashboard's light/dark choice; "system" follows the OS. */
function resolveOverlayTheme(mode: unknown): OverlayTheme {
    if (mode === 'light' || mode === 'dark') return mode;
    try {
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

/**
 * One stylesheet for every FocuzPass surface. Tokens mirror the `--fz-*` values in
 * focuzDesign.css (dark + light); motion uses the dashboard's ease-out curve.
 */
const OVERLAY_STYLE = `
    :host {
        all: initial;
        --bg: oklch(0.225 0.004 275);
        --bg-raised: oklch(0.198 0.004 275);
        --hover: oklch(0.955 0.003 275 / 0.06);
        --active: oklch(0.955 0.003 275 / 0.1);
        --border: oklch(0.955 0.003 275 / 0.085);
        --border-strong: oklch(0.955 0.003 275 / 0.14);
        --text-1: oklch(0.985 0.002 275);
        --text-2: oklch(0.895 0.003 275);
        --text-3: oklch(0.765 0.005 275);
        --text-4: oklch(0.675 0.005 275);
        --accent: oklch(0.955 0.003 275);
        --accent-fg: oklch(0.17 0.004 275);
        --focus: oklch(0.955 0.003 275 / 0.45);
        --success: oklch(0.72 0.14 150);
        --success-soft: oklch(0.72 0.14 150 / 0.14);
        --danger: oklch(0.72 0.14 25);
        --shadow: 0 0 0 1px oklch(0 0 0 / 0.2), 0 8px 24px -4px rgb(0 0 0 / 0.5), 0 2px 6px rgb(0 0 0 / 0.3);
        --shadow-sm: 0 0 0 1px oklch(0 0 0 / 0.25), 0 1px 3px rgb(0 0 0 / 0.35);
        --skeleton: oklch(0.955 0.003 275 / 0.07);
        --ease-out: ${EASE_OUT};
        --ease-in: ${EASE_IN};
        color-scheme: dark;
    }
    :host([data-theme="light"]) {
        --bg: oklch(1 0 0);
        --bg-raised: oklch(0.975 0.004 275);
        --hover: oklch(0.2 0.008 275 / 0.05);
        --active: oklch(0.2 0.008 275 / 0.08);
        --border: oklch(0.2 0.008 275 / 0.08);
        --border-strong: oklch(0.2 0.008 275 / 0.13);
        --text-1: oklch(0.2 0.008 275);
        --text-2: oklch(0.36 0.008 275);
        --text-3: oklch(0.51 0.008 275);
        --text-4: oklch(0.6 0.008 275);
        --accent: oklch(0.2 0.008 275);
        --accent-fg: oklch(0.99 0.002 275);
        --focus: oklch(0.2 0.008 275 / 0.4);
        --success: oklch(0.6 0.14 150);
        --success-soft: oklch(0.6 0.14 150 / 0.12);
        --danger: oklch(0.58 0.16 25);
        --shadow: 0 0 0 1px oklch(0.2 0.01 275 / 0.08), 0 8px 24px -4px rgb(0 0 0 / 0.14), 0 2px 6px rgb(0 0 0 / 0.07);
        --shadow-sm: 0 0 0 1px oklch(0.2 0.01 275 / 0.1), 0 1px 3px rgb(0 0 0 / 0.12);
        --skeleton: oklch(0.2 0.008 275 / 0.06);
        color-scheme: light;
    }
    * { box-sizing: border-box; }
    button { font: inherit; }
    .ic { width: 14px; height: 14px; flex: none; display: block; }
    .brand { display: block; width: 100%; height: 100%; }

    /* ---- field button ---- */
    .field-btn {
        all: unset; box-sizing: border-box; width: 100%; height: 100%;
        display: grid; place-items: center; border-radius: 6px; cursor: pointer;
        opacity: 0; pointer-events: none;
        transition: opacity 120ms ease, transform 120ms var(--ease-out), box-shadow 120ms ease, background-color 120ms ease;
    }
    .field-btn.is-shown { opacity: 1; pointer-events: auto; transition-duration: 180ms; }
    .field-btn.is-shown:hover { box-shadow: 0 0 0 3px var(--hover); }
    .field-btn.is-shown:active { transform: scale(.94); transition-duration: 90ms; }
    .field-btn.is-open { box-shadow: 0 0 0 3px var(--active); }
    .field-btn .brand { border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.25); }
    .field-btn.is-locked { background: var(--bg); color: var(--text-2); box-shadow: var(--shadow-sm); }
    .field-btn.is-locked .ic { width: 12px; height: 12px; }
    .field-btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

    /* ---- anchored panel ---- */
    .panel {
        position: relative; overflow: hidden; width: 100%;
        color: var(--text-1); background: var(--bg); border-radius: 10px; box-shadow: var(--shadow);
        font-family: "Inter Variable", Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12.5px; line-height: 1.35; -webkit-font-smoothing: antialiased;
        transform-origin: 50% 0;
        animation: fp-panel-in 200ms var(--ease-out);
    }
    .panel[data-placement="above"] { transform-origin: 50% 100%; animation-name: fp-panel-in-up; }
    .head { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 6px 0 10px; border-bottom: 1px solid var(--border); }
    .head .brand { width: 16px; height: 16px; border-radius: 4px; overflow: hidden; flex: none; }
    .head-title { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 6px; white-space: nowrap; overflow: hidden; }
    .head-title strong { font-size: 12px; font-weight: 600; color: var(--text-1); letter-spacing: -.005em; }
    .head-title span { font-size: 11.5px; color: var(--text-4); overflow: hidden; text-overflow: ellipsis; }
    .icon-btn {
        all: unset; box-sizing: border-box; width: 24px; height: 24px; flex: none;
        display: grid; place-items: center; border-radius: 6px; color: var(--text-4); cursor: pointer;
        transition: background-color 120ms ease, color 120ms ease;
    }
    .icon-btn:hover { background: var(--hover); color: var(--text-1); }
    .icon-btn:active { background: var(--active); }
    .icon-btn .ic { width: 13px; height: 13px; }
    .body { padding: 4px; }
    .foot { display: flex; align-items: center; gap: 2px; padding: 4px; border-top: 1px solid var(--border); }
    .foot[hidden] { display: none; }

    /* rows */
    .list { display: grid; gap: 1px; max-height: 232px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
    .row {
        all: unset; box-sizing: border-box; position: relative; display: flex; align-items: center; gap: 10px;
        min-height: 44px; padding: 6px 8px; border-radius: 7px; cursor: pointer;
        transition: background-color 120ms ease;
    }
    .row.is-active { background: var(--hover); }
    .row:active { background: var(--active); }
    .row:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
    .tile {
        width: 28px; height: 28px; flex: none; display: grid; place-items: center; overflow: hidden;
        border-radius: 7px; background: var(--bg-raised); border: 1px solid var(--border);
        color: var(--text-2); font-size: 10.5px; font-weight: 650; letter-spacing: .02em;
    }
    .tile img { width: 18px; height: 18px; object-fit: contain; display: block; }
    .tile .ic { width: 14px; height: 14px; }
    .tile.is-card { font-size: 8.5px; letter-spacing: .04em; }
    .copy { min-width: 0; flex: 1; display: grid; gap: 1px; }
    .title { color: var(--text-1); font-size: 12.5px; font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub { color: var(--text-3); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hint {
        flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 5px;
        color: var(--text-4); border: 1px solid var(--border);
        opacity: 0; transform: translateX(-3px); transition: opacity 140ms var(--ease-out), transform 180ms var(--ease-out);
    }
    .hint .ic { width: 12px; height: 12px; }
    .row.is-active .hint { opacity: 1; transform: none; }

    /* loading skeleton */
    .skeleton { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 8px; }
    .skeleton i { display: block; border-radius: 5px; background: var(--skeleton); animation: fp-pulse 1.1s ease-in-out infinite; }
    .skeleton .sk-tile { width: 28px; height: 28px; border-radius: 7px; }
    .skeleton .sk-lines { flex: 1; display: grid; gap: 6px; }
    .skeleton .sk-a { width: 46%; height: 9px; }
    .skeleton .sk-b { width: 68%; height: 8px; animation-delay: 120ms; }
    .skeleton + .skeleton i { animation-delay: 200ms; }
    .loading-note { margin: 2px 8px 8px; color: var(--text-3); font-size: 11.5px; line-height: 1.45; }

    /* empty / gate / error */
    .note { display: flex; gap: 10px; align-items: flex-start; padding: 10px 8px 8px; }
    .note .tile { width: 30px; height: 30px; }
    .note-copy { min-width: 0; flex: 1; }
    .note-title { margin: 0; color: var(--text-1); font-size: 12.5px; font-weight: 600; }
    .note-text { margin: 3px 0 0; color: var(--text-3); font-size: 11.5px; line-height: 1.45; }
    .note.is-error .tile { color: var(--danger); }
    .note-actions { padding: 4px 8px 8px 48px; display: flex; gap: 6px; }

    /* buttons */
    .btn {
        all: unset; box-sizing: border-box; height: 30px; padding: 0 12px;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        border-radius: 7px; cursor: pointer; font-size: 12px; font-weight: 550; white-space: nowrap;
        transition: background-color 120ms ease, color 120ms ease, opacity 120ms ease, transform 90ms ease;
    }
    .btn .ic { width: 13px; height: 13px; }
    .btn:active { transform: scale(.98); }
    .btn:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
    .btn-primary { background: var(--accent); color: var(--accent-fg); }
    .btn-primary:hover { opacity: .88; }
    .btn-secondary { background: transparent; color: var(--text-1); box-shadow: inset 0 0 0 1px var(--border-strong); }
    .btn-secondary:hover { background: var(--hover); }
    .btn-ghost { background: transparent; color: var(--text-3); padding: 0 8px; }
    .btn-ghost:hover { background: var(--hover); color: var(--text-1); }
    .btn-block { width: 100%; }
    .foot .btn-ghost { flex: 1; justify-content: flex-start; height: 28px; font-weight: 500; }

    /* suggested password */
    .pw { padding: 6px 6px 8px; display: grid; gap: 8px; }
    .pw-label { margin: 2px 2px 0; color: var(--text-3); font-size: 11.5px; }
    .pw-value {
        display: flex; align-items: center; gap: 4px; height: 36px; padding: 0 4px 0 10px;
        border-radius: 7px; background: var(--bg-raised); box-shadow: inset 0 0 0 1px var(--border);
        font-family: ui-monospace, "Cascadia Code", Menlo, monospace; font-size: 12.5px; color: var(--text-1);
    }
    .pw-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: .03em; user-select: all; transition: opacity 140ms ease; }
    .pw-text.is-swapping { opacity: 0; }
    .rotating .ic { animation: fp-spin 420ms var(--ease-out); }

    /* ---- save toast ---- */
    .toast {
        position: relative; overflow: hidden; width: min(360px, calc(100vw - 24px));
        color: var(--text-1); background: var(--bg); border-radius: 12px; box-shadow: var(--shadow);
        font-family: "Inter Variable", Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12.5px; line-height: 1.35; -webkit-font-smoothing: antialiased;
        transform-origin: 100% 0;
        animation: fp-toast-in 260ms var(--ease-out);
    }
    .toast-main { display: flex; gap: 12px; align-items: center; padding: 14px 10px 10px 14px; }
    .toast .tile { width: 34px; height: 34px; border-radius: 9px; font-size: 11px; }
    .toast .tile img { width: 20px; height: 20px; }
    .toast-copy { min-width: 0; flex: 1; }
    .toast-copy h2 { margin: 0; color: var(--text-1); font-size: 13px; font-weight: 600; letter-spacing: -.005em; }
    .toast-copy p { margin: 2px 0 0; color: var(--text-3); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .toast-main .icon-btn { align-self: flex-start; }
    .toast-actions { display: flex; align-items: center; gap: 6px; padding: 4px 12px 14px 14px; }
    .toast-actions .btn-ghost { margin-right: auto; padding: 0 6px; margin-left: -6px; }
    .countdown { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; }
    .countdown i { display: block; height: 100%; background: var(--border-strong); transform-origin: 0 50%; animation: fp-countdown linear forwards; }
    .toast:hover .countdown i { animation-play-state: paused; }
    .saved { display: flex; align-items: center; gap: 10px; padding: 16px 14px; animation: fp-fade-in 200ms var(--ease-out); }
    .saved .tile { color: var(--success); background: var(--success-soft); border-color: transparent; }
    .saved .ic { width: 16px; height: 16px; }
    .saved strong { font-size: 12.5px; font-weight: 600; color: var(--text-1); }

    @keyframes fp-panel-in { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
    @keyframes fp-panel-in-up { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }
    @keyframes fp-toast-in { from { opacity: 0; transform: translateY(-10px) scale(.97); } to { opacity: 1; transform: none; } }
    @keyframes fp-fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fp-pulse { 50% { opacity: .45; } }
    @keyframes fp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes fp-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) {
        .panel, .toast, .saved, .skeleton i, .rotating .ic { animation: none !important; }
        * { transition-duration: .01ms !important; }
    }
`;

function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function appendIcon(target: HTMLElement, markup: string) {
    const wrapper = document.createElement('span');
    wrapper.innerHTML = markup;
    const svg = wrapper.firstElementChild;
    if (svg) target.appendChild(svg);
}

function iconButton(name: IconName, label: string) {
    const button = createElement('button', 'icon-btn');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = icon(name);
    return button;
}

function textButton(variant: 'primary' | 'secondary' | 'ghost', label: string, iconName?: IconName, trailing = false) {
    const button = createElement('button', `btn btn-${variant}`);
    button.type = 'button';
    const text = createElement('span', '', label);
    if (iconName && !trailing) appendIcon(button, icon(iconName));
    button.appendChild(text);
    if (iconName && trailing) appendIcon(button, icon(iconName));
    return button;
}

function associatedLabelText(element: HTMLElement): string {
    const parts: string[] = [];
    const labelled = element.getAttribute('aria-labelledby');
    if (labelled) {
        for (const id of labelled.split(/\s+/)) {
            const node = document.getElementById(id);
            if (node?.textContent) parts.push(node.textContent);
        }
    }
    const described = element.getAttribute('aria-describedby');
    if (described) {
        for (const id of described.split(/\s+/)) {
            const node = document.getElementById(id);
            if (node?.textContent) parts.push(node.textContent);
        }
    }
    const labels = 'labels' in element ? (element as HTMLInputElement).labels : null;
    if (labels) {
        for (const label of Array.from(labels)) parts.push(label.textContent || '');
    } else if (element.id) {
        try {
            const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
            if (label?.textContent) parts.push(label.textContent);
        } catch {
            /* invalid id */
        }
    }
    const wrap = element.closest('label');
    if (wrap?.textContent) parts.push(wrap.textContent);
    return parts.join(' ');
}

function fieldDescriptor(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
    return [
        element.name,
        element.id,
        element.getAttribute('autocomplete') || '',
        element.getAttribute('placeholder') || '',
        element.getAttribute('aria-label') || '',
        element.getAttribute('title') || '',
        element.getAttribute('inputmode') || '',
        element.getAttribute('data-elements-stable-field-name') || '',
        element.getAttribute('data-checkout') || '',
        element.dataset.field || '',
        associatedLabelText(element),
    ].join(' ').toLowerCase().replace(/[_-]+/g, ' ');
}

/**
 * Classification reads labels and attributes, and callers ask about the same field
 * many times per scan (grouping, sorting, positioning). Cache it per scan
 * generation; a new scan (triggered by attribute/DOM changes) recomputes.
 */
let classifyGeneration = 0;
const classifyCache = new WeakMap<Element, [number, FieldRole]>();

function classifyField(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FieldRole {
    const cached = classifyCache.get(element);
    if (cached && cached[0] === classifyGeneration) return cached[1];
    const role = classifyFieldUncached(element);
    classifyCache.set(element, [classifyGeneration, role]);
    return role;
}

/** Could this added element hold something FocuzPass cares about? */
function mayContainFields(el: Element): boolean {
    if (/^(INPUT|SELECT|TEXTAREA|IFRAME|FORM)$/.test(el.tagName)) return true;
    return el.firstElementChild !== null && el.querySelector('input, select, textarea, iframe') !== null;
}

/** Pages opt fields out (the other vault's master password on focuznow.com/pwcode, say): no badge, fill or save offer. */
function isIgnoredField(element: Element): boolean {
    return Boolean(element.closest('[data-focuzpass-ignore]'));
}

function classifyFieldUncached(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FieldRole {
    if (isIgnoredField(element)) return 'unknown';
    const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/).at(-1) || '';
    const autocompleteRoles: Record<string, FieldRole> = {
        username: 'username', 'current-password': 'password', 'new-password': 'password', email: 'email', tel: 'phone',
        name: 'name', 'given-name': 'given-name', 'family-name': 'family-name', organization: 'organization',
        'street-address': 'address-line1', 'address-line1': 'address-line1', 'address-line2': 'address-line2',
        'address-level2': 'city', 'address-level1': 'region', 'postal-code': 'postal-code', country: 'country', 'country-name': 'country',
        'cc-name': 'cardholder', 'cc-number': 'card-number', 'cc-exp': 'card-expiry', 'cc-exp-month': 'card-exp-month',
        'cc-exp-year': 'card-exp-year', 'cc-csc': 'cvv', bday: 'birth-date',
    };
    if (autocompleteRoles[autocomplete]) return autocompleteRoles[autocomplete];

    if (element instanceof HTMLInputElement) {
        if (element.type === 'password') return 'password';
        if (element.type === 'email') return 'email';
        if (element.type === 'tel') return 'phone';
    }
    const value = fieldDescriptor(element);
    if (/search|coupon|promo|discount|one time|otp|verification code|captcha/.test(value)) return 'unknown';
    if (/card.?holder|name on card|name on the card/.test(value)) return 'cardholder';
    if (/card.?number|credit.?card|debit.?card|cc.?number|pan\b|card no/.test(value)) return 'card-number';
    if (
        element instanceof HTMLInputElement
        && (element.inputMode === 'numeric' || element.inputMode === 'decimal')
        && (element.maxLength === 16 || element.maxLength === 19)
        && !/zip|postal|cvv|cvc|phone|otp/.test(value)
    ) {
        return 'card-number';
    }
    if (/expir|expiry|expiration|cc.?exp/.test(value) && /month|mm\b/.test(value)) return 'card-exp-month';
    if (/expir|expiry|expiration|cc.?exp/.test(value) && /year|yy/.test(value)) return 'card-exp-year';
    if (/expir|expiry|expiration|cc.?exp/.test(value)) return 'card-expiry';
    if (/\bcvv\b|\bcvc\b|security.?code|card.?code|cc.?csc/.test(value)) return 'cvv';
    if (/confirm|repeat|verify/.test(value) && /password|passcode/.test(value)) return 'password';
    if (/password|passcode|passwd/.test(value)) return 'password';
    if (/e.?mail/.test(value)) return 'email';
    if (/phone|mobile|telephone|\btel\b/.test(value)) return 'phone';
    if (/first.?name|given.?name|forename/.test(value)) return 'given-name';
    if (/last.?name|family.?name|surname/.test(value)) return 'family-name';
    if (/full.?name|your.?name|legal.?name|\bname\b/.test(value)) return 'name';
    if (/company|organization|organisation|business/.test(value)) return 'organization';
    if (/address.?2|address.?line.?2|apartment|\bapt\b|suite|unit/.test(value)) return 'address-line2';
    if (/street|address.?1|address.?line.?1|shipping.?address|billing.?address/.test(value)) return 'address-line1';
    if (/\bcity\b|town/.test(value)) return 'city';
    if (/state|province|region|county/.test(value)) return 'region';
    if (/zip|postal/.test(value)) return 'postal-code';
    if (/country/.test(value)) return 'country';
    if (/birth|dob|date of birth/.test(value)) return 'birth-date';
    if (/routing|account.?number|api.?key|client.?secret|access.?token|social.?security|\bssn\b|license.?number|passport.?number|member.?id|policy.?number|wallet.?address|recovery.?phrase|private.?key|public.?key|network.?name|wi.?fi/.test(value)) return 'credential';
    if (/user|login|account.?name/.test(value)) return 'username';
    return 'unknown';
}

function isVisibleTarget(element: HTMLElement, role?: FieldRole): boolean {
    if (!element.isConnected) return false;
    if (element instanceof HTMLInputElement) {
        if (element.disabled) return false;
        if (['hidden', 'checkbox', 'radio', 'submit', 'button', 'reset', 'file', 'image', 'range', 'color'].includes(element.type)) return false;
    }
    if ((element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) && element.disabled) return false;
    if (role === 'unknown') return false;
    if (!isElementVisuallyAvailable(element)) return false;
    const rect = element.getBoundingClientRect();
    const minWidth = role === 'cvv' || role === 'card-exp-month' || role === 'card-exp-year' || role === 'card-expiry' ? 28 : 40;
    return rect.width >= minWidth && rect.height >= 16 && rect.bottom >= 0 && rect.top <= window.innerHeight;
}

function isFillableControl(element: EventTarget | null): element is FillableControl {
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

function isRenderableInput(input: HTMLInputElement): boolean {
    if (!input.isConnected || input.disabled) return false;
    if (!isElementVisuallyAvailable(input)) return false;
    const rect = input.getBoundingClientRect();
    return rect.width > 20 && rect.height > 16;
}

function isElementVisuallyAvailable(element: HTMLElement): boolean {
    let current: HTMLElement | null = element;
    while (current) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        current = current.parentElement;
    }
    return true;
}

function scoreIdentityInput(input: HTMLInputElement, password: HTMLInputElement): number {
    if (!isRenderableInput(input) || input === password) return -1;
    const type = input.type.toLowerCase();
    if (!['text', 'email', 'tel', ''].includes(type)) return -1;
    const autocomplete = input.autocomplete.toLowerCase();
    const haystack = `${input.name} ${input.id} ${input.placeholder} ${input.getAttribute('aria-label') || ''}`.toLowerCase();
    if (/search|coupon|promo|code|otp|one.?time/.test(haystack) || autocomplete === 'one-time-code') return -1;

    let score = 0;
    if (autocomplete === 'username') score += 120;
    if (autocomplete === 'email') score += 105;
    if (type === 'email') score += 80;
    if (/user|email|login|account/.test(haystack)) score += 48;
    if (input.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING) score += 20;
    if (input.value) score += 8;
    return score;
}

function identityInputFor(password: HTMLInputElement): HTMLInputElement | null {
    const scope = password.form || password.closest('form') || password.closest('[role="dialog"], main, section, article, div') || document;
    const candidates = Array.from(scope.querySelectorAll<HTMLInputElement>('input'))
        .map((input) => ({ input, score: scoreIdentityInput(input, password) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score);
    return candidates[0]?.input || null;
}

function passwordInputFor(form: HTMLFormElement): HTMLInputElement | null {
    const candidates = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="password"]'))
        .filter((input) => isRenderableInput(input) && Boolean(input.value) && !isIgnoredField(input));
    const preferred = candidates.find((input) => {
        const haystack = `${input.name} ${input.id} ${input.autocomplete}`.toLowerCase();
        return !/confirm|repeat|verify/.test(haystack);
    });
    return preferred || candidates[0] || null;
}

function isAccountCreationForm(form: HTMLFormElement, passwordInput: HTMLInputElement): boolean {
    const passwordFields = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="password"]'));
    const descriptors = `${form.id} ${form.className} ${form.getAttribute('name') || ''} ${form.getAttribute('aria-label') || ''} ${form.innerText}`
        .toLowerCase()
        .slice(0, 3000);
    return passwordInput.autocomplete.toLowerCase() === 'new-password'
        || passwordFields.some((input) => input.autocomplete.toLowerCase() === 'new-password')
        || passwordFields.length > 1
        || /sign\s*up|create\s+(an?\s+)?account|register|join\s+(now|us)/.test(descriptors);
}

function submitFilledLogin(passwordInput: HTMLInputElement) {
    const form = passwordInput.form || passwordInput.closest('form');
    if (form) {
        const submitter = Array.from(
            form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input[type="submit"], input[type="button"]'),
        ).find((candidate) => {
            if (candidate.disabled || !isElementVisuallyAvailable(candidate)) return false;
            const type = (candidate.getAttribute('type') || (candidate.tagName === 'BUTTON' ? 'submit' : '')).toLowerCase();
            const label = `${candidate.textContent || ''} ${candidate.getAttribute('value') || ''} ${candidate.getAttribute('aria-label') || ''}`.toLowerCase();
            return type === 'submit' || /sign\s*in|log\s*in|continue|submit/.test(label);
        });
        if (submitter) submitter.click();
        else form.requestSubmit();
        return;
    }

    for (const type of ['keydown', 'keypress', 'keyup'] as const) {
        passwordInput.dispatchEvent(new KeyboardEvent(type, {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
            cancelable: true,
        }));
    }
}

function fillRelatedPasswordConfirmation(passwordInput: HTMLInputElement, password: string) {
    const form = passwordInput.form || passwordInput.closest('form');
    if (!form) return;
    for (const candidate of form.querySelectorAll<HTMLInputElement>('input[type="password"]')) {
        if (candidate === passwordInput || !isRenderableInput(candidate)) continue;
        const descriptor = `${candidate.name} ${candidate.id} ${candidate.autocomplete} ${candidate.placeholder} ${candidate.getAttribute('aria-label') || ''}`.toLowerCase();
        if (candidate.autocomplete.toLowerCase() === 'new-password' || /confirm|repeat|verify|password.?2/.test(descriptor)) {
            setInputValue(candidate, password);
        }
    }
}

function setInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setControlValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string, role?: FieldRole) {
    if (control instanceof HTMLInputElement) {
        if (control.list) {
            const option = Array.from(control.list.options).find((item) => matchChoiceText(item.value || item.label || item.text, value, role));
            if (option) value = option.value || option.label || value;
        }
        setInputValue(control, value);
        fillVisibleChoice(control, value, role);
        return;
    }
    if (control instanceof HTMLSelectElement) {
        const option = matchSelectOption(control, value, role || classifyField(control));
        if (!option) {
            fillVisibleChoice(control, value, role);
            return;
        }
        option.selected = true;
        control.selectedIndex = option.index;
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        if (setter) setter.call(control, option.value);
        else control.value = option.value;
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
        fillVisibleChoice(control, option.text || option.value || value, role);
        return;
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(control, value);
    else control.value = value;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
}

function normalizedKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const US_STATES: Record<string, string> = {
    al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california', co: 'colorado',
    ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia', hi: 'hawaii', id: 'idaho',
    il: 'illinois', in: 'indiana', ia: 'iowa', ks: 'kansas', ky: 'kentucky', la: 'louisiana',
    me: 'maine', md: 'maryland', ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi',
    mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada', nh: 'newhampshire', nj: 'newjersey',
    nm: 'newmexico', ny: 'newyork', nc: 'northcarolina', nd: 'northdakota', oh: 'ohio', ok: 'oklahoma',
    or: 'oregon', pa: 'pennsylvania', ri: 'rhodeisland', sc: 'southcarolina', sd: 'southdakota',
    tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont', va: 'virginia', wa: 'washington',
    wv: 'westvirginia', wi: 'wisconsin', wy: 'wyoming', dc: 'districtofcolumbia',
};

const CA_PROVINCES: Record<string, string> = {
    ab: 'alberta', bc: 'britishcolumbia', mb: 'manitoba', nb: 'newbrunswick',
    nl: 'newfoundlandandlabrador', ns: 'novascotia', nt: 'northwestterritories', nu: 'nunavut',
    on: 'ontario', pe: 'princeedwardisland', qc: 'quebec', sk: 'saskatchewan', yt: 'yukon',
};

const COUNTRY_ALIASES: Record<string, string[]> = {
    us: ['us', 'usa', 'unitedstates', 'unitedstatesofamerica', 'america'],
    gb: ['gb', 'uk', 'unitedkingdom', 'greatbritain', 'britain', 'england'],
    ca: ['ca', 'can', 'canada'],
    au: ['au', 'aus', 'australia'],
    de: ['de', 'deu', 'germany', 'deutschland'],
    fr: ['fr', 'fra', 'france'],
    in: ['in', 'ind', 'india'],
    mx: ['mx', 'mex', 'mexico'],
    br: ['br', 'bra', 'brazil', 'brasil'],
    jp: ['jp', 'jpn', 'japan'],
    cn: ['cn', 'chn', 'china'],
    es: ['es', 'esp', 'spain', 'espana'],
    it: ['it', 'ita', 'italy', 'italia'],
    nl: ['nl', 'nld', 'netherlands', 'holland'],
};

function regionAliases(): Record<string, string> {
    return { ...US_STATES, ...CA_PROVINCES };
}

function aliasTokens(value: string, role?: FieldRole): string[] {
    const key = normalizedKey(value);
    if (!key) return [];
    const tokens = new Set<string>([key]);
    if (/^\d{4}$/.test(key)) tokens.add(key.slice(-2));
    if (/^\d{2}$/.test(key)) tokens.add(`20${key}`);
    if (role !== 'country') {
        const regions = regionAliases();
        if (regions[key]) tokens.add(regions[key]);
        const regionCode = Object.entries(regions).find(([, name]) => name === key)?.[0];
        if (regionCode) tokens.add(regionCode);
    }
    if (role !== 'region') {
        for (const [code, names] of Object.entries(COUNTRY_ALIASES)) {
            if (names.includes(key) || code === key) {
                tokens.add(code);
                for (const name of names) tokens.add(name);
            }
        }
    }
    return [...tokens];
}

function matchChoiceText(candidate: string, value: string, role?: FieldRole): boolean {
    const wanted = aliasTokens(value, role);
    const haystack = normalizedKey(candidate);
    return wanted.some((token) => haystack === token || (token.length >= 2 && haystack.includes(token)));
}

function matchSelectOption(select: HTMLSelectElement, value: string, role?: FieldRole): HTMLOptionElement | undefined {
    const wanted = aliasTokens(value, role);
    if (wanted.length === 0) return undefined;
    const wantedSet = new Set(wanted);
    const options = Array.from(select.options).filter((option) => option.value !== '' || option.text.trim());
    const scored = options.map((option) => {
        const valueKey = normalizedKey(option.value);
        const textKey = normalizedKey(option.text || option.label);
        const optionTokens = new Set([...aliasTokens(option.value, role), ...aliasTokens(option.text, role)]);
        let score = 0;
        if (wantedSet.has(valueKey)) score += 20;
        if (wantedSet.has(textKey)) score += 16;
        for (const token of wanted) {
            if (optionTokens.has(token)) score += 8;
            else if ((valueKey.includes(token) || textKey.includes(token)) && token.length >= 2) score += 3;
        }
        return { option, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.score ? scored[0].option : undefined;
}

function fillVisibleChoice(near: HTMLElement, value: string, role?: FieldRole) {
    if (role !== 'country' && role !== 'region' && role !== 'card-exp-month' && role !== 'card-exp-year') return;
    const root = near.closest('label, fieldset, [role="group"], [role="combobox"], li, div') || near.parentElement;
    if (!(root instanceof HTMLElement)) return;
    const options = Array.from(root.querySelectorAll<HTMLElement>('[role="option"]'));
    const match = options.find((option) => matchChoiceText(option.textContent || option.getAttribute('data-value') || '', value, role));
    if (match && isElementVisuallyAvailable(match) && match.getAttribute('aria-selected') !== 'true') match.click();
}

function parseAddressBlob(address: string): Partial<Record<FieldRole, string>> {
    const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return {};
    const parsed: Partial<Record<FieldRole, string>> = { 'address-line1': parts[0] };
    const tail = parts[parts.length - 1];
    if (/united states|usa|\bus\b|canada|australia|united kingdom|\buk\b/i.test(tail) || tail.length === 2) {
        parsed.country = tail;
        parts.pop();
    }
    const regionZip = parts[parts.length - 1] || '';
    const zipMatch = regionZip.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?|[A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i);
    if (zipMatch) {
        parsed.region = zipMatch[1];
        parsed['postal-code'] = zipMatch[2];
        parsed.city = parts[parts.length - 2] || parsed.city;
    } else if (parts.length >= 2) {
        parsed.city = parts[parts.length - 2];
        parsed.region = regionZip;
    }
    return parsed;
}

type FieldFamily = 'login' | 'identity' | 'payment';

function roleFamily(role: FieldRole): FieldFamily | null {
    if (role === 'unknown') return null;
    if (role === 'username' || role === 'password') return 'login';
    if (role.startsWith('card-') || role === 'cardholder' || role === 'cvv') return 'payment';
    return 'identity';
}

function fieldScope(element: HTMLElement): HTMLElement {
    const form = (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
        ? element.form
        : null)
        || element.closest('form, [role="form"]');
    return form instanceof HTMLElement ? form : document.body;
}

function overlayAnchorRect(element: HTMLElement): DOMRect {
    const rect = element.getBoundingClientRect();
    if (rect.height <= 72) return rect;
    const inner = element.querySelector<HTMLElement>('iframe, input, select, textarea, [contenteditable="true"]');
    if (inner) {
        const innerRect = inner.getBoundingClientRect();
        if (innerRect.width >= 28 && innerRect.height >= 16 && innerRect.height < rect.height) return innerRect;
    }
    return new DOMRect(rect.left, rect.top, rect.width, Math.min(rect.height, 44));
}

function fixedOverlayOrigin() {
    const probe = document.createElement('div');
    probe.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:1px;height:1px;display:block;visibility:hidden;pointer-events:none;';
    document.documentElement.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    probe.remove();
    return { x: rect.left, y: rect.top };
}

function isHostedPaymentFrame() {
    return /stripe\.com|js\.stripe|paypal\.com|braintreegateway|adyen\.com|squareup\.com/.test(location.hostname);
}

const SCOPE_IDS = new WeakMap<HTMLElement, string>();
let scopeSerial = 0;

function scopeKey(element: HTMLElement): string {
    const current = SCOPE_IDS.get(element);
    if (current) return current;
    const next = `scope-${++scopeSerial}`;
    SCOPE_IDS.set(element, next);
    return next;
}

function itemValues(item: AutofillItem): { roles: Partial<Record<FieldRole, string>>; fields: Record<string, string> } {
    const fields = item.fields || {};
    const get = (...keys: string[]) => {
        const entry = Object.entries(fields).find(([key]) => keys.some((candidate) => normalizedKey(key) === normalizedKey(candidate)));
        return entry?.[1] || '';
    };
    const roles: Partial<Record<FieldRole, string>> = {};

    if (item.type === 'login') {
        roles.username = item.identity;
        if (item.identity.includes('@')) roles.email = item.identity;
        roles.password = item.password || '';
    } else if (item.type === 'card') {
        const [month = '', year = ''] = (item.expiry || '').split('/');
        roles.cardholder = item.identity;
        roles.name = item.identity;
        roles['card-number'] = item.cardNumber || '';
        roles['card-expiry'] = item.expiry || '';
        roles['card-exp-month'] = month;
        roles['card-exp-year'] = year.length === 2 ? `20${year}` : year;
        roles.cvv = item.cvv || '';
    } else {
        const fullName = get('fullName', 'memberName', 'accountHolder') || item.identity;
        const nameParts = fullName.trim().split(/\s+/);
        roles.name = fullName;
        roles['given-name'] = nameParts[0] || '';
        roles['family-name'] = nameParts.slice(1).join(' ');
        roles.username = get('username', 'adminUsername') || (item.kind === 'email' ? get('email') : '');
        roles.password = get('password', 'adminPassword', 'passphrase');
        roles.email = get('email', 'recoveryEmail');
        roles.phone = get('phone');
        roles.organization = get('organization', 'bankName', 'provider');
        roles['address-line1'] = get('addressLine1', 'streetAddress', 'address');
        roles['address-line2'] = get('addressLine2', 'apartment', 'suite');
        roles.city = get('city');
        roles.region = get('region', 'state', 'issuedState');
        roles['postal-code'] = get('postalCode', 'zip');
        roles.country = get('country', 'nationality', 'countryCode');
        roles['birth-date'] = get('dateOfBirth');
        const parsed = parseAddressBlob(get('address', 'addressLine1', 'streetAddress'));
        if (!roles.city && parsed.city) roles.city = parsed.city;
        if (!roles.region && parsed.region) roles.region = parsed.region;
        if (!roles['postal-code'] && parsed['postal-code']) roles['postal-code'] = parsed['postal-code'];
        if (!roles.country && parsed.country) roles.country = parsed.country;
    }
    return { roles, fields };
}

function valueForControl(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, item: AutofillItem): string {
    const { roles, fields } = itemValues(item);
    const role = classifyField(control);
    if (roles[role]) return roles[role] || '';
    const descriptor = normalizedKey(fieldDescriptor(control));
    const direct = Object.entries(fields).find(([key]) => {
        const normalized = normalizedKey(key);
        return normalized.length >= 4 && (descriptor.includes(normalized) || normalized.includes(descriptor));
    });
    return direct?.[1] || '';
}

/** A non-login item that names a site, on that site. (Imported "Password" items used to show on every site.) */
function forThisSite(item: AutofillItem): boolean {
    const domain = (item.domain || '').toLowerCase().replace(/^www\./, '');
    if (!domain) return false;
    const host = location.hostname.toLowerCase().replace(/^www\./, '');
    return host === domain || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
}

function relevantItemsForRole(items: AutofillItem[], role: FieldRole): AutofillItem[] {
    const cardRole = role.startsWith('card-') || role === 'cardholder' || role === 'cvv';
    if (cardRole) return items.filter((item) => item.type === 'card');
    if (role === 'password' || role === 'username') {
        return items.filter((item) => item.type === 'login' || (item.type === 'custom' && ['password', 'email', 'api_credentials', 'wireless_router'].includes(item.kind || '') && forThisSite(item)));
    }
    if (role === 'email') return items.filter((item) => (item.type === 'login' && item.identity.includes('@')) || (item.type === 'custom' && ['identity', 'email'].includes(item.kind || '')));
    if (['phone', 'name', 'given-name', 'family-name', 'organization', 'address-line1', 'address-line2', 'city', 'region', 'postal-code', 'country', 'birth-date'].includes(role)) {
        return items.filter((item) => item.type === 'custom' && ['identity', 'driver_license', 'medical_record', 'membership', 'passport', 'social_security_number'].includes(item.kind || ''));
    }
    if (role === 'credential') return items.filter((item) => item.type === 'custom');
    return items.filter((item) => item.type !== 'login');
}

function maskPersonName(value: string): string {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => (part.length <= 1 ? part : `${part[0]}${'•'.repeat(Math.min(part.length - 1, 5))}`))
        .join(' ');
}

function maskEmail(value: string): string {
    const [user, domain] = value.split('@');
    if (!domain || !user) return maskPersonName(value);
    return `${user[0] || '•'}•••@${domain}`;
}

function lastCardDigits(number?: string): string {
    const digits = (number || '').replace(/\D/g, '');
    return digits.slice(-4);
}

function isIdentityKind(item: AutofillItem): boolean {
    return item.type === 'custom' && ['identity', 'driver_license', 'medical_record', 'membership', 'passport', 'social_security_number'].includes(item.kind || '');
}

function itemSubtitle(item: AutofillItem): string {
    if (item.type === 'card') {
        const last4 = lastCardDigits(item.cardNumber);
        return last4 ? `•••• ${last4}` : 'Credit card';
    }
    if (isIdentityKind(item)) {
        const name = item.fields?.fullName || item.identity;
        if (!name) return (item.kind || 'identity').replace(/_/g, ' ');
        return name.includes('@') ? maskEmail(name) : maskPersonName(name);
    }
    if (item.type === 'custom') return item.fields?.email || item.fields?.username || item.identity || (item.kind || 'item').replace(/_/g, ' ');
    return item.identity;
}

function paymentBrand(number?: string): string {
    const digits = (number || '').replace(/\D/g, '');
    if (/^4/.test(digits)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
    if (/^3[47]/.test(digits)) return 'amex';
    if (/^(6011|65|64[4-9])/.test(digits)) return 'discover';
    if (/^35/.test(digits)) return 'jcb';
    return 'card';
}

function currentFavicon(): string | undefined {
    const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"][href], link[rel="shortcut icon"][href]');
    const candidate = icon?.href || `${location.origin}/favicon.ico`;
    try {
        const url = new URL(candidate, location.href);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
    } catch {
        return undefined;
    }
}

function siteTitle(): string {
    const title = document.title.trim().split(/\s+[|·—–-]\s+/)[0]?.trim();
    return (title || location.hostname.replace(/^www\./, '')).slice(0, 120);
}

function siteMark(value?: string): string {
    const cleaned = (value || location.hostname).replace(/^www\./, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
    return cleaned.slice(0, 2) || 'FP';
}

export type FocuzPassOverlayTransport = <T>(message: Record<string, unknown>) => Promise<T>;

/**
 * Generous on purpose: on a busy machine the browser runs extension workers at
 * idle priority, so a sleeping worker can take many seconds to answer. Giving up
 * early turned "slow" into "broken"; the panel shows a waking-up state instead.
 */
/** Fields where a passkey sign-in can be offered. */
const PASSKEY_ROLES: ReadonlySet<FieldRole> = new Set(['username', 'email', 'password', 'credential']);

const FAST_MESSAGE_TYPES = new Set(['FOCUZPASS_STATUS', 'FOCUZPASS_PAGE_CONTEXT', 'FOCUZPASS_PENDING_LOGIN', 'FOCUZPASS_PING']);
const FAST_TIMEOUT_MS = 20_000;
const SLOW_TIMEOUT_MS = 30_000;
const KEEP_AWAKE_MS = 20_000;

async function runtimeSendMessage<T>(message: Record<string, unknown>): Promise<T> {
    if (!chrome.runtime?.id) throw new Error('Extension reloaded. Refresh this page to reconnect FocuzPass.');
    const limit = FAST_MESSAGE_TYPES.has(String(message.type)) ? FAST_TIMEOUT_MS : SLOW_TIMEOUT_MS;
    let timer = 0;
    const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error('FocuzPass took too long to respond')), limit);
    });
    try {
        const response = (await Promise.race([chrome.runtime.sendMessage(message), timeout])) as MessageResponse<T> | undefined;
        if (!response || response.ok !== true) {
            throw new Error(response && 'error' in response ? response.error : 'FocuzPass did not respond');
        }
        return response.data;
    } finally {
        window.clearTimeout(timer);
    }
}

const PAYMENT_SLOT_SELECTOR = [
    '.StripeElement',
    '[data-stripe]',
    'iframe[name^="__privateStripeFrame"]',
    'iframe[src*="js.stripe.com"]',
    'iframe[src*="hooks.stripe.com"]',
    'iframe[title*="card number" i]',
    'iframe[title*="secure card" i]',
    'iframe[title*="credit card" i]',
    'iframe[src*="paypal.com"]',
    'iframe[src*="braintreegateway.com"]',
].join(',');

const CONTEXT_REVALIDATE_MS = 30_000;
const SCAN_MIN_GAP_MS = 250;
const SAVE_TOAST_TIMEOUT_MS = 20_000;
const DISMISS_KEY = 'focuzpass.dismissed';
const NEVER_SAVE_KEY = 'focuzpass.neverSave.v1';

function debugPerf(label: string, startMark: string) {
    try {
        if (!window.localStorage.getItem('focuzpass:debug')) return;
        performance.mark(`${label}.end`);
        const measure = performance.measure(label, startMark, `${label}.end`);
        console.debug(`[focuzpass] ${label}: ${Math.round(measure.duration)}ms`);
    } catch {
        /* localStorage/perf unavailable */
    }
}

/** Session suppression for auto-open — per-origin since sessionStorage is origin-scoped. */
function readDismissed(): boolean {
    try {
        return window.sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
        return false;
    }
}

function writeDismissed() {
    try {
        window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
        /* ignore */
    }
}

async function readNeverSave(): Promise<string[]> {
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            const stored = await chrome.storage.local.get(NEVER_SAVE_KEY);
            const list = stored[NEVER_SAVE_KEY];
            return Array.isArray(list) ? list.map(String) : [];
        }
        const raw = window.localStorage.getItem(NEVER_SAVE_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

async function writeNeverSave(domain: string) {
    const list = await readNeverSave();
    if (!list.includes(domain)) list.push(domain);
    try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({ [NEVER_SAVE_KEY]: list });
        } else {
            window.localStorage.setItem(NEVER_SAVE_KEY, JSON.stringify(list));
        }
    } catch {
        /* ignore */
    }
}

function isLoginFieldRole(role: FieldRole): boolean {
    return role === 'password' || role === 'username' || role === 'email';
}

class FocuzPassPageOverlay {
    private controls = new Map<HTMLElement, FieldControl>();
    private activeInput: FillableControl | null = null;
    private activeControl: FieldControl | null = null;
    private popoverHost: HTMLDivElement | null = null;
    private saveHost: HTMLDivElement | null = null;
    private positionFrame = 0;
    private contextRequest = 0;
    private lastCaptures = new WeakMap<HTMLFormElement, number>();
    private observer: MutationObserver | null = null;
    private controlState: ControlState = 'checking';
    private dismissedFor: HTMLElement | null = null;
    private remoteSourceFrameId: number | null = null;
    private pageContext: PageContext | null = null;
    private pageContextAt = 0;
    private pageContextPromise: Promise<PageContext | null> | null = null;
    private contextPrefetched = false;
    private interactiveTargets = new Set<HTMLElement>();
    private saveTimer = 0;
    private signupSuggestedFor: HTMLElement | null = null;
    private theme: OverlayTheme = resolveOverlayTheme('system');
    private panel: HTMLDivElement | null = null;
    private panelBody: HTMLDivElement | null = null;
    private panelFoot: HTMLDivElement | null = null;
    private panelTitle: HTMLSpanElement | null = null;
    /** Final height while the panel is tweening, so above-field placement doesn't jump. */
    private panelTargetHeight = 0;
    private loadingTimer = 0;
    private wakingTimer = 0;
    /** Field the panel was last placed under — switching fields glides instead of jumping. */
    private placedFor: Element | null = null;
    private unlockWatch = 0;
    /** The "unlock to fill/save" prompt pops up on its own once per page load. */
    private lockedPromptShown = false;

    constructor(private readonly send: FocuzPassOverlayTransport = runtimeSendMessage) {}

    init() {
        if (document.getElementById(POPOVER_HOST_ID) || document.documentElement.hasAttribute('data-focuzpass-overlay')) return;
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
        // §5.1: skip tiny/hidden frames (<60×20) and ad-like cross-origin frames
        // that contain no fillable fields.
        if (window !== window.top && (window.innerWidth < 60 || window.innerHeight < 20)) return;
        document.documentElement.setAttribute('data-focuzpass-overlay', 'v1');

        this.scan();
        if (window !== window.top && this.controls.size === 0) {
            // Ad-like/utility frame with nothing fillable — stay inert (§5.1) but
            // keep a cheap childList-only observer in case fields appear later.
            this.observer = new MutationObserver(this.onMutations);
            this.observer.observe(document.documentElement, { childList: true, subtree: true });
            return;
        }
        void this.refreshControlState();
        this.observer = new MutationObserver(this.onMutations);
        this.observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['type', 'disabled', 'readonly', 'autocomplete', 'name', 'id', 'placeholder', 'aria-label', 'aria-labelledby'],
        });

        document.addEventListener('focusin', this.handleFocusIn, true);
        watchPasskeyOffer(this.openForPasskeyOffer);
        // §5.1: MutationObserver + requestIdleCallback replace the old 1200ms poll.
        const idleScan = () => {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(() => this.scan(), { timeout: 2000 });
            else window.setTimeout(() => this.scan(), 800);
        };
        window.setTimeout(idleScan, 900);
        document.addEventListener('submit', this.handleSubmit, true);
        document.addEventListener('click', this.handlePotentialSubmitClick, true);
        document.addEventListener('pointerdown', this.handleOutsidePointer, true);
        document.addEventListener('keydown', this.handleKeydown, true);
        window.addEventListener('scroll', this.schedulePosition, true);
        window.addEventListener('resize', this.schedulePosition, true);
        window.addEventListener('pageshow', this.checkPendingSoon);
        document.addEventListener('visibilitychange', this.handleVisibility);
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);
        }
        void this.loadTheme();
        window.setTimeout(() => void this.checkPending(), 650);
        if (window === window.top) {
            // The browser puts an idle extension worker to sleep after ~30s, and waking it
            // on a busy machine can take many seconds. While a page with login fields is
            // on screen, keep it awake with a no-op ping so filling stays instant.
            window.setInterval(() => {
                if (document.visibilityState !== 'visible' || this.controls.size === 0) return;
                if (typeof chrome !== 'undefined' && chrome.runtime && !chrome.runtime.id) return;
                void this.send<null>({ type: 'FOCUZPASS_PING' }).catch(() => undefined);
            }, KEEP_AWAKE_MS);
        }
    }

    private async loadTheme() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
        try {
            const stored = await chrome.storage.local.get(COLOR_MODE_KEY);
            this.applyTheme(resolveOverlayTheme(stored[COLOR_MODE_KEY]));
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local' && COLOR_MODE_KEY in changes) {
                    this.applyTheme(resolveOverlayTheme(changes[COLOR_MODE_KEY]?.newValue));
                }
            });
        } catch {
            /* keep the OS-based default */
        }
    }

    private applyTheme(theme: OverlayTheme) {
        this.theme = theme;
        for (const control of this.controls.values()) control.host.dataset.theme = theme;
        if (this.popoverHost) this.popoverHost.dataset.theme = theme;
        if (this.saveHost) this.saveHost.dataset.theme = theme;
    }

    /**
     * Pages that autofocus their login field focus it before this script runs, so
     * no focus event ever reaches us — open for that field once we know the vault state.
     */
    private autoOpenFocused = () => {
        const focused = document.activeElement;
        if (this.popoverHost || !isFillableControl(focused) || classifyField(focused) === 'unknown') return;
        if (this.controls.has(focused)) {
            this.interactiveTargets.add(focused);
            this.schedulePosition();
        }
        this.openFromField(focused);
    };

    /**
     * Busy pages (feeds, chats) mutate constantly. Only react to changes that can
     * affect form fields: a control's attributes, fields being added, or one of our
     * fields being removed.
     */
    private onMutations = (records: MutationRecord[]) => {
        for (const record of records) {
            if (record.type === 'attributes') {
                if (isFillableControl(record.target)) return this.scheduleScan();
                continue;
            }
            for (const node of record.addedNodes) {
                if (node.nodeType === 1 && mayContainFields(node as Element)) return this.scheduleScan();
            }
            if (this.controls.size === 0) continue;
            for (const node of record.removedNodes) {
                if (node.nodeType !== 1) continue;
                for (const target of this.controls.keys()) {
                    if (node === target || node.contains(target)) return this.scheduleScan();
                }
            }
        }
    };

    private scanQueued = false;
    private lastScanAt = 0;

    /** One pending scan at a time, at most every SCAN_MIN_GAP_MS, in idle time. */
    private scheduleScan = () => {
        if (this.scanQueued) return;
        this.scanQueued = true;
        const wait = Math.max(0, SCAN_MIN_GAP_MS - (performance.now() - this.lastScanAt));
        const run = () => {
            this.scanQueued = false;
            this.scan();
        };
        window.setTimeout(() => {
            if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 400 });
            else run();
        }, wait);
    };

    /** §5.1: perf marks gated behind `localStorage['focuzpass:debug']`. */
    private async sendTimed<T>(message: Record<string, unknown>): Promise<T> {
        const type = String(message.type || 'message');
        const startMark = `${type}.start.${Math.random().toString(36).slice(2)}`;
        try {
            performance.mark(startMark);
        } catch { /* ignore */ }
        const result = await this.send<T>(message);
        debugPerf(type, startMark);
        return result;
    }

    /** Cached page context still inside the revalidate window, if any. */
    private freshPageContext(): PageContext | null {
        if (!this.pageContext || this.pageContext.state !== 'ready') return null;
        return Date.now() - this.pageContextAt < CONTEXT_REVALIDATE_MS ? this.pageContext : null;
    }

    /** Prefetch + cache page context (§5.1); invalidated on lock/access change. Retries once. */
    private async getPageContext(force = false): Promise<PageContext | null> {
        const fresh = this.freshPageContext();
        if (!force && fresh) return fresh;
        if (this.pageContextPromise) return this.pageContextPromise;
        const request = async () => {
            try {
                return await this.sendTimed<PageContext>({ type: 'FOCUZPASS_PAGE_CONTEXT' });
            } catch {
                await new Promise((resolve) => window.setTimeout(resolve, 250));
                return this.sendTimed<PageContext>({ type: 'FOCUZPASS_PAGE_CONTEXT' });
            }
        };
        this.pageContextPromise = request()
            .then((context) => {
                this.pageContext = context;
                this.pageContextAt = Date.now();
                this.controlState = context.state === 'ready' ? 'ready' : 'locked';
                this.updateControls();
                return context;
            })
            .catch(() => null)
            .finally(() => {
                this.pageContextPromise = null;
            });
        return this.pageContextPromise;
    }

    private invalidatePageContext() {
        this.pageContext = null;
        this.pageContextAt = 0;
    }

    private collectFillable(): FillableControl[] {
        return Array.from(document.querySelectorAll<FillableControl>('input, textarea, select'))
            .filter((control) => {
                if (control.closest(`[${FIELD_HOST_ATTR}]`) || control.closest('#focuzpass-popover-host')) return false;
                return classifyField(control) !== 'unknown';
            });
    }

    private collectPaymentSlots(): HTMLElement[] {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(PAYMENT_SLOT_SELECTOR))
            .map((node) => {
                if (node instanceof HTMLIFrameElement) {
                    return (node.closest('.StripeElement') || node) as HTMLElement;
                }
                return node;
            })
            .filter((node, index, all) => node && all.indexOf(node) === index);
        return nodes.filter((node) => !nodes.some((other) => other !== node && node.contains(other)));
    }

    private familyFor(control: FillableControl, siblings: FillableControl[]): FieldFamily {
        const role = classifyField(control);
        if (role === 'email' && this.hasPasswordField(siblings)) return 'login';
        return roleFamily(role) || 'identity';
    }

    /** Memoized per sibling list — familyFor is called once per field. */
    private passwordScanFor: FillableControl[] | null = null;
    private passwordScanResult = false;
    private hasPasswordField(siblings: FillableControl[]): boolean {
        if (this.passwordScanFor !== siblings) {
            this.passwordScanFor = siblings;
            this.passwordScanResult = siblings.some((item) => classifyField(item) === 'password');
        }
        return this.passwordScanResult;
    }

    private groupAnchors(fillable: FillableControl[], slots: HTMLElement[]): Map<string, HTMLElement> {
        const groups = new Map<string, HTMLElement[]>();
        for (const field of fillable) {
            const family = this.familyFor(field, fillable);
            const key = family === 'payment' ? 'payment:page' : `${family}:${scopeKey(fieldScope(field))}`;
            const list = groups.get(key) || [];
            list.push(field);
            groups.set(key, list);
        }
        if (slots.length > 0) {
            const key = 'payment:page';
            groups.set(key, [...(groups.get(key) || []), ...slots]);
        }
        const anchors = new Map<string, HTMLElement>();
        for (const [key, members] of groups) {
            const ranked = members
                .filter((node) => isVisibleTarget(node, isFillableControl(node) ? classifyField(node) : 'card-number'))
                .sort((a, b) => {
                    const aRole = isFillableControl(a) ? classifyField(a) : 'card-number';
                    const bRole = isFillableControl(b) ? classifyField(b) : 'card-number';
                    const weight = (role: FieldRole) => (
                        role === 'card-number' || role === 'username' || role === 'name' || role === 'address-line1' ? 0
                            : role === 'email' || role === 'cardholder' ? 1
                                : 2
                    );
                    return weight(aRole) - weight(bRole);
                });
            if (ranked[0]) anchors.set(key, ranked[0]);
        }
        return anchors;
    }

    private scan() {
        this.lastScanAt = performance.now();
        classifyGeneration += 1;
        if (isHostedPaymentFrame()) {
            for (const control of this.controls.values()) control.host.remove();
            this.controls.clear();
            return;
        }
        const fillable = this.collectFillable();
        const slots = this.collectPaymentSlots();
        const anchors = new Set(this.groupAnchors(fillable, slots).values());
        for (const [target, control] of this.controls) {
            if (!anchors.has(target) || !target.isConnected) {
                control.host.remove();
                this.controls.delete(target);
                this.interactiveTargets.delete(target);
            }
        }
        for (const anchor of anchors) {
            if (this.controls.has(anchor)) continue;
            this.attachTarget(anchor, isFillableControl(anchor) ? undefined : 'card-number');
        }
        this.syncAnchor();
        // §5.1: prefetch page context as soon as the first login/signup field exists.
        if (!this.contextPrefetched && fillable.some((control) => isLoginFieldRole(classifyField(control)))) {
            this.contextPrefetched = true;
            void this.getPageContext().then(this.autoOpenFocused);
        }
        this.schedulePosition();
    }

    private attachTarget(target: HTMLElement, virtualRole?: FieldRole) {
        const host = document.createElement('div');
        host.setAttribute(FIELD_HOST_ATTR, '');
        host.dataset.theme = this.theme;
        // The host never takes clicks itself — only the (visible) button inside does.
        host.style.cssText = 'all:initial;position:fixed;z-index:2147483645;width:20px;height:20px;display:none;pointer-events:none;';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = OVERLAY_STYLE;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'field-btn';
        button.setAttribute('aria-label', 'Open FocuzPass');
        button.title = 'FocuzPass';
        button.addEventListener('pointerdown', (event) => event.preventDefault());
        button.addEventListener('click', () => void this.toggle(target));
        if (isFillableControl(target)) {
            // §5.4: the field icon appears only while the field is hovered or focused.
            target.addEventListener('pointerenter', () => {
                this.interactiveTargets.add(target);
                this.schedulePosition();
            });
            // Moving from the field onto its own icon (or back) must not hide the icon,
            // or it vanishes right as you reach for it.
            const leave = (event: Event) => {
                const next = (event as PointerEvent).relatedTarget;
                if (next === host || next === target) return;
                if (document.activeElement !== target) this.interactiveTargets.delete(target);
                this.schedulePosition();
            };
            target.addEventListener('pointerleave', leave);
            button.addEventListener('pointerleave', leave);
            target.addEventListener('focus', () => {
                this.interactiveTargets.add(target);
                this.schedulePosition();
                this.openFromField(target);
            });
            target.addEventListener('blur', () => {
                this.interactiveTargets.delete(target);
                if (this.dismissedFor === target) this.dismissedFor = null;
                this.schedulePosition();
            });
        }
        shadow.append(style, button);
        document.documentElement.appendChild(host);
        const control: FieldControl = { host, shadow, button, target, virtualRole };
        this.controls.set(target, control);
        if (isFillableControl(target) && document.activeElement === target) this.interactiveTargets.add(target);
        this.updateControl(target, control);
    }

    private handleFocusIn = (event: FocusEvent) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
        if (classifyField(target) === 'unknown') return;
        this.openFromField(target);
    };

    private refreshControlState = async () => {
        try {
            const status = await this.sendTimed<VaultStatus>({ type: 'FOCUZPASS_STATUS' });
            this.controlState = status.configured && status.unlocked ? 'ready' : 'locked';
        } catch {
            this.controlState = 'locked';
        }
        this.updateControls();
        this.schedulePosition();
        if (this.controlState === 'ready') void this.getPageContext().then(this.autoOpenFocused);
    };

    private updateControls() {
        for (const [input, control] of this.controls) this.updateControl(input, control);
    }

    private updateControl(_input: HTMLElement, control: FieldControl) {
        const open = Boolean(this.popoverHost && this.activeControl === control);
        const locked = this.controlState === 'locked';
        control.button.classList.toggle('is-locked', locked);
        control.button.classList.toggle('is-open', open);
        control.button.setAttribute('aria-expanded', String(open));
        control.button.setAttribute('aria-label', locked ? 'Unlock FocuzPass' : 'Show matching FocuzPass items');
        const mode = locked ? 'locked' : 'ready';
        if (control.mode !== mode) {
            control.mode = mode;
            control.button.innerHTML = locked ? icon('lock') : BRAND_MARK;
        }
    }

    private schedulePosition = () => {
        if (this.positionFrame) return;
        this.positionFrame = window.requestAnimationFrame(() => {
            this.positionFrame = 0;
            this.positionControls();
        });
    };

    private positionControls() {
        for (const [target, control] of this.controls) {
            const role = control.virtualRole || (isFillableControl(target) ? classifyField(target) : 'card-number');
            if (!isVisibleTarget(target, role)) {
                control.host.style.display = 'none';
                control.button.classList.remove('is-shown');
                continue;
            }
            // Icon only while the field is hovered/focused and no panel is open,
            // or always for a hosted payment slot (no hoverable input) (§5.4).
            const shown = !this.popoverHost && (!isFillableControl(target) || this.interactiveTargets.has(target));
            const rect = overlayAnchorRect(target);
            const size = Math.max(16, Math.min(20, rect.height - 12));
            control.host.style.width = `${size}px`;
            control.host.style.height = `${size}px`;
            control.host.style.left = `${Math.max(3, rect.right - size - 8)}px`;
            control.host.style.top = `${Math.max(3, rect.top + (rect.height - size) / 2)}px`;
            if (control.host.style.display !== 'block') {
                control.host.style.display = 'block';
                // Paint the hidden state once so the fade-in actually transitions.
                void control.button.offsetWidth;
            }
            control.button.classList.toggle('is-shown', shown);
        }
        if (this.popoverHost) this.positionPopover();
    }

    private shouldProxyPopover() {
        return window !== window.top && (window.innerHeight < 220 || window.innerWidth < 280);
    }

    private familyOf(target: HTMLElement, siblings = this.collectFillable()): FieldFamily {
        return isFillableControl(target) ? this.familyFor(target, siblings) : 'payment';
    }

    private sameArea(a: HTMLElement, b: HTMLElement): boolean {
        const siblings = this.collectFillable();
        const familyA = this.familyOf(a, siblings);
        const familyB = this.familyOf(b, siblings);
        if (familyA !== familyB) return false;
        if (familyA === 'payment') return true;
        return fieldScope(a) === fieldScope(b);
    }

    private controlForField(target: HTMLElement): FieldControl | null {
        const direct = this.controls.get(target);
        if (direct) return direct;
        for (const [anchor, control] of this.controls) {
            if (this.sameArea(anchor, target)) return control;
        }
        return null;
    }

    private matchesFor(target: HTMLElement, context: PageContext | null): AutofillItem[] {
        if (!context || context.state !== 'ready') return [];
        const role = this.controls.get(target)?.virtualRole
            || (isFillableControl(target) ? classifyField(target) : 'card-number');
        return relevantItemsForRole(context.items || context.matches, role)
            .filter((item) => !isFillableControl(target) || Boolean(valueForControl(target as FillableControl, item)));
    }

    private isSignupContext(target: HTMLElement): boolean {
        if (/signup|sign-up|register|create-account|join/i.test(location.pathname)) return true;
        if (target instanceof HTMLInputElement && target.type === 'password') {
            const form = target.form || target.closest('form');
            if (form && isAccountCreationForm(form, target)) return true;
        }
        return false;
    }

    /** New-password field on a signup form — gets the suggested-password panel (§5.4). */
    private isNewPasswordField(target: HTMLElement): target is HTMLInputElement {
        return target instanceof HTMLInputElement && target.type === 'password'
            && target.autocomplete.toLowerCase() !== 'current-password' && this.isSignupContext(target);
    }

    /** Signup vs login, judged from the whole form so the email field counts too. */
    private formLooksLikeSignup(target: HTMLElement): boolean {
        if (/signup|sign-up|register|create-account|join/i.test(location.pathname)) return true;
        const form = (isFillableControl(target) ? target.form : null) || target.closest('form');
        const password = form ? passwordInputFor(form) : null;
        return Boolean(form && password && isAccountCreationForm(form, password));
    }

    /**
     * Auto-open on focus when the vault is unlocked and there are matches (§5.4), or —
     * when it's locked — offer to unlock on login/signup fields. An open panel is reused:
     * moving between fields glides it and swaps its content instead of replaying it.
     */
    private openFromField(target: HTMLElement) {
        if (this.dismissedFor === target || readDismissed()) return;
        const context = this.pageContext;
        if (context?.state === 'ready' && this.isNewPasswordField(target)) {
            void this.openSignupPanel(target);
            return;
        }
        if (this.popoverHost && (this.activeControl?.target === target || this.activeInput === target
            || (this.activeControl && this.sameArea(this.activeControl.target, target)))) {
            // Back from the suggested-password panel to a field with saved logins: show them.
            if (this.signupSuggestedFor && context?.state === 'ready' && this.matchesFor(target, context).length > 0) {
                void this.openPopover(target);
                return;
            }
            this.activeInput = isFillableControl(target) ? target : this.activeInput;
            this.positionPopover();
            return;
        }
        if (context?.state === 'ready' && (this.matchesFor(target, context).length > 0 || this.passkeyOfferFor(target))) {
            void this.openPopover(target);
            return;
        }
        // Locked vault on a login/signup form: say so right away and offer to unlock.
        if (context?.state === 'locked' && !this.lockedPromptShown && isFillableControl(target) && isLoginFieldRole(classifyField(target))) {
            this.lockedPromptShown = true;
            void this.openPopover(target);
            return;
        }
        // Revalidate the context on focus (§5.1) — auto-opens if matches or a lock show up.
        void this.getPageContext(true).then((fresh) => {
            if (this.popoverHost || readDismissed() || document.activeElement !== target) return;
            if (fresh?.state === 'ready' && (this.matchesFor(target, fresh).length > 0 || this.passkeyOfferFor(target))) void this.openPopover(target);
            else if (fresh?.state === 'locked' && !this.lockedPromptShown && isFillableControl(target) && isLoginFieldRole(classifyField(target))) {
                this.lockedPromptShown = true;
                void this.openPopover(target);
            }
        });
    }

    /** A page waiting for a passkey sign-in, on a field where FocuzPass can offer one. */
    private passkeyOfferFor(target: HTMLElement): boolean {
        return Boolean(currentPasskeyOffer()) && isFillableControl(target) && PASSKEY_ROLES.has(classifyField(target));
    }

    /** The offer can arrive after the page focused its username field: open for that field then. */
    private openForPasskeyOffer = () => {
        const focused = document.activeElement;
        if (!currentPasskeyOffer() || !(focused instanceof HTMLElement) || !this.passkeyOfferFor(focused)) return;
        if (this.popoverHost && (this.activeInput === focused || this.activeControl?.target === focused)) {
            void this.getPageContext().then((context) => context && this.renderContext(context));
            return;
        }
        this.openFromField(focused);
    };

    private async toggle(target: HTMLElement) {
        if (this.popoverHost && this.activeControl?.target === target) {
            this.closePopover({ dismissed: true });
            return;
        }
        if (this.isSignupContext(target) && target instanceof HTMLInputElement && target.type === 'password'
            && this.controlState !== 'locked') {
            void this.openSignupPanel(target);
            return;
        }
        void this.openPopover(target);
    }

    private async openPopover(target: HTMLElement) {
        if (this.popoverHost && this.activeControl?.target === target && !this.signupSuggestedFor) return;
        if (this.shouldProxyPopover()) {
            void chrome.runtime.sendMessage({
                type: 'FOCUZPASS_OVERLAY_RELAY',
                payloadType: 'FOCUZPASS_OVERLAY_OPEN',
                frameId: 0,
                payload: {
                    role: this.controls.get(target)?.virtualRole || (isFillableControl(target) ? classifyField(target) : 'card-number'),
                },
            }).catch(() => undefined);
            return;
        }
        this.preparePopover(target);

        const cached = this.freshPageContext();
        if (cached) {
            this.renderContext(cached);
            return;
        }
        await this.loadIntoPanel(false);
    }

    /** Fetch page context into the open panel; the skeleton only shows if it's actually slow. */
    private async loadIntoPanel(force: boolean) {
        const request = ++this.contextRequest;
        window.clearTimeout(this.loadingTimer);
        window.clearTimeout(this.wakingTimer);
        this.loadingTimer = window.setTimeout(() => {
            if (request === this.contextRequest && this.popoverHost) this.renderLoading();
        }, 140);
        this.wakingTimer = window.setTimeout(() => {
            if (request === this.contextRequest && this.popoverHost) {
                this.renderLoading('Waking up FocuzPass… this can take a few seconds when your computer is busy.');
            }
        }, 2500);
        const context = await this.getPageContext(force);
        window.clearTimeout(this.loadingTimer);
        window.clearTimeout(this.wakingTimer);
        if (request !== this.contextRequest || !this.popoverHost) return;
        if (!context) {
            this.renderError('The extension didn’t answer. Try again — if it keeps happening, reload FocuzNow from your extensions page.', () => void this.loadIntoPanel(true));
            return;
        }
        this.renderContext(context);
    }

    /**
     * Point the popover at a field. An already-open panel is kept — its content is
     * swapped (height tween) and it glides to the new field — so nothing replays.
     */
    private preparePopover(target: HTMLElement) {
        if (this.popoverHost) {
            this.contextRequest += 1;
            window.clearTimeout(this.loadingTimer);
            window.clearTimeout(this.wakingTimer);
            this.stopUnlockWatch();
            this.keyboardItems = [];
            this.signupSuggestedFor = null;
        } else {
            this.createPopover();
        }
        this.dismissedFor = null;
        this.activeInput = isFillableControl(target) ? target : null;
        this.activeControl = this.controls.get(target) || this.controlForField(target);
        this.updateControls();
        this.schedulePosition();
    }

    private createPopover() {
        const host = document.createElement('div');
        host.id = POPOVER_HOST_ID;
        host.dataset.theme = this.theme;
        host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;display:block;min-width:260px;max-width:min(360px, calc(100vw - 16px));';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = OVERLAY_STYLE;
        shadow.appendChild(style);
        document.documentElement.appendChild(host);
        this.popoverHost = host;
        this.panel = null;
        this.panelBody = null;
        this.panelFoot = null;
        this.panelTitle = null;
        this.panelTargetHeight = 0;
        this.placedFor = null;
    }

    /**
     * The panel is built once per open. Later renders swap its body and tween the
     * height, so loading → results doesn't flash or replay the entrance animation.
     */
    private renderPanel(label: string, domain: string | null, build: (body: HTMLDivElement, foot: HTMLDivElement) => void) {
        const shadow = this.popoverHost?.shadowRoot;
        if (!shadow) return;
        const previousHeight = this.panel ? this.panel.getBoundingClientRect().height : 0;
        if (!this.panel) {
            const panel = createElement('div', 'panel');
            panel.setAttribute('role', 'dialog');
            const head = createElement('div', 'head');
            appendIcon(head, BRAND_MARK);
            const title = createElement('span', 'head-title');
            const close = iconButton('x', 'Dismiss FocuzPass');
            close.addEventListener('click', () => this.closePopover({ dismissed: true }));
            head.append(title, close);
            this.panelBody = createElement('div', 'body');
            this.panelFoot = createElement('div', 'foot');
            panel.append(head, this.panelBody, this.panelFoot);
            this.panelTitle = title;
            this.panel = panel;
            shadow.appendChild(panel);
        }
        const panel = this.panel;
        const body = this.panelBody!;
        const foot = this.panelFoot!;
        panel.setAttribute('aria-label', label);
        this.panelTitle!.replaceChildren(createElement('strong', '', 'FocuzPass'));
        if (domain) this.panelTitle!.appendChild(createElement('span', '', domain));
        body.removeAttribute('aria-busy');
        body.replaceChildren();
        foot.replaceChildren();
        build(body, foot);
        foot.hidden = foot.childElementCount === 0;
        if (previousHeight > 0 && !prefersReducedMotion()) {
            const nextHeight = panel.getBoundingClientRect().height;
            if (Math.abs(nextHeight - previousHeight) > 1) {
                this.panelTargetHeight = nextHeight;
                const tween = panel.animate(
                    [{ height: `${previousHeight}px` }, { height: `${nextHeight}px` }],
                    { duration: 220, easing: EASE_OUT },
                );
                const settle = () => {
                    this.panelTargetHeight = 0;
                };
                tween.onfinish = settle;
                tween.oncancel = settle;
            }
            body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
        }
        this.positionPopover();
    }

    private note(iconName: IconName, title: string, text: string, tone?: 'error') {
        const note = createElement('div', `note${tone ? ` is-${tone}` : ''}`);
        const tile = createElement('span', 'tile');
        tile.innerHTML = icon(iconName);
        const copy = createElement('div', 'note-copy');
        copy.append(createElement('p', 'note-title', title), createElement('p', 'note-text', text));
        note.append(tile, copy);
        return note;
    }

    private renderLoading(note?: string) {
        this.keyboardItems = [];
        this.renderPanel('Looking for saved items', null, (body) => {
            body.setAttribute('aria-busy', 'true');
            for (let index = 0; index < 2; index += 1) {
                const row = createElement('div', 'skeleton');
                const lines = createElement('span', 'sk-lines');
                lines.append(createElement('i', 'sk-a'), createElement('i', 'sk-b'));
                row.append(createElement('i', 'sk-tile'), lines);
                body.appendChild(row);
            }
            if (note) body.appendChild(createElement('p', 'loading-note', note));
        });
    }

    private renderContext(context: PageContext) {
        if (!this.popoverHost) return;
        if (context.state === 'locked') {
            const signup = this.activeInput ? this.formLooksLikeSignup(this.activeInput) : false;
            this.renderGate(
                signup ? 'Unlock to save this login' : 'Unlock to fill this login',
                signup
                    ? `FocuzPass is locked. Unlock it so the account you create on ${context.domain} can be saved.`
                    : `FocuzPass is locked. Unlock it to fill your saved login for ${context.domain}.`,
                'Unlock FocuzPass',
            );
            return;
        }
        if (context.state === 'unconfigured') {
            this.renderGate('Set up your vault', 'Create a master password before saving or filling logins.', 'Set up FocuzPass');
            return;
        }
        const role = this.activeControl?.virtualRole
            || (this.activeInput ? classifyField(this.activeInput) : 'card-number');
        const matches = relevantItemsForRole(context.items || context.matches, role)
            .filter((item) => !this.activeInput || Boolean(valueForControl(this.activeInput, item)));
        // A page waiting for a passkey sign-in: FocuzPass's passkeys for it go first.
        const passkeys = PASSKEY_ROLES.has(role) ? currentPasskeyOffer() : null;
        if (matches.length === 0 && !passkeys) {
            this.renderEmpty(context.domain, role);
            return;
        }
        this.renderMatches(context.domain, matches, passkeys);
    }

    private renderGate(title: string, description: string, actionLabel: string) {
        this.keyboardItems = [];
        this.renderPanel(title, null, (body) => {
            body.appendChild(this.note('lock', title, description));
            const actions = createElement('div', 'note-actions');
            const action = textButton('primary', actionLabel, 'arrowRight', true);
            action.addEventListener('click', () => this.openUnlockWindow());
            actions.appendChild(action);
            body.appendChild(actions);
        });
    }

    private renderEmpty(domain: string, role: FieldRole) {
        this.keyboardItems = [];
        const cardRole = role.startsWith('card-') || role === 'cardholder' || role === 'cvv';
        const label = cardRole ? 'cards' : role === 'password' || role === 'username' ? 'logins' : 'matching items';
        this.renderPanel(`FocuzPass items for ${domain}`, domain, (body, foot) => {
            body.appendChild(this.note(cardRole ? 'creditCard' : 'keyRound', `No saved ${label}`, `Nothing in FocuzPass matches this field on ${domain}.`));
            this.fillFooter(foot);
        });
    }

    private itemTile(match: AutofillItem, favicon?: string) {
        const tile = createElement('span', 'tile');
        if (match.type === 'card') {
            const brand = paymentBrand(match.cardNumber);
            if (brand === 'card') {
                tile.innerHTML = icon('creditCard');
            } else {
                tile.classList.add('is-card');
                tile.textContent = brand === 'mastercard' ? 'MC' : brand === 'discover' ? 'DISC' : brand.toUpperCase();
            }
            return tile;
        }
        if (isIdentityKind(match)) {
            tile.innerHTML = icon('userRound');
            return tile;
        }
        const mark = match.mark || siteMark(match.title);
        if (favicon && match.type === 'login') {
            const image = createElement('img');
            image.alt = '';
            image.src = favicon;
            image.addEventListener('error', () => {
                tile.textContent = mark;
            }, { once: true });
            tile.appendChild(image);
        } else {
            tile.textContent = mark;
        }
        return tile;
    }

    private renderMatches(domain: string, matches: AutofillItem[], passkeys: PasskeyOffer | null = null) {
        this.keyboardItems = matches;
        this.keyboardIndex = 0;
        const favicon = currentFavicon();
        this.renderPanel(`FocuzPass · ${domain}`, domain, (body, foot) => {
            const list = createElement('div', 'list');
            list.setAttribute('role', 'listbox');
            list.setAttribute('aria-label', 'Saved items');
            for (const account of passkeys?.accounts ?? []) {
                const row = createElement('button', 'row pk-row');
                row.type = 'button';
                row.setAttribute('role', 'option');
                row.setAttribute('aria-label', `Sign in with a passkey as ${account.userName || account.title}`);
                const tile = createElement('span', 'tile');
                tile.innerHTML = icon('keyRound');
                const copy = createElement('span', 'copy');
                copy.append(createElement('span', 'title', 'Sign in with a passkey'), createElement('span', 'sub', account.userName || account.title));
                row.append(tile, copy);
                row.addEventListener('pointerdown', (event) => event.preventDefault());
                row.addEventListener('click', (event) => {
                    if (!event.isTrusted) return;
                    passkeys!.choose(account.credentialId);
                    this.closePopover();
                });
                list.appendChild(row);
            }
            for (const [index, match] of matches.entries()) {
                const row = createElement('button', `row${index === 0 ? ' is-active' : ''}`);
                row.type = 'button';
                row.setAttribute('role', 'option');
                row.setAttribute('aria-selected', String(index === 0));
                row.dataset.index = String(index);
                row.setAttribute('aria-label', `Fill ${match.title} (${itemSubtitle(match)})`);
                const copy = createElement('span', 'copy');
                copy.append(createElement('span', 'title', match.title), createElement('span', 'sub', itemSubtitle(match)));
                const hint = createElement('span', 'hint');
                hint.innerHTML = icon('enter');
                row.append(this.itemTile(match, favicon), copy, hint);
                row.addEventListener('pointerdown', (event) => event.preventDefault());
                row.addEventListener('click', () => this.fillMatch(match));
                row.addEventListener('pointerenter', () => this.setKeyboardIndex(index));
                list.appendChild(row);
            }
            body.appendChild(list);
            this.fillFooter(foot);
        });
    }

    private keyboardItems: AutofillItem[] = [];
    private keyboardIndex = 0;

    private setKeyboardIndex(index: number) {
        this.keyboardIndex = index;
        const rows = Array.from(this.panelBody?.querySelectorAll<HTMLElement>('.row:not(.pk-row)') || []);
        rows.forEach((node, i) => {
            node.classList.toggle('is-active', i === index);
            node.setAttribute('aria-selected', String(i === index));
        });
        rows[index]?.scrollIntoView({ block: 'nearest' });
    }

    private renderError(message: string, retry?: () => void, title = 'Couldn’t reach FocuzPass') {
        if (!this.popoverHost) return;
        this.keyboardItems = [];
        this.renderPanel(title, null, (body) => {
            body.appendChild(this.note('alert', title, message, 'error'));
            if (retry) {
                const actions = createElement('div', 'note-actions');
                const again = textButton('secondary', 'Try again', 'rotateCw');
                again.addEventListener('click', retry);
                actions.appendChild(again);
                body.appendChild(actions);
            }
        });
    }

    private fillFooter(foot: HTMLElement) {
        if (this.activeInput && classifyField(this.activeInput) === 'password') {
            const suggest = textButton('ghost', 'Suggest password', 'sparkles');
            suggest.addEventListener('click', () => void this.generateAndFill());
            foot.appendChild(suggest);
        }
        const open = textButton('ghost', 'Open FocuzPass', 'externalLink');
        open.addEventListener('click', () => this.openDashboard());
        foot.appendChild(open);
    }

    /**
     * Open the secure window and keep this panel open, waiting: once you unlock it
     * swaps straight to your saved logins (it used to close and go stale).
     */
    private openUnlockWindow() {
        void this.send<null>({ type: 'FOCUZPASS_OPEN_ACCESS_WINDOW' }).catch(() => undefined);
        if (!this.popoverHost) return;
        this.keyboardItems = [];
        this.renderPanel('Waiting for unlock', null, (body) => {
            body.appendChild(this.note('lock', 'Finish unlocking in the FocuzPass window', 'This panel updates by itself as soon as your vault is unlocked.'));
            const actions = createElement('div', 'note-actions');
            const again = textButton('secondary', 'Reopen window', 'externalLink');
            again.addEventListener('click', () => void this.send<null>({ type: 'FOCUZPASS_OPEN_ACCESS_WINDOW' }).catch(() => undefined));
            actions.appendChild(again);
            body.appendChild(actions);
        });
        this.startUnlockWatch();
    }

    private startUnlockWatch() {
        this.stopUnlockWatch();
        const startedAt = Date.now();
        this.unlockWatch = window.setInterval(() => {
            if (!this.popoverHost || Date.now() - startedAt > 180_000) {
                this.stopUnlockWatch();
                return;
            }
            if (document.visibilityState !== 'visible') return;
            void this.sendTimed<VaultStatus>({ type: 'FOCUZPASS_STATUS' }).then((status) => {
                if (status.configured && status.unlocked) void this.onAccessChanged();
            }).catch(() => undefined);
        }, 1000);
    }

    private stopUnlockWatch() {
        window.clearInterval(this.unlockWatch);
        this.unlockWatch = 0;
    }

    /** Vault unlocked/locked elsewhere: drop stale state and refresh an open panel in place. */
    private async onAccessChanged() {
        this.stopUnlockWatch();
        this.invalidatePageContext();
        this.contextPrefetched = false;
        await this.refreshControlState();
        if (this.popoverHost && (this.activeInput || this.activeControl)) await this.loadIntoPanel(true);
    }

    private openDashboard() {
        void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS', tab: 'focuzpass' });
        this.closePopover();
    }

    private fillMatch(match: AutofillItem) {
        if (this.remoteSourceFrameId != null) {
            void chrome.runtime.sendMessage({
                type: 'FOCUZPASS_OVERLAY_RELAY',
                payloadType: 'FOCUZPASS_OVERLAY_FILL',
                frameId: this.remoteSourceFrameId,
                payload: { item: match },
            }).catch(() => undefined);
            this.closePopover();
            return;
        }
        const activeInput = this.activeInput;
        const scope = (activeInput && (activeInput.form || activeInput.closest('form') || activeInput.closest('[role="dialog"], main, section, article'))) || document;
        const controls = Array.from(scope.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));
        for (const control of controls) {
            if (control instanceof HTMLInputElement && (control.disabled || ['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(control.type))) continue;
            if (control instanceof HTMLSelectElement && control.disabled) continue;
            if (control instanceof HTMLTextAreaElement && (control.disabled || !isElementVisuallyAvailable(control))) continue;
            const role = classifyField(control);
            const choiceField = role === 'country' || role === 'region' || role === 'card-exp-month' || role === 'card-exp-year';
            if (control instanceof HTMLInputElement && !choiceField && !isRenderableInput(control) && !control.list) continue;
            let value = valueForControl(control, match);
            if (!value) continue;
            if (role === 'card-number') value = value.replace(/\D/g, '');
            if (role === 'card-expiry' && control instanceof HTMLInputElement && control.type === 'month') {
                const [month, year] = value.split('/');
                value = `${year?.length === 2 ? `20${year}` : year}-${month}`;
            }
            if (role === 'card-exp-year' && control instanceof HTMLInputElement && control.maxLength === 2) value = value.slice(-2);
            setControlValue(control, value, role);
        }
        if (match.type === 'login' && match.password) {
            const passwordInput = controls.find((control): control is HTMLInputElement => control instanceof HTMLInputElement && classifyField(control) === 'password');
            if (passwordInput) fillRelatedPasswordConfirmation(passwordInput, match.password);
        }
        activeInput?.focus({ preventScroll: true });
        void this.send<null>({ type: 'FOCUZPASS_MARK_USED', id: match.id }).catch(() => undefined);
        this.closePopover();
        if (match.type === 'login' && activeInput) window.queueMicrotask(() => {
            const passwordInput = controls.find((control): control is HTMLInputElement => control instanceof HTMLInputElement && classifyField(control) === 'password');
            submitFilledLogin(passwordInput || (activeInput instanceof HTMLInputElement ? activeInput : passwordInput!));
        });
    }

    /** §5.4: suggested-password panel on signup forms — fills password + confirm. */
    private async openSignupPanel(passwordInput: HTMLInputElement) {
        if (this.popoverHost && this.signupSuggestedFor === passwordInput) return;
        this.preparePopover(passwordInput);
        this.signupSuggestedFor = passwordInput;
        const request = ++this.contextRequest;

        let suggested = '';
        try {
            suggested = await this.sendTimed<string>({ type: 'FOCUZPASS_GENERATE', length: 20 });
        } catch {
            suggested = '';
        }
        if (request !== this.contextRequest || !this.popoverHost) return;
        if (!suggested) {
            this.renderError('FocuzPass couldn’t make a password right now.', () => {
                this.signupSuggestedFor = null;
                void this.openSignupPanel(passwordInput);
            }, 'Couldn’t make a password');
            return;
        }

        const masked = '•'.repeat(16);
        let revealed = false;
        this.keyboardItems = [];
        this.renderPanel('Suggested password', location.hostname.replace(/^www\./, ''), (body) => {
            const wrap = createElement('div', 'pw');
            wrap.appendChild(createElement('p', 'pw-label', 'Suggested strong password'));
            const value = createElement('div', 'pw-value');
            value.setAttribute('aria-label', 'Suggested password');
            const text = createElement('span', 'pw-text', masked);
            const reveal = iconButton('eye', 'Show password');
            reveal.addEventListener('click', () => {
                revealed = !revealed;
                text.textContent = revealed ? suggested : masked;
                reveal.innerHTML = icon(revealed ? 'eyeOff' : 'eye');
                const label = revealed ? 'Hide password' : 'Show password';
                reveal.setAttribute('aria-label', label);
                reveal.title = label;
            });
            const again = iconButton('rotateCw', 'Generate another');
            again.addEventListener('click', async () => {
                again.classList.remove('rotating');
                void again.offsetWidth;
                again.classList.add('rotating');
                try {
                    const next = await this.sendTimed<string>({ type: 'FOCUZPASS_GENERATE', length: 20 });
                    text.classList.add('is-swapping');
                    window.setTimeout(() => {
                        suggested = next;
                        text.textContent = revealed ? suggested : masked;
                        text.classList.remove('is-swapping');
                    }, 140);
                } catch {
                    /* keep the current suggestion */
                }
            });
            value.append(text, reveal, again);
            const use = textButton('primary', 'Use strong password', 'check');
            use.classList.add('btn-block');
            use.addEventListener('click', () => {
                if (!suggested) return;
                setInputValue(passwordInput, suggested);
                fillRelatedPasswordConfirmation(passwordInput, suggested);
                this.closePopover();
                passwordInput.focus({ preventScroll: true });
            });
            wrap.append(value, use);
            body.appendChild(wrap);
        });
    }

    private async generateAndFill() {
        const passwordInput = this.activeInput;
        if (!(passwordInput instanceof HTMLInputElement)) return;
        try {
            const password = await this.send<string>({ type: 'FOCUZPASS_GENERATE', length: 20 });
            setInputValue(passwordInput, password);
            fillRelatedPasswordConfirmation(passwordInput, password);
            passwordInput.focus({ preventScroll: true });
            this.closePopover();
        } catch (error) {
            this.renderError(error instanceof Error ? error.message : 'Could not generate a password', undefined, 'Couldn’t make a password');
        }
    }

    private positionPopover() {
        if (!this.popoverHost) return;
        const focused = document.activeElement;
        const anchor = (focused && isFillableControl(focused) && classifyField(focused) !== 'unknown' ? focused : null)
            || this.activeInput
            || this.activeControl?.target;
        if (!anchor) return;
        const rect = overlayAnchorRect(anchor);
        const origin = fixedOverlayOrigin();
        // §5.4: match the field width within 280–360px, sit 6px below the field,
        // flip above when there's no room, and never overlap the field itself.
        const width = Math.min(Math.max(280, Math.min(360, rect.width)), window.innerWidth - 16);
        this.popoverHost.style.width = `${width}px`;
        const panelHeight = Math.min(this.panelTargetHeight || this.popoverHost.offsetHeight || 96, window.innerHeight - 16);
        const gap = 6;
        const below = rect.bottom + gap;
        const fitsBelow = below + panelHeight <= window.innerHeight - 8;
        const top = fitsBelow
            ? below
            : Math.max(8, rect.top - panelHeight - gap);
        const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
        const host = this.popoverHost;
        const prevLeft = parseFloat(host.style.left);
        const prevTop = parseFloat(host.style.top);
        host.style.left = `${left - origin.x}px`;
        host.style.top = `${top - origin.y}px`;
        // Moving to another field glides the panel; scrolling/resizing just follows.
        const moved = this.placedFor !== null && this.placedFor !== anchor;
        this.placedFor = anchor;
        if (moved && Number.isFinite(prevLeft) && Number.isFinite(prevTop) && !prefersReducedMotion()) {
            const dx = prevLeft - (left - origin.x);
            const dy = prevTop - (top - origin.y);
            if (Math.abs(dx) + Math.abs(dy) > 1) {
                host.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240, easing: EASE_OUT });
            }
        }
        // Placement only decides the entrance direction, so set it once per panel.
        if (this.panel && !this.panel.dataset.placement) this.panel.dataset.placement = fitsBelow ? 'below' : 'above';
    }

    private closePopover(opts?: { dismissed?: boolean }) {
        const current = this.activeControl?.target || this.activeInput;
        this.contextRequest += 1;
        window.clearTimeout(this.loadingTimer);
        window.clearTimeout(this.wakingTimer);
        this.stopUnlockWatch();
        this.placedFor = null;
        const host = this.popoverHost;
        const panel = this.panel;
        this.popoverHost = null;
        this.panel = null;
        this.panelBody = null;
        this.panelFoot = null;
        this.panelTitle = null;
        this.panelTargetHeight = 0;
        if (host) this.retireHost(host, panel, 'panel');
        this.activeInput = null;
        this.activeControl = null;
        this.keyboardItems = [];
        this.signupSuggestedFor = null;
        if (opts?.dismissed) {
            this.dismissedFor = current;
            writeDismissed();
        }
        this.remoteSourceFrameId = null;
        this.updateControls();
        this.schedulePosition();
    }

    /** Fade a surface out with the dashboard's ease-in, then remove its host. */
    private retireHost(host: HTMLElement, surface: HTMLElement | null, kind: 'panel' | 'toast') {
        host.removeAttribute('id');
        host.style.pointerEvents = 'none';
        if (!surface || prefersReducedMotion() || typeof surface.animate !== 'function') {
            host.remove();
            return;
        }
        const lift = kind === 'toast' || surface.dataset.placement !== 'above' ? -4 : 4;
        const fade = surface.animate(
            [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${lift}px) scale(.98)` }],
            { duration: kind === 'toast' ? 180 : 130, easing: EASE_IN, fill: 'forwards' },
        );
        const done = () => host.remove();
        fade.onfinish = done;
        window.setTimeout(done, 400);
    }

    private handleOutsidePointer = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (!this.popoverHost || !target) return;
        if (target === this.popoverHost || this.popoverHost.contains(target)) return;
        if (this.activeControl?.target && (target === this.activeControl.target || this.activeControl.target.contains(target))) return;
        if (this.activeInput && (target === this.activeInput || this.activeInput.contains(target))) return;
        const field = target instanceof Element ? target.closest('input, select, textarea') : null;
        if (field && isFillableControl(field) && (
            (this.activeInput && this.sameArea(this.activeInput, field))
            || (this.activeControl && this.sameArea(this.activeControl.target, field))
        )) return;
        for (const control of this.controls.values()) {
            if (target === control.host || control.host.contains(target)) return;
        }
        this.closePopover();
    };

    private handleKeydown = (event: KeyboardEvent) => {
        if (!this.popoverHost) return;
        if (event.key === 'Escape') {
            const returnFocus = this.activeInput || this.activeControl?.button;
            this.closePopover({ dismissed: true });
            returnFocus?.focus();
            return;
        }
        // §5.4: ArrowUp/Down move through the dropdown, Enter fills the active row.
        if (this.keyboardItems.length === 0) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            this.setKeyboardIndex((this.keyboardIndex + delta + this.keyboardItems.length) % this.keyboardItems.length);
            return;
        }
        if (event.key === 'Enter') {
            const match = this.keyboardItems[this.keyboardIndex];
            if (!match) return;
            event.preventDefault();
            event.stopPropagation();
            this.fillMatch(match);
        }
    };

    private handleSubmit = (event: SubmitEvent) => {
        const form = event.target instanceof HTMLFormElement ? event.target : null;
        if (form) this.captureForm(form);
    };

    private handlePotentialSubmitClick = (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement | HTMLInputElement>('button, input[type="submit"], input[type="button"]') : null;
        if (!target) return;
        const form = target instanceof HTMLInputElement ? target.form : target.form;
        if (!form) return;
        const type = (target.getAttribute('type') || (target.tagName === 'BUTTON' ? 'submit' : '')).toLowerCase();
        const label = `${target.textContent || ''} ${target.getAttribute('value') || ''} ${target.getAttribute('aria-label') || ''}`.toLowerCase();
        if (type === 'submit' || /sign\s*in|sign\s*up|log\s*in|continue|create account|register|join\s+(now|us)/.test(label)) {
            this.captureForm(form);
        }
    };

    private captureForm(form: HTMLFormElement) {
        const now = Date.now();
        if (now - (this.lastCaptures.get(form) || 0) < SUBMIT_DEBOUNCE_MS) return;
        const passwordInput = passwordInputFor(form);
        if (!passwordInput?.value) return;
        const identityInput = identityInputFor(passwordInput);
        const identity = identityInput?.value.trim();
        const password = passwordInput.value;
        if (!identity || !password) return;
        const accountCreation = isAccountCreationForm(form, passwordInput);
        this.lastCaptures.set(form, now);
        const beforeUrl = location.href;
        void this.send<{ captured: boolean; reason?: string }>({
            type: 'FOCUZPASS_CAPTURE_LOGIN',
            title: siteTitle(),
            identity,
            password,
            faviconUrl: currentFavicon(),
            accountCreation,
        }).then((result) => {
            if (!result.captured) return;
            window.setTimeout(() => {
                const moved = location.href !== beforeUrl;
                const formGone = !form.isConnected || !isRenderableInput(passwordInput);
                if (accountCreation || moved || formGone) void this.checkPending();
            }, 1350);
        }).catch(() => undefined);
    }

    private checkPendingSoon = () => {
        window.setTimeout(() => void this.checkPending(), 350);
    };

    /** Keep the extension at normal priority while this page's fields are on screen. */
    private syncAnchor() {
        if (document.visibilityState === 'visible' && this.controls.size > 0) holdExtensionAnchor('focuzpass-overlay');
        else releaseExtensionAnchor('focuzpass-overlay');
    }

    private handleVisibility = () => {
        this.syncAnchor();
        if (document.visibilityState !== 'visible') return;
        if (this.controlState !== 'ready') this.invalidatePageContext();
        void this.refreshControlState();
        if (this.saveHost) this.removeSavePrompt();
        this.checkPendingSoon();
    };

    private handleRuntimeMessage = (message: { type?: string; role?: FieldRole; item?: AutofillItem; sourceFrameId?: number }) => {
        if (message?.type === 'FOCUZPASS_LOCKED') {
            this.controlState = 'locked';
            this.invalidatePageContext();
            this.closePopover();
            this.updateControls();
            return;
        }
        if (message?.type === 'FOCUZPASS_ACCESS_CHANGED') {
            // Invalidate the cached page context (§5.1) and refresh state + any open panel.
            void this.onAccessChanged();
            return;
        }
        if (message?.type === 'FOCUZPASS_OVERLAY_OPEN' && window === window.top) {
            this.remoteSourceFrameId = Number.isInteger(message.sourceFrameId) ? Number(message.sourceFrameId) : null;
            const slot = this.collectPaymentSlots()[0];
            if (slot) {
                if (!this.controls.has(slot)) this.attachTarget(slot, message.role || 'card-number');
                void this.openPopover(slot);
            }
            return;
        }
        if (message?.type === 'FOCUZPASS_OVERLAY_FILL' && message.item) {
            this.activeInput = document.activeElement && isFillableControl(document.activeElement)
                ? document.activeElement
                : this.collectFillable()[0] || null;
            this.fillMatch(message.item);
        }
    };

    private async checkPending() {
        if (this.saveHost) return;
        try {
            const pending = await this.send<PendingLogin>({ type: 'FOCUZPASS_PENDING_LOGIN' });
            if (!pending.available || !pending.domain || !pending.identity) return;
            const never = await readNeverSave();
            if (never.includes(pending.domain)) return;
            this.showSavePrompt(pending);
        } catch {
            /* extension unavailable or vault not ready */
        }
    }

    private showSavePrompt(pending: PendingLogin) {
        this.saveHost?.remove();
        const host = document.createElement('div');
        host.id = SAVE_HOST_ID;
        host.dataset.theme = this.theme;
        host.style.cssText = 'all:initial;position:fixed;right:16px;top:16px;z-index:2147483647;max-width:calc(100vw - 24px);';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = OVERLAY_STYLE;
        const toast = createElement('div', 'toast');
        toast.setAttribute('role', 'dialog');
        toast.setAttribute('aria-label', 'Save login to FocuzPass');
        const main = createElement('div', 'toast-main');
        const mark = siteMark(pending.title);
        const tile = createElement('span', 'tile', mark);
        if (pending.faviconUrl) {
            const image = createElement('img');
            image.alt = '';
            image.src = pending.faviconUrl;
            image.addEventListener('error', () => {
                tile.textContent = mark;
            }, { once: true });
            tile.replaceChildren(image);
        }
        const copy = createElement('div', 'toast-copy');
        copy.append(
            createElement('h2', '', pending.update
                ? `Update password for ${pending.domain}?`
                : pending.accountCreation ? 'Save this new account?' : 'Save this password?'),
            createElement('p', '', `${pending.identity} · ${pending.domain}`),
        );
        const close = iconButton('x', 'Not now');
        close.addEventListener('click', () => void this.dismissPending());
        main.append(tile, copy, close);
        const actions = createElement('div', 'toast-actions');
        const never = textButton('ghost', 'Never for this site');
        never.addEventListener('click', async () => {
            if (pending.domain) await writeNeverSave(pending.domain);
            await this.dismissPending();
        });
        const notNow = textButton('secondary', 'Not now');
        notNow.addEventListener('click', () => void this.dismissPending());
        const save = textButton('primary', pending.update ? 'Update' : 'Save');
        save.addEventListener('click', () => void this.commitPending(toast));
        actions.append(never, notNow, save);
        // §5.4: 20s auto-dismiss, paused while hovered — the bar is the timer.
        const countdown = createElement('div', 'countdown');
        const bar = createElement('i');
        bar.style.animationDuration = `${SAVE_TOAST_TIMEOUT_MS}ms`;
        bar.addEventListener('animationend', () => void this.dismissPending(), { once: true });
        countdown.appendChild(bar);
        toast.append(main, actions, countdown);
        shadow.append(style, toast);
        document.documentElement.appendChild(host);
        this.saveHost = host;
    }

    /** Swap the toast's content with a height tween so it doesn't jump. */
    private morphToast(toast: HTMLElement, change: () => void) {
        const before = toast.getBoundingClientRect().height;
        change();
        if (prefersReducedMotion()) return;
        const after = toast.getBoundingClientRect().height;
        if (Math.abs(after - before) > 1) {
            toast.animate([{ height: `${before}px` }, { height: `${after}px` }], { duration: 240, easing: EASE_OUT });
        }
    }

    private async commitPending(toast: HTMLElement) {
        toast.querySelector('.countdown')?.remove();
        try {
            const result = await this.send<{ saved: boolean; queued?: boolean }>({ type: 'FOCUZPASS_COMMIT_PENDING_LOGIN' });
            const saved = createElement('div', 'saved');
            const tile = createElement('span', 'tile');
            tile.innerHTML = icon('check');
            saved.append(tile, createElement('strong', '', result.queued ? 'Saved — added after you unlock' : 'Saved to FocuzPass'));
            this.morphToast(toast, () => toast.replaceChildren(saved));
            window.clearTimeout(this.saveTimer);
            this.saveTimer = window.setTimeout(() => this.removeSavePrompt(), 1800);
        } catch (error) {
            const copy = toast.querySelector('.toast-copy');
            if (copy) {
                copy.querySelector('h2')!.textContent = 'Unlock to save';
                copy.querySelector('p')!.textContent = error instanceof Error ? error.message : 'Open FocuzPass and try again.';
            }
            const actions = toast.querySelector<HTMLElement>('.toast-actions');
            if (actions) {
                const notNow = textButton('secondary', 'Not now');
                notNow.addEventListener('click', () => void this.dismissPending());
                const open = textButton('primary', 'Open FocuzPass', 'arrowRight', true);
                open.addEventListener('click', () => {
                    void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS', tab: 'focuzpass' });
                });
                actions.replaceChildren(notNow, open);
            }
        }
    }

    private async dismissPending() {
        try {
            await this.send<null>({ type: 'FOCUZPASS_DISMISS_PENDING_LOGIN' });
        } catch {
            /* already gone */
        }
        this.removeSavePrompt();
    }

    private removeSavePrompt() {
        window.clearTimeout(this.saveTimer);
        const host = this.saveHost;
        this.saveHost = null;
        if (host) this.retireHost(host, host.shadowRoot?.querySelector<HTMLElement>('.toast') || null, 'toast');
    }
}

export function initFocuzPassOverlay(transport: FocuzPassOverlayTransport = runtimeSendMessage) {
    const overlay = new FocuzPassPageOverlay(transport);
    overlay.init();
    return overlay;
}

// Shared with the passkey prompts (passkeyRequests.ts), so every FocuzPass surface on a page looks the same.
export { BRAND_MARK, COLOR_MODE_KEY, OVERLAY_STYLE, createElement, icon, iconButton, resolveOverlayTheme, runtimeSendMessage, siteMark, textButton };
