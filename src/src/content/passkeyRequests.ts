/**
 * FocuzPass passkeys, extension side of public/focuzpass-passkeys.js (the page script). It takes
 * the page's passkey requests, asks the person in a FocuzPass prompt, and gets the answer from the
 * service worker, which checks everything against the frame origin the browser reports. The page
 * only ever gets back what a WebAuthn call returns; it never sees a key.
 *
 * The prompt only reacts to real clicks and key presses (isTrusted), so a page can't press its buttons.
 */

import { COLOR_MODE_KEY, OVERLAY_STYLE, createElement, icon, iconButton, resolveOverlayTheme, runtimeSendMessage, siteMark } from './focuzPassOverlay';
import type { FocuzPassOverlayTransport } from './focuzPassOverlay';
import { clearPasskeyOffer, setPasskeyOffer } from './passkeyOffer';

const REQUEST = 'focuzpass-passkey:request';
const RESPONSE = 'focuzpass-passkey:response';
const ACK = 'focuzpass-passkey:ack';
const CANCEL = 'focuzpass-passkey:cancel';
const WARM = 'focuzpass-passkey:warm';
const HOST_ID = 'focuzpass-passkey-prompt';
/** Under the 30 s after which the browser stops an idle service worker. */
const KEEP_AWAKE_MS = 20_000;
const UNLOCK_WAIT_MS = 120_000;
/** A quick answer shows the prompt ready; a slow one (a sleeping worker) shows it checking first. */
const CHECKING_DELAY_MS = 300;

type Account = { credentialId: string; userName: string; title: string; lastUsedAt?: string };
type Preflight = {
    state: 'off' | 'unconfigured' | 'locked' | 'ready' | 'refused';
    rpId?: string;
    userName?: string;
    excluded?: boolean;
    accounts?: Account[];
    synced?: boolean;
    lapse?: { daysLeft: number };
};
type Answer = { credential?: unknown; error?: { name: string; message: string } };
type Choice = 'primary' | 'secondary' | 'close' | 'cancelled' | { account: string };
type PasskeyRequest = {
    id: string;
    op: 'create' | 'get';
    options: Record<string, unknown>;
    /** Sign-in suggestions (conditional mediation): offered in FocuzPass's suggestions, not asked now. */
    conditional: boolean;
    /** Set when an iframe on this page asked: its origin, as the browser reported it. */
    frameOrigin?: string;
    post: (message: Record<string, unknown>) => void;
};
type CardSpec = {
    title: string;
    subtitle: string;
    note?: string;
    warn?: boolean;
    accounts?: Account[];
    primary?: string;
    secondary?: string;
    /** Waiting on FocuzNow: the main button turns into this label with a spinner. */
    busy?: string;
    /** Finished: a check mark and this label in the main button's place. */
    done?: string;
};

