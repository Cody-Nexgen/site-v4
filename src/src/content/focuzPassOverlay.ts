/**
 * FocuzPass form companion.
 *
 * Runs in an isolated content-script world, renders inside Shadow DOM, never auto-submits,
 * and only requests credentials for the exact page hostname from the service worker.
 */

type LoginMatch = {
    id: string;
    type: 'login';
    title: string;
    identity: string;
    domain?: string;
    password?: string;
    authMethod: string;
    mark: string;
    markTone: string;
};

type PageContext = {
    state: 'unconfigured' | 'locked' | 'ready';
    domain: string;
    matches: LoginMatch[];
};

type PendingLogin = {
    available: boolean;
    domain?: string;
    title?: string;
    identity?: string;
    faviconUrl?: string;
};

type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string };

type FieldControl = {
    host: HTMLDivElement;
    shadow: ShadowRoot;
    button: HTMLButtonElement;
};

const FIELD_HOST_ATTR = 'data-focuzpass-field-host';
const POPOVER_HOST_ID = 'focuzpass-popover-host';
const SAVE_HOST_ID = 'focuzpass-save-host';
const SUBMIT_DEBOUNCE_MS = 1800;

const KEY_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="7.5" cy="15.5" r="4.5"></circle>
  <path d="m11 12 8.5-8.5M16 7l2 2M18 5l2 2"></path>
</svg>`;

const LOCK_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect width="15" height="11" x="4.5" y="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
</svg>`;

const SPARK_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="m12 3-1.2 3.8a2 2 0 0 1-1.3 1.3L5.7 9.3l3.8 1.2a2 2 0 0 1 1.3 1.3L12 15.6l1.2-3.8a2 2 0 0 1 1.3-1.3l3.8-1.2-3.8-1.2a2 2 0 0 1-1.3-1.3L12 3Z"></path><path d="m19 15-.6 1.8a1 1 0 0 1-.6.6L16 18l1.8.6a1 1 0 0 1 .6.6L19 21l.6-1.8a1 1 0 0 1 .6-.6L22 18l-1.8-.6a1 1 0 0 1-.6-.6L19 15Z"></path>
</svg>`;

const CHECK_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"></path></svg>`;

const ARROW_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;

const FIELD_STYLE = `
    :host { all: initial; color-scheme: dark; }
    * { box-sizing: border-box; }
    button {
        all: unset;
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        color: #f2c14f; cursor: pointer; border-radius: 7px;
        background: rgba(14,14,15,.92); border: 1px solid rgba(255,255,255,.13);
        box-shadow: 0 4px 14px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.06);
        transition: transform 140ms cubic-bezier(.16,1,.3,1), background 140ms ease, border-color 140ms ease;
    }
    button:hover { transform: translateY(-1px); background: rgba(27,27,29,.97); border-color: rgba(242,193,79,.36); }
    button:active { transform: scale(.94); }
    button:focus-visible { outline: 2px solid rgba(242,193,79,.88); outline-offset: 2px; }
    svg { width: 55%; height: 55%; }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }
`;

