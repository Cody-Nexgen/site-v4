/**
 * Reading other password managers' exports into FocuzPass items. Everything here runs in the
 * page: the export is parsed in memory and only the resulting items go to the vault worker,
 * the same way a manually added login does.
 *
 * Formats: 1Password .1pux, Bitwarden JSON, Keeper JSON, Enpass JSON, Proton Pass JSON (zip),
 * Dashlane CSV (zip), and CSV from anything else (columns are matched by name).
 */

import type { VaultUpsertInput } from './vaultCore';
import type { CustomItemKind } from './types';
import { isZip, readZip } from './zip';

/* ── sources and their export steps ────────────────────────────────────── */

export type ImportSource = {
    id: string;
    name: string;
    /** Key into BRAND_MARKS; sources without one get a lettermark. */
    mark?: string;
    letters?: string;
    /** File picker filter. */
    accept: string;
    /** What to export, in the app's own words. */
    format: string;
    steps: string[];
    tip?: string;
};

export const IMPORT_SOURCES: ImportSource[] = [
    {
        id: '1password',
        name: '1Password',
        mark: 'onepassword',
        accept: '.1pux,.csv',
        format: '1PUX file',
        steps: [
            'Open and unlock the 1Password desktop app (exporting isn\'t available in the browser extension).',
            'Mac: choose File › Export. Windows: select ⋯ next to your account name, then Export.',
            'Pick the account to export and enter your 1Password account password.',
            'Choose 1PUX as the file format, then select Export Data and save the file.',
        ],
        tip: 'A .1pux file keeps cards, identities, bank accounts, Wi-Fi, API keys, SSH keys and more. CSV only has logins.',
    },
    {
        id: 'bitwarden',
        name: 'Bitwarden',
        mark: 'bitwarden',
        accept: '.json,.csv',
        format: '.json file',
        steps: [
            'Open the Bitwarden web vault (vault.bitwarden.com) and sign in.',
            'Go to Tools › Export vault. In the browser extension it\'s Settings › Vault › Export vault.',
            'For File format choose .json. Don\'t pick ".json (Encrypted)", FocuzPass can\'t read it.',
            'Select Confirm format, enter your master password and save the file.',
        ],
    },
    {
        id: 'lastpass',
        name: 'LastPass',
        mark: 'lastpass',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'Open the LastPass browser extension and sign in.',
            'Select Account (your profile) › Fix a problem yourself › Export vault items.',
            'Choose Export data for use anywhere and enter your master password.',
            'LastPass saves a .csv file to your downloads.',
        ],
    },
    {
        id: 'nordpass',
        name: 'NordPass',
        mark: 'nordpass',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'Open the NordPass desktop app and sign in.',
            'Go to Settings › Export items and select Export.',
            'Enter your master password, then save the .csv file.',
        ],
    },
    {
        id: 'dashlane',
        name: 'Dashlane',
        mark: 'dashlane',
        accept: '.zip,.csv',
        format: 'CSV export',
        steps: [
            'Open the Dashlane web app (app.dashlane.com) and sign in.',
            'Go to My account › Settings › Export data.',
            'Choose the unencrypted CSV export. Dashlane downloads a .zip with several CSV files.',
            'Import the .zip as it is, or just credentials.csv from inside it.',
        ],
    },
    {
        id: 'proton',
        name: 'Proton Pass',
        mark: 'protonpass',
        accept: '.zip,.json,.csv',
        format: 'CSV or JSON export',
        steps: [
            'Open Proton Pass (the web app or the extension) and go to Settings › Export.',
            'Choose CSV, or JSON without PGP encryption.',
            'Select Export, confirm with your Proton password and save the file.',
        ],
    },
    {
        id: 'keeper',
        name: 'Keeper',
        mark: 'keeper',
        accept: '.json,.csv',
        format: '.json or .csv',
        steps: [
            'Open the Keeper web vault or desktop app and sign in.',
            'Open Settings (the gear) › Export.',
            'Choose Export to .json (keeps more detail) or Export to .csv, confirm and save the file.',
        ],
    },
    {
        id: 'chrome',
        name: 'Google Chrome',
        mark: 'chrome',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'In Chrome, open chrome://password-manager/settings (Google Password Manager › Settings).',
            'Next to Export passwords, select Download file.',
            'Confirm with your computer\'s password or PIN and save the .csv file.',
        ],
    },
    {
        id: 'apple',
        name: 'Apple Passwords',
        mark: 'apple',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'On a Mac, open the Passwords app (or Safari on older macOS).',
            'Choose File › Export All Passwords to File… (Safari: File › Export › Passwords).',
            'Confirm with Touch ID or your Mac password and save the .csv file.',
        ],
        tip: 'Exporting to a file needs a Mac. iPhone and iPad can\'t export to CSV.',
    },
    {
        id: 'firefox',
        name: 'Firefox',
        mark: 'firefox',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'In Firefox, open about:logins (Menu › Passwords).',
            'Select ⋯ at the top right, then Export Passwords.',
            'Confirm, enter your computer password if asked, and save the .csv file.',
        ],
    },
    {
        id: 'edge',
        name: 'Microsoft Edge',
        mark: 'edge',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'In Edge, open edge://wallet/passwords (Settings › Passwords).',
            'Select ⋯ next to Saved passwords, then Export passwords.',
            'Confirm with your computer\'s password and save the .csv file.',
        ],
    },
    {
        id: 'keepass',
        name: 'KeePass',
        mark: 'keepass',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'KeePassXC: open and unlock your database, then choose Database › Export › CSV File.',
            'KeePass 2: choose File › Export and pick "KeePass CSV (1.x)".',
            'Save the .csv file.',
        ],
    },
    {
        id: 'roboform',
        name: 'RoboForm',
        mark: 'roboform',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'Open the RoboForm desktop app and sign in.',
            'Open the RoboForm menu › Options › Account & Data › Export.',
            'Choose CSV as the format, enter your master password and save the file.',
        ],
    },
    {
        id: 'enpass',
        name: 'Enpass',
        mark: 'enpass',
        accept: '.json,.csv',
        format: '.json file',
        steps: [
            'Open Enpass and unlock your vault.',
            'Choose Menu › File › Export, and pick .json as the format.',
            'Enter your master password and save the file.',
        ],
    },
    {
        id: 'csv',
        name: 'Other app (CSV)',
        letters: 'CSV',
        accept: '.csv',
        format: 'CSV file',
        steps: [
            'Export your passwords from the app as a CSV file (look for Export in its settings).',
            'FocuzPass reads the columns by name: name or title, url or website, username or email, password, and notes.',
        ],
    },
];

