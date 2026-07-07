// Content Script: Draggable Timer Overlay + Pomodoro Widget
console.log('[Content Script] Draggable Timer logic loaded.');

const POMO_KEY = 'pomodoroRuntimeV1';

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
        background: rgba(255,255,255,0.15);
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
        btn.style.background = 'rgba(255,255,255,0.15)';
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
    let completing = false;

    const applyShell = (isBreak: boolean) => {
        const border = isBreak ? 'rgba(34,197,94,0.4)' : 'rgba(168,85,247,0.4)';
        const glow = isBreak ? 'rgba(34,197,94,0.15)' : 'rgba(168,85,247,0.15)';
        widget.style.borderColor = border;
        widget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px ${glow}`;
    };

    widget.style.cssText = `
        position: fixed;
        z-index: 2147483646;
        bottom: 24px;
        left: 24px;
        width: fit-content;
        max-width: min(180px, 90vw);
        box-sizing: border-box;
        background: rgba(10, 10, 10, 0.88);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(168,85,247,0.4);
        color: white;
        padding: 10px 12px 12px;
        border-radius: 20px;
        font-family: system-ui, -apple-system, sans-serif;
        user-select: none;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 24px rgba(168,85,247,0.15);
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
        'font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; opacity: 0.45; margin-bottom: 6px; text-align: center;';
    labelEl.textContent = 'Focus Session';

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
    track.setAttribute('stroke', 'rgba(255,255,255,0.08)');
    track.setAttribute('stroke-width', '4');

    const progress = document.createElementNS(svgNS, 'circle');
    progress.setAttribute('cx', '44');
    progress.setAttribute('cy', '44');
    progress.setAttribute('r', '38');
    progress.setAttribute('fill', 'none');
    progress.setAttribute('stroke', '#a855f7');
    progress.setAttribute('stroke-width', '4');
    progress.setAttribute('stroke-linecap', 'round');
    const circum = 2 * Math.PI * 38;
    progress.setAttribute('stroke-dasharray', String(circum));

    svg.appendChild(track);
    svg.appendChild(progress);
    ringWrap.appendChild(svg);

    const timeEl = document.createElement('div');
    timeEl.style.cssText =
        'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; letter-spacing: -0.02em; tabular-nums;';
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
        border-radius: 10px;
        background: #a855f7;
        color: white;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
    `;
    actionBtn.textContent = 'START';

    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.style.cssText = `
        padding: 6px 10px;
        border: none;
        border-radius: 10px;
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.6);
        font-size: 10px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s;
    `;
    stopBtn.textContent = 'RESET';

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
                    });
                }
            });
        });
    };

    stopBtn.onclick = (e) => {
        e.stopPropagation();
        writePomoRuntime(null);
    };

    const update = () => {
        readPomoRuntime((rt) => {
            getPomoSettings((settings) => {
                const focusMin = settings.focusMin || 25;
                const breakMin = settings.breakMin || 5;
                const defaultSec = Math.round(
                    ((rt?.isBreak ? breakMin : focusMin) || focusMin) * 60,
                );

                if (!rt || (!rt.running && !rt.paused)) {
                    labelEl.textContent = 'Pomodoro';
                    timeEl.textContent = fmtTime(defaultSec);
                    progress.setAttribute('stroke', '#555');
                    progress.setAttribute('stroke-dashoffset', String(circum));
                    actionBtn.textContent = 'START';
                    actionBtn.style.background = '#a855f7';
                    applyShell(false);
                    return;
                }

                const left = computeTimeLeft(rt);
                const total = rt.segmentTotalSec || defaultSec;
                const pct = total > 0 ? Math.min(1, (total - left) / total) : 0;
                const color = rt.isBreak ? '#22c55e' : '#a855f7';

                labelEl.textContent = rt.isBreak ? 'Break Time' : 'Focus Session';
                timeEl.textContent = fmtTime(left);
                progress.setAttribute('stroke', color);
                progress.setAttribute('stroke-dashoffset', String(circum * (1 - pct)));
                applyShell(!!rt.isBreak);

                if (rt.running && !rt.paused) {
                    actionBtn.textContent = 'PAUSE';
                    actionBtn.style.background = 'rgba(255,255,255,0.12)';
                } else {
                    actionBtn.textContent = 'START';
                    actionBtn.style.background = color;
                }

                if (rt.running && !rt.paused && left <= 0 && !completing) {
                    completing = true;
                    chrome.runtime.sendMessage({ type: 'POMODORO_SEGMENT_COMPLETE' }, () => {
                        completing = false;
                    });
                }
            });
        });
    };

    update();
    setInterval(update, 1000);
    chrome.storage.onChanged.addListener((changes: Record<string, any>, area: string) => {
        if (area === 'local' && changes[POMO_KEY]) update();
    });
}

function initDraggableTimer() {
    if (document.getElementById('focuznow-draggable-timer')) return;

    const domain = window.location.hostname;
    let scale = parseFloat(localStorage.getItem(`focuznow_timer_scale_${domain}`) || '1.0');
    const timerContainer = document.createElement('div');
    timerContainer.id = 'focuznow-draggable-timer';

    let xOffset = 0;
    let yOffset = 0;

    const applyStyles = () => {
        timerContainer.style.cssText = `
            position: fixed;
            z-index: 2147483647;
            top: 20px;
            right: 20px;
            width: fit-content;
            max-width: min(320px, 90vw);
            box-sizing: border-box;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            padding: 8px 12px;
            border-radius: 9999px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            font-weight: 700;
            cursor: grab;
            user-select: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-end;
            gap: 0;
            transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease;
            transform: translate3d(${xOffset}px, ${yOffset}px, 0) scale(${scale});
        `;
    };

    const closeBtn = createCloseBtn(() => {
        siteTimerDismissed = true;
        removeDraggableTimer();
    });
    timerContainer.appendChild(closeBtn);

    const iconStr = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

    const controls = document.createElement('div');
    controls.className = 'timer-controls';
    controls.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        max-width: 0;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
        flex-shrink: 0;
        margin-right: 0;
        transform: translateX(8px);
        transition:
            max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.25s ease,
            margin-right 0.35s cubic-bezier(0.4, 0, 0.2, 1),
            transform 0.35s cubic-bezier(0.4, 0, 1, 1);
    `;

    const btnStyle =
        'background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; transition: background 0.2s, transform 0.1s; outline: none; flex-shrink: 0;';

    const minusBtn = document.createElement('button');
    minusBtn.type = 'button';
    minusBtn.innerText = '−';
    minusBtn.style.cssText = btnStyle;
    minusBtn.onclick = (e) => {
        e.stopPropagation();
        updateScale(scale - 0.1);
    };

    const plusBtn = document.createElement('button');
    plusBtn.type = 'button';
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
        'display: flex; align-items: center; gap: 8px; flex-shrink: 0; white-space: nowrap;';

    const timeSpan = document.createElement('span');
    timeSpan.innerText = '0m 0s';

    timerCore.innerHTML = iconStr;
    timerCore.appendChild(timeSpan);

    timerContainer.appendChild(controls);
    timerContainer.appendChild(timerCore);
    document.body.appendChild(timerContainer);

    timerContainer.onmouseenter = () => {
        controls.style.opacity = '1';
        controls.style.maxWidth = '56px';
        controls.style.marginRight = '8px';
        controls.style.transform = 'translateX(0)';
        controls.style.pointerEvents = 'auto';
    };
    timerContainer.onmouseleave = () => {
        controls.style.opacity = '0';
        controls.style.maxWidth = '0';
        controls.style.marginRight = '0';
        controls.style.transform = 'translateX(8px)';
        controls.style.pointerEvents = 'none';
    };

    const updateScale = (newScale: number) => {
        scale = Math.max(0.4, Math.min(2.5, newScale));
        localStorage.setItem(`focuznow_timer_scale_${domain}`, scale.toString());
        applyStyles();
    };

    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    applyStyles();

    timerContainer.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e: MouseEvent) {
        if (e.target instanceof HTMLButtonElement) return;
        if ((e.target as HTMLElement).closest('button')) return;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (
            e.target === timerContainer ||
            (e.target as HTMLElement).parentNode === timerContainer ||
            (e.target as HTMLElement).parentNode?.parentNode === timerContainer ||
            (e.target as HTMLElement).closest?.('.timer-core')
        ) {
            isDragging = true;
            timerContainer.style.cursor = 'grabbing';
        }
    }

    function drag(e: MouseEvent) {
        if (isDragging) {
            e.preventDefault();
            const newX = e.clientX - initialX;
            const newY = e.clientY - initialY;
            currentX = newX;
            currentY = newY;
            xOffset = currentX;
            yOffset = currentY;
            timerContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${scale * 1.05})`;
        }
    }

    function dragEnd() {
        if (isDragging) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            timerContainer.style.cursor = 'grab';
            timerContainer.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0) scale(${scale})`;
        }
    }

    const updateTime = () => {
        const host = window.location.hostname;
        chrome.runtime.sendMessage({ type: 'GET_CURRENT_URL_TIME', domain: host }, (response) => {
            if (response && response.timeSpent !== undefined) {
                const totalSeconds = Math.floor(response.timeSpent / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                let displayStr = '';
                if (minutes > 0) displayStr += `${minutes}m `;
                displayStr += `${seconds}s`;
                timeSpan.innerText = displayStr;
            }
        });
    };

    updateTime();
    setInterval(updateTime, 1000);
}
