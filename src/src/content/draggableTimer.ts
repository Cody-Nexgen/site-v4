// Content Script: Draggable Timer Overlay + Pomodoro Widget

const POMO_KEY = 'pomodoroRuntimeV1';

function newPomodoroSegmentId(): string {
    return globalThis.crypto?.randomUUID?.() ??
        `segment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

let siteTimerDismissed = false;
let pomoWidgetDismissed = false;

function removeDraggableTimer() {
    document.getElementById('focuznow-draggable-timer')?.remove();
}

function removePomodoroWidget() {
    document.getElementById('focuznow-pomodoro-widget')?.remove();
}

function syncOverlayWidgets(state: { draggableTimer?: boolean; pomodoroWidget?: boolean } = {}) {
    if (state.draggableTimer && !siteTimerDismissed) {
        initDraggableTimer();
    } else {
        removeDraggableTimer();
    }
    if (state.pomodoroWidget && !pomoWidgetDismissed) {
        initPomodoroWidget();
    } else {
        removePomodoroWidget();
    }
}

chrome.storage.local.get(['blockEngineState'], (result: any) => {
    syncOverlayWidgets(result.blockEngineState || {});
});

chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes.blockEngineState) return;
    const next = changes.blockEngineState.newValue as { draggableTimer?: boolean; pomodoroWidget?: boolean } | undefined;
    syncOverlayWidgets(next || {});
});

chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
    if (msg.type === 'SYNC_OVERLAY_WIDGETS') {
        chrome.storage.local.get(['blockEngineState'], (result: any) => {
            syncOverlayWidgets(result.blockEngineState || {});
        });
    }
});

function createCloseBtn(onClose: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Close');
    btn.innerHTML = '×';
    btn.style.cssText = `
        position: absolute;
        top: -6px;
        right: -6px;
        width: 18px;
        height: 18px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.16);
        color: rgba(255,255,255,0.7);
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.15s, color 0.15s;
        z-index: 2;
    `;
    btn.onmouseenter = () => {
        btn.style.background = 'rgba(239,68,68,0.85)';
        btn.style.color = '#fff';
    };
    btn.onmouseleave = () => {
        btn.style.background = 'rgba(255, 255, 255, 0.16)';
        btn.style.color = 'rgba(255,255,255,0.7)';
    };
    btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        onClose();
    };
    return btn;
}

function fmtTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function getPomoSettings(cb: (s: { focusMin: number; breakMin: number }) => void) {
    chrome.storage.local.get(['blockEngineState'], (res: any) => {
        const s = res.blockEngineState?.pomodoroSettings || { focusMin: 25, breakMin: 5 };
        cb(s);
    });
}

function writePomoRuntime(rt: Record<string, unknown> | null, cb?: () => void) {
    if (!rt) {
        chrome.storage.local.remove(POMO_KEY, cb ?? (() => {}));
    } else {
        chrome.storage.local.set({ [POMO_KEY]: rt }, cb ?? (() => {}));
    }
}

function readPomoRuntime(cb: (rt: any) => void) {
    chrome.storage.local.get([POMO_KEY], (res) => cb(res[POMO_KEY] || null));
}

function computeTimeLeft(rt: any): number {
    if (!rt || rt.paused || !rt.running || !rt.endAt) return rt?.timeLeftSec ?? 0;
    return Math.max(0, Math.ceil((rt.endAt - Date.now()) / 1000));
}

function initPomodoroWidget() {
    if (document.getElementById('focuznow-pomodoro-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'focuznow-pomodoro-widget';

    let xOff = 0;
    let yOff = 0;
    let dragging = false;
    let dragIx = 0;
    let dragIy = 0;
    const applyShell = (isBreak: boolean) => {
        const border = isBreak ? 'oklch(0.72 0.14 150 / 0.4)' : 'oklch(0.955 0.003 275 / 0.07)';
        widget.style.borderColor = border;
        widget.style.boxShadow = '0 0 0 1px oklch(0 0 0 / 0.2), 0 8px 24px -4px rgb(0 0 0 / 0.5), 0 2px 6px rgb(0 0 0 / 0.3)';
    };

    widget.style.cssText = `
        position: fixed;
        z-index: 2147483646;
        bottom: 24px;
        left: 24px;
        width: fit-content;
        max-width: min(180px, 90vw);
        box-sizing: border-box;
        background: oklch(0.225 0.006 275 / 0.94);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid oklch(0.955 0.003 275 / 0.07);
        color: oklch(0.955 0.003 275);
        padding: 10px 12px 12px;
        border-radius: 12px;
        font-family: "Inter Variable", Inter, system-ui, -apple-system, sans-serif;
        user-select: none;
        box-shadow: 0 0 0 1px oklch(0 0 0 / 0.2), 0 8px 24px -4px rgb(0 0 0 / 0.5), 0 2px 6px rgb(0 0 0 / 0.3);
        transition: border-color 0.4s ease, box-shadow 0.4s ease;
        transform: translate3d(0px, 0px, 0);
    `;
    applyShell(false);

    const closeBtn = createCloseBtn(() => {
        pomoWidgetDismissed = true;
        removePomodoroWidget();
    });
    widget.appendChild(closeBtn);

    const dragHandle = document.createElement('div');
    dragHandle.style.cssText = 'cursor: grab; display: flex; flex-direction: column; align-items: center;';

    const labelEl = document.createElement('div');
    labelEl.style.cssText =
        'font-size: 11px; font-weight: 560; color: oklch(0.675 0.005 275); margin-bottom: 6px; text-align: center;';
    labelEl.textContent = 'Focus session';

    const ringWrap = document.createElement('div');
    ringWrap.style.cssText = 'position: relative; width: 88px; height: 88px; margin: 0 auto 8px;';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '88');
    svg.setAttribute('height', '88');
    svg.setAttribute('viewBox', '0 0 88 88');
    svg.style.cssText = 'position: absolute; inset: 0; transform: rotate(-90deg);';

    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('cx', '44');
    track.setAttribute('cy', '44');
    track.setAttribute('r', '38');
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'oklch(0.955 0.003 275 / 0.08)');
    track.setAttribute('stroke-width', '4');

    const progress = document.createElementNS(svgNS, 'circle');
    progress.setAttribute('cx', '44');
    progress.setAttribute('cy', '44');
    progress.setAttribute('r', '38');
    progress.setAttribute('fill', 'none');
    progress.setAttribute('stroke', 'oklch(0.68 0.15 255)');
    progress.setAttribute('stroke-width', '4');
    progress.setAttribute('stroke-linecap', 'round');
    const circum = 2 * Math.PI * 38;
    progress.setAttribute('stroke-dasharray', String(circum));

    svg.appendChild(track);
    svg.appendChild(progress);
    ringWrap.appendChild(svg);

    const timeEl = document.createElement('div');
    timeEl.style.cssText =
        'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 560; letter-spacing: -0.02em; font-variant-numeric: tabular-nums;';
    timeEl.textContent = '25:00';
    ringWrap.appendChild(timeEl);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 6px; justify-content: center;';

    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.style.cssText = `
        min-width: 64px;
        padding: 6px 10px;
        border: none;
        border-radius: 8px;
        background: oklch(0.68 0.15 255);
        color: oklch(0.17 0.02 255);
        font-size: 11px;
        font-weight: 560;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
    `;
    actionBtn.textContent = 'Start';

    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.style.cssText = `
        padding: 6px 10px;
        border: none;
        border-radius: 8px;
        background: oklch(0.955 0.003 275 / 0.08);
        color: oklch(0.765 0.005 275);
        font-size: 11px;
        font-weight: 560;
        cursor: pointer;
        transition: background 0.15s;
    `;
    stopBtn.textContent = 'Reset';

    btnRow.appendChild(actionBtn);
    btnRow.appendChild(stopBtn);

    dragHandle.appendChild(labelEl);
    dragHandle.appendChild(ringWrap);
    dragHandle.appendChild(btnRow);
    widget.appendChild(dragHandle);
    document.body.appendChild(widget);

    dragHandle.addEventListener('mousedown', (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        dragIx = e.clientX - xOff;
        dragIy = e.clientY - yOff;
        dragging = true;
        dragHandle.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e: MouseEvent) => {
        if (!dragging) return;
        xOff = e.clientX - dragIx;
        yOff = e.clientY - dragIy;
        widget.style.transform = `translate3d(${xOff}px, ${yOff}px, 0)`;
    });
    document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        dragHandle.style.cursor = 'grab';
    });

    actionBtn.onclick = (e) => {
        e.stopPropagation();
        readPomoRuntime((rt) => {
            getPomoSettings((settings) => {
                const focusMin = settings.focusMin || 25;
                const breakMin = settings.breakMin || 5;
                if (rt?.running && !rt.paused) {
                    const left = computeTimeLeft(rt);
                    writePomoRuntime({
                        ...rt,
                        running: false,
                        paused: true,
                        endAt: null,
                        timeLeftSec: left,
                        segmentTotalSec: left,
                    });
                } else {
                    const isBreak = rt?.isBreak ?? false;
                    const left =
                        rt?.timeLeftSec ??
                        Math.round((isBreak ? breakMin : focusMin) * 60);
                    const endAt = Date.now() + left * 1000;
                    writePomoRuntime({
                        running: true,
                        paused: false,
                        endAt,
                        timeLeftSec: left,
                        isBreak,
                        segmentTotalSec: left,
                        focusMin,
                        breakMin,
                        segmentId:
                            rt?.segmentId ??
                            newPomodoroSegmentId(),
                    });
                }
            });
        });
    };

    stopBtn.onclick = (e) => {
        e.stopPropagation();
        readPomoRuntime((rt) => {
            if (rt?.futureSelfContractId) {
                chrome.runtime.sendMessage({
                    type: 'FUTURE_SELF_FINISH',
                    status: 'cancelled',
                }).catch(() => {});
            }
            writePomoRuntime(null);
        });
    };

    // Render from a cached runtime + settings. Storage is read once here and then
    // only when it changes — it used to be read twice a second from every tab.
    let rtCache: {
        running?: boolean;
        paused?: boolean;
        endAt?: number | null;
        timeLeftSec?: number;
        isBreak?: boolean;
        segmentTotalSec?: number;
        futureSelfContractId?: string;
    } | null = null;
    let settingsCache: { focusMin: number; breakMin: number } = { focusMin: 25, breakMin: 5 };

    const update = () => {
        const rt = rtCache;
        const focusMin = settingsCache.focusMin || 25;
        const breakMin = settingsCache.breakMin || 5;
        const defaultSec = Math.round(
            ((rt?.isBreak ? breakMin : focusMin) || focusMin) * 60,
        );

        if (!rt || (!rt.running && !rt.paused)) {
            labelEl.textContent = 'Pomodoro';
            timeEl.textContent = fmtTime(defaultSec);
            progress.setAttribute('stroke', 'oklch(0.955 0.003 275 / 0.25)');
            progress.setAttribute('stroke-dashoffset', String(circum));
            actionBtn.textContent = 'Start';
            actionBtn.style.background = 'oklch(0.68 0.15 255)';
            applyShell(false);
            return;
        }

        const left = computeTimeLeft(rt);
        const total = rt.segmentTotalSec || defaultSec;
        const pct = total > 0 ? Math.min(1, (total - left) / total) : 0;
        const color = rt.isBreak ? 'oklch(0.72 0.14 150)' : 'oklch(0.68 0.15 255)';

        labelEl.textContent = rt.isBreak
            ? 'Break time'
            : rt.futureSelfContractId
                ? 'Future Self'
                : 'Focus session';
        timeEl.textContent = fmtTime(left);
        progress.setAttribute('stroke', color);
        progress.setAttribute('stroke-dashoffset', String(circum * (1 - pct)));
        applyShell(!!rt.isBreak);

        if (rt.running && !rt.paused) {
            actionBtn.textContent = 'Pause';
            actionBtn.style.background = 'oklch(0.955 0.003 275 / 0.08)';
            actionBtn.style.color = 'oklch(0.955 0.003 275)';
        } else {
            actionBtn.textContent = 'Start';
            actionBtn.style.background = color;
            actionBtn.style.color = 'oklch(0.17 0.02 255)';
        }
    };

    readPomoRuntime((rt) => {
        rtCache = rt;
        getPomoSettings((settings) => {
            settingsCache = settings;
            update();
        });
    });
    setInterval(() => {
        if (document.visibilityState === 'visible') update();
    }, 1000);
    chrome.storage.onChanged.addListener((changes: Record<string, any>, area: string) => {
        if (area !== 'local') return;
        if (changes[POMO_KEY]) rtCache = changes[POMO_KEY].newValue ?? null;
        const nextSettings = changes.blockEngineState?.newValue?.pomodoroSettings;
        if (nextSettings) settingsCache = nextSettings;
        if (changes[POMO_KEY] || nextSettings) update();
    });
}

function initDraggableTimer() {
    if (document.getElementById('focuznow-draggable-timer')) return;

    const domain = window.location.hostname;
    const POS_KEY = `focuznow_timer_pos_${domain}`;
    const COLLAPSED_KEY = `focuznow_timer_collapsed_${domain}`;
    let scale = parseFloat(localStorage.getItem(`focuznow_timer_scale_${domain}`) || '1.0');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const timerContainer = document.createElement('div');
    timerContainer.id = 'focuznow-draggable-timer';
    timerContainer.setAttribute('role', 'status');
    timerContainer.setAttribute('aria-label', 'Time on this site');

    // Position = top-left of the pill in viewport coords; snapped to a corner
    // on release. Persisted per-site in chrome.storage.local.
    let posX = window.innerWidth - 140;
    let posY = 20;
    let collapsed = false;

    const applyTransform = (animate: boolean) => {
        timerContainer.style.transition = animate && !reduceMotion
            ? 'transform 320ms cubic-bezier(0.22, 1.2, 0.36, 1), opacity 220ms ease'
            : 'opacity 220ms ease';
        timerContainer.style.transform = `translate3d(${posX}px, ${posY}px, 0) scale(${scale})`;
    };

    const applyStyles = () => {
        timerContainer.style.cssText = `
            position: fixed;
            z-index: 2147483647;
            top: 0;
            left: 0;
            width: fit-content;
            max-width: min(320px, 90vw);
            box-sizing: border-box;
            background: oklch(0.225 0.006 275 / 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid oklch(0.955 0.003 275 / 0.07);
            color: oklch(0.955 0.003 275);
            padding: 7px 12px;
            border-radius: 12px;
            font-family: "Inter Variable", Inter, system-ui, -apple-system, sans-serif;
            font-size: 15px;
            font-weight: 560;
            font-variant-numeric: tabular-nums;
            cursor: grab;
            user-select: none;
            box-shadow: 0 0 0 1px oklch(0 0 0 / 0.2), 0 8px 24px -4px rgb(0 0 0 / 0.5), 0 2px 6px rgb(0 0 0 / 0.3);
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 0;
            transform-origin: top left;
            touch-action: none;
        `;
        applyTransform(false);
    };

    const persistPosition = () => {
        chrome.storage.local.set({ [POS_KEY]: { x: posX, y: posY } });
    };

    const snapToCorner = (velX: number, velY: number) => {
        // Project the release point along the drag velocity, then snap to the
        // nearest viewport corner with spring easing.
        const projectedX = posX + velX * 120;
        const projectedY = posY + velY * 120;
        const rect = timerContainer.getBoundingClientRect();
        const margin = 12;
        const w = rect.width / scale;
        const h = rect.height / scale;
        const targetX = projectedX + w / 2 < window.innerWidth / 2
            ? margin
            : window.innerWidth - w - margin;
        const targetY = projectedY + h / 2 < window.innerHeight / 2
            ? margin
            : window.innerHeight - h - margin;
        posX = targetX;
        posY = targetY;
        applyTransform(true);
        persistPosition();
    };

    const closeBtn = createCloseBtn(() => {
        siteTimerDismissed = true;
        removeDraggableTimer();
    });

    const iconStr = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: oklch(0.675 0.005 275)"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

    const controls = document.createElement('div');
    controls.className = 'timer-controls';
    controls.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        max-width: 0;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
        flex-shrink: 0;
        margin-right: 0;
        transition:
            max-width 120ms ease,
            opacity 120ms ease,
            margin-right 120ms ease;
    `;

    const btnStyle =
        'background: oklch(0.955 0.003 275 / 0.08); border: none; color: oklch(0.86 0.004 275); border-radius: 6px; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 560; transition: background 120ms ease; outline: none; flex-shrink: 0;';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.setAttribute('aria-label', 'Make timer smaller');
    minusBtn.innerText = '−';
    minusBtn.style.cssText = btnStyle;
    minusBtn.onclick = (e) => {
        e.stopPropagation();
        updateScale(scale - 0.1);
    };

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
    plusBtn.setAttribute('aria-label', 'Make timer bigger');
    plusBtn.innerText = '+';
    plusBtn.style.cssText = btnStyle;
    plusBtn.onclick = (e) => {
        e.stopPropagation();
        updateScale(scale + 0.1);
    };

    controls.appendChild(minusBtn);
    controls.appendChild(plusBtn);

    const timerCore = document.createElement('div');
    timerCore.className = 'timer-core';
    timerCore.style.cssText =
        'display: flex; align-items: center; gap: 7px; flex-shrink: 0; white-space: nowrap;';

    const timeSpan = document.createElement('span');
    timeSpan.innerText = '0:00';
    timeSpan.style.cssText = 'font-variant-numeric: tabular-nums; letter-spacing: -0.01em;';

    timerCore.innerHTML = iconStr;
    timerCore.appendChild(timeSpan);

    timerContainer.appendChild(controls);
    timerContainer.appendChild(timerCore);
    timerContainer.appendChild(closeBtn);
    document.body.appendChild(timerContainer);

    const setCollapsed = (next: boolean) => {
        collapsed = next;
        timerCore.style.display = next ? 'none' : 'flex';
        controls.style.display = next ? 'none' : 'flex';
        closeBtn.style.display = next ? 'none' : 'flex';
        timerContainer.style.padding = next ? '0' : '7px 12px';
        timerContainer.style.width = next ? '32px' : 'fit-content';
        timerContainer.style.height = next ? '32px' : '';
        timerContainer.style.borderRadius = next ? '9999px' : '12px';
        if (next) {
            const dot = document.createElement('span');
            dot.className = 'timer-dot';
            dot.style.cssText =
                'width: 8px; height: 8px; border-radius: 9999px; background: oklch(0.68 0.15 255); margin: auto; display: block;';
            timerContainer.appendChild(dot);
        } else {
            timerContainer.querySelector('.timer-dot')?.remove();
        }
        chrome.storage.local.set({ [COLLAPSED_KEY]: next });
        applyTransform(false);
    };

    timerContainer.addEventListener('dblclick', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setCollapsed(!collapsed);
    });

    timerContainer.onmouseenter = () => {
        if (collapsed) return;
        controls.style.opacity = '1';
        controls.style.maxWidth = '52px';
        controls.style.marginRight = '8px';
        controls.style.pointerEvents = 'auto';
    };
    timerContainer.onmouseleave = () => {
        controls.style.opacity = '0';
        controls.style.maxWidth = '0';
        controls.style.marginRight = '0';
        controls.style.pointerEvents = 'none';
    };

    const updateScale = (newScale: number) => {
        scale = Math.max(0.4, Math.min(2.5, newScale));
        localStorage.setItem(`focuznow_timer_scale_${domain}`, scale.toString());
        applyStyles();
    };

    applyStyles();

    // Restore per-site position + collapsed state.
    chrome.storage.local.get([POS_KEY, COLLAPSED_KEY], (res) => {
        const saved = res?.[POS_KEY] as { x?: number; y?: number } | undefined;
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
            posX = Math.max(0, Math.min(window.innerWidth - 60, saved.x!));
            posY = Math.max(0, Math.min(window.innerHeight - 40, saved.y!));
        } else {
            posX = window.innerWidth - 140;
            posY = 20;
        }
        if (res?.[COLLAPSED_KEY] === true) setCollapsed(true);
        applyTransform(false);
    });

    let isDragging = false;
    let dragOriginX = 0;
    let dragOriginY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let velX = 0;
    let velY = 0;
    let moved = false;

    const onPointerMove = (e: PointerEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        velX = (e.clientX - lastX) / dt * 16;
        velY = (e.clientY - lastY) / dt * 16;
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = now;
        posX = e.clientX - dragOriginX;
        posY = e.clientY - dragOriginY;
        moved = true;
        timerContainer.style.transition = 'none';
        timerContainer.style.transform = `translate3d(${posX}px, ${posY}px, 0) scale(${scale})`;
    };

    const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        timerContainer.style.cursor = 'grab';
        timerContainer.releasePointerCapture?.(lastPointerId);
        if (moved) snapToCorner(velX, velY);
    };

    let lastPointerId = 0;
    timerContainer.addEventListener('pointerdown', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        isDragging = true;
        moved = false;
        lastPointerId = e.pointerId;
        timerContainer.setPointerCapture?.(e.pointerId);
        dragOriginX = e.clientX - posX;
        dragOriginY = e.clientY - posY;
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = performance.now();
        velX = 0;
        velY = 0;
        timerContainer.style.cursor = 'grabbing';
    });
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    // Tick locally and only re-sync with the worker now and then. Asking the
    // worker every second from every open tab kept it (and extension storage)
    // permanently busy, which is what made FocuzPass lookups crawl.
    let baseMs = 0;
    let baseAt = performance.now();
    let counting = false;
    const render = () => {
        const ms = baseMs + (counting ? performance.now() - baseAt : 0);
        timeSpan.innerText = fmtTime(Math.floor(ms / 1000));
    };
    const syncTime = () => {
        if (document.visibilityState !== 'visible' || !chrome.runtime?.id) return;
        chrome.runtime.sendMessage({ type: 'GET_CURRENT_URL_TIME', domain: window.location.hostname }, (response) => {
            void chrome.runtime.lastError;
            if (response && response.timeSpent !== undefined) {
                baseMs = response.timeSpent;
                baseAt = performance.now();
                counting = response.counting !== false;
                render();
            }
        });
    };

    syncTime();
    setInterval(() => {
        if (document.visibilityState === 'visible') render();
    }, 1000);
    setInterval(syncTime, 30_000);
    document.addEventListener('visibilitychange', syncTime);
    window.addEventListener('focus', syncTime);
}
