// =========================================================
// devConsole.ts — real browser DevTools console commands
//
// Installs `devmodetest()` and `focuznowDev` on `window` so a
// developer can open the actual Chrome DevTools console (F12)
// on the options/dashboard tab and drive testing directly —
// no in-app UI required.
// =========================================================

import { setDevModeEnabled, toggleDevMode, isDevModeEnabled } from './devMode';
import {
    devClearSlip,
    devGrowAll,
    devPlantTrees,
    devResetForest,
    plantTreeFromSession,
    registerSlip,
} from './forest';

declare global {
    interface Window {
        devmodetest?: () => boolean;
        focuznowDev?: Record<string, (...args: any[]) => unknown>;
        plant?: (count?: number) => void;
        grow?: (minutes?: number) => void;
        slip?: () => void;
        recover?: () => void;
    }
}

const HELP = `[FocuzNow Dev] Commands available:
  devmodetest()              toggle dev testing mode
  plant()                    plant one tree, exactly like a finished focus session
  plant(10)                  plant 10 trees at once
  grow(360)                  instantly grow all trees by N minutes
  slip()                     simulate a blocklist/Shorts slip
  recover()                  clear the active slip penalty
  focuznowDev.enable()       turn dev mode on
  focuznowDev.disable()      turn dev mode off
  focuznowDev.reset()        wipe the forest`;

export function installDevConsole(): void {
    if (typeof window === 'undefined' || window.focuznowDev) return;

    window.devmodetest = () => {
        const on = toggleDevMode();
        console.log(`[FocuzNow Dev] Dev mode ${on ? 'ENABLED' : 'DISABLED'}.${on ? ` Try focuznowDev.plant() or open the Forest tab.\n${HELP}` : ''}`);
        return on;
    };

    // Auto-enable dev mode the first time any planting command runs, so
    // `plant()` alone is enough to unlock the Forest dev toolkit too.
    const ensureDevMode = () => { if (!isDevModeEnabled()) setDevModeEnabled(true); };

    const plant = (count = 1) => {
        ensureDevMode();
        const run = count > 1 ? devPlantTrees(count) : plantTreeFromSession();
        void run.then(() => console.log(`[FocuzNow Dev] Planted ${count} tree(s), same as a finished focus session.`));
    };
    const grow = (minutes = 360) => {
        ensureDevMode();
        void devGrowAll(minutes).then(() => console.log(`[FocuzNow Dev] Grew all trees by ${minutes} minutes.`));
    };
    const slip = () => {
        ensureDevMode();
        void registerSlip('other').then(() => console.log('[FocuzNow Dev] Slip registered.'));
    };
    const recover = () => {
        ensureDevMode();
        void devClearSlip().then(() => console.log('[FocuzNow Dev] Slip penalty cleared.'));
    };

    window.plant = plant;
    window.grow = grow;
    window.slip = slip;
    window.recover = recover;

    window.focuznowDev = {
        help: () => console.log(HELP),
        enable: () => { setDevModeEnabled(true); console.log('[FocuzNow Dev] Dev mode ENABLED.'); },
        disable: () => { setDevModeEnabled(false); console.log('[FocuzNow Dev] Dev mode DISABLED.'); },
        isEnabled: () => isDevModeEnabled(),
        plant,
        grow,
        slip,
        recover,
        reset: () => {
            void devResetForest().then(() => console.log('[FocuzNow Dev] Forest reset.'));
        },
    };

    console.log(`${HELP}\n\nOpen the Forest tab, then type plant() to get started.`);
}