const PROMPT_STYLE = `
    .pk-scrim {
        position: fixed; inset: 0; pointer-events: none;
        background: oklch(0.12 0.004 275 / 0.34);
        animation: fp-fade-in 180ms var(--ease-out);
    }
    :host([data-theme="light"]) .pk-scrim { background: oklch(0.2 0.008 275 / 0.16); }
    .pk-card {
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        width: min(660px, calc(100vw - 24px)); pointer-events: auto; overflow: hidden;
        color: var(--text-1); border-radius: 999px; border: 1px solid transparent;
        /* A frosted body inside a soft gradient outline, brighter where the light catches it. */
        background:
            linear-gradient(oklch(0.225 0.004 275 / 0.9), oklch(0.19 0.004 275 / 0.92)) padding-box,
            linear-gradient(150deg, oklch(1 0 0 / 0.3), oklch(1 0 0 / 0.07) 36%, oklch(1 0 0 / 0.04) 64%, oklch(1 0 0 / 0.2)) border-box;
        -webkit-backdrop-filter: blur(20px) saturate(1.4); backdrop-filter: blur(20px) saturate(1.4);
        box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.07), 0 1px 2px rgb(0 0 0 / 0.3), 0 20px 50px -12px rgb(0 0 0 / 0.6);
        font-family: "Inter Variable", Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 13px; line-height: 1.35; -webkit-font-smoothing: antialiased;
        animation: pk-drop 280ms var(--ease-out);
    }
    .pk-card.is-tall { border-radius: 28px; }
    .pk-main { display: flex; align-items: center; gap: 14px; padding: 14px 16px 14px 14px; }
    .pk-site {
        width: 48px; height: 48px; flex: none; display: grid; place-items: center; overflow: hidden;
        border-radius: 50%; background: var(--bg-raised); border: 1px solid var(--border);
        color: var(--text-2); font-size: 14px; font-weight: 650; letter-spacing: .02em;
    }
    .pk-site { box-shadow: 0 0 0 4px oklch(1 0 0 / 0.035), inset 0 1px 0 oklch(1 0 0 / 0.06); }
    .pk-site img { width: 30px; height: 30px; object-fit: contain; display: block; }
    .pk-actions .btn-primary { box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.45), 0 1px 2px rgb(0 0 0 / 0.25), 0 4px 14px -4px rgb(0 0 0 / 0.35); }
    :host([data-theme="light"]) .pk-card {
        background:
            linear-gradient(oklch(1 0 0 / 0.92), oklch(0.985 0.002 275 / 0.94)) padding-box,
            linear-gradient(150deg, oklch(0.2 0.01 275 / 0.18), oklch(0.2 0.01 275 / 0.06) 36%, oklch(0.2 0.01 275 / 0.04) 64%, oklch(0.2 0.01 275 / 0.14)) border-box;
        box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.9), 0 1px 2px rgb(0 0 0 / 0.06), 0 20px 50px -12px rgb(0 0 0 / 0.25);
    }
    :host([data-theme="light"]) .pk-site { box-shadow: 0 0 0 4px oklch(0.2 0.01 275 / 0.04), inset 0 1px 0 oklch(1 0 0 / 0.8); }
    :host([data-theme="light"]) .pk-actions .btn-primary { box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.15), 0 1px 2px rgb(0 0 0 / 0.2), 0 4px 14px -4px rgb(0 0 0 / 0.3); }
    .pk-copy { flex: 1 1 auto; min-width: 0; }
    .pk-copy h2 { margin: 0; color: var(--text-1); font-size: 15px; font-weight: 620; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pk-copy p { margin: 2px 0 0; color: var(--text-3); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pk-actions { display: flex; align-items: center; gap: 8px; flex: none; margin-left: auto; }
    .pk-actions .btn { height: 36px; padding: 0 16px; border-radius: 999px; font-size: 13px; }
    .pk-actions .btn-ghost { padding: 0 12px; }
    .pk-actions .icon-btn { width: 32px; height: 32px; border-radius: 50%; }
    .pk-actions .icon-btn .ic { width: 15px; height: 15px; }
    .btn.is-busy { pointer-events: none; opacity: .9; }
    .btn.is-done { pointer-events: none; background: var(--success-soft); color: var(--success); }
    .btn.is-done .ic { width: 15px; height: 15px; }
    .pk-spin {
        width: 14px; height: 14px; flex: none; border-radius: 50%;
        border: 2px solid currentColor; border-right-color: transparent; opacity: .75;
        animation: fp-spin 700ms linear infinite;
    }
    .pk-accounts { display: grid; gap: 2px; padding: 0 10px 10px; max-height: 260px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
    .pk-account {
        all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 12px; width: 100%;
        padding: 8px 8px 8px 14px; border-radius: 999px; cursor: pointer; color: var(--text-1);
        transition: background-color 120ms ease;
    }
    .pk-account:hover { background: var(--hover); }
    .pk-account:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
    .pk-account > .ic { width: 16px; height: 16px; color: var(--text-3); flex: none; }
    .pk-account span { min-width: 0; flex: 1; }
    .pk-account b { display: block; font-weight: 550; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pk-account small { display: block; margin-top: 1px; color: var(--text-3); font-size: 11.5px; }
    .pk-account .go { height: 32px; padding: 0 14px; border-radius: 999px; display: inline-flex; align-items: center; background: var(--accent); color: var(--accent-fg); font-size: 12.5px; font-weight: 550; flex: none; }
    .pk-note { margin: -4px 16px 14px 78px; color: var(--text-3); font-size: 12px; line-height: 1.45; }
    .pk-note.is-warn { color: var(--danger); }
    @media (max-width: 560px) {
        .pk-card { border-radius: 28px; }
        .pk-main { flex-wrap: wrap; }
        .pk-actions { width: 100%; justify-content: flex-end; }
        .pk-note { margin-left: 16px; }
    }
    @keyframes pk-drop { from { opacity: 0; transform: translate(-50%, -14px) scale(.98); } to { opacity: 1; transform: translate(-50%, 0); } }
    @media (prefers-reduced-motion: reduce) { .pk-card, .pk-scrim, .pk-spin { animation: none !important; } }
`;

