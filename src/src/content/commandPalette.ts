/** In-page command palette (shadow DOM). Works on http(s) pages via content script + chrome.commands. */

const ICONS = {
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    focus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
    todo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>`,
    block: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>`,
    nav: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
};

const STYLES = `
    :host { all: initial; }
    .palette-backdrop {
        position: fixed; inset: 0; z-index: 2147483647;
        background: rgba(0,0,0,0.55); backdrop-filter: blur(8px);
        display: flex; align-items: flex-start; justify-content: center;
        padding-top: 12vh; opacity: 0; pointer-events: none;
        transition: opacity 0.18s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .palette-backdrop.open { opacity: 1; pointer-events: auto; }
    .palette-container {
        width: 100%; max-width: 560px;
        background: #141414; border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px; overflow: hidden;
        box-shadow: 0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
        transform: scale(0.97) translateY(-6px);
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        color: #fff;
    }
    .palette-backdrop.open .palette-container { transform: scale(1) translateY(0); }
    .palette-container.prompt-active { max-width: 460px; }
    .palette-chrome { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 0; }
    .traffic { display: flex; gap: 6px; }
    .traffic span { width: 10px; height: 10px; border-radius: 50%; cursor: pointer; transition: filter 0.15s, transform 0.1s; }
    .traffic span:hover { filter: brightness(1.25); transform: scale(1.15); }
    .traffic span:active { transform: scale(0.9); }
    .traffic .r { background: #ff5f57; } .traffic .y { background: #febc2e; } .traffic .g { background: #28c840; }
    .palette-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: #666; text-transform: uppercase; }
    .palette-search-wrap {
        margin: 12px 14px; padding: 12px 14px; background: #1c1c1c;
        border: 1px solid rgba(255,255,255,0.06); border-radius: 12px;
        display: flex; align-items: center; gap: 10px;
    }
    .palette-search-wrap.prompt-mode { border-color: rgba(168,85,247,0.45); box-shadow: 0 0 0 1px rgba(168,85,247,0.2); }
    .palette-search-wrap svg { width: 18px; height: 18px; color: #666; flex-shrink: 0; }
    .palette-input { flex: 1; background: transparent; border: none; outline: none; color: #fff; font-size: 15px; }
    .palette-input::placeholder { color: #555; }
    .palette-hint { font-size: 11px; color: #a855f7; padding: 0 18px 8px; font-weight: 600; }
    .palette-prompt-title { font-size: 12px; color: #d4d4d4; padding: 2px 18px 8px; font-weight: 700; letter-spacing: 0.02em; }
    .group-title {
        font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase;
        letter-spacing: 0.1em; padding: 10px 18px 4px;
    }
    .palette-results { max-height: 360px; overflow-y: auto; padding-bottom: 12px; scroll-behavior: smooth; }
    .palette-results.prompt-mode { max-height: 0; padding-bottom: 0; overflow: hidden; }
    .palette-results.success-mode {
        max-height: 220px; padding-bottom: 12px; overflow: visible;
    }
    .palette-item {
        display: flex; align-items: center; gap: 12px;
        padding: 11px 18px; cursor: pointer; color: #aaa; transition: background 0.12s;
    }
    .palette-item.selected { background: rgba(168,85,247,0.15); color: #fff; outline: 1px solid rgba(168,85,247,0.25); }
    .palette-item-icon { width: 18px; height: 18px; color: #777; display: flex; }
    .palette-item.selected .palette-item-icon { color: #c4b5fd; }
    .palette-item-text { flex: 1; font-size: 14px; font-weight: 500; }
    .palette-item-sub { font-size: 11px; color: #666; display: block; margin-top: 1px; }
    .palette-item-meta { font-size: 11px; color: #666; }
    .palette-item-meta .kbd {
        background: #252525; border: 1px solid #333; padding: 2px 6px;
        border-radius: 5px; font-family: ui-monospace, monospace; font-size: 10px;
    }
    .empty { padding: 24px; text-align: center; color: #555; font-size: 13px; }
    .palette-success {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 36px 24px 40px; gap: 12px;
    }
    .palette-success-icon {
        width: 56px; height: 56px; border-radius: 50%;
        background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35);
        display: flex; align-items: center; justify-content: center;
        color: #4ade80;
        animation: palette-check-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .palette-success-icon svg { width: 28px; height: 28px; stroke-width: 2.5; }
    .palette-success-text { font-size: 15px; font-weight: 700; color: #fff; }
    @keyframes palette-check-pop {
        0% { transform: scale(0.5); opacity: 0; }
        60% { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
    }
    .toast {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: #1a1a1a; color: #fff; padding: 12px 18px; border-radius: 10px;
        font-size: 13px; font-weight: 600; z-index: 2147483647; border: 1px solid rgba(168,85,247,0.35);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
`;

