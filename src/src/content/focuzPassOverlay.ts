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
    accountCreation?: boolean;
};

type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string };

type FieldControl = {
    host: HTMLDivElement;
    shadow: ShadowRoot;
    button: HTMLButtonElement;
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

const CHECK_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"></path></svg>`;

const ARROW_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;

const CHEVRON_ICON = `
<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.5 5 5-5 5"></path></svg>`;

const LOCK_ICON = `
<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="8.5" width="11" height="8" rx="2"></rect><path d="M7 8.5V6.7a3 3 0 0 1 6 0v1.8"></path></svg>`;

const SLIDERS_ICON = `
<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h12M4 14h12"></path><circle cx="8" cy="6" r="1.8" fill="#242426"></circle><circle cx="12" cy="14" r="1.8" fill="#242426"></circle></svg>`;

const PLUS_ICON = `
<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 4v12M4 10h12"></path></svg>`;

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

const NEUTRAL_FIELD_STYLE = `
    :host { color-scheme: dark; }
    button {
        gap: 1px; padding: 2px 3px; color: #f4f4f5; background: #202023; border-color: #5b5c61;
        border-radius: 999px; box-shadow: 0 2px 8px rgba(0,0,0,.32); box-sizing: border-box;
    }
    button:hover { transform: none; color: #ffffff; background: #29292d; border-color: #77787e; }
    button:active { transform: scale(.96); }
    button:focus-visible { outline-color: #8eaefc; }
    .control-chevron, .control-lock, .control-mark { display: flex; align-items: center; justify-content: center; }
    .control-chevron { width: 13px; height: 13px; color: #e4e4e7; transition: transform 150ms ease; }
    .control-chevron svg { width: 13px; height: 13px; }
    button.is-open .control-chevron { transform: rotate(90deg); }
    .control-mark {
        width: 17px; height: 17px; border-radius: 50%; color: #ffffff; background: #3975e9;
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.34); font: 700 9px/1 Inter, ui-sans-serif, system-ui, sans-serif;
    }
    .control-lock { width: 17px; height: 17px; color: #e4e4e7; }
    .control-lock svg { width: 15px; height: 15px; }
`;

const NEUTRAL_PANEL_STYLE = `
    :host { color-scheme: dark; }
    .panel {
        width: 100%; color: #f7f7f8; background: #29292b; border-color: rgba(255,255,255,.12); border-radius: 16px;
        box-shadow: 0 22px 64px rgba(0,0,0,.46), 0 3px 12px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.05);
        animation-duration: 210ms;
    }
    .panel::before, .head, .brand, .eyebrow, .section-label, .method, .chevron, .local, .empty-icon { display: none; }
    .body { padding: 10px; }
    .account-list { display: grid; gap: 7px; }
    .account-row {
        display: flex; align-items: center; gap: 5px; overflow: hidden; padding: 3px;
        border: 1px solid rgba(255,255,255,.07); border-radius: 13px; background: #242426;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.018);
        transition: border-color 150ms ease, background 150ms ease, transform 150ms cubic-bezier(.16,1,.3,1);
    }
    .account-row:hover { transform: translateY(-1px); border-color: rgba(255,255,255,.13); background: #272729; }
    .account {
        min-width: 0; flex: 1; gap: 12px; padding: 10px; border-color: transparent; border-radius: 10px; background: transparent;
    }
    .account:hover { transform: none; border-color: transparent; background: rgba(255,255,255,.025); }
    .account:active { transform: scale(.992); background: rgba(255,255,255,.04); }
    .account:focus-visible, .action:focus-visible, .text-action:focus-visible, .manage:focus-visible { outline-color: #8eaefc; }
    .favicon, .mark {
        width: 46px; height: 46px; border-color: rgba(255,255,255,.09); border-radius: 11px; background: #323236;
        box-shadow: 0 5px 13px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.055);
    }
    .favicon { object-fit: contain; padding: 7px; }
    .mark { color: #d6d7da; background: #34353a; font-size: 11px; }
    .account-title { color: #f7f7f8; font-size: 13.5px; font-weight: 650; letter-spacing: -.015em; }
    .account-id { margin-top: 4px; color: #9b9da4; font-size: 10.5px; }
    .manage {
        all: unset; width: 38px; height: 38px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
        margin-right: 6px; border: 1px solid rgba(255,255,255,.095); border-radius: 10px; color: #afb1b7; background: #2d2d30; cursor: pointer;
        transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
    }
    .manage:hover { color: #f2f2f3; background: #37373b; border-color: rgba(255,255,255,.16); }
    .manage:active { transform: scale(.95); }
    .manage svg { width: 18px; height: 18px; }
    .empty { padding: 18px 16px 16px; }
    .empty-title { color: #f7f7f8; font-size: 14px; }
    .empty-copy { margin: 7px 0 16px; color: #96989f; font-size: 11px; line-height: 1.55; }
    .action { height: 42px; color: #171719; background: #f2f2f3; border-color: #ffffff; border-radius: 10px; box-shadow: none; font-size: 11px; }
    .action:hover { transform: none; background: #ffffff; }
    .footer { padding: 9px 10px 10px; border-top-color: rgba(255,255,255,.07); background: #252527; }
    .text-action {
        width: 100%; height: 44px; display: flex; align-items: center; justify-content: flex-start; gap: 11px; padding: 0 13px;
        border: 1px solid rgba(255,255,255,.07); border-radius: 11px; color: #e4e4e7; background: #2b2b2e; font-size: 11px; font-weight: 650;
        transition: color 140ms ease, background 140ms ease, border-color 140ms ease, transform 140ms cubic-bezier(.16,1,.3,1);
    }
    .text-action:hover { color: #ffffff; background: #323236; border-color: rgba(255,255,255,.13); transform: translateY(-1px); }
    .text-action:active { transform: scale(.99); }
    .text-action svg { width: 16px; height: 16px; color: #aeb5c3; }
    .loading { padding: 18px 15px; color: #b0b1b6; font-size: 11px; }
    .spinner { border-color: #4b4c51; border-top-color: #d8d9dc; }
`;

const NEUTRAL_SAVE_STYLE = `
    :host { color-scheme: dark; }
    .toast {
        width: min(420px, calc(100vw - 24px)); color: #f7f7f8; background: #29292b; border-color: rgba(255,255,255,.12); border-radius: 17px;
        box-shadow: 0 22px 64px rgba(0,0,0,.46), 0 3px 12px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.05);
        animation-duration: 220ms;
    }
    .toast::before, .eyebrow { display: none; }
    .main { padding: 18px 18px 16px; gap: 14px; align-items: center; }
    .site-icon, .site-mark {
        width: 48px; height: 48px; border-color: rgba(255,255,255,.09); border-radius: 12px; background: #333337;
        box-shadow: 0 6px 15px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.06);
    }
    .site-icon { padding: 8px; }
    .site-mark { color: #d6d7da; background: #34353a; }
    h2 { color: #f7f7f8; font-size: 15px; font-weight: 670; letter-spacing: -.02em; }
    p { margin-top: 5px; color: #9b9da4; font-size: 10.5px; }
    .close { color: #8d8e94; }
    .close:hover { color: #ffffff; background: #333439; }
    .actions { padding: 12px 16px 16px; border-top-color: rgba(255,255,255,.07); background: #272729; }
    button.action { height: 38px; padding: 0 15px; border-radius: 10px; font-size: 10.5px; }
    .secondary { color: #c0c1c6; border-color: rgba(255,255,255,.09); background: #2d2d30; }
    .secondary:hover { color: #ffffff; background: #36363a; }
    .primary { color: #171719; border-color: #ffffff; background: #f2f2f3; }
    .primary:hover { transform: translateY(-1px); background: #ffffff; }
    .primary:active, .secondary:active { transform: scale(.98); }
    button:focus-visible { outline-color: #8eaefc; }
    .saved { min-height: 76px; padding: 18px; color: #f0f0f2; font-size: 12px; }
    .saved span { width: 36px; height: 36px; border-radius: 11px; color: #82d8af; background: #263a32; box-shadow: inset 0 1px 0 rgba(255,255,255,.045); }
    .saved svg { width: 16px; height: 16px; }
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
    private controlState: ControlState = 'checking';

    constructor(private readonly send: FocuzPassOverlayTransport = runtimeSendMessage) {}

    init() {
        if (document.getElementById(POPOVER_HOST_ID) || document.documentElement.hasAttribute('data-focuzpass-overlay')) return;
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
        document.documentElement.setAttribute('data-focuzpass-overlay', 'v1');

        this.scan();
        void this.refreshControlState();
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
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);
        }
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
        style.textContent = `${FIELD_STYLE}\n${NEUTRAL_FIELD_STYLE}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', 'Open FocuzPass');
        button.title = 'FocuzPass';
        button.addEventListener('pointerdown', (event) => event.preventDefault());
        button.addEventListener('click', () => void this.toggle(input));
        shadow.append(style, button);
        document.documentElement.appendChild(host);
        const control = { host, shadow, button };
        this.controls.set(input, control);
        this.updateControl(input, control);
    }

    private refreshControlState = async () => {
        try {
            const status = await this.send<VaultStatus>({ type: 'FOCUZPASS_STATUS' });
            this.controlState = status.configured && status.unlocked ? 'ready' : 'locked';
        } catch {
            this.controlState = 'locked';
        }
        this.updateControls();
        this.schedulePosition();
    };

    private updateControls() {
        for (const [input, control] of this.controls) this.updateControl(input, control);
    }

    private updateControl(input: HTMLInputElement, control: FieldControl) {
        const open = Boolean(this.popoverHost && this.activeInput === input);
        const ready = this.controlState === 'ready';
        control.button.className = `${ready ? 'is-ready' : 'is-locked'}${open ? ' is-open' : ''}`;
        control.button.setAttribute('aria-expanded', String(open));
        control.button.setAttribute('aria-label', ready ? 'Show saved logins' : 'Unlock FocuzPass');
        control.button.innerHTML = ready
            ? `<span class="control-chevron">${CHEVRON_ICON}</span><span class="control-mark" aria-hidden="true">F</span>`
            : `<span class="control-lock">${LOCK_ICON}</span>`;
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
            const width = this.controlState === 'ready' ? Math.max(38, size + 13) : size;
            control.host.style.width = `${width}px`;
            control.host.style.height = `${size}px`;
            control.host.style.left = `${Math.max(3, rect.right - width - 5)}px`;
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
        this.updateControls();
        this.renderLoading();
        this.positionPopover();

        const request = ++this.contextRequest;
        try {
            const context = await this.send<PageContext>({ type: 'FOCUZPASS_PAGE_CONTEXT' });
            if (request !== this.contextRequest || !this.popoverHost) return;
            this.controlState = context.state === 'ready' ? 'ready' : 'locked';
            this.updateControls();
            this.renderContext(context);
        } catch (error) {
            if (request !== this.contextRequest || !this.popoverHost) return;
            this.renderError(error instanceof Error ? error.message : 'FocuzPass could not connect');
        }
    }

    private createPopover() {
        const host = document.createElement('div');
        host.id = POPOVER_HOST_ID;
        host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;width:392px;max-width:calc(100vw - 16px);';
        const shadow = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `${PANEL_STYLE}\n${NEUTRAL_PANEL_STYLE}`;
        shadow.appendChild(style);
        document.documentElement.appendChild(host);
        this.popoverHost = host;
    }

    private panelFrame(label = 'FocuzPass') {
        const shadow = this.popoverHost!.shadowRoot!;
        shadow.querySelector('.panel')?.remove();
        const panel = createElement('div', 'panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', label);
        const body = createElement('div', 'body');
        panel.append(body);
        shadow.appendChild(panel);
        window.requestAnimationFrame(() => this.positionPopover());
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
            this.renderGate('Vault locked', 'Unlock FocuzPass to see saved logins for this site.', 'Unlock FocuzPass');
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
        const { body } = this.panelFrame(title);
        const empty = createElement('div', 'empty');
        empty.append(createElement('p', 'empty-title', title), createElement('p', 'empty-copy', description));
        const action = createElement('button', 'action', actionLabel);
        action.type = 'button';
        appendIcon(action, ARROW_ICON);
        action.addEventListener('click', () => this.openDashboard());
        empty.appendChild(action);
        body.appendChild(empty);
    }

    private renderEmpty(domain: string) {
        const { panel, body } = this.panelFrame(`Saved logins for ${domain}`);
        const empty = createElement('div', 'empty');
        empty.append(
            createElement('p', 'empty-title', 'No saved logins'),
            createElement('p', 'empty-copy', `No account is saved for ${domain}.`),
        );
        body.appendChild(empty);
        const footer = this.createFooter();
        footer.appendChild(this.createNewPasswordButton());
        panel.appendChild(footer);
    }

    private renderMatches(domain: string, matches: LoginMatch[]) {
        const { panel, body } = this.panelFrame(`Saved logins for ${domain}`);
        const list = createElement('div', 'account-list');
        const favicon = currentFavicon();
        for (const match of matches) {
            const row = createElement('div', 'account-row');
            const button = createElement('button', 'account');
            button.type = 'button';
            button.setAttribute('aria-label', `Fill ${match.identity} for ${match.title}`);
            const mark = createElement('span', 'mark', match.mark || siteMark(match.title));
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
            button.append(copy);
            button.addEventListener('pointerdown', (event) => event.preventDefault());
            button.addEventListener('click', () => this.fillMatch(match));
            const manage = createElement('button', 'manage');
            manage.type = 'button';
            manage.setAttribute('aria-label', `Manage ${match.title} login`);
            appendIcon(manage, SLIDERS_ICON);
            manage.addEventListener('click', () => this.openDashboard());
            row.append(button, manage);
            list.appendChild(row);
        }
        body.appendChild(list);
        const footer = this.createFooter();
        footer.appendChild(this.createNewPasswordButton());
        panel.appendChild(footer);
    }

    private renderError(message: string) {
        if (!this.popoverHost) return;
        const { body } = this.panelFrame('Couldn’t open FocuzPass');
        const empty = createElement('div', 'empty');
        empty.append(
            createElement('p', 'empty-title', 'FocuzPass is unavailable'),
            createElement('p', 'empty-copy', message),
        );
        body.appendChild(empty);
    }

    private createFooter() {
        return createElement('div', 'footer');
    }

    private createNewPasswordButton() {
        const button = createElement('button', 'text-action', 'New password');
        button.type = 'button';
        button.prepend(this.iconNode(PLUS_ICON));
        button.addEventListener('click', () => void this.generateAndFill());
        return button;
    }

    private iconNode(markup: string) {
        const span = createElement('span');
        appendIcon(span, markup);
        return span.firstElementChild || span;
    }

    private openDashboard() {
        void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS', tab: 'focuzpass' });
        this.closePopover();
    }

    private fillMatch(match: LoginMatch) {
        const passwordInput = this.activeInput;
        if (!passwordInput) return;
        const identityInput = identityInputFor(passwordInput);
        if (identityInput) setInputValue(identityInput, match.identity);
        if (match.password) setInputValue(passwordInput, match.password);
        passwordInput.focus({ preventScroll: true });
        void this.send<null>({ type: 'FOCUZPASS_MARK_USED', id: match.id }).catch(() => undefined);
        this.closePopover();
        window.queueMicrotask(() => submitFilledLogin(passwordInput));
    }

    private async generateAndFill() {
        const passwordInput = this.activeInput;
        if (!passwordInput) return;
        try {
            const password = await this.send<string>({ type: 'FOCUZPASS_GENERATE', length: 20 });
            setInputValue(passwordInput, password);
            fillRelatedPasswordConfirmation(passwordInput, password);
            passwordInput.focus({ preventScroll: true });
            this.closePopover();
        } catch (error) {
            this.renderError(error instanceof Error ? error.message : 'Could not generate a password');
        }
    }

    private positionPopover() {
        if (!this.popoverHost || !this.activeInput) return;
        const rect = this.activeInput.getBoundingClientRect();
        const width = Math.min(392, window.innerWidth - 16);
        this.popoverHost.style.width = `${width}px`;
        const panelHeight = Math.min(this.popoverHost.offsetHeight || 116, window.innerHeight - 16);
        const below = rect.bottom + 8;
        const top = below + panelHeight <= window.innerHeight || rect.top < panelHeight + 16
            ? below
            : Math.max(8, rect.top - panelHeight - 8);
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
        this.updateControls();
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

    private handleVisibility = () => {
        if (document.visibilityState !== 'visible') return;
        void this.refreshControlState();
        if (this.saveHost) this.removeSavePrompt();
        this.checkPendingSoon();
    };

    private handleRuntimeMessage = (message: { type?: string }) => {
        if (message?.type !== 'FOCUZPASS_LOCKED') return;
        this.controlState = 'locked';
        this.closePopover();
        this.updateControls();
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
        style.textContent = `${SAVE_STYLE}\n${NEUTRAL_SAVE_STYLE}`;
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
            createElement('h2', '', pending.accountCreation ? 'Save this new account?' : 'Save this password?'),
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
            saved.append(icon, createElement('span', '', 'Password saved'));
            toast.appendChild(saved);
            window.setTimeout(() => this.removeSavePrompt(), 1750);
        } catch (error) {
            const copy = toast.querySelector('.copy');
            if (copy) {
                copy.querySelector('h2')!.textContent = 'Unlock to save';
                copy.querySelector('p')!.textContent = error instanceof Error ? error.message : 'Open FocuzPass and try again.';
            }
            const actions = toast.querySelector<HTMLElement>('.actions');
            if (actions) {
                const notNow = createElement('button', 'action secondary', 'Not now');
                notNow.type = 'button';
                notNow.addEventListener('click', () => void this.dismissPending());
                const open = createElement('button', 'action primary', 'Open FocuzPass');
                open.type = 'button';
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
        this.saveHost?.remove();
        this.saveHost = null;
    }
}

export function initFocuzPassOverlay(transport: FocuzPassOverlayTransport = runtimeSendMessage) {
    const overlay = new FocuzPassPageOverlay(transport);
    overlay.init();
    return overlay;
}