function relativeDay(iso?: string): string {
    if (!iso) return 'Not used yet';
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
    if (days < 1) return 'Used today';
    if (days === 1) return 'Used yesterday';
    return days < 30 ? `Used ${days} days ago` : `Used ${new Date(iso).toLocaleDateString()}`;
}

function days(count: number) {
    return `${count} ${count === 1 ? 'day' : 'days'}`;
}

async function promptTheme(): Promise<'light' | 'dark'> {
    try {
        const stored = await chrome.storage.local.get(COLOR_MODE_KEY);
        return resolveOverlayTheme(stored[COLOR_MODE_KEY]);
    } catch {
        return resolveOverlayTheme(undefined);
    }
}

/** The site's own tab icon, when the passkey is for this page's site (an iframe's site gets letters). */
function siteIcon(site: string): string | null {
    const host = location.hostname;
    if (host !== site && !host.endsWith(`.${site}`)) return null;
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon" i], link[rel="apple-touch-icon" i]')];
    const best = links.find((link) => /apple-touch-icon/i.test(link.rel)) ?? links[0];
    const href = best?.href || `${location.origin}/favicon.ico`;
    return /^(https?:|data:image\/)/.test(href) ? href : null;
}

function spinnerButton(className: string, label: string, done = false): HTMLButtonElement {
    const button = createElement('button', `btn btn-primary ${className}`);
    button.type = 'button';
    button.tabIndex = -1;
    if (done) button.insertAdjacentHTML('afterbegin', icon('check'));
    else button.append(createElement('i', 'pk-spin'));
    button.append(createElement('span', '', label));
    return button;
}

/**
 * Wakes FocuzNow's service worker (or keeps it up). A sleeping one can take many seconds to start
 * on a busy machine, which is what made "Checking" and "Saving" crawl.
 */
let lastWake = 0;
function wakeWorker(minGapMs = 0) {
    if (Date.now() - lastWake < minGapMs) return;
    lastWake = Date.now();
    try {
        void chrome.runtime.sendMessage({ type: 'FOCUZPASS_PING' }).catch(() => undefined);
    } catch {
        /* extension reloaded */
    }
}

let active: PasskeyCard | null = null;

/**
 * FocuzPass's passkey prompt: one at a time, top centre over a light scrim (the page stays usable
 * underneath). It stays up through a request, changing in place: checking, asking, saving, saved.
 */
class PasskeyCard {
    private readonly host = document.createElement('div');
    private readonly shadow: ShadowRoot;
    private readonly ready: Promise<void>;
    private waiting: { promise: Promise<Choice>; resolve: (choice: Choice) => void } | null = null;
    private shown = false;
    private closed = false;

    /** Replaces any prompt already up. */
    static open(id: string, site: string): PasskeyCard {
        active?.close('cancelled');
        document.getElementById(HOST_ID)?.remove();
        active = new PasskeyCard(id, site);
        return active;
    }

