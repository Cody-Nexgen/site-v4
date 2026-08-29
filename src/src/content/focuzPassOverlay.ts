/**
 * FocuzPass form companion.
 *
 * Runs in an isolated content-script world, renders inside Shadow DOM, and only submits after
 * the user explicitly chooses an item. Site logins remain exact-host scoped.
 */

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
};

type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string };

type FillableControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type FieldControl = {
    host: HTMLDivElement;
    shadow: ShadowRoot;
    button: HTMLButtonElement;
    target: HTMLElement;
    virtualRole?: FieldRole;
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

const FOCUZNOW_MARK_ICON = `
<svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><circle cx="10" cy="10" r="7.15" stroke="currentColor" stroke-width="1.7"></circle><circle cx="10" cy="10" r="2.85" fill="currentColor"></circle></svg>`;

const IDENTITY_ICON = `
<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"></circle><path d="M5.6 19.2c.7-3.1 3.3-5 6.4-5s5.7 1.9 6.4 5"></path></svg>`;

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
    .mark.is-identity { color: #e8e8ea; }
    .mark.is-identity svg { width: 18px; height: 18px; }
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
        width: 17px; height: 17px; border-radius: 50%; color: #f4f4f5; background: transparent;
        box-shadow: none;
    }
    .control-mark svg { width: 17px; height: 17px; display: block; }
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
    .mark.is-identity { color: #e8e8ea; }
    .mark.is-identity svg { width: 22px; height: 22px; }
    .mark.card-brand { width: 46px; height: 32px; border: 0; border-radius: 9px; color: #1833a4; background: linear-gradient(145deg,#f7f8fa,#cbd1d9); font-size: 8px; font-weight: 850; }
    .mark.card-brand.is-amex { color: #fff; background: linear-gradient(145deg,#45abe3,#1478b5); }
    .mark.card-brand.is-discover { color: #171719; background: linear-gradient(145deg,#fff,#dedee0); }
    .mark.card-brand.is-mastercard { color: transparent; background: radial-gradient(circle at 42% 50%,#e21d2a 0 25%,transparent 26%),radial-gradient(circle at 60% 50%,#f2a31e 0 25%,transparent 26%),linear-gradient(145deg,#f7f7f8,#d4d4d7); }
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

function classifyField(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FieldRole {
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

function setControlValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
    if (control instanceof HTMLInputElement) {
        setInputValue(control, value);
        return;
    }
    if (control instanceof HTMLSelectElement) {
        const normalized = value.trim().toLowerCase();
        const option = Array.from(control.options).find((candidate) => candidate.value.toLowerCase() === normalized || candidate.text.trim().toLowerCase() === normalized)
            || Array.from(control.options).find((candidate) => candidate.text.trim().toLowerCase().includes(normalized));
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        if (setter) setter.call(control, option?.value || value);
        else control.value = option?.value || value;
    } else {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) setter.call(control, value);
        else control.value = value;
    }
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
}

function normalizedKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
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
        roles.country = get('country', 'nationality');
        roles['birth-date'] = get('dateOfBirth');
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

function relevantItemsForRole(items: AutofillItem[], role: FieldRole): AutofillItem[] {
    const cardRole = role.startsWith('card-') || role === 'cardholder' || role === 'cvv';
    if (cardRole) return items.filter((item) => item.type === 'card');
    if (role === 'password' || role === 'username') {
        return items.filter((item) => item.type === 'login' || (item.type === 'custom' && ['password', 'email', 'api_credentials', 'wireless_router'].includes(item.kind || '')));
    }
    if (role === 'email') return items.filter((item) => item.type === 'login' && item.identity.includes('@') || item.type === 'custom' && ['identity', 'email'].includes(item.kind || ''));
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

async function runtimeSendMessage<T>(message: Record<string, unknown>): Promise<T> {
    if (!chrome.runtime?.id) throw new Error('Extension reloaded. Refresh this page to reconnect FocuzPass.');
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T> | undefined;
    if (!response || response.ok !== true) {
        throw new Error(response && 'error' in response ? response.error : 'FocuzPass did not respond');
    }
    return response.data;
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

class FocuzPassPageOverlay {
    private controls = new Map<HTMLElement, FieldControl>();
    private activeInput: FillableControl | null = null;
    private activeControl: FieldControl | null = null;
    private popoverHost: HTMLDivElement | null = null;
    private saveHost: HTMLDivElement | null = null;
    private scanTimer = 0;
    private positionFrame = 0;
    private contextRequest = 0;
    private lastCaptures = new WeakMap<HTMLFormElement, number>();
    private observer: MutationObserver | null = null;
    private controlState: ControlState = 'checking';
    private dismissedFor: HTMLElement | null = null;
    private remoteSourceFrameId: number | null = null;

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
            attributeFilter: ['type', 'disabled', 'readonly', 'autocomplete', 'name', 'id', 'placeholder', 'aria-label', 'aria-labelledby'],
        });

        document.addEventListener('focusin', this.handleFocusIn, true);
        window.setInterval(() => this.scan(), 1200);
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

    private collectFillable(): FillableControl[] {
        return Array.from(document.querySelectorAll<FillableControl>('input, textarea, select'))
            .filter((control) => {
                if (control.closest(`[${FIELD_HOST_ATTR}]`) || control.closest('#focuzpass-popover-host')) return false;
                return classifyField(control) !== 'unknown';
            });
    }

    private collectPaymentSlots(): HTMLElement[] {
        return Array.from(document.querySelectorAll<HTMLElement>(PAYMENT_SLOT_SELECTOR))
            .map((node) => {
                if (node instanceof HTMLIFrameElement) {
                    return (node.closest('.StripeElement, [data-stripe], [class*="Stripe"], form, label, div') || node.parentElement || node) as HTMLElement;
                }
                return node;
            })
            .filter((node, index, all) => node && all.indexOf(node) === index);
    }

    private scan() {
        const fillable = this.collectFillable();
        const slots = this.collectPaymentSlots();
        const live = new Set<HTMLElement>([...fillable, ...slots]);
        for (const [target, control] of this.controls) {
            if (!live.has(target) || !target.isConnected) {
                control.host.remove();
                this.controls.delete(target);
            }
        }
        for (const field of fillable) {
            if (this.controls.has(field)) continue;
            this.attachTarget(field);
        }
        for (const slot of slots) {
            if (this.controls.has(slot) || fillable.some((field) => slot.contains(field))) continue;
            this.attachTarget(slot, 'card-number');
        }
        this.schedulePosition();
    }

    private attachTarget(target: HTMLElement, virtualRole?: FieldRole) {
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
        button.addEventListener('click', () => void this.toggle(target));
        if (isFillableControl(target)) {
            target.addEventListener('focus', () => this.openFromField(target));
            target.addEventListener('blur', () => {
                if (this.dismissedFor === target) this.dismissedFor = null;
            });
        }
        shadow.append(style, button);
        document.documentElement.appendChild(host);
        const control = { host, shadow, button, target, virtualRole };
        this.controls.set(target, control);
        this.updateControl(target, control);
    }

    private handleFocusIn = (event: FocusEvent) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
        if (classifyField(target) === 'unknown') return;
        if (!this.controls.has(target)) this.attachTarget(target);
        this.openFromField(target);
    };

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

    private updateControl(_input: HTMLElement, control: FieldControl) {
        const open = Boolean(this.popoverHost && this.activeControl === control);
        const ready = this.controlState === 'ready';
        control.button.className = `${ready ? 'is-ready' : 'is-locked'}${open ? ' is-open' : ''}`;
        control.button.setAttribute('aria-expanded', String(open));
        control.button.setAttribute('aria-label', ready ? 'Show matching FocuzPass items' : 'Unlock FocuzPass');
        control.button.innerHTML = ready
            ? `<span class="control-chevron">${CHEVRON_ICON}</span><span class="control-mark" aria-hidden="true">${FOCUZNOW_MARK_ICON}</span>`
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
        for (const [target, control] of this.controls) {
            const role = control.virtualRole || (isFillableControl(target) ? classifyField(target) : 'card-number');
            if (!isVisibleTarget(target, role)) {
                control.host.style.display = 'none';
                continue;
            }
            const rect = target.getBoundingClientRect();
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

    private shouldProxyPopover() {
        return window !== window.top && (window.innerHeight < 220 || window.innerWidth < 280);
    }

    private openFromField(target: HTMLElement) {
        if (this.dismissedFor === target) return;
        if (this.popoverHost && this.activeControl?.target === target) return;
        void this.openPopover(target);
    }

    private async toggle(target: HTMLElement) {
        if (this.popoverHost && this.activeControl?.target === target) {
            this.closePopover({ dismissed: true });
            return;
        }
        void this.openPopover(target);
    }

    private async openPopover(target: HTMLElement) {
        if (this.popoverHost && this.activeControl?.target === target) return;
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
        this.closePopover();
        this.dismissedFor = null;
        this.activeInput = isFillableControl(target) ? target : null;
        this.activeControl = this.controls.get(target) || null;
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
        const role = this.activeControl?.virtualRole
            || (this.activeInput ? classifyField(this.activeInput) : 'card-number');
        const matches = relevantItemsForRole(context.items || context.matches, role)
            .filter((item) => !this.activeInput || Boolean(valueForControl(this.activeInput, item)));
        if (matches.length === 0) {
            this.renderEmpty(context.domain, role);
            return;
        }
        this.renderMatches(context.domain, matches);
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

    private renderEmpty(domain: string, role: FieldRole) {
        const { panel, body } = this.panelFrame(`FocuzPass items for ${domain}`);
        const label = role.startsWith('card-') || role === 'cardholder' || role === 'cvv' ? 'cards' : role === 'password' || role === 'username' ? 'logins' : 'matching items';
        const empty = createElement('div', 'empty');
        empty.append(
            createElement('p', 'empty-title', `No saved ${label}`),
            createElement('p', 'empty-copy', `FocuzPass has nothing that matches this field on ${domain}.`),
        );
        body.appendChild(empty);
        const footer = this.createFooter();
        footer.appendChild(this.createNewPasswordButton());
        panel.appendChild(footer);
    }

    private renderMatches(domain: string, matches: AutofillItem[]) {
        const { panel, body } = this.panelFrame(`FocuzPass items for ${domain}`);
        const list = createElement('div', 'account-list');
        const favicon = currentFavicon();
        for (const match of matches) {
            const row = createElement('div', 'account-row');
            const button = createElement('button', 'account');
            button.type = 'button';
            button.setAttribute('aria-label', `Fill ${match.title} (${itemSubtitle(match)})`);
            const brand = match.type === 'card' ? paymentBrand(match.cardNumber) : '';
            const mark = createElement('span', `mark${brand ? ` card-brand is-${brand}` : ''}${isIdentityKind(match) ? ' is-identity' : ''}`, brand ? (brand === 'card' ? 'CARD' : brand.toUpperCase()) : match.mark || siteMark(match.title));
            if (isIdentityKind(match)) {
                mark.replaceChildren();
                appendIcon(mark, IDENTITY_ICON);
            }
            if (favicon && match.type === 'login') {
                const image = createElement('img', 'favicon');
                image.alt = '';
                image.src = favicon;
                image.addEventListener('error', () => image.replaceWith(mark), { once: true });
                button.appendChild(image);
            } else {
                button.appendChild(mark);
            }
            const copy = createElement('span', 'account-copy');
            copy.append(createElement('span', 'account-title', match.title), createElement('span', 'account-id', itemSubtitle(match)));
            button.append(copy);
            button.addEventListener('pointerdown', (event) => event.preventDefault());
            button.addEventListener('click', () => this.fillMatch(match));
            const manage = createElement('button', 'manage');
            manage.type = 'button';
            manage.setAttribute('aria-label', `Manage ${match.title}`);
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
        const passwordTarget = this.activeInput && classifyField(this.activeInput) === 'password';
        const button = createElement('button', 'text-action', passwordTarget ? 'New password' : 'Manage FocuzPass');
        button.type = 'button';
        button.prepend(this.iconNode(PLUS_ICON));
        button.addEventListener('click', () => passwordTarget ? void this.generateAndFill() : this.openDashboard());
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
            if (control instanceof HTMLInputElement && (!isRenderableInput(control) || ['hidden', 'checkbox', 'radio', 'submit', 'button', 'file'].includes(control.type))) continue;
            if (!(control instanceof HTMLInputElement) && (control.disabled || !isElementVisuallyAvailable(control))) continue;
            const role = classifyField(control);
            let value = valueForControl(control, match);
            if (!value) continue;
            if (role === 'card-number') value = value.replace(/\D/g, '');
            if (role === 'card-expiry' && control instanceof HTMLInputElement && control.type === 'month') {
                const [month, year] = value.split('/');
                value = `${year?.length === 2 ? `20${year}` : year}-${month}`;
            }
            if (role === 'card-exp-year' && control instanceof HTMLInputElement && control.maxLength === 2) value = value.slice(-2);
            setControlValue(control, value);
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
            this.renderError(error instanceof Error ? error.message : 'Could not generate a password');
        }
    }

    private positionPopover() {
        if (!this.popoverHost) return;
        const anchor = this.activeControl?.target || this.activeInput;
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
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

    private closePopover(opts?: { dismissed?: boolean }) {
        const current = this.activeControl?.target || this.activeInput;
        this.contextRequest += 1;
        this.popoverHost?.remove();
        this.popoverHost = null;
        this.activeInput = null;
        this.activeControl = null;
        if (opts?.dismissed) this.dismissedFor = current;
        this.remoteSourceFrameId = null;
        this.updateControls();
    }

    private handleOutsidePointer = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (!this.popoverHost || !target) return;
        if (target === this.popoverHost || this.popoverHost.contains(target)) return;
        if (this.activeControl?.target && (target === this.activeControl.target || this.activeControl.target.contains(target))) return;
        if (this.activeInput && (target === this.activeInput || this.activeInput.contains(target))) return;
        for (const control of this.controls.values()) {
            if (target === control.host || control.host.contains(target)) return;
        }
        this.closePopover();
    };

    private handleKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !this.popoverHost) return;
        const returnFocus = this.activeInput || this.activeControl?.button;
        this.closePopover({ dismissed: true });
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

    private handleRuntimeMessage = (message: { type?: string; role?: FieldRole; item?: AutofillItem; sourceFrameId?: number }) => {
        if (message?.type === 'FOCUZPASS_LOCKED') {
            this.controlState = 'locked';
            this.closePopover();
            this.updateControls();
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