const PANEL_STYLE = `
    :host { all: initial; color-scheme: dark; }
    * { box-sizing: border-box; }
    .panel {
        position: relative; overflow: hidden; width: 326px; color: #f5f5f5;
        border: 1px solid rgba(255,255,255,.105); border-radius: 14px;
        background: rgba(17,17,18,.975); box-shadow: 0 24px 70px rgba(0,0,0,.46), inset 0 1px 0 rgba(255,255,255,.045);
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased; animation: fp-panel-in 260ms cubic-bezier(.16,1,.3,1);
    }
    .panel::before {
        content: ""; position: absolute; left: 0; top: 0; width: 42%; height: 2px;
        background: linear-gradient(90deg, transparent, #f2c14f 35%, #ffe19a 70%, transparent);
        animation: fp-seal 520ms cubic-bezier(.16,1,.3,1) both;
    }
    .head { display: flex; align-items: center; gap: 10px; padding: 14px 14px 11px; border-bottom: 1px solid rgba(255,255,255,.065); }
    .brand {
        width: 29px; height: 29px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
        border-radius: 9px; color: #f2c14f; background: rgba(242,193,79,.075); border: 1px solid rgba(242,193,79,.15);
    }
    .brand svg { width: 15px; height: 15px; }
    .head-copy { min-width: 0; flex: 1; }
    .eyebrow { margin: 0 0 2px; color: #c99732; font-size: 8px; font-weight: 750; letter-spacing: .15em; text-transform: uppercase; }
    .head-title { margin: 0; color: #f1f1f1; font-size: 12px; font-weight: 650; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .close {
        all: unset; width: 27px; height: 27px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
        border-radius: 7px; color: #666; cursor: pointer; transition: background 130ms ease, color 130ms ease, transform 130ms ease;
    }
    .close:hover { background: rgba(255,255,255,.055); color: #ddd; }
    .close:active { transform: scale(.94); }
    .close svg { width: 14px; height: 14px; }
    .body { padding: 13px; }
    .section-label { margin: 0 0 8px; color: #626267; font-size: 8px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
    .account-list { display: grid; gap: 5px; }
    .account {
        all: unset; width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px; cursor: pointer;
        border: 1px solid rgba(255,255,255,.06); border-radius: 10px; background: rgba(255,255,255,.022);
        transition: transform 150ms cubic-bezier(.16,1,.3,1), background 150ms ease, border-color 150ms ease;
    }
    .account:hover { transform: translateX(2px); border-color: rgba(242,193,79,.19); background: rgba(255,255,255,.045); }
    .account:active { transform: translateX(1px) scale(.99); }
    .account:focus-visible, .action:focus-visible, .text-action:focus-visible, .close:focus-visible { outline: 2px solid rgba(242,193,79,.82); outline-offset: 2px; }
    .favicon, .mark {
        width: 34px; height: 34px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
        border-radius: 9px; border: 1px solid rgba(255,255,255,.075); background: rgba(255,255,255,.045);
    }
    .favicon { object-fit: contain; padding: 7px; }
    .mark { color: #aaa; font-size: 9px; font-weight: 800; letter-spacing: -.02em; }
    .account-copy { min-width: 0; flex: 1; }
    .account-title { display: block; color: #ededed; font-size: 11px; font-weight: 620; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .account-id { display: block; margin-top: 3px; color: #747479; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .method { max-width: 88px; color: #777; font-size: 8px; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chevron { width: 13px; height: 13px; color: #6b582e; transition: transform 150ms ease, color 150ms ease; }
    .account:hover .chevron { transform: translateX(2px); color: #f2c14f; }
    .empty { padding: 6px 3px 7px; }
    .empty-icon {
        width: 37px; height: 37px; margin-bottom: 11px; display: flex; align-items: center; justify-content: center;
        border-radius: 11px; color: #c99732; background: rgba(242,193,79,.07); border: 1px solid rgba(242,193,79,.13);
    }
    .empty-icon svg { width: 17px; height: 17px; }
    .empty-title { margin: 0; color: #ededed; font-size: 13px; font-weight: 650; letter-spacing: -.015em; }
    .empty-copy { margin: 5px 0 13px; color: #77777d; font-size: 10px; line-height: 1.5; }
    .action {
        all: unset; width: 100%; height: 36px; padding: 0 11px; display: flex; align-items: center; justify-content: center; gap: 7px;
        border-radius: 9px; cursor: pointer; color: #221b0b; background: #f2c14f; border: 1px solid rgba(255,225,150,.45);
        box-shadow: 0 7px 22px rgba(242,193,79,.08); font-size: 10px; font-weight: 750;
        transition: transform 140ms cubic-bezier(.16,1,.3,1), background 140ms ease;
    }
    .action:hover { transform: translateY(-1px); background: #f7cc69; }
    .action:active { transform: scale(.985); }
    .action svg { width: 13px; height: 13px; }
    .footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 13px; border-top: 1px solid rgba(255,255,255,.06); background: rgba(255,255,255,.012); }
    .local { display: flex; align-items: center; gap: 5px; color: #525257; font-size: 8px; }
    .local-dot { width: 5px; height: 5px; border-radius: 50%; background: #46b98a; box-shadow: 0 0 0 3px rgba(70,185,138,.08); }
    .text-action { all: unset; color: #8d7543; cursor: pointer; font-size: 8px; font-weight: 650; transition: color 130ms ease; }
    .text-action:hover { color: #f2c14f; }
    .loading { display: flex; align-items: center; gap: 10px; padding: 9px 4px; color: #777; font-size: 10px; }
    .spinner { width: 15px; height: 15px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.1); border-top-color: #d3a83f; animation: fp-spin .7s linear infinite; }
    .success { padding: 11px 4px 10px; text-align: center; }
    .success-icon { width: 39px; height: 39px; margin: 0 auto 9px; display: flex; align-items: center; justify-content: center; border-radius: 12px; color: #55d39e; background: rgba(85,211,158,.07); border: 1px solid rgba(85,211,158,.14); }
    .success-icon svg { width: 18px; height: 18px; }
    .success-title { margin: 0; color: #ededed; font-size: 12px; font-weight: 650; }
    .success-copy { margin: 4px 0 0; color: #717176; font-size: 9px; line-height: 1.45; }
    @keyframes fp-panel-in { from { opacity: 0; transform: translateY(-7px) scale(.975); } to { opacity: 1; transform: none; } }
    @keyframes fp-seal { from { transform: translateX(-110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes fp-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .panel, .panel::before, .spinner { animation: none; } * { transition-duration: .01ms !important; } }
`;