    private constructor(readonly id: string, private readonly site: string) {
        this.host.id = HOST_ID;
        this.host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
        this.shadow = this.host.attachShadow({ mode: 'closed' });
        this.ready = promptTheme().then((theme) => {
            this.host.dataset.theme = theme;
        });
        // While the person reads it, the worker mustn't go to sleep and have to start again for the answer.
        this.keepAwake = window.setInterval(() => wakeWorker(), KEEP_AWAKE_MS);
    }

    private readonly keepAwake: number;

    get isClosed() {
        return this.closed;
    }

    /** The person's next choice (the same promise until they make it), or 'cancelled' if it closes first. */
    next(): Promise<Choice> {
        if (this.closed) return Promise.resolve('cancelled');
        if (!this.waiting) {
            let resolve!: (choice: Choice) => void;
            const promise = new Promise<Choice>((r) => (resolve = r));
            this.waiting = { promise, resolve };
        }
        return this.waiting.promise;
    }

    private choose(choice: Choice) {
        const waiting = this.waiting;
        this.waiting = null;
        waiting?.resolve(choice);
    }

    async show(spec: CardSpec) {
        await this.ready;
        if (this.closed) return;
        const on = (element: HTMLElement, choice: Choice) =>
            element.addEventListener('click', (event) => {
                if (event.isTrusted) this.choose(choice);
            });

        const card = createElement('div', 'pk-card');
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-label', spec.title);
        card.addEventListener('keydown', (event) => {
            if (event.isTrusted && event.key === 'Escape') this.choose('close');
        });
        // Changing in place doesn't replay the entrance.
        if (this.shown) card.style.animation = 'none';

        const main = createElement('div', 'pk-main');
        const tile = createElement('span', 'pk-site');
        const src = siteIcon(this.site);
        if (src) {
            const img = createElement('img');
            img.alt = '';
            img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', () => (tile.textContent = siteMark(this.site)), { once: true });
            img.src = src;
            tile.append(img);
        } else {
            tile.textContent = siteMark(this.site);
        }
        const copy = createElement('div', 'pk-copy');
        copy.append(createElement('h2', '', spec.title), createElement('p', '', spec.subtitle));

        const actions = createElement('div', 'pk-actions');
        let focus: HTMLElement | null = null;
        if (spec.secondary && !spec.done) {
            const other = createElement('button', 'btn btn-ghost', spec.secondary);
            other.type = 'button';
            on(other, 'secondary');
            actions.append(other);
        }
        if (spec.done) {
            actions.append(spinnerButton('is-done', spec.done, true));
        } else if (spec.busy) {
            actions.append(spinnerButton('is-busy', spec.busy));
        } else if (spec.primary) {
            const go = createElement('button', 'btn btn-primary', spec.primary);
            go.type = 'button';
            on(go, 'primary');
            actions.append(go);
            focus = go;
        }
        // Saving or signing in can't be stopped halfway; everything else can be cancelled.
        if (!spec.done && !(spec.busy && !spec.secondary)) {
            const dismiss = iconButton('x', 'Cancel');
            on(dismiss, 'close');
            actions.append(dismiss);
        }
        main.append(tile, copy, actions);
        card.append(main);

        if (spec.accounts?.length && !spec.busy && !spec.done) {
            const list = createElement('div', 'pk-accounts');
            for (const account of spec.accounts) {
                const row = createElement('button', 'pk-account');
                row.type = 'button';
                row.innerHTML = icon('keyRound');
                const text = createElement('span');
                text.append(createElement('b', '', account.userName || account.title), createElement('small', '', relativeDay(account.lastUsedAt)));
                row.append(text, createElement('i', 'go', 'Sign in'));
                on(row, { account: account.credentialId });
                list.append(row);
                focus ??= row;
            }
            card.append(list);
        }
        if (spec.note) card.append(createElement('p', spec.warn ? 'pk-note is-warn' : 'pk-note', spec.note));
        // A pill while it's one row; rounded corners once a list or note makes it taller.
        card.classList.toggle('is-tall', Boolean(spec.note || (spec.accounts?.length && !spec.busy && !spec.done)));

        if (this.shown) {
            this.shadow.querySelector('.pk-card')?.replaceWith(card);
        } else {
            const style = createElement('style');
            style.textContent = OVERLAY_STYLE + PROMPT_STYLE;
            this.shadow.append(style, createElement('div', 'pk-scrim'), card);
            document.documentElement.appendChild(this.host);
            this.shown = true;
        }
        focus?.focus({ preventScroll: true });
    }