/* ── results ───────────────────────────────────────────────────────────── */

export type ImportSkip = { reason: string; count: number };

export type ImportParseResult = {
    items: VaultUpsertInput[];
    skipped: ImportSkip[];
    /** One-time-code (TOTP) secrets were kept in each login's notes. */
    totpInNotes: number;
};

type Collector = {
    items: VaultUpsertInput[];
    skips: Map<string, number>;
    totp: number;
    seen: Set<string>;
};

const SKIP_NOTES = 'Secure notes (FocuzPass doesn\'t have notes yet)';
const SKIP_OTHER = 'Documents and other item types FocuzPass doesn\'t support yet';
const SKIP_EMPTY = 'Entries with no username or password';
const SKIP_DUPLICATE = 'Repeated entries in the file';

function skip(c: Collector, reason: string) {
    c.skips.set(reason, (c.skips.get(reason) ?? 0) + 1);
}

function clean(value: unknown): string {
    return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function hostOf(url: string): string {
    try {
        return new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function appendTotp(c: Collector, notes: string, totp: string): string {
    if (!totp) return notes;
    c.totp++;
    return [notes, `One-time code secret (TOTP): ${totp}`].filter(Boolean).join('\n\n');
}

function addLogin(c: Collector, raw: { title?: string; url?: string; username?: string; password?: string; notes?: string; totp?: string; favorite?: boolean }) {
    const username = clean(raw.username);
    const password = raw.password ?? '';
    const url = clean(raw.url);
    if (!username && !password) return skip(c, SKIP_EMPTY);
    const key = `${hostOf(url)}\u0000${username}\u0000${password}`;
    if (c.seen.has(key)) return skip(c, SKIP_DUPLICATE);
    c.seen.add(key);
    const title = clean(raw.title) || hostOf(url) || username || 'Imported login';
    const note = appendTotp(c, clean(raw.notes), clean(raw.totp)) || undefined;
    if (username) {
        c.items.push({ type: 'login', title, identity: username, domain: url || undefined, password, note, favorite: raw.favorite || undefined });
    } else {
        // A password with no username: FocuzPass's "Password" item.
        c.items.push({ type: 'custom', kind: 'password', title, identity: '', fields: { username: '', password }, note, favorite: raw.favorite || undefined });
    }
}

/** "0426", "04/2026", "2026-04", "202604" or month + year → "MM/YY". */
function formatExpiry(value: string, year?: string): string | undefined {
    const v = value.trim();
    if (year) {
        const m = v.padStart(2, '0').slice(-2);
        const y = year.trim().slice(-2);
        return m && y ? `${m}/${y}` : undefined;
    }
    let match = v.match(/^(\d{4})[-/]?(\d{2})$/); // 2026-04, 202604
    if (match && Number(match[2]) <= 12 && Number(match[1]) > 1900) return `${match[2]}/${match[1].slice(-2)}`;
    match = v.match(/^(\d{1,2})\s*[/-]\s*(\d{2,4})$/); // 04/26, 4/2026
    if (match) return `${match[1].padStart(2, '0')}/${match[2].slice(-2)}`;
    return v || undefined;
}

function addCard(c: Collector, raw: { title?: string; holder?: string; number?: string; expiry?: string; cvv?: string; notes?: string; favorite?: boolean }) {
    const number = clean(raw.number).replace(/[\s-]/g, '');
    if (!number) return skip(c, SKIP_EMPTY);
    const holder = clean(raw.holder);
    const title = clean(raw.title) || (holder ? `${holder}'s card` : `Card •••• ${number.slice(-4)}`);
    c.items.push({
        type: 'card',
        title,
        identity: holder || title,
        cardNumber: number,
        expiry: raw.expiry ? formatExpiry(raw.expiry) : undefined,
        cvv: clean(raw.cvv) || undefined,
        note: clean(raw.notes) || undefined,
        favorite: raw.favorite || undefined,
    });
}

function addIdentity(c: Collector, raw: { title?: string; fullName?: string; email?: string; phone?: string; address?: string; notes?: string }) {
    const fields: Record<string, string> = {};
    for (const key of ['fullName', 'email', 'phone', 'address'] as const) {
        const value = clean(raw[key]);
        if (value) fields[key] = value;
    }
    if (!Object.keys(fields).length) return skip(c, SKIP_EMPTY);
    const title = clean(raw.title) || fields.fullName || 'Identity';
    c.items.push({ type: 'custom', kind: 'identity', title, identity: fields.fullName || fields.email || '', fields, note: clean(raw.notes) || undefined });
}

/* ── CSV ───────────────────────────────────────────────────────────────── */

/** RFC 4180 CSV: quoted fields, doubled quotes, line breaks inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    const s = text.replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (quoted) {
            if (ch === '"') {
                if (s[i + 1] === '"') {
                    field += '"';
                    i++;
                } else quoted = false;
            } else field += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && s[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            if (row.some((cell) => cell !== '')) rows.push(row);
            row = [];
        } else field += ch;
    }
    row.push(field);
    if (row.some((cell) => cell !== '')) rows.push(row);
    return rows;
}

const COLUMNS: Record<string, string[]> = {
    title: ['name', 'title', 'account', 'item name', 'site name', 'label'],
    url: ['url', 'login_uri', 'website', 'web site', 'website address', 'login url', 'uri', 'urls', 'web address', 'hostname', 'matchurl'],
    username: ['username', 'login_username', 'user name', 'login', 'login name', 'user', 'user id', 'userid'],
    email: ['email', 'email address', 'e-mail', 'username2'],
    password: ['password', 'login_password', 'pwd', 'pass'],
    notes: ['notes', 'note', 'extra', 'comments', 'comment'],
    totp: ['totp', 'otpauth', 'login_totp', 'otpsecret', 'otp', 'otpurl', 'one-time password', 'totp secret'],
    type: ['type', 'item type'],
    favorite: ['favorite', 'fav', 'favourite'],
    cardNumber: ['cardnumber', 'card number', 'card_number', 'cc_number'],
    cardHolder: ['cardholdername', 'cardholder', 'cardholder name', 'name on card', 'account_holder'],
    expiry: ['expirydate', 'expiry date', 'expiration date', 'expiry', 'expiration'],
    expiryMonth: ['expiration_month', 'exp month', 'expmonth'],
    expiryYear: ['expiration_year', 'exp year', 'expyear'],
    cvv: ['cvc', 'cvv', 'security code', 'code'],
};

function columnIndex(header: string[]): Record<string, number> {
    const normalized = header.map((h) => h.trim().toLowerCase());
    const index: Record<string, number> = {};
    for (const [key, names] of Object.entries(COLUMNS)) {
        const i = normalized.findIndex((h) => names.includes(h));
        if (i >= 0) index[key] = i;
    }
    return index;
}

function parseCsvExport(c: Collector, text: string, sourceId: string) {
    const rows = parseCsv(text);
    if (!rows.length) return;
    let index = columnIndex(rows[0]);
    let body = rows.slice(1);
    // Keeper's CSV has no header row: folder, title, login, password, website, notes, …
    if (index.password === undefined && sourceId === 'keeper') {
        index = { title: 1, username: 2, password: 3, url: 4, notes: 5 };
        body = rows;
    }
    if (index.password === undefined && index.cardNumber === undefined) {
        throw new Error('FocuzPass couldn\'t find a password column in this CSV. Check that it\'s a password export with a header row.');
    }
    const cell = (row: string[], key: string) => (index[key] !== undefined ? row[index[key]] ?? '' : '');
    for (const row of body) {
        const type = cell(row, 'type').trim().toLowerCase();
        const url = cell(row, 'url');
        const favorite = /^(1|true|yes)$/i.test(cell(row, 'favorite').trim());
        if (/note/.test(type) || url.trim() === 'http://sn') {
            skip(c, SKIP_NOTES);
        } else if ((type.includes('card') || (!type && !cell(row, 'password') && cell(row, 'cardNumber'))) && cell(row, 'cardNumber')) {
            const month = cell(row, 'expiryMonth');
            addCard(c, {
                title: cell(row, 'title'),
                holder: cell(row, 'cardHolder'),
                number: cell(row, 'cardNumber'),
                expiry: month ? formatExpiry(month, cell(row, 'expiryYear')) : cell(row, 'expiry'),
                cvv: cell(row, 'cvv'),
                notes: cell(row, 'notes'),
                favorite,
            });
        } else if (type && !/login|password|credential|website|^1$/.test(type)) {
            skip(c, SKIP_OTHER);
        } else {
            addLogin(c, {
                title: cell(row, 'title'),
                url: url.split(/[\s,]+/)[0],
                username: cell(row, 'username') || cell(row, 'email'),
                password: cell(row, 'password'),
                notes: cell(row, 'notes'),
                totp: cell(row, 'totp'),
                favorite,
            });
        }
    }
}

/* ── 1Password .1pux ───────────────────────────────────────────────────── */

type OnePuxField = { id?: string; title?: string; value?: Record<string, unknown> };
type OnePuxItem = {
    categoryUuid?: string;
    favIndex?: number;
    state?: string;
    details?: {
        loginFields?: { value?: string; designation?: string; fieldType?: string; name?: string }[];
        notesPlain?: string;
        password?: string;
        sections?: { title?: string; fields?: OnePuxField[] }[];
    };
    overview?: { title?: string; url?: string; urls?: { url?: string }[] };
};

function onePuxFields(item: OnePuxItem): OnePuxField[] {
    return (item.details?.sections ?? []).flatMap((s) => s.fields ?? []);
}

function onePuxValue(field: OnePuxField | undefined): string {
    if (!field?.value) return '';
    const v = Object.values(field.value)[0];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

/** A field's value as people read it: dates as YYYY-MM-DD, emails and addresses unwrapped. */
function onePuxText(field: OnePuxField): string {
    const [type, v] = Object.entries(field.value ?? {})[0] ?? [];
    if (v === null || v === undefined) return '';
    if (type === 'date' && typeof v === 'number') return v > 0 ? new Date(v * 1000).toISOString().slice(0, 10) : '';
    if (type === 'monthYear' && typeof v === 'number') {
        const s = String(v);
        return s.length === 6 ? `${s.slice(4)}/${s.slice(0, 4)}` : s;
    }
    if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (type === 'email') return clean(o.email_address);
        if (type === 'address') return [o.street, o.city, o.state, o.zip, o.country].map(clean).filter(Boolean).join(', ');
        if (type === 'sshKey') return clean(o.privateKey);
        return '';
    }
    return clean(v);
}

/**
 * 1Password categories FocuzPass has an item type for. Each 1Password field goes to the first
 * FocuzPass field whose pattern matches its id or label; anything left over is kept in the
 * item's (encrypted) notes, so nothing is lost. The subtitle is always a non-secret field.
 */
type OnePuxKind = { kind: CustomItemKind; subtitle: string[]; fields: [string, RegExp][] };
const MEMBERSHIP: OnePuxKind = {
    kind: 'membership',
    subtitle: ['organization', 'memberName'],
    fields: [
        ['organization', /\b(org|group|company)\b/],
        ['memberName', /member name/],
        ['memberNumber', /membership no|member (id|no|number)|membership number/],
        ['started', /since|start/],
        ['expires', /expir/],
        ['website', /website|\burl\b/],
    ],
};
const ONEPUX_KINDS: Record<string, OnePuxKind> = {
    '101': {
        kind: 'bank_account',
        subtitle: ['bankName', 'accountHolder'],
        fields: [
            ['bankName', /bank ?name/],
            ['accountHolder', /owner|holder|name on account/],
            ['accountType', /type/],
            ['routingNumber', /routing|sort code|\bbsb\b|transit/],
            ['accountNumber', /account ?(no|num)/],
            ['swift', /swift|\bbic\b/],
        ],
    },
    '103': {
        kind: 'driver_license',
        subtitle: ['fullName'],
        fields: [
            ['fullName', /full ?name/],
            ['licenseNumber', /number/],
            ['class', /class/],
            ['issued', /issue/],
            ['expires', /expir/],
            ['region', /state|country|region/],
        ],
    },
    '105': MEMBERSHIP,
    '107': MEMBERSHIP,
    '106': {
        kind: 'passport',
        subtitle: ['fullName'],
        fields: [
            ['fullName', /full ?name/],
            ['passportNumber', /number/],
            ['nationality', /nationality/],
            ['dateOfBirth', /birth ?date|date of birth/],
            ['issued', /issue date|issued on/],
            ['expires', /expir/],
        ],
    },
    '108': { kind: 'social_security_number', subtitle: ['fullName'], fields: [['fullName', /name/], ['ssn', /number/]] },
    '109': {
        kind: 'wireless_router',
        subtitle: ['networkName'],
        fields: [
            ['networkName', /network name/],
            ['password', /wireless (network )?password/],
            ['adminPassword', /password/],
            ['ipAddress', /server|ip address/],
            ['model', /base station name|^name\b/],
        ],
    },
    '111': {
        kind: 'email',
        subtitle: ['email'],
        fields: [
            ['email', /username|email/],
            ['password', /password/],
            ['provider', /^provider\b/],
            ['incomingServer', /pop server|imap server|incoming/],
            ['outgoingServer', /smtp server|outgoing/],
        ],
    },
    '112': {
        kind: 'api_credentials',
        subtitle: ['username', 'hostname', 'credentialType'],
        fields: [
            ['username', /user/],
            ['password', /credential|password|secret|key|token/],
            ['credentialType', /type/],
            ['filename', /file/],
            ['validFrom', /valid ?from/],
            ['expires', /expir/],
            ['hostname', /host/],
        ],
    },
    '113': { kind: 'medical_record', subtitle: ['provider', 'fullName'], fields: [['fullName', /patient/], ['provider', /professional|provider|location/]] },
    '114': {
        kind: 'ssh_key',
        subtitle: ['username', 'hostname'],
        fields: [
            ['privateKey', /private ?key/],
            ['publicKey', /public/],
            ['passphrase', /passphrase|password/],
            ['username', /user/],
            ['hostname', /host|server/],
            ['port', /port/],
        ],
    },
    '115': {
        kind: 'crypto_wallet',
        subtitle: ['network', 'address'],
        fields: [
            ['recoveryPhrase', /recovery|seed|phrase|mnemonic/],
            ['password', /password/],
            ['address', /address/],
            ['network', /network|coin|chain/],
        ],
    },
};

function addOnePuxCustom(c: Collector, map: OnePuxKind, raw: OnePuxItem, fields: OnePuxField[]) {
    const out: Record<string, string> = {};
    const extra: string[] = [];
    for (const field of fields) {
        const value = onePuxText(field);
        if (!value) continue;
        const sshKey = field.value && 'sshKey' in field.value ? (field.value.sshKey as { metadata?: { publicKey?: string } }) : undefined;
        if (sshKey && map.kind === 'ssh_key') {
            out.privateKey ??= value;
            const pub = clean(sshKey.metadata?.publicKey);
            if (pub) out.publicKey ??= pub;
            continue;
        }
        const label = `${field.id ?? ''} ${field.title ?? ''}`.toLowerCase().replace(/[_-]+/g, ' ').trim();
        const target = map.fields.find(([key, pattern]) => out[key] === undefined && pattern.test(label))?.[0];
        if (target) out[target] = value;
        else extra.push(`${clean(field.title) || clean(field.id) || 'Field'}: ${value}`);
    }
    if (!Object.keys(out).length && !extra.length) return skip(c, SKIP_EMPTY);
    const title = clean(raw.overview?.title) || 'Imported item';
    const key = `${map.kind}\u0000${title}\u0000${JSON.stringify(out)}`;
    if (c.seen.has(key)) return skip(c, SKIP_DUPLICATE);
    c.seen.add(key);
    const notes = [clean(raw.details?.notesPlain), extra.join('\n')].filter(Boolean).join('\n\n');
    c.items.push({
        type: 'custom',
        kind: map.kind,
        title,
        identity: map.subtitle.map((k) => out[k]).find(Boolean) ?? '',
        fields: out,
        note: notes || undefined,
        favorite: (raw.favIndex ?? 0) > 0 || undefined,
    });
}

/** Server, Database, Software License: a login (or a "Password" item) plus the rest in notes. */
function addOnePuxLoginLike(c: Collector, raw: OnePuxItem, fields: OnePuxField[], category: string) {
    const get = (pattern: RegExp) => fields.find((f) => pattern.test(`${f.id ?? ''} ${f.title ?? ''}`.toLowerCase().replace(/[_-]+/g, ' ')));
    const url = category === '110' ? get(/^url\b|\burl$/) : category === '102' ? get(/^hostname|server/) : undefined;
    const username = category === '100' ? get(/reg name|licensed to|reg email/) : get(/^username|user name/);
    const password = category === '100' ? get(/reg code|license key|key/) : get(/^password\b/);
    const used = new Set([url, username, password].filter(Boolean));
    const rest = fields
        .filter((f) => !used.has(f))
        .map((f) => [clean(f.title) || clean(f.id), onePuxText(f)] as const)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`);
    const notes = [clean(raw.details?.notesPlain), rest.join('\n')].filter(Boolean).join('\n\n');
    const title = raw.overview?.title;
    const favorite = (raw.favIndex ?? 0) > 0;
    if (category === '100') {
        const key = password ? onePuxText(password) : '';
        if (!key) return skip(c, SKIP_EMPTY);
        c.items.push({ type: 'custom', kind: 'password', title: clean(title) || 'Software license', identity: username ? onePuxText(username) : '', fields: { username: username ? onePuxText(username) : '', password: key }, note: notes || undefined, favorite: favorite || undefined });
        return;
    }
    addLogin(c, { title, url: url ? onePuxText(url) : raw.overview?.url, username: username ? onePuxText(username) : '', password: password ? onePuxText(password) : '', notes, favorite });
}

function parse1pux(c: Collector, data: unknown) {
    const accounts = (data as { accounts?: { vaults?: { items?: unknown[] }[] }[] })?.accounts;
    if (!Array.isArray(accounts)) throw new Error('This .1pux file doesn\'t look like a 1Password export.');
    for (const account of accounts) {
        for (const vault of account.vaults ?? []) {
            for (const entry of vault.items ?? []) {
                const item = ((entry as { item?: OnePuxItem }).item ?? entry) as OnePuxItem;
                if (item.state === 'archived') continue;
                const title = item.overview?.title;
                const url = item.overview?.url || item.overview?.urls?.[0]?.url;
                const notes = item.details?.notesPlain;
                const favorite = (item.favIndex ?? 0) > 0;
                const fields = onePuxFields(item);
                const find = (pred: (f: OnePuxField) => boolean) => fields.find(pred);
                switch (item.categoryUuid) {
                    case '001': {
                        const loginFields = item.details?.loginFields ?? [];
                        const password = loginFields.find((f) => f.designation === 'password')?.value ?? loginFields.find((f) => f.fieldType === 'P')?.value;
                        // Logins saved from a form may have no "username" designation. Fall back to an
                        // email field, then a text field, but never one that holds the password (a
                        // "confirm password" or PIN box): that would show the password as the username.
                        const candidates = loginFields.filter((f) => f.value && f.value !== password && !/pass|pin|secret|code|otp/i.test(f.name ?? ''));
                        const username =
                            loginFields.find((f) => f.designation === 'username')?.value ||
                            candidates.find((f) => f.fieldType === 'E')?.value ||
                            candidates.find((f) => f.fieldType === 'T')?.value;
                        const totp = onePuxValue(find((f) => !!f.value && 'totp' in f.value));
                        addLogin(c, { title, url, username, password, notes, totp, favorite });
                        break;
                    }
                    case '005':
                        addLogin(c, { title, url, username: onePuxValue(find((f) => f.id === 'username')), password: item.details?.password, notes, favorite });
                        break;
                    case '002':
                        addCard(c, {
                            title,
                            holder: onePuxValue(find((f) => f.id === 'cardholder')),
                            number: onePuxValue(find((f) => !!f.value && 'creditCardNumber' in f.value)),
                            expiry: onePuxValue(find((f) => !!f.value && 'monthYear' in f.value)),
                            cvv: onePuxValue(find((f) => f.id === 'cvv')),
                            notes,
                            favorite,
                        });
                        break;
                    case '004': {
                        const first = onePuxValue(find((f) => f.id === 'firstname'));
                        const last = onePuxValue(find((f) => f.id === 'lastname'));
                        const address = find((f) => !!f.value && 'address' in f.value)?.value?.address as Record<string, string> | undefined;
                        addIdentity(c, {
                            title,
                            fullName: [first, last].filter(Boolean).join(' '),
                            email: onePuxValue(find((f) => f.id === 'email' || (!!f.value && 'email' in f.value))),
                            phone: onePuxValue(find((f) => f.id === 'defphone' || f.id === 'cellphone')),
                            address: address ? [address.street, address.city, address.state, address.zip, address.country].filter(Boolean).join(', ') : '',
                            notes,
                        });
                        break;
                    }
                    case '003':
                        skip(c, SKIP_NOTES);
                        break;
                    case '100':
                    case '102':
                    case '110':
                        addOnePuxLoginLike(c, item, fields, item.categoryUuid);
                        break;
                    default: {
                        const map = ONEPUX_KINDS[item.categoryUuid ?? ''];
                        if (map) addOnePuxCustom(c, map, item, fields);
                        else skip(c, SKIP_OTHER);
                    }
                }
            }
        }
    }
}

/* ── JSON exports ──────────────────────────────────────────────────────── */

type BitwardenItem = {
    type?: number;
    name?: string;
    notes?: string;
    favorite?: boolean;
    login?: { username?: string; password?: string; totp?: string; uris?: { uri?: string }[] };
    card?: { cardholderName?: string; number?: string; expMonth?: string; expYear?: string; code?: string };
    identity?: { firstName?: string; lastName?: string; email?: string; phone?: string; address1?: string; city?: string; state?: string; postalCode?: string; country?: string };
};

function parseBitwarden(c: Collector, data: { encrypted?: boolean; items?: BitwardenItem[] }) {
    if (data.encrypted) throw new Error('This is an encrypted Bitwarden export. Export again and choose ".json", not ".json (Encrypted)".');
    for (const item of data.items ?? []) {
        if (item.type === 1) {
            addLogin(c, { title: item.name, url: item.login?.uris?.[0]?.uri, username: item.login?.username, password: item.login?.password, notes: item.notes, totp: item.login?.totp, favorite: item.favorite });
        } else if (item.type === 3) {
            const card = item.card ?? {};
            addCard(c, { title: item.name, holder: card.cardholderName, number: card.number, expiry: card.expMonth ? formatExpiry(card.expMonth, card.expYear) : undefined, cvv: card.code, notes: item.notes, favorite: item.favorite });
        } else if (item.type === 4) {
            const id = item.identity ?? {};
            addIdentity(c, {
                title: item.name,
                fullName: [id.firstName, id.lastName].filter(Boolean).join(' '),
                email: id.email,
                phone: id.phone,
                address: [id.address1, id.city, id.state, id.postalCode, id.country].filter(Boolean).join(', '),
                notes: item.notes,
            });
        } else if (item.type === 2) skip(c, SKIP_NOTES);
        else skip(c, SKIP_OTHER);
    }
}

function parseKeeper(c: Collector, data: { records?: { title?: string; login?: string; password?: string; login_url?: string; notes?: string; $type?: string; custom_fields?: Record<string, unknown> }[] }) {
    for (const r of data.records ?? []) {
        if (r.$type && !/login|password/i.test(r.$type)) {
            skip(c, /note/i.test(r.$type) ? SKIP_NOTES : SKIP_OTHER);
            continue;
        }
        const totp = Object.entries(r.custom_fields ?? {}).find(([k]) => /totp|one-time/i.test(k))?.[1];
        addLogin(c, { title: r.title, url: r.login_url, username: r.login, password: r.password, notes: r.notes, totp: typeof totp === 'string' ? totp : '' });
    }
}

function parseEnpass(c: Collector, data: { items?: { title?: string; category?: string; note?: string; favorite?: number; fields?: { type?: string; value?: string; label?: string }[] }[] }) {
    for (const item of data.items ?? []) {
        const f = (type: string) => item.fields?.find((x) => x.type === type && x.value)?.value ?? '';
        if (item.category === 'note') skip(c, SKIP_NOTES);
        else if (item.category === 'creditcard') {
            addCard(c, { title: item.title, holder: f('ccName'), number: f('ccNumber'), expiry: f('ccExpiry'), cvv: f('ccCvc'), notes: item.note });
        } else if (f('password') || f('username') || f('email')) {
            addLogin(c, { title: item.title, url: f('url'), username: f('username') || f('email'), password: f('password'), notes: item.note, totp: f('totp'), favorite: item.favorite === 1 });
        } else skip(c, SKIP_OTHER);
    }
}

type ProtonItem = {
    data?: {
        type?: string;
        metadata?: { name?: string; note?: string };
        content?: { itemEmail?: string; itemUsername?: string; password?: string; urls?: string[]; totpUri?: string; cardholderName?: string; number?: string; verificationNumber?: string; expirationDate?: string };
    };
};

function parseProton(c: Collector, data: { encrypted?: boolean; vaults?: Record<string, { items?: ProtonItem[] }> }) {
    if (data.encrypted) throw new Error('This Proton Pass export is encrypted. Export again without PGP encryption.');
    for (const vault of Object.values(data.vaults ?? {})) {
        for (const { data: item } of vault.items ?? []) {
            const content = item?.content ?? {};
            const meta = item?.metadata ?? {};
            if (item?.type === 'login') {
                addLogin(c, { title: meta.name, url: content.urls?.[0], username: content.itemUsername || content.itemEmail, password: content.password, notes: meta.note, totp: content.totpUri });
            } else if (item?.type === 'creditCard') {
                addCard(c, { title: meta.name, holder: content.cardholderName, number: content.number, expiry: content.expirationDate, cvv: content.verificationNumber, notes: meta.note });
            } else if (item?.type === 'note') skip(c, SKIP_NOTES);
            else skip(c, SKIP_OTHER);
        }
    }
}

function parseJsonExport(c: Collector, text: string) {
    let data: unknown;
    try {
        data = JSON.parse(text.replace(/^﻿/, ''));
    } catch {
        throw new Error('This file isn\'t valid JSON.');
    }
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.accounts)) return parse1pux(c, d);
    if (d.vaults && typeof d.vaults === 'object' && !Array.isArray(d.vaults)) return parseProton(c, d as never);
    if (Array.isArray(d.records)) return parseKeeper(c, d as never);
    if (Array.isArray(d.items) && (d.items as { fields?: unknown }[]).some((i) => Array.isArray(i?.fields) && 'category' in (i as object))) {
        return parseEnpass(c, d as never);
    }
    if (Array.isArray(d.items) || 'encrypted' in d) return parseBitwarden(c, d as never);
    throw new Error('FocuzPass doesn\'t recognise this JSON export.');
}

/* ── entry point ───────────────────────────────────────────────────────── */

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

export async function parseImportFile(sourceId: string, file: Blob & { name?: string }): Promise<ImportParseResult> {
    const c: Collector = { items: [], skips: new Map(), totp: 0, seen: new Set() };
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (isZip(bytes)) {
        const files = await readZip(bytes);
        const exportData = [...files.entries()].find(([name]) => name === 'export.data' || name.endsWith('/export.data'));
        if (exportData) {
            parse1pux(c, JSON.parse(decode(exportData[1])));
        } else {
            const readable = [...files.entries()].filter(([name]) => /\.(csv|json)$/i.test(name) && !name.startsWith('__MACOSX'));
            // Dashlane zips hold several CSVs; its notes and IDs aren't supported, so read logins and cards only.
            const wanted = readable.filter(([name]) => !/securenotes|personalinfo|ids\.csv/i.test(name));
            if (!wanted.length) throw new Error('FocuzPass couldn\'t find a password export inside this .zip.');
            for (const [name, content] of wanted) {
                if (/\.json$/i.test(name)) parseJsonExport(c, decode(content));
                else parseCsvExport(c, decode(content), sourceId);
            }
            const notes = readable.find(([name]) => /securenotes/i.test(name));
            if (notes) for (let i = parseCsv(decode(notes[1])).length - 1; i > 0; i--) skip(c, SKIP_NOTES);
        }
    } else if (bytes.subarray(0, 4096).includes(0)) {
        // Binary and not a zip: an image, a PDF, an encrypted export…
        throw new Error('This doesn\'t look like a password export. Choose the file you exported (usually .csv, .json or .1pux).');
    } else {
        const text = decode(bytes);
        if (/^\s*[[{]/.test(text.replace(/^﻿/, ''))) parseJsonExport(c, text);
        else parseCsvExport(c, text, sourceId);
    }

    return {
        items: c.items,
        skipped: [...c.skips.entries()].map(([reason, count]) => ({ reason, count })),
        totpInNotes: c.totp,
    };
}

/** How many of each kind, for the review screen. */
export function summarizeImport(items: VaultUpsertInput[]) {
    return {
        logins: items.filter((i) => i.type === 'login' || (i.type === 'custom' && i.kind === 'password')).length,
        cards: items.filter((i) => i.type === 'card').length,
        identities: items.filter((i) => i.type === 'custom' && i.kind === 'identity').length,
        other: items.filter((i) => i.type === 'passkey' || (i.type === 'custom' && i.kind !== 'identity' && i.kind !== 'password')).length,
    };
}