type Cmd = {
    id: string;
    group: string;
    icon: string;
    label: string;
    sub?: string;
    meta?: string;
    needsInput?: boolean;
    inputPlaceholder?: string;
    action: (val?: string) => void;
};

let togglePalette: (() => void) | null = null;

function showToast(msg: string) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
}

function isFocuznowSite(): boolean {
    const h = window.location.hostname.replace(/^www\./, '');
    return h === 'focuznow.com' || h.endsWith('.focuznow.com');
}

export function initCommandPalette() {
    if (isFocuznowSite()) return;

    if (document.getElementById('focuznow-command-palette-host')) {
        return;
    }

    const host = document.createElement('div');
    host.id = 'focuznow-command-palette-host';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const hostName = window.location.hostname.replace(/^www\./, '') || 'this site';

    const COMMANDS: Cmd[] = [
        {
            id: 'focus',
            group: 'Actions',
            icon: ICONS.focus,
            label: 'Start focus session',
            sub: 'Action',
            meta: '25m',
            action: () => sendMsg({ type: 'START_SESSION', duration: 25 }, 'Focus session started (25m)'),
        },
        {
            id: 'todo',
            group: 'Actions',
            icon: ICONS.todo,
            label: 'Add to-do',
            sub: 'Action',
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
            sub: 'Action',
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
            group: 'Navigation',
            icon: ICONS.dashboard,
            label: 'Open FocuzNow dashboard',
            sub: 'Page',
            action: () => sendMsg({ type: 'OPEN_OPTIONS' }, 'Opening dashboard…'),
        },
        { id: 'today', group: 'Navigation', icon: ICONS.nav, label: 'Go to Today', sub: 'Page', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'overview' }, 'Opening Today…') },
        { id: 'cal', group: 'Navigation', icon: ICONS.nav, label: 'Go to Calendar', sub: 'Page', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'calendar' }, 'Opening Calendar…') },
        { id: 'blocklist', group: 'Navigation', icon: ICONS.nav, label: 'Go to Block list', sub: 'Page', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'blocklist' }, 'Opening Block list…') },
        { id: 'habits', group: 'Navigation', icon: ICONS.nav, label: 'Go to Habits', sub: 'Page', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'habits' }, 'Opening Habits…') },
        { id: 'stats', group: 'Navigation', icon: ICONS.nav, label: 'Go to Statistics', sub: 'Page', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'statistics' }, 'Opening Statistics…') },
        { id: 'settings', group: 'Navigation', icon: ICONS.nav, label: 'Go to Settings', sub: 'Page', action: () => sendMsg({ type: 'OPEN_OPTIONS', tab: 'settings' }, 'Opening Settings…') },
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
                showToast('Command could not complete');
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
        <div class="palette-container">
            <div class="palette-chrome">
                <div class="traffic"><span class="r"></span><span class="y"></span><span class="g"></span></div>
                <span class="palette-label">Command palette</span>
            </div>
            <div class="palette-search-wrap">
                ${ICONS.search}
                <input type="text" class="palette-input" placeholder="Type a command or search…" spellcheck="false" autocomplete="off" />
            </div>
            <div class="palette-hint" hidden></div>
            <div class="palette-prompt-title" hidden></div>
            <div class="palette-results"></div>
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
    const trafficR = shadow.querySelector('.traffic .r') as HTMLSpanElement;
    const trafficY = shadow.querySelector('.traffic .y') as HTMLSpanElement;
    const trafficG = shadow.querySelector('.traffic .g') as HTMLSpanElement;

    let selectedIndex = 0;
    let isOpen = false;
    let flatCommands: Cmd[] = [];
    let selectionMode: 'keyboard' | 'mouse' = 'keyboard';
    let lastMouseMove = 0;
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
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function highlightSelection() {
        resultsContainer.querySelectorAll('.palette-item').forEach((item) => {
            const idx = parseInt((item as HTMLElement).dataset.idx || '0', 10);
            item.classList.toggle('selected', idx === selectedIndex);
        });
        scrollSelectedIntoView();
    }

    function renderResults() {
        if (promptCmd) return;

        const query = input.value.trim().toLowerCase();
        flatCommands = buildFlat(query);

        if (flatCommands.length === 0) {
            resultsContainer.innerHTML = '<div class="empty">No commands found</div>';
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
                    <div class="palette-item-text">
                        ${cmd.label}
                        <span class="palette-item-sub">${cmd.sub || cmd.group}</span>
                    </div>
                    <div class="palette-item-meta">${cmd.meta || ''}<span class="kbd">↵</span></div>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;

        resultsContainer.querySelectorAll('.palette-item').forEach((el) => {
            const idx = parseInt((el as HTMLElement).dataset.idx || '0', 10);
            el.addEventListener('mouseenter', () => {
                if (Date.now() - lastMouseMove < 400 && selectionMode === 'keyboard') return;
                selectionMode = 'mouse';
                selectedIndex = idx;
                highlightSelection();
            });
            el.addEventListener('click', () => {
                selectionMode = 'mouse';
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
        hintEl.textContent = cmd.inputPlaceholder || 'Type your answer, then press Enter';
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
        input.placeholder = 'Type a command or search…';
        input.value = '';
        selectedIndex = 0;
        selectionMode = 'keyboard';
        renderResults();
    }

    function activateCommand(cmd: Cmd | undefined) {
        if (!cmd) return;
        if (cmd.needsInput && !promptCmd) {
            enterPrompt(cmd);
            return;
        }
        const val = promptCmd ? input.value.trim() : input.value.trim();
        cmd.action(val);
    }

    function openPalette() {
        if (isOpen) return;
        isOpen = true;
        promptCmd = null;
        backdrop.classList.add('open');
        input.value = '';
        selectedIndex = 0;
        selectionMode = 'keyboard';
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

    // Traffic light button actions
    trafficR?.addEventListener('click', () => closePalette());
    trafficY?.addEventListener('click', () => {
        // Minimize: collapse the results list
        const isMinimized = resultsContainer.style.display === 'none';
        resultsContainer.style.display = isMinimized ? '' : 'none';
        searchWrap.style.borderRadius = isMinimized ? '' : '12px';
    });
    trafficG?.addEventListener('click', () => {
        // Maximize: toggle wide mode
        container.style.maxWidth = container.style.maxWidth === '800px' ? '' : '800px';
    });

    input.addEventListener('input', () => {
        if (promptCmd) return;
        selectedIndex = 0;
        selectionMode = 'keyboard';
        renderResults();
    });

    backdrop.addEventListener('mousemove', () => {
        lastMouseMove = Date.now();
    });

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closePalette();
    });

    const onKey = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            e.stopPropagation();
            togglePalette?.();
            return;
        }
        if (!isOpen) return;

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
            selectionMode = 'keyboard';
            selectedIndex = (selectedIndex + 1) % flatCommands.length;
            highlightSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectionMode = 'keyboard';
            selectedIndex = (selectedIndex - 1 + flatCommands.length) % flatCommands.length;
            highlightSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            selectionMode = 'keyboard';
            activateCommand(flatCommands[selectedIndex]);
        }
    };

    window.addEventListener('keydown', onKey, true);

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'TOGGLE_COMMAND_PALETTE') togglePalette?.();
    });
    window.addEventListener('focuznow-toggle-palette', () => togglePalette?.());
}

if (typeof window !== 'undefined') {
    const blocked =
        window.location.protocol === 'chrome:' ||
        window.location.protocol === 'chrome-extension:' ||
        window.location.protocol === 'edge:' ||
        window.location.protocol === 'about:';
    if (!blocked) initCommandPalette();
}