    close(choice: Choice = 'cancelled') {
        if (this.closed) return;
        this.closed = true;
        window.clearInterval(this.keepAwake);
        if (active === this) active = null;
        this.host.remove();
        this.choose(choice);
    }

    /** Shows the finished state briefly, then goes. */
    finish(spec: CardSpec, ms = 1100) {
        void this.show(spec);
        window.setTimeout(() => this.close(), ms);
    }
}

/** Waits (up to two minutes) for the vault to be unlocked in the FocuzPass window. */
async function waitForUnlock(send: FocuzPassOverlayTransport, card: PasskeyCard): Promise<boolean> {
    const started = Date.now();
    while (Date.now() - started < UNLOCK_WAIT_MS) {
        if (card.isClosed) return false;
        await new Promise((r) => window.setTimeout(r, 1000));
        try {
            const status = await send<{ unlocked: boolean }>({ type: 'FOCUZPASS_STATUS' });
            if (status.unlocked) return true;
        } catch {
            return false;
        }
    }
    return false;
}

/** The site to show while FocuzNow checks (the service worker decides the real one). */
function siteGuess(op: 'create' | 'get', options: Record<string, unknown>, frameOrigin?: string): string {
    const claimed = op === 'create' ? (options.rp as { id?: unknown } | undefined)?.id : options.rpId;
    if (typeof claimed === 'string' && claimed) return claimed.slice(0, 120);
    try {
        return new URL(frameOrigin ?? location.origin).hostname;
    } catch {
        return location.hostname;
    }
}

/**
 * Passkeys found by this page's sign-in suggestions lookup (sites start it when the page loads).
 * A sign-in prompt for the same site shows them at once instead of "Checking…"; a fresh check
 * still runs, and only an account it confirms can be used.
 */
let known: { rpId: string; accounts: Account[]; at: number; frameOrigin?: string } | null = null;
const KNOWN_FOR_MS = 10 * 60_000;

function knownAccounts(options: Record<string, unknown>, frameOrigin?: string): { rpId: string; accounts: Account[] } | null {
    if (!known || Date.now() - known.at > KNOWN_FOR_MS || known.frameOrigin !== frameOrigin) return null;
    let rpId = typeof options.rpId === 'string' && options.rpId ? options.rpId : '';
    if (!rpId) {
        try {
            rpId = new URL(frameOrigin ?? location.origin).hostname;
        } catch {
            return null;
        }
    }
    if (rpId !== known.rpId) return null;
    const allow = Array.isArray(options.allowCredentials)
        ? options.allowCredentials.map((entry) => (entry as { id?: unknown } | null)?.id).filter((id): id is string => typeof id === 'string')
        : [];
    const accounts = allow.length ? known.accounts.filter((account) => allow.includes(account.credentialId)) : known.accounts;
    return accounts.length ? { rpId: known.rpId, accounts } : null;
}

function sameAccounts(a: Account[], b: Account[]): boolean {
    return a.length === b.length && a.every((account, i) => account.credentialId === b[i]?.credentialId);
}

function isPick(choice: Choice): boolean {
    return choice === 'primary' || typeof choice === 'object';
}

