/** In-page command palette (shadow DOM). Works on http(s) pages via content script + chrome.commands. */
import { isPaletteShortcut, IS_MAC, PALETTE_SHORTCUT_LABEL } from '../lib/shortcuts';
import { installWebExtensionBridge } from './webBridge';

// Install early so the web dashboard RPC works even if the site-specific
// content script is stale or failed to load.
installWebExtensionBridge();

const ICONS = {
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    todo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>`,
    block: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>`,
    habits: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
    stats: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="M18 17V9M13 17V5M8 17v-3"></path></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"></path></svg>`,
    timer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4M12 14l3-3"></path><circle cx="12" cy="14" r="8"></circle></svg>`,
    external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`,
};

/* The same look as focuznow.com's palette and the dashboard's (.fz-cmdk in
 * styles/focuzDesign.css). Content scripts render in a shadow DOM that can't see that
 * stylesheet, so the values are copied here; keep the two in sync. */
const STYLES = `
    :host { all: initial; }
    .palette-backdrop {
        --cmdk-scrim: oklch(0.08 0.003 275 / 0.6);
        --cmdk-panel: oklch(0.185 0.004 275);
        --cmdk-ring: oklch(0.955 0.003 275 / 0.15);
        --cmdk-line: oklch(0.955 0.003 275 / 0.08);
        --cmdk-shadow: 0 40px 120px -20px rgb(0 0 0 / 0.85);
        --cmdk-text-1: oklch(0.985 0.002 275);
        --cmdk-text-2: oklch(0.83 0.004 275);
        --cmdk-text-3: oklch(0.69 0.005 275);
        --cmdk-text-4: oklch(0.55 0.005 275);
        --cmdk-selected: oklch(1 0 0 / 0.07);
        --cmdk-kbd-bg: oklch(1 0 0 / 0.05);
        --cmdk-kbd-edge: oklch(1 0 0 / 0.08);
        --cmdk-success: oklch(0.74 0.14 150);
        --cmdk-ease: cubic-bezier(0.16, 1, 0.3, 1);
        position: fixed; inset: 0; z-index: 2147483647;
        background: var(--cmdk-scrim);
        -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        display: flex; align-items: flex-start; justify-content: center;
        padding: 16vh 16px 0; box-sizing: border-box; opacity: 0; pointer-events: none;
        transition: opacity 200ms ease;
        font-family: "Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
    }
    .palette-backdrop[data-theme="light"] {
        --cmdk-scrim: oklch(0.2 0.008 275 / 0.28);
        --cmdk-panel: oklch(1 0 0);
        --cmdk-ring: oklch(0.2 0.008 275 / 0.1);
        --cmdk-line: oklch(0.2 0.008 275 / 0.08);
        --cmdk-shadow: 0 40px 120px -20px rgb(15 23 42 / 0.35);
        --cmdk-text-1: oklch(0.2 0.008 275);
        --cmdk-text-2: oklch(0.36 0.008 275);
        --cmdk-text-3: oklch(0.51 0.008 275);
        --cmdk-text-4: oklch(0.6 0.008 275);
        --cmdk-selected: oklch(0.2 0.008 275 / 0.055);
        --cmdk-kbd-bg: oklch(0.2 0.008 275 / 0.04);
        --cmdk-kbd-edge: oklch(0.2 0.008 275 / 0.06);
        --cmdk-success: oklch(0.55 0.14 150);
    }
    .palette-backdrop.open { opacity: 1; pointer-events: auto; }
    .palette-container {
        width: 100%; max-width: 560px;
        background: var(--cmdk-panel);
        border-radius: 18px; overflow: hidden;
        box-shadow: 0 0 0 1px var(--cmdk-ring), var(--cmdk-shadow);
        color: var(--cmdk-text-1);
        opacity: 0; transform: translateY(-10px) scale(0.97); filter: blur(6px);
        transition: opacity 320ms var(--cmdk-ease), transform 320ms var(--cmdk-ease), filter 320ms var(--cmdk-ease), max-width 180ms var(--cmdk-ease);
    }
    .palette-backdrop.open .palette-container { opacity: 1; transform: none; filter: blur(0); }
    .palette-container.prompt-active { max-width: 480px; }
    .palette-search-wrap {
        display: flex; align-items: center; gap: 12px; padding: 0 20px;
        box-shadow: inset 0 -1px 0 var(--cmdk-line);
    }
    .palette-search-wrap svg { width: 17px; height: 17px; color: var(--cmdk-text-3); flex-shrink: 0; }
    .palette-input {
        flex: 1; min-width: 0; height: 58px; background: transparent; border: none; outline: none; padding: 0;
        color: var(--cmdk-text-1); font: inherit; font-size: 16px;
    }
    .palette-input::placeholder { color: var(--cmdk-text-4); }
    .kbd {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 6px;
        font: inherit; font-size: 11.5px; font-weight: 560; color: var(--cmdk-text-2);
        background: var(--cmdk-kbd-bg);
        box-shadow: inset 0 0 0 1px var(--cmdk-ring), inset 0 -1px 0 var(--cmdk-kbd-edge);
    }
    .palette-hint { font-size: 13px; color: var(--cmdk-text-3); padding: 16px 20px; }
    .palette-prompt-title { font-size: 12px; font-weight: 540; color: var(--cmdk-text-4); padding: 14px 20px 0; }
    .group-title { font-size: 12px; font-weight: 540; color: var(--cmdk-text-4); padding: 10px 12px 6px; }
    .palette-results { max-height: 360px; overflow-y: auto; padding: 8px; scrollbar-width: thin; scrollbar-color: var(--cmdk-ring) transparent; }
    .palette-results.prompt-mode { max-height: 0; padding: 0; overflow: hidden; }
    .palette-results.success-mode { max-height: 220px; overflow: visible; }
    .palette-item {
        display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; cursor: pointer;
        color: var(--cmdk-text-2); font-size: 14.5px; transition: background-color 150ms ease, color 150ms ease;
    }
    .palette-item.selected { background: var(--cmdk-selected); color: var(--cmdk-text-1); }
    .palette-item-icon { width: 16px; height: 16px; display: flex; flex-shrink: 0; }
    .palette-item-icon svg { width: 16px; height: 16px; }
    .palette-item-text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .palette-item-meta { font-size: 12.5px; color: var(--cmdk-text-4); }
    .palette-item .kbd { visibility: hidden; }
    .palette-item.selected .kbd { visibility: visible; }
    .palette-footer {
        display: flex; align-items: center; gap: 8px; padding: 12px 20px;
        font-size: 12.5px; color: var(--cmdk-text-4); box-shadow: inset 0 1px 0 var(--cmdk-line);
    }
    .empty { padding: 32px 12px; text-align: center; color: var(--cmdk-text-3); font-size: 14px; }
    .palette-success {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 36px 24px 40px; gap: 12px;
    }
    .palette-success-icon {
        width: 48px; height: 48px; border-radius: 50%;
        box-shadow: inset 0 0 0 1px currentColor;
        display: flex; align-items: center; justify-content: center;
        color: var(--cmdk-success);
        animation: palette-check-pop 320ms var(--cmdk-ease);
    }
    .palette-success-icon svg { width: 22px; height: 22px; stroke-width: 2.5; }
    .palette-success-text { font-size: 14.5px; font-weight: 560; color: var(--cmdk-text-1); margin: 0; }
    @keyframes palette-check-pop {
        0% { transform: scale(0.6); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
        .palette-backdrop, .palette-container, .palette-item, .palette-success-icon {
            transition: none !important; animation: none !important; filter: none !important;
        }
    }
`;

type Cmd = {
    id: string;
    group: string;
    icon: string;
    label: string;
    meta?: string;
    needsInput?: boolean;
    inputPlaceholder?: string;
    action: (val?: string) => void;
};

let togglePalette: (() => void) | null = null;
let resolvedPaletteTheme: 'light' | 'dark' = 'dark';
let paletteShadow: ShadowRoot | null = null;
let isPaletteOpen = () => false;

function showToast(msg: string) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    Object.assign(t.style, {
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        zIndex: '2147483647',
        background: resolvedPaletteTheme === 'light' ? 'oklch(1 0 0)' : 'oklch(0.185 0.004 275)',
        color: resolvedPaletteTheme === 'light' ? 'oklch(0.2 0.008 275)' : 'oklch(0.985 0.002 275)',
        padding: '11px 16px',
        borderRadius: '12px',
        boxShadow: resolvedPaletteTheme === 'light'
            ? '0 0 0 1px oklch(0.2 0.008 275 / 0.1), 0 20px 50px -12px rgb(15 23 42 / 0.3)'
            : '0 0 0 1px oklch(0.955 0.003 275 / 0.15), 0 20px 50px -12px rgb(0 0 0 / 0.7)',
        font: '560 12.5px "Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    });
    (paletteShadow ?? document.documentElement).appendChild(t);
    setTimeout(() => t.remove(), 3200);
}

function isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement
        && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function isFocuznowSite(): boolean {
    const h = window.location.hostname.replace(/^www\./, '');
    return h === 'focuznow.com' || h.endsWith('.focuznow.com');
}

/** Builds the palette UI. Only runs the first time it's opened — not on every page load. */
function buildPalette() {
    const host = document.createElement('div');
    host.id = 'focuznow-command-palette-host';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    paletteShadow = shadow;

    const hostName = window.location.hostname.replace(/^www\./, '') || 'this site';

    const COMMANDS: Cmd[] = [
        {
            id: 'focus',
            group: 'Actions',
            icon: ICONS.timer,
            label: 'Start a focus session',
            meta: '25 min',
            action: () => sendMsg({ type: 'START_SESSION', duration: 25 }, 'Focus session started (25m)'),
        },
        {
            id: 'todo',
            group: 'Actions',
            icon: ICONS.todo,
            label: 'Add a to-do',
            needsInput: true,
            inputPlaceholder: 'What do you need to do?',
            action: (val) => {
                const title = (val || '').trim();
                if (!title) {
                    showToast('Type a to-do name');
                    return;
                }
                sendMsg(
                    { type: 'ADD_TODO', title, openDashboard: false },
                    undefined,
                    {
                        keepOpen: true,
                        onSuccess: () => showTodoAddedSuccess(() => exitPrompt()),
                    },
                );
            },
        },
        {
            id: 'block',
            group: 'Actions',
            icon: ICONS.block,
            label: `Block ${hostName}`,
            needsInput: true,
            inputPlaceholder: 'Minutes to block (e.g. 25)',
            action: (val) => {
                const duration = Math.max(1, parseInt(val || '25', 10) || 25);
                sendMsg(
                    { type: 'BLOCK_DOMAIN', domain: hostName, duration, openDashboard: true },
                    `Blocked ${hostName} for ${duration} min`
                );
            },
        },
        {
            id: 'dash',
            group: 'Go to',
            icon: ICONS.external,
            label: 'FocuzNow dashboard',
            action: () => sendMsg({ type: 'OPEN_OPTIONS' }, 'Opening dashboard…'),
        },
        { id: 'today', group: 'Go to', icon: ICONS.grid, label: 'Dashboard', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'overview' }, 'Opening Dashboard…') },
        { id: 'cal', group: 'Go to', icon: ICONS.calendar, label: 'Calendar', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'calendar' }, 'Opening Calendar…') },
        { id: 'blocklist', group: 'Go to', icon: ICONS.block, label: 'Block list', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'blocklist' }, 'Opening Block list…') },
        { id: 'habits', group: 'Go to', icon: ICONS.habits, label: 'Habits', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'habits' }, 'Opening Habits…') },
        { id: 'stats', group: 'Go to', icon: ICONS.stats, label: 'Statistics', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'statistics' }, 'Opening Statistics…') },
        { id: 'settings', group: 'Go to', icon: ICONS.settings, label: 'Settings', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'settings' }, 'Opening Settings…') },
    ];

    function sendMsg(
        msg: Record<string, unknown>,
        successToast?: string,
        opts?: { keepOpen?: boolean; onSuccess?: () => void },
    ) {
        if (!chrome.runtime?.id) {
            showToast('Extension reloaded — refresh this page, then try again.');
            return;
        }
        chrome.runtime.sendMessage(msg, (resp) => {
            if (chrome.runtime.lastError) {
                showToast(chrome.runtime.lastError.message || 'Command failed');
                return;
            }
            if (resp && (resp as { ok?: boolean }).ok === false) {
                showToast((resp as { error?: string }).error || 'Command could not complete');
                return;
            }
            if (successToast) showToast(successToast);
            opts?.onSuccess?.();
        });
        if (!opts?.keepOpen) closePalette();
    }

    const style = document.createElement('style');
    style.textContent = STYLES;

    const backdrop = document.createElement('div');
    backdrop.className = 'palette-backdrop';
    backdrop.innerHTML = `
        <div class="palette-container" role="dialog" aria-modal="true" aria-label="FocuzNow command palette">
            <div class="palette-prompt-title" hidden></div>
            <div class="palette-search-wrap">
                ${ICONS.search}
                <input type="text" class="palette-input" placeholder="Search or run a command" spellcheck="false" autocomplete="off" />
                <span class="kbd">esc</span>
            </div>
            <div class="palette-hint" hidden></div>
            <div class="palette-results"></div>
            <div class="palette-footer"><span class="kbd">${PALETTE_SHORTCUT_LABEL}</span> opens this on any site.</div>
        </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(backdrop);

    const input = shadow.querySelector('.palette-input') as HTMLInputElement;
    const searchWrap = shadow.querySelector('.palette-search-wrap') as HTMLDivElement;
    const hintEl = shadow.querySelector('.palette-hint') as HTMLDivElement;
    const promptTitleEl = shadow.querySelector('.palette-prompt-title') as HTMLDivElement;
    const resultsContainer = shadow.querySelector('.palette-results') as HTMLDivElement;
    const container = shadow.querySelector('.palette-container') as HTMLDivElement;
    const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    let paletteColorMode: 'light' | 'dark' | 'system' = 'system';

    const applyPaletteTheme = () => {
        resolvedPaletteTheme =
            paletteColorMode === 'system'
                ? colorSchemeMedia.matches ? 'dark' : 'light'
                : paletteColorMode;
        backdrop.dataset.theme = resolvedPaletteTheme;
    };
    const isPaletteColorMode = (value: unknown): value is typeof paletteColorMode =>
        value === 'light' || value === 'dark' || value === 'system';

    applyPaletteTheme();
    const refreshPaletteTheme = () => {
        chrome.storage.local.get(['dashboardColorMode'], (stored) => {
            const mode = stored.dashboardColorMode;
            if (isPaletteColorMode(mode)) paletteColorMode = mode;
            applyPaletteTheme();
        });
    };
    colorSchemeMedia.addEventListener('change', () => {
        if (paletteColorMode === 'system') applyPaletteTheme();
    });

    let selectedIndex = 0;
    let isOpen = false;
    let flatCommands: Cmd[] = [];
    let promptCmd: Cmd | null = null;

    function buildFlat(query: string) {
        const q = query.trim().toLowerCase();
        return COMMANDS.filter(
            (c) =>
                !q ||
                c.label.toLowerCase().includes(q) ||
                c.group.toLowerCase().includes(q) ||
                c.id.includes(q)
        );
    }

    function scrollSelectedIntoView() {
        const el = resultsContainer.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: 'nearest' });
    }

    /** Scroll only for the keyboard: scrolling under the pointer would pick a new row and scroll again. */
    function highlightSelection(scroll = true) {
        resultsContainer.querySelectorAll('.palette-item').forEach((item) => {
            const idx = parseInt((item as HTMLElement).dataset.idx || '0', 10);
            item.classList.toggle('selected', idx === selectedIndex);
        });
        if (scroll) scrollSelectedIntoView();
    }

    function renderResults() {
        if (promptCmd) return;

        const query = input.value.trim().toLowerCase();
        flatCommands = buildFlat(query);

        if (flatCommands.length === 0) {
            resultsContainer.innerHTML = '<div class="empty">No commands match.</div>';
            return;
        }

        selectedIndex = Math.max(0, Math.min(selectedIndex, flatCommands.length - 1));

        let html = '';
        let lastGroup = '';
        flatCommands.forEach((cmd, idx) => {
            if (cmd.group !== lastGroup) {
                html += `<div class="group-title">${cmd.group}</div>`;
                lastGroup = cmd.group;
            }
            const sel = idx === selectedIndex ? 'selected' : '';
            html += `
                <div class="palette-item ${sel}" data-idx="${idx}">
                    <div class="palette-item-icon">${cmd.icon}</div>
                    <div class="palette-item-text">${cmd.label}</div>
                    ${cmd.meta ? `<div class="palette-item-meta">${cmd.meta}</div>` : ''}
                    <span class="kbd">↵</span>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;

        resultsContainer.querySelectorAll('.palette-item').forEach((el) => {
            const idx = parseInt((el as HTMLElement).dataset.idx || '0', 10);
            // mousemove, not mouseenter: rows sliding under a still pointer (arrow keys, scrolling)
            // shouldn't steal the highlight, but any real pointer movement should, however slow.
            el.addEventListener('mousemove', () => {
                if (selectedIndex === idx) return;
                selectedIndex = idx;
                highlightSelection(false);
            });
            el.addEventListener('click', () => {
                selectedIndex = idx;
                activateCommand(flatCommands[idx]);
            });
        });

        highlightSelection();
    }

    function enterPrompt(cmd: Cmd) {
        promptCmd = cmd;
        container.classList.add('prompt-active');
        searchWrap.classList.add('prompt-mode');
        resultsContainer.classList.add('prompt-mode');
        hintEl.hidden = false;
        hintEl.innerHTML = 'Press <span class="kbd">↵</span> to confirm, <span class="kbd">esc</span> to go back.';
        promptTitleEl.hidden = false;
        promptTitleEl.textContent = cmd.label;
        input.value = '';
        input.placeholder = cmd.inputPlaceholder || 'Type here…';
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }, 20);
    }

    function showTodoAddedSuccess(then: () => void) {
        resultsContainer.classList.remove('prompt-mode');
        resultsContainer.classList.add('success-mode');
        searchWrap.classList.remove('prompt-mode');
        resultsContainer.innerHTML = `
            <div class="palette-success">
                <div class="palette-success-icon">${ICONS.check}</div>
                <p class="palette-success-text">To-do added</p>
            </div>
        `;
        hintEl.hidden = true;
        promptTitleEl.hidden = true;
        input.value = '';
        input.blur();
        setTimeout(() => {
            resultsContainer.classList.remove('success-mode');
            then();
        }, 900);
    }

    function exitPrompt() {
        promptCmd = null;
        container.classList.remove('prompt-active');
        searchWrap.classList.remove('prompt-mode');
        resultsContainer.classList.remove('prompt-mode');
        hintEl.hidden = true;
        promptTitleEl.hidden = true;
        promptTitleEl.textContent = '';
        input.placeholder = 'Search or run a command';
        input.value = '';
        selectedIndex = 0;
        renderResults();
    }

    function activateCommand(cmd: Cmd | undefined) {
        if (!cmd) return;
        if (cmd.needsInput && !promptCmd) {
            enterPrompt(cmd);
            return;
        }
        cmd.action(input.value.trim());
    }

    function openPalette() {
        if (isOpen) return;
        isOpen = true;
        refreshPaletteTheme();
        promptCmd = null;
        backdrop.classList.add('open');
        input.value = '';
        selectedIndex = 0;
        searchWrap.classList.remove('prompt-mode');
        resultsContainer.classList.remove('prompt-mode');
        hintEl.hidden = true;
        promptTitleEl.hidden = true;
        container.classList.remove('prompt-active');
        renderResults();
        setTimeout(() => {
            input.focus();
            input.select();
        }, 40);
    }

    function closePalette() {
        if (!isOpen) return;
        isOpen = false;
        promptCmd = null;
        backdrop.classList.remove('open');
        input.blur();
    }

    togglePalette = () => (isOpen ? closePalette() : openPalette());
    isPaletteOpen = () => isOpen;

    input.addEventListener('input', () => {
        if (promptCmd) return;
        selectedIndex = 0;
        renderResults();
    });

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closePalette();
    });

    const onKey = (e: KeyboardEvent) => {
        if (!isOpen || isPaletteShortcut(e)) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            if (promptCmd) exitPrompt();
            else closePalette();
            return;
        }

        if (promptCmd) {
            if (e.key === 'Enter') {
                e.preventDefault();
                activateCommand(promptCmd);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % flatCommands.length;
            highlightSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + flatCommands.length) % flatCommands.length;
            highlightSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            activateCommand(flatCommands[selectedIndex]);
        }
    };

    window.addEventListener('keydown', onKey, true);
}

export function initCommandPalette() {
    if (isFocuznowSite()) return;
    const w = window as unknown as { __focuznowPaletteReady?: boolean };
    if (w.__focuznowPaletteReady) return;
    w.__focuznowPaletteReady = true;

    const toggle = () => {
        if (!togglePalette) buildPalette();
        togglePalette?.();
    };
    // Alt+K (⌥K). Fallback for when the browser shortcut (chrome.commands) isn't
    // bound: it runs after the page's own handlers and backs off if the site already
    // used the key. On a Mac ⌥K types "˚", so leave text fields alone there.
    window.addEventListener('keydown', (e) => {
        if (!isPaletteShortcut(e) || e.defaultPrevented) return;
        if (IS_MAC && !isPaletteOpen() && isEditableTarget(e.target)) return;
        e.preventDefault();
        toggle();
    });
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'TOGGLE_COMMAND_PALETTE') toggle();
    });
    window.addEventListener('focuznow-toggle-palette', toggle);
}

if (typeof window !== 'undefined') {
    const blocked =
        window.location.protocol === 'chrome:' ||
        window.location.protocol === 'chrome-extension:' ||
        window.location.protocol === 'edge:' ||
        window.location.protocol === 'about:';
    if (!blocked) initCommandPalette();
}