const SAVE_STYLE = `
    :host { all: initial; color-scheme: dark; }
    * { box-sizing: border-box; }
    .toast {
        position: relative; overflow: hidden; width: min(360px, calc(100vw - 24px));
        border: 1px solid rgba(255,255,255,.11); border-radius: 15px; background: rgba(17,17,18,.98);
        color: #f2f2f2; box-shadow: 0 24px 70px rgba(0,0,0,.48), inset 0 1px 0 rgba(255,255,255,.05);
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased; animation: fp-save-in 340ms cubic-bezier(.16,1,.3,1);
    }
    .toast::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 2px; background: #f2c14f; }
    .main { display: flex; gap: 11px; padding: 14px 14px 12px 16px; }
    .site-icon, .site-mark { width: 38px; height: 38px; flex: 0 0 auto; border-radius: 10px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.045); }
    .site-icon { object-fit: contain; padding: 8px; }
    .site-mark { display: flex; align-items: center; justify-content: center; color: #d5a83c; font-size: 10px; font-weight: 800; }
    .copy { min-width: 0; flex: 1; }
    .eyebrow { margin: 0 0 3px; color: #b78b2d; font-size: 8px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
    h2 { margin: 0; color: #f1f1f1; font-size: 13px; font-weight: 660; letter-spacing: -.015em; }
    p { margin: 4px 0 0; color: #747479; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .close { all: unset; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; border-radius: 7px; color: #626267; cursor: pointer; }
    .close:hover { color: #ddd; background: rgba(255,255,255,.05); }
    .close svg { width: 13px; height: 13px; }
    .actions { display: flex; justify-content: flex-end; gap: 7px; padding: 9px 14px 11px 16px; border-top: 1px solid rgba(255,255,255,.06); }
    button.action { all: unset; height: 31px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 11px; border-radius: 8px; cursor: pointer; font-size: 9px; font-weight: 700; transition: transform 130ms ease, background 130ms ease, color 130ms ease; }
    .secondary { color: #7c7c82; border: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.025); }
    .secondary:hover { color: #ddd; background: rgba(255,255,255,.05); }
    .primary { color: #211a0b; border: 1px solid rgba(255,225,150,.45); background: #f2c14f; }
    .primary:hover { transform: translateY(-1px); background: #f7cc69; }
    .action svg { width: 12px; height: 12px; }
    button:focus-visible { outline: 2px solid rgba(242,193,79,.85); outline-offset: 2px; }
    .saved { padding: 15px 16px; display: flex; align-items: center; gap: 9px; color: #d8d8da; font-size: 10px; font-weight: 620; }
    .saved span { width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #55d39e; background: rgba(85,211,158,.07); }
    .saved svg { width: 13px; height: 13px; }
    @keyframes fp-save-in { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } * { transition-duration: .01ms !important; } }
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

function closeIconButton(label: string) {
    const button = createElement('button', 'close');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
    return button;
}

function isVisibleInput(input: HTMLInputElement): boolean {
    if (!input.isConnected || input.disabled || input.readOnly || input.type !== 'password') return false;
    if (!isElementVisuallyAvailable(input)) return false;
    const rect = input.getBoundingClientRect();
    return rect.width >= 80 && rect.height >= 22 && rect.bottom >= 0 && rect.top <= window.innerHeight;
}

function isRenderableInput(input: HTMLInputElement): boolean {
    if (!input.isConnected || input.disabled || input.readOnly) return false;
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
        .filter((input) => isRenderableInput(input) && Boolean(input.value));
    const preferred = candidates.find((input) => {
        const haystack = `${input.name} ${input.id} ${input.autocomplete}`.toLowerCase();
        return !/confirm|repeat|verify/.test(haystack);
    });
    return preferred || candidates[0] || null;
}

function setInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
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

function authMethodLabel(method: string): string {
    const labels: Record<string, string> = {
        PASSWORD: 'Password',
        GOOGLE_SSO: 'Google',
        MICROSOFT_SSO: 'Microsoft',
        CLASSLINK_SSO: 'ClassLink',
        APPLE_SSO: 'Apple',
        OKTA_SSO: 'Okta',
        SAML_GENERIC: 'SSO',
        PASSKEY: 'Passkey',
        MAGIC_LINK: 'Magic link',
        OTP_ONLY: 'One-time code',
    };
    return labels[method] || method.replaceAll('_', ' ').toLowerCase();
}

export type FocuzPassOverlayTransport = <T>(message: Record<string, unknown>) => Promise<T>;

async function runtimeSendMessage<T>(message: Record<string, unknown>): Promise<T> {
    if (!chrome.runtime?.id) throw new Error('Extension reloaded. Refresh this page to reconnect FocuzPass.');
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T> | undefined;
    if (!response || response.ok !== true) {
        throw new Error(response && 'error' in response ? response.error : 'FocuzPass did not respond');
    }
    return response.data;
}

class FocuzPassPageOverlay {
    private controls = new Map<HTMLInputElement, FieldControl>();
    private activeInput: HTMLInputElement | null = null;
    private activeControl: FieldControl | null = null;
    private popoverHost: HTMLDivElement | null = null;
    private saveHost: HTMLDivElement | null = null;
    private scanTimer = 0;
    private positionFrame = 0;
    private contextRequest = 0;
    private lastCaptures = new WeakMap<HTMLFormElement, number>();
    private observer: MutationObserver | null = null;

    constructor(private readonly send: FocuzPassOverlayTransport = runtimeSendMessage) {}

    init() {
        if (document.getElementById(POPOVER_HOST_ID) || document.documentElement.hasAttribute('data-focuzpass-overlay')) return;
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
        document.documentElement.setAttribute('data-focuzpass-overlay', 'v1');

        this.scan();
        this.observer = new MutationObserver(() => this.scheduleScan());
        this.observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['type', 'disabled', 'readonly', 'autocomplete'],
        });

        document.addEventListener('submit', this.handleSubmit, true);
        document.addEventListener('click', this.handlePotentialSubmitClick, true);
        document.addEventListener('pointerdown', this.handleOutsidePointer, true);
        document.addEventListener('keydown', this.handleKeydown, true);
        window.addEventListener('scroll', this.schedulePosition, true);
        window.addEventListener('resize', this.schedulePosition, true);
        window.addEventListener('pageshow', this.checkPendingSoon);
        document.addEventListener('visibilitychange', this.handleVisibility);
        window.setTimeout(() => void this.checkPending(), 650);
    }

    private scheduleScan = () => {
        window.clearTimeout(this.scanTimer);
        this.scanTimer = window.setTimeout(() => this.scan(), 140);
    };

    private scan() {
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]'));
        const live = new Set(inputs);
        for (const [input, control] of this.controls) {
            if (!live.has(input) || !input.isConnected) {
                control.host.remove();
                this.controls.delete(input);
            }
        }
        for (const input of inputs) {
            if (input.closest(`[${FIELD_HOST_ATTR}]`) || this.controls.has(input)) continue;
            this.attachField(input);
        }
        this.schedulePosition();
    }

    private attachField(input: HTMLInputElement) {
        const host = document.createElement('div');
        host.setAttribute(FIELD_HOST_ATTR, '');
        host.style.cssText = 'all:initial;position:fixed;z-index:2147483645;width:26px;height:26px;display:none;';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = FIELD_STYLE;
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', 'Open FocuzPass');
        button.title = 'FocuzPass';
        button.innerHTML = KEY_ICON;
        button.addEventListener('pointerdown', (event) => event.preventDefault());
        button.addEventListener('click', () => void this.toggle(input));
        shadow.append(style, button);
        document.documentElement.appendChild(host);
        this.controls.set(input, { host, shadow, button });
    }

    private schedulePosition = () => {
        if (this.positionFrame) return;
        this.positionFrame = window.requestAnimationFrame(() => {
            this.positionFrame = 0;
            this.positionControls();
        });
    };

    private positionControls() {
        for (const [input, control] of this.controls) {
            if (!isVisibleInput(input)) {
                control.host.style.display = 'none';
                continue;
            }
            const rect = input.getBoundingClientRect();
            const size = Math.max(22, Math.min(28, rect.height - 6));
            control.host.style.width = `${size}px`;
            control.host.style.height = `${size}px`;
            control.host.style.left = `${Math.max(3, rect.right - size - 5)}px`;
            control.host.style.top = `${Math.max(3, rect.top + (rect.height - size) / 2)}px`;
            control.host.style.display = 'block';
        }
        if (this.popoverHost && this.activeInput) this.positionPopover();
    }

    private async toggle(input: HTMLInputElement) {
        if (this.popoverHost && this.activeInput === input) {
            this.closePopover();
            return;
        }
        this.closePopover();
        this.activeInput = input;
        this.activeControl = this.controls.get(input) || null;
        this.createPopover();
        this.renderLoading();
        this.positionPopover();

        const request = ++this.contextRequest;
        try {
            const context = await this.send<PageContext>({ type: 'FOCUZPASS_PAGE_CONTEXT' });
            if (request !== this.contextRequest || !this.popoverHost) return;
            this.renderContext(context);
        } catch (error) {
            if (request !== this.contextRequest || !this.popoverHost) return;
            this.renderError(error instanceof Error ? error.message : 'FocuzPass could not connect');
        }
    }

    private createPopover() {
        const host = document.createElement('div');
        host.id = POPOVER_HOST_ID;
        host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;width:326px;max-width:calc(100vw - 16px);';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = PANEL_STYLE;
        shadow.appendChild(style);
        document.documentElement.appendChild(host);
        this.popoverHost = host;
    }

    private panelFrame(title: string, icon = KEY_ICON) {
        const shadow = this.popoverHost!.shadowRoot!;
        shadow.querySelector('.panel')?.remove();
        const panel = createElement('div', 'panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'FocuzPass');
        const head = createElement('div', 'head');
        const brand = createElement('span', 'brand');
        appendIcon(brand, icon);
        const copy = createElement('div', 'head-copy');
        copy.append(createElement('p', 'eyebrow', 'FocuzPass'), createElement('p', 'head-title', title));
        const close = closeIconButton('Close FocuzPass');
        close.addEventListener('click', () => this.closePopover());
        head.append(brand, copy, close);
        const body = createElement('div', 'body');
        panel.append(head, body);
        shadow.appendChild(panel);
        return { panel, body };
    }

    private renderLoading() {
        if (!this.popoverHost) return;
        const { body } = this.panelFrame('Checking this site');
        const loading = createElement('div', 'loading');
        loading.append(createElement('span', 'spinner'), createElement('span', '', 'Looking for saved accounts…'));
        body.appendChild(loading);
    }

    private renderContext(context: PageContext) {
        if (!this.popoverHost) return;
        if (context.state === 'locked') {
            this.renderGate('Vault locked', 'Unlock FocuzPass to see accounts saved for this site.', 'Unlock in dashboard');
            return;
        }
        if (context.state === 'unconfigured') {
            this.renderGate('Set up your vault', 'Create a master password before saving or filling logins.', 'Set up FocuzPass');
            return;
        }
        if (context.matches.length === 0) {
            this.renderEmpty(context.domain);
            return;
        }
        this.renderMatches(context.domain, context.matches);
    }

    private renderGate(title: string, description: string, actionLabel: string) {
        const { body } = this.panelFrame(title, LOCK_ICON);
        const empty = createElement('div', 'empty');
        const emptyIcon = createElement('div', 'empty-icon');
        appendIcon(emptyIcon, LOCK_ICON);
        empty.append(emptyIcon, createElement('p', 'empty-title', title), createElement('p', 'empty-copy', description));
        const action = createElement('button', 'action', actionLabel);
        action.type = 'button';
        appendIcon(action, ARROW_ICON);
        action.addEventListener('click', () => {
            void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS', tab: 'focuzpass' });
            this.closePopover();
        });
        empty.appendChild(action);
        body.appendChild(empty);
    }

    private renderEmpty(domain: string) {
        const { panel, body } = this.panelFrame(domain);
        const empty = createElement('div', 'empty');
        const emptyIcon = createElement('div', 'empty-icon');
        appendIcon(emptyIcon, SPARK_ICON);
        empty.append(
            emptyIcon,
            createElement('p', 'empty-title', 'No login saved yet'),
            createElement('p', 'empty-copy', 'Create a strong password now. FocuzPass can offer to save it after you sign in.'),
        );
        const action = createElement('button', 'action', 'Create strong password');
        action.type = 'button';
        action.prepend(this.iconNode(SPARK_ICON));
        action.addEventListener('click', () => void this.generateAndFill());
        empty.appendChild(action);
        body.appendChild(empty);
        panel.appendChild(this.createFooter());
    }

    private renderMatches(domain: string, matches: LoginMatch[]) {
        const { panel, body } = this.panelFrame(`Sign in to ${domain}`);
        body.appendChild(createElement('p', 'section-label', matches.length === 1 ? 'Saved account' : `${matches.length} saved accounts`));
        const list = createElement('div', 'account-list');
        const favicon = currentFavicon();
        for (const match of matches) {
            const button = createElement('button', 'account');
            button.type = 'button';
            button.setAttribute('aria-label', `Fill ${match.identity} for ${match.title}`);
            const mark = createElement('span', 'mark', match.mark || siteMark(match.title));
            mark.style.color = match.markTone || '#aaa';
            if (favicon) {
                const image = createElement('img', 'favicon');
                image.alt = '';
                image.src = favicon;
                image.addEventListener('error', () => image.replaceWith(mark), { once: true });
                button.appendChild(image);
            } else {
                button.appendChild(mark);
            }
            const copy = createElement('span', 'account-copy');
            copy.append(createElement('span', 'account-title', match.title), createElement('span', 'account-id', match.identity));
            const method = createElement('span', 'method', authMethodLabel(match.authMethod));
            const chevron = createElement('span', 'chevron');
            appendIcon(chevron, ARROW_ICON);
            button.append(copy, method, chevron);
            button.addEventListener('pointerdown', (event) => event.preventDefault());
            button.addEventListener('click', () => this.fillMatch(match));
            list.appendChild(button);
        }
        body.appendChild(list);
        const footer = this.createFooter();
        const generate = createElement('button', 'text-action', 'Use a new password');
        generate.type = 'button';
        generate.addEventListener('click', () => void this.generateAndFill());
        footer.appendChild(generate);
        panel.appendChild(footer);
    }

    private renderError(message: string) {
        if (!this.popoverHost) return;
        const { body } = this.panelFrame('Couldn’t open FocuzPass');
        const empty = createElement('div', 'empty');
        const emptyIcon = createElement('div', 'empty-icon');
        appendIcon(emptyIcon, LOCK_ICON);
        empty.append(
            emptyIcon,
            createElement('p', 'empty-title', 'FocuzPass is unavailable'),
            createElement('p', 'empty-copy', message),
        );
        body.appendChild(empty);
    }

    private createFooter() {
        const footer = createElement('div', 'footer');
        const local = createElement('span', 'local');
        local.append(createElement('span', 'local-dot'), createElement('span', '', 'Local to this device'));
        footer.appendChild(local);
        return footer;
    }

    private iconNode(markup: string) {
        const span = createElement('span');
        appendIcon(span, markup);
        return span.firstElementChild || span;
    }

    private fillMatch(match: LoginMatch) {
        const passwordInput = this.activeInput;
        if (!passwordInput) return;
        const identityInput = identityInputFor(passwordInput);
        if (identityInput) setInputValue(identityInput, match.identity);
        if (match.password) setInputValue(passwordInput, match.password);
        passwordInput.focus({ preventScroll: true });
        void this.send<null>({ type: 'FOCUZPASS_MARK_USED', id: match.id }).catch(() => undefined);
        this.renderSuccess(
            match.password ? 'Login filled' : 'Identity filled',
            match.password ? 'Review the fields, then submit when you’re ready.' : `Continue using ${authMethodLabel(match.authMethod)}.`,
        );
    }

    private async generateAndFill() {
        const passwordInput = this.activeInput;
        if (!passwordInput) return;
        try {
            const password = await this.send<string>({ type: 'FOCUZPASS_GENERATE', length: 20 });
            setInputValue(passwordInput, password);
            passwordInput.focus({ preventScroll: true });
            this.renderSuccess('Strong password created', 'Finish the form and FocuzPass will offer to save it after sign-in.');
        } catch (error) {
            this.renderError(error instanceof Error ? error.message : 'Could not generate a password');
        }
    }

    private renderSuccess(title: string, description: string) {
        if (!this.popoverHost) return;
        const { body } = this.panelFrame('Ready when you are');
        const success = createElement('div', 'success');
        const icon = createElement('div', 'success-icon');
        appendIcon(icon, CHECK_ICON);
        success.append(icon, createElement('p', 'success-title', title), createElement('p', 'success-copy', description));
        body.appendChild(success);
        window.setTimeout(() => this.closePopover(), 1900);
    }

    private positionPopover() {
        if (!this.popoverHost || !this.activeInput) return;
        const rect = this.activeInput.getBoundingClientRect();
        const width = Math.min(326, window.innerWidth - 16);
        this.popoverHost.style.width = `${width}px`;
        const estimatedHeight = Math.min(370, window.innerHeight - 16);
        const below = rect.bottom + 8;
        const top = below + estimatedHeight <= window.innerHeight
            ? below
            : Math.max(8, rect.top - estimatedHeight - 8);
        const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width));
        this.popoverHost.style.left = `${left}px`;
        this.popoverHost.style.top = `${top}px`;
    }

    private closePopover() {
        this.contextRequest += 1;
        this.popoverHost?.remove();
        this.popoverHost = null;
        this.activeInput = null;
        this.activeControl = null;
    }

    private handleOutsidePointer = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (!this.popoverHost || !target) return;
        if (target === this.popoverHost || this.popoverHost.contains(target)) return;
        for (const control of this.controls.values()) {
            if (target === control.host || control.host.contains(target)) return;
        }
        this.closePopover();
    };

    private handleKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !this.popoverHost) return;
        const returnFocus = this.activeControl?.button;
        this.closePopover();
        returnFocus?.focus();
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
        if (type === 'submit' || /sign\s*in|log\s*in|continue|create account|register/.test(label)) {
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
        this.lastCaptures.set(form, now);
        const beforeUrl = location.href;
        void this.send<{ captured: boolean; reason?: string }>({
            type: 'FOCUZPASS_CAPTURE_LOGIN',
            title: siteTitle(),
            identity,
            password,
            faviconUrl: currentFavicon(),
        }).then((result) => {
            if (!result.captured) return;
            window.setTimeout(() => {
                const moved = location.href !== beforeUrl;
                const formGone = !form.isConnected || !isRenderableInput(passwordInput);
                if (moved || formGone) void this.checkPending();
            }, 1350);
        }).catch(() => undefined);
    }

    private checkPendingSoon = () => {
        window.setTimeout(() => void this.checkPending(), 350);
    };

    private handleVisibility = () => {
        if (document.visibilityState === 'visible') this.checkPendingSoon();
    };

    private async checkPending() {
        if (this.saveHost) return;
        try {
            const pending = await this.send<PendingLogin>({ type: 'FOCUZPASS_PENDING_LOGIN' });
            if (pending.available && pending.domain && pending.identity) this.showSavePrompt(pending);
        } catch {
            /* extension unavailable or vault not ready */
        }
    }

    private showSavePrompt(pending: PendingLogin) {
        this.saveHost?.remove();
        const host = document.createElement('div');
        host.id = SAVE_HOST_ID;
        host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483647;max-width:calc(100vw - 24px);';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = SAVE_STYLE;
        const toast = createElement('div', 'toast');
        toast.setAttribute('role', 'dialog');
        toast.setAttribute('aria-label', 'Save login to FocuzPass');
        const main = createElement('div', 'main');
        const mark = createElement('span', 'site-mark', siteMark(pending.title));
        if (pending.faviconUrl) {
            const image = createElement('img', 'site-icon');
            image.alt = '';
            image.src = pending.faviconUrl;
            image.addEventListener('error', () => image.replaceWith(mark), { once: true });
            main.appendChild(image);
        } else {
            main.appendChild(mark);
        }
        const copy = createElement('div', 'copy');
        copy.append(
            createElement('div', 'eyebrow', 'FocuzPass'),
            createElement('h2', '', 'Save this login?'),
            createElement('p', '', `${pending.identity} · ${pending.domain}`),
        );
        const close = closeIconButton('Not now');
        close.addEventListener('click', () => void this.dismissPending());
        main.append(copy, close);
        const actions = createElement('div', 'actions');
        const notNow = createElement('button', 'action secondary', 'Not now');
        notNow.type = 'button';
        notNow.addEventListener('click', () => void this.dismissPending());
        const save = createElement('button', 'action primary', 'Save login');
        save.type = 'button';
        save.prepend(this.iconNode(KEY_ICON));
        save.addEventListener('click', () => void this.commitPending(toast));
        actions.append(notNow, save);
        toast.append(main, actions);
        shadow.append(style, toast);
        document.documentElement.appendChild(host);
        this.saveHost = host;
    }

    private async commitPending(toast: HTMLElement) {
        try {
            await this.send<{ saved: boolean }>({ type: 'FOCUZPASS_COMMIT_PENDING_LOGIN' });
            toast.replaceChildren();
            const saved = createElement('div', 'saved');
            const icon = createElement('span');
            appendIcon(icon, CHECK_ICON);
            saved.append(icon, createElement('span', '', 'Login saved to FocuzPass'));
            toast.appendChild(saved);
            window.setTimeout(() => this.removeSavePrompt(), 1750);
        } catch (error) {
            toast.querySelector('.actions')?.remove();
            const copy = toast.querySelector('.copy');
            if (copy) {
                copy.querySelector('h2')!.textContent = 'Unlock to save';
                copy.querySelector('p')!.textContent = error instanceof Error ? error.message : 'Open FocuzPass and try again.';
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
        this.saveHost?.remove();
        this.saveHost = null;
    }
}

export function initFocuzPassOverlay(transport: FocuzPassOverlayTransport = runtimeSendMessage) {
    const overlay = new FocuzPassPageOverlay(transport);
    overlay.init();
    return overlay;
}