async function handle(send: FocuzPassOverlayTransport, request: PasskeyRequest) {
    const { id, op, options } = request;
    const reply = (result: Record<string, unknown>) => {
        request.post({ type: RESPONSE, id, ...result });
    };
    // Which frame asked goes to the service worker, which checks the site against that origin.
    const from = request.frameOrigin ? { frameOrigin: request.frameOrigin } : {};
    const fallback = () => reply({ fallback: true });
    const notAllowed = () => reply({ error: { name: 'NotAllowedError', message: 'The operation either timed out or was not allowed.' } });
    const answer = (choice: Choice) => (choice === 'secondary' ? fallback() : notAllowed());
    const preflight = () => send<Preflight>({ type: 'FOCUZPASS_PASSKEY_PREFLIGHT', op, options, ...from });

    if (request.conditional) {
        // Nothing to ask now: FocuzPass's suggestions on the username field offer these passkeys,
        // and this answers when one is picked (the browser's own suggestions stay too).
        try {
            const pre = await preflight();
            if (pre.state !== 'ready' || !pre.rpId || !pre.accounts?.length) return fallback();
            known = { rpId: pre.rpId, accounts: pre.accounts, at: Date.now(), frameOrigin: request.frameOrigin };
            setPasskeyOffer({
                id,
                rpId: pre.rpId,
                accounts: pre.accounts,
                choose: (credentialId) => {
                    clearPasskeyOffer(id);
                    void send<Answer>({ type: 'FOCUZPASS_PASSKEY_GET', options, credentialId, ...from }).then(reply, (error) =>
                        reply({ error: { name: 'NotAllowedError', message: error instanceof Error ? error.message : 'FocuzPass couldn\'t finish that.' } }),
                    );
                },
            });
        } catch {
            fallback();
        }
        return;
    }

    const guess = siteGuess(op, options, request.frameOrigin);
    const card = PasskeyCard.open(id, guess);
    const saveTitle = (site: string) => `Save a passkey for ${site}?`;
    const signInTitle = (site: string) => `Sign in to ${site}`;
    const title = op === 'create' ? saveTitle(guess) : signInTitle(guess);
    // A sleeping service worker can take a while to answer: show that FocuzPass is on it, with the
    // way out, instead of nothing.
    const checking = window.setTimeout(() => {
        void card.show({ title, subtitle: 'Checking FocuzPass…', busy: 'Checking', secondary: 'Use another device' });
    }, CHECKING_DELAY_MS);
    const leave = (then: () => void) => {
        window.clearTimeout(checking);
        card.close();
        then();
    };
    const signInCard = (site: string, accounts: Account[], lapseNote?: string) => {
        const one = accounts.length === 1 ? accounts[0]! : null;
        void card.show({
            title: signInTitle(site),
            subtitle: one ? `${one.userName || one.title} · ${relativeDay(one.lastUsedAt)}` : 'Choose a passkey saved in FocuzPass',
            accounts: one ? undefined : accounts,
            primary: one ? 'Sign in' : undefined,
            note: lapseNote,
            warn: Boolean(lapseNote),
            secondary: 'Use another device',
        });
    };
    // Already looked up when the page loaded: ask right away, check in the background.
    const early = op === 'get' ? knownAccounts(options, request.frameOrigin) : null;
    if (early) {
        window.clearTimeout(checking);
        signInCard(early.rpId, early.accounts);
    }
    let pendingChoice: Choice | null = null;

    let pre: Preflight;
    const checkStarted = performance.now();
    // Diagnostic while passkey speed is being confirmed with the owner; remove after.
    const timing: { shown?: number; check?: number; clicked?: number } = early ? { shown: 0 } : {};
    try {
        const first = await Promise.race([preflight().then((value) => ({ pre: value })), card.next().then((choice) => ({ choice }))]);
        window.clearTimeout(checking);
        timing.check = Math.round(performance.now() - checkStarted);
        if ('choice' in first) {
            // Picked on the early card before the check finished: finish the check, then use it.
            if (!early || !isPick(first.choice)) return leave(() => answer(first.choice));
            pendingChoice = first.choice;
            void card.show({ title: signInTitle(early.rpId), subtitle: 'With a passkey saved in FocuzPass', busy: 'Signing in…' });
            pre = await preflight();
        } else {
            pre = first.pre;
        }
        if (pre.state === 'locked') {
            pendingChoice = null;
            const site = pre.rpId || guess;
            void card.show({ title: op === 'create' ? saveTitle(site) : signInTitle(site), subtitle: 'Unlock FocuzPass to use your passkeys', primary: 'Unlock FocuzPass', secondary: 'Use another device' });
            const choice = await card.next();
            if (choice !== 'primary') return leave(() => answer(choice));
            void card.show({ title: op === 'create' ? saveTitle(site) : signInTitle(site), subtitle: 'Unlock FocuzPass in the window that opened', busy: 'Waiting', secondary: 'Use another device' });
            await send({ type: 'FOCUZPASS_OPEN_ACCESS_WINDOW' });
            const unlocked = await Promise.race([waitForUnlock(send, card).then((ok) => ({ ok })), card.next().then((choice) => ({ choice }))]);
            if ('choice' in unlocked) return leave(() => answer(unlocked.choice));
            if (!unlocked.ok) return leave(fallback);
            pre = await preflight();
        }
    } catch {
        return leave(fallback);
    }
    if (pre.state !== 'ready' || !pre.rpId) return leave(fallback);
    const site = pre.rpId;
    const lapseNote = pre.lapse
        ? `FocuzNow Pro has ended. Resubscribe within ${days(pre.lapse.daysLeft)} to keep Cloud sync; until then FocuzPass is read-only.`
        : undefined;

    try {
        if (op === 'create') {
            const subtitle = `${pre.userName || 'Your account'} · ${pre.synced ? 'Syncs to your devices' : 'Saved on this device'}`;
            if (pre.excluded) {
                // Saving one somewhere else too (Windows Hello, a phone, a security key) is still allowed.
                void card.show({ title: 'This passkey is already in FocuzPass', subtitle: `${pre.userName || 'This account'} · ${site}`, primary: 'OK', secondary: 'Save to another device' });
                const choice = await card.next();
                if (choice === 'secondary') return leave(fallback);
                return leave(() => reply({ error: { name: 'InvalidStateError', message: 'A passkey for this account is already saved in FocuzPass.' } }));
            }
            if (pre.lapse) {
                void card.show({ title: 'FocuzPass can\'t save new passkeys now', subtitle: site, note: lapseNote, warn: true, secondary: 'Use another device' });
                const choice = await card.next();
                return leave(() => answer(choice));
            }
            void card.show({ title: saveTitle(site), subtitle, primary: 'Save passkey', secondary: 'Use another device' });
            const choice = await card.next();
            if (choice !== 'primary') return leave(() => answer(choice));
            void card.show({ title: saveTitle(site), subtitle, busy: 'Saving…' });
            const result = await send<Answer>({ type: 'FOCUZPASS_PASSKEY_CREATE', options, ...from });
            reply(result);
            if (result.credential) card.finish({ title: 'Passkey saved in FocuzPass', subtitle, done: 'Saved' });
            else card.close();
            return;
        }

        const accounts = pre.accounts ?? [];
        if (!accounts.length) return leave(fallback);
        // The early card stands if the check found the same passkeys; otherwise show what it found.
        const shownEarly = early && !pre.lapse && sameAccounts(early.accounts, accounts) ? early.accounts : null;
        let shown = accounts;
        let choice: Choice;
        if (shownEarly) {
            shown = shownEarly;
            choice = pendingChoice ?? (await card.next());
        } else {
            signInCard(site, accounts, lapseNote);
            timing.shown ??= Math.round(performance.now() - checkStarted);
            choice = await card.next();
        }
        const clickedAt = performance.now();
        const one = shown.length === 1 ? shown[0]! : null;
        const picked = choice === 'primary' && one ? one.credentialId : typeof choice === 'object' ? choice.account : null;
        // Only a passkey the fresh check found can be used.
        const credentialId = picked && accounts.some((account) => account.credentialId === picked) ? picked : null;
        if (!credentialId) return leave(() => answer(choice));
        void card.show({ title: signInTitle(site), subtitle: 'With a passkey saved in FocuzPass', busy: 'Signing in…' });
        reply(await send<Answer>({ type: 'FOCUZPASS_PASSKEY_GET', options, credentialId, ...from }));
        console.info(`[FocuzPass] passkey sign-in: prompt shown ${timing.shown ?? '?'} ms after the site asked (check ${timing.check ?? '?'} ms); signed in ${Math.round(performance.now() - clickedAt)} ms after your click`);
        card.close();
    } catch (error) {
        card.close();
        reply({ error: { name: 'NotAllowedError', message: error instanceof Error ? error.message : 'FocuzPass couldn\'t finish that.' } });
    }
}

