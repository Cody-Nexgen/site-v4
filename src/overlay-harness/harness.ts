// Dev-only harness for §6.21 content-script overlays + the extension popup.
// Usage: /overlay-harness/index.html?view=palette|timer|timer-dot|block|popup
import '../src/mockChrome';

const view = new URLSearchParams(window.location.search).get('view') || 'palette';

async function main() {
    switch (view) {
        case 'popup': {
            document.getElementById('root')!.innerHTML = '';
            await import('../src/popup/PopupApp');
            break;
        }
        case 'palette': {
            await import('../src/content/commandPalette');
            // Open after mount
            setTimeout(() => {
                window.dispatchEvent(new Event('focuznow-toggle-palette'));
                const q = new URLSearchParams(window.location.search).get('q');
                if (q) {
                    const host = document.getElementById('focuznow-command-palette-host');
                    const input = host?.shadowRoot?.querySelector<HTMLInputElement>('.palette-input');
                    if (input) {
                        input.value = q;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            }, 300);
            break;
        }
        case 'timer':
        case 'timer-dot': {
            await chrome.storage.local.set({
                blockEngineState: { draggableTimer: true, pomodoroWidget: false },
                focuznow_timer_collapsed_localhost: view === 'timer-dot',
            });
            await import('../src/content/draggableTimer');
            break;
        }
        case 'block': {
            const mod = await import('../src/content/inAppBlock');
            mod.renderBlockedCover(
                'https://www.youtube.com/shorts/abc123',
                'Shorts are on your blocklist while you\'re focusing. Slip-ups are fine — head back when you\'re ready.',
            );
            break;
        }
    }
}

void main();