/** A frame inside this page (any depth); a page can't pass another window off as one. */
function childFrame(source: MessageEventSource | null): Window | null {
    try {
        const frame = source as Window | null;
        return frame && frame !== window && frame.top === window ? frame : null;
    } catch {
        return null;
    }
}

function secureOrigin(origin: string): boolean {
    try {
        const url = new URL(origin);
        return url.origin === origin && (url.protocol === 'https:' || (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname.endsWith('.localhost'))));
    } catch {
        return false;
    }
}

/** False once FocuzNow is reloaded, updated or removed: this copy can't reach the extension any more. */
function extensionAlive(): boolean {
    try {
        return Boolean(chrome.runtime?.id);
    } catch {
        return false;
    }
}

/**
 * Listens for the page script's requests: from this page, and from iframes in it (the prompt shows
 * here, in the top frame, whichever frame asked). Answers go back to the frame that asked.
 *
 * After FocuzNow updates, pages already open keep this copy, cut off from the extension, and get a
 * fresh one injected beside it (see reconnectPasskeyTabs in the service worker). The old copy stays
 * quiet so the fresh one answers; answers carry `live` so the page script can tell them apart from
 * a copy older than this rule.
 */
export function initPasskeyRequests(send: FocuzPassOverlayTransport = runtimeSendMessage, alive: () => boolean = extensionAlive) {
    if (window.top !== window) return;
    const seen = new Set<string>();
    // Pressing a button ("Sign in with a passkey") comes a moment before the site asks: wake the
    // worker then, in case the browser put it to sleep since the page loaded.
    window.addEventListener('pointerdown', (event) => {
        if (!alive()) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('button, a, [role="button"], input[type="submit"], input[type="button"]')) wakeWorker(5_000);
    }, { capture: true, passive: true });
    window.addEventListener('message', (event) => {
        if (!alive()) return;
        const fromPage = event.source === window && event.origin === window.location.origin;
        const frame = fromPage ? null : childFrame(event.source);
        if (!fromPage && !(frame && secureOrigin(event.origin))) return;
        const data = event.data as { type?: unknown; id?: unknown; op?: unknown; payload?: { options?: unknown; conditional?: unknown } } | null;
        if (!data || typeof data !== 'object' || typeof data.id !== 'string' || data.id.length > 80) return;
        const post = (message: Record<string, unknown>) => {
            const live = { ...message, live: true };
            if (frame) frame.postMessage(live, event.origin);
            else window.postMessage(live, window.location.origin);
        };
        if (data.type === WARM) {
            if (fromPage) wakeWorker(15_000);
            return;
        }
        if (data.type === CANCEL) {
            if (active?.id === data.id) active.close('cancelled');
            clearPasskeyOffer(data.id);
            return;
        }
        if (data.type !== REQUEST || (data.op !== 'create' && data.op !== 'get')) return;
        const options = data.payload?.options;
        post({ type: ACK, id: data.id });
        // The page script repeats a request until it's acknowledged: handle each one once.
        if (seen.has(data.id)) return;
        if (seen.size > 200) seen.clear();
        seen.add(data.id);
        if (!options || typeof options !== 'object') {
            post({ type: RESPONSE, id: data.id, fallback: true });
            return;
        }
        void handle(send, {
            id: data.id,
            op: data.op,
            options: options as Record<string, unknown>,
            conditional: data.op === 'get' && data.payload?.conditional === true,
            frameOrigin: frame ? event.origin : undefined,
            post,
        });
    });
}
