import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    ArchiveRestore,
    ArrowRight,
    BadgeCheck,
    BookOpen,
    Braces,
    Check,
    ChevronDown,
    ChevronLeft,
    Copy,
    CopyPlus,
    CreditCard,
    Download,
    EllipsisVertical,
    Eye,
    EyeOff,
    Fingerprint,
    FolderInput,
    HeartPulse,
    IdCard,
    KeyRound,
    Landmark,
    LayoutGrid,
    Laptop,
    Lock,
    Mail,
    MoreHorizontal,
    PanelLeft,
    Pencil,
    Plus,
    Router,
    Search,
    ShieldCheck,
    ShieldEllipsis,
    Sparkles,
    Star,
    Terminal,
    TicketCheck,
    Trash2,
    UserRound,
    WalletCards,
    X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import vaultIconUrl from '../assets/focuzpass-vault.png';
import ModalPortal from '../components/ModalPortal';
import {
    focuzPassCreateTag,
    focuzPassCreateVault,
    focuzPassDelete,
    focuzPassItemAction,
    focuzPassLock,
    focuzPassSetup,
    focuzPassSnapshot,
    focuzPassStatus,
    focuzPassTouch,
    focuzPassUnlock,
    focuzPassUpsert,
    type CustomItemKind,
    type DecryptedVaultItem,
    type VaultCollection,
    type VaultStatus,
    type VaultTag,
} from '../lib/focuzPass/client';
import { formatRelativeTime } from '../lib/focuzPass/vaultCore';
import { isWebPlatform } from '../lib/platform';

type VaultItemType = 'login' | 'card' | 'passkey' | 'custom';
type EditableItemKind = 'login' | 'card' | CustomItemKind;
type VaultFilter = 'all' | VaultItemType | 'risk';
type PasswordStrength = 'weak' | 'okay' | 'strong';

type VaultItem = {
    id: string;
    type: VaultItemType;
    kind?: CustomItemKind;
    title: string;
    identity: string;
    domain?: string;
    password?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    authMethod: string;
    fields: Record<string, string>;
    strength?: PasswordStrength;
    risk?: 'weak' | 'reused';
    lastUsed: string;
    sortDate: string;
    note?: string;
    mark: string;
    markTone: string;
    credentialId?: string;
    experimental?: boolean;
    vaultId: string;
    tagIds: string[];
    favorite: boolean;
    archivedAt?: string;
    deletedAt?: string;
};

type VaultView =
    | { kind: 'all' }
    | { kind: 'favorites' }
    | { kind: 'archive' }
    | { kind: 'deleted' }
    | { kind: 'vault'; id: string }
    | { kind: 'tag'; id: string };

type FieldDefinition = {
    key: string;
    label: string;
    placeholder: string;
    type?: 'text' | 'password' | 'date' | 'textarea' | 'number';
};

type BootState = 'loading' | 'companion' | 'setup' | 'locked' | 'ready' | 'error';

const FILTERS: { id: VaultFilter; label: string; icon: typeof KeyRound }[] = [
    { id: 'all', label: 'All items', icon: LayoutGrid },
    { id: 'login', label: 'Logins', icon: KeyRound },
    { id: 'card', label: 'Cards', icon: CreditCard },
    { id: 'passkey', label: 'Passkeys', icon: Fingerprint },
    { id: 'risk', label: 'Security review', icon: ShieldCheck },
];

const TYPE_META: Record<VaultItemType, { label: string; icon: typeof KeyRound }> = {
    login: { label: 'Login', icon: KeyRound },
    card: { label: 'Card', icon: CreditCard },
    passkey: { label: 'Passkey', icon: Fingerprint },
    custom: { label: 'Other', icon: IdCard },
};

const ITEM_DEFINITIONS: Record<EditableItemKind, {
    label: string;
    icon: typeof KeyRound;
    tone: string;
    primary: boolean;
    fields: FieldDefinition[];
}> = {
    login: {
        label: 'Login', icon: KeyRound, tone: '#4fc3c9', primary: true,
        fields: [
            { key: 'identity', label: 'Username', placeholder: 'you@example.com' },
            { key: 'password', label: 'Password', placeholder: 'Enter or generate a password', type: 'password' },
            { key: 'domain', label: 'Website', placeholder: 'https://example.com' },
        ],
    },
    card: {
        label: 'Credit Card', icon: CreditCard, tone: '#58b4e8', primary: true,
        fields: [
            { key: 'identity', label: 'Cardholder', placeholder: 'Full name' },
            { key: 'cardNumber', label: 'Card number', placeholder: '0000 0000 0000 0000', type: 'number' },
            { key: 'expiry', label: 'Expiry', placeholder: 'MM/YY' },
            { key: 'cvv', label: 'Security code', placeholder: 'CVV', type: 'password' },
        ],
    },
    identity: {
        label: 'Identity', icon: IdCard, tone: '#6fcf97', primary: true,
        fields: [
            { key: 'fullName', label: 'Full name', placeholder: 'Full legal name' },
            { key: 'email', label: 'Email', placeholder: 'you@example.com' },
            { key: 'phone', label: 'Phone', placeholder: '+1 555 000 0000' },
            { key: 'address', label: 'Address', placeholder: 'Street, city, region, postal code', type: 'textarea' },
            { key: 'dateOfBirth', label: 'Date of birth', placeholder: 'Choose a date', type: 'date' },
        ],
    },
    password: {
        label: 'Password', icon: Fingerprint, tone: '#65c5c8', primary: true,
        fields: [
            { key: 'username', label: 'Username', placeholder: 'Username or account name' },
            { key: 'password', label: 'Password', placeholder: 'Enter or generate a password', type: 'password' },
        ],
    },
    api_credentials: {
        label: 'API Credentials', icon: Braces, tone: '#55c3cf', primary: false,
        fields: [
            { key: 'username', label: 'Username', placeholder: 'API username or client ID' },
            { key: 'password', label: 'Password', placeholder: 'API password or client secret', type: 'password' },
            { key: 'credentialType', label: 'Type', placeholder: 'OAuth, token, service account…' },
            { key: 'filename', label: 'Filename', placeholder: 'credentials.json' },
            { key: 'validFrom', label: 'Valid from', placeholder: 'Choose a date', type: 'date' },
            { key: 'expires', label: 'Expires', placeholder: 'Choose a date', type: 'date' },
            { key: 'hostname', label: 'Hostname', placeholder: 'api.example.com' },
        ],
    },
    bank_account: {
        label: 'Bank Account', icon: Landmark, tone: '#f0aa3c', primary: false,
        fields: [
            { key: 'accountHolder', label: 'Account holder', placeholder: 'Full name' },
            { key: 'bankName', label: 'Bank name', placeholder: 'Financial institution' },
            { key: 'accountType', label: 'Account type', placeholder: 'Checking, savings…' },
            { key: 'routingNumber', label: 'Routing number', placeholder: 'Routing number', type: 'password' },
            { key: 'accountNumber', label: 'Account number', placeholder: 'Account number', type: 'password' },
            { key: 'swift', label: 'SWIFT / BIC', placeholder: 'International bank code' },
        ],
    },
    crypto_wallet: {
        label: 'Crypto Wallet', icon: WalletCards, tone: '#6577d8', primary: false,
        fields: [
            { key: 'network', label: 'Network', placeholder: 'Bitcoin, Ethereum…' },
            { key: 'address', label: 'Wallet address', placeholder: 'Public wallet address' },
            { key: 'password', label: 'Password', placeholder: 'Wallet password', type: 'password' },
            { key: 'recoveryPhrase', label: 'Recovery phrase', placeholder: 'Secret recovery phrase', type: 'textarea' },
        ],
    },
    driver_license: {
        label: 'Driver License', icon: BadgeCheck, tone: '#e978a5', primary: false,
        fields: [
            { key: 'fullName', label: 'Full name', placeholder: 'Name on license' },
            { key: 'licenseNumber', label: 'License number', placeholder: 'License number', type: 'password' },
            { key: 'class', label: 'Class', placeholder: 'License class' },
            { key: 'issued', label: 'Issued', placeholder: 'Choose a date', type: 'date' },
            { key: 'expires', label: 'Expires', placeholder: 'Choose a date', type: 'date' },
            { key: 'region', label: 'State / country', placeholder: 'Issuing region' },
        ],
    },
    email: {
        label: 'Email', icon: Mail, tone: '#cf4b82', primary: false,
        fields: [
            { key: 'email', label: 'Email address', placeholder: 'you@example.com' },
            { key: 'password', label: 'Password', placeholder: 'Email password', type: 'password' },
            { key: 'provider', label: 'Provider', placeholder: 'Gmail, Outlook…' },
            { key: 'recoveryEmail', label: 'Recovery email', placeholder: 'recovery@example.com' },
            { key: 'incomingServer', label: 'Incoming server', placeholder: 'imap.example.com' },
            { key: 'outgoingServer', label: 'Outgoing server', placeholder: 'smtp.example.com' },
        ],
    },
    medical_record: {
        label: 'Medical Record', icon: HeartPulse, tone: '#eb6c91', primary: false,
        fields: [
            { key: 'fullName', label: 'Full name', placeholder: 'Patient name' },
            { key: 'provider', label: 'Provider', placeholder: 'Insurance or care provider' },
            { key: 'policyNumber', label: 'Policy number', placeholder: 'Policy number', type: 'password' },
            { key: 'memberId', label: 'Member ID', placeholder: 'Member ID', type: 'password' },
            { key: 'groupNumber', label: 'Group number', placeholder: 'Group number' },
            { key: 'expires', label: 'Expires', placeholder: 'Choose a date', type: 'date' },
        ],
    },
    membership: {
        label: 'Membership', icon: TicketCheck, tone: '#b78bd4', primary: false,
        fields: [
            { key: 'organization', label: 'Organization', placeholder: 'Club or organization' },
            { key: 'memberName', label: 'Member name', placeholder: 'Name on membership' },
            { key: 'memberNumber', label: 'Member number', placeholder: 'Membership number', type: 'password' },
            { key: 'started', label: 'Started', placeholder: 'Choose a date', type: 'date' },
            { key: 'expires', label: 'Expires', placeholder: 'Choose a date', type: 'date' },
            { key: 'website', label: 'Website', placeholder: 'https://example.com' },
        ],
    },
    passport: {
        label: 'Passport', icon: BookOpen, tone: '#4e91da', primary: false,
        fields: [
            { key: 'fullName', label: 'Full name', placeholder: 'Name on passport' },
            { key: 'passportNumber', label: 'Passport number', placeholder: 'Passport number', type: 'password' },
            { key: 'nationality', label: 'Nationality', placeholder: 'Nationality' },
            { key: 'dateOfBirth', label: 'Date of birth', placeholder: 'Choose a date', type: 'date' },
            { key: 'issued', label: 'Issued', placeholder: 'Choose a date', type: 'date' },
            { key: 'expires', label: 'Expires', placeholder: 'Choose a date', type: 'date' },
        ],
    },
    ssh_key: {
        label: 'SSH Key', icon: Terminal, tone: '#d7a74e', primary: false,
        fields: [
            { key: 'username', label: 'Username', placeholder: 'Server username' },
            { key: 'hostname', label: 'Hostname', placeholder: 'server.example.com' },
            { key: 'port', label: 'Port', placeholder: '22' },
            { key: 'privateKey', label: 'Private key', placeholder: 'Paste private key', type: 'textarea' },
            { key: 'publicKey', label: 'Public key', placeholder: 'Paste public key', type: 'textarea' },
            { key: 'passphrase', label: 'Passphrase', placeholder: 'Key passphrase', type: 'password' },
        ],
    },
    social_security_number: {
        label: 'Social Security Number', icon: ShieldCheck, tone: '#3e8fc6', primary: false,
        fields: [
            { key: 'fullName', label: 'Full name', placeholder: 'Full legal name' },
            { key: 'ssn', label: 'Social Security number', placeholder: '000-00-0000', type: 'password' },
            { key: 'issuedState', label: 'Issued state', placeholder: 'State or territory' },
        ],
    },
    wireless_router: {
        label: 'Wireless Router', icon: Router, tone: '#4fa7e8', primary: false,
        fields: [
            { key: 'networkName', label: 'Network name', placeholder: 'Wi-Fi network name' },
            { key: 'password', label: 'Wi-Fi password', placeholder: 'Network password', type: 'password' },
            { key: 'adminUsername', label: 'Admin username', placeholder: 'Router admin username' },
            { key: 'adminPassword', label: 'Admin password', placeholder: 'Router admin password', type: 'password' },
            { key: 'ipAddress', label: 'IP address', placeholder: '192.168.1.1' },
            { key: 'model', label: 'Model', placeholder: 'Router manufacturer and model' },
        ],
    },
};

function SoftItemTypeIcon({ kind, size = 32 }: { kind: EditableItemKind; size?: number }) {
    let glyph: ReactNode;

    switch (kind) {
        case 'login':
            glyph = <>
                <rect className="item-icon-paper" x="8" y="6" width="32" height="36" rx="8" />
                <rect className="item-icon-mid" x="11" y="9" width="26" height="30" rx="6" />
                <rect className="item-icon-paper" x="15" y="13" width="18" height="22" rx="4" />
                <circle className="item-icon-ink" cx="24" cy="23" r="4.2" />
                <path d="M22.5 26h3l-.8 6h-1.4l-.8-6Z" className="item-icon-ink" />
            </>;
            break;
        case 'card':
            glyph = <>
                <rect className="item-icon-paper" x="5" y="10" width="38" height="28" rx="5" />
                <rect className="item-icon-ink" x="5" y="16" width="38" height="7" />
                <rect className="item-icon-mid" x="10" y="29" width="13" height="3.5" rx="1.75" />
                <circle className="item-icon-accent" cx="36" cy="30.5" r="4" />
            </>;
            break;
        case 'identity':
            glyph = <>
                <rect className="item-icon-ink" x="8" y="13" width="34" height="25" rx="5" opacity=".26" />
                <rect className="item-icon-paper" x="6" y="10" width="34" height="25" rx="5" />
                <rect className="item-icon-mid" x="9" y="13" width="12" height="19" rx="3" />
                <circle className="item-icon-paper" cx="15" cy="19" r="3.25" />
                <path d="M11 29c.6-3.3 1.9-5 4-5s3.4 1.7 4 5M25 17h10M25 22h8M25 27h10" className="item-icon-ink-stroke" />
                <circle className="item-icon-accent" cx="35" cy="31" r="2.25" />
            </>;
            break;
        case 'password':
            glyph = <>
                <circle className="item-icon-paper" cx="19" cy="20" r="11" />
                <circle className="item-icon-mid" cx="19" cy="20" r="6" />
                <circle className="item-icon-ink" cx="19" cy="20" r="2.5" />
                <path d="m26.5 27.5 11 11m-2.7-8.3-3.4 3.4m8-1.2-4 4" className="item-icon-paper-stroke" />
            </>;
            break;
        case 'api_credentials':
            glyph = <>
                <rect className="item-icon-paper" x="5" y="8" width="38" height="32" rx="5" />
                <path d="M5 15h38" className="item-icon-ink-stroke" />
                <circle className="item-icon-accent" cx="10" cy="11.5" r="1.5" />
                <circle className="item-icon-mid" cx="15" cy="11.5" r="1.5" />
                <path d="m18 23-5 4 5 4m12-8 5 4-5 4m-4-10-4 12" className="item-icon-ink-stroke" />
            </>;
            break;
        case 'bank_account':
            glyph = <>
                <circle className="item-icon-paper" cx="24" cy="24" r="17" />
                <circle className="item-icon-mid" cx="24" cy="24" r="13" />
                <path d="m13 21 11-7 11 7M15 23h18M17 23v9m7-9v9m7-9v9M14 34h20" className="item-icon-ink-stroke" />
            </>;
            break;
        case 'crypto_wallet':
            glyph = <>
                <rect className="item-icon-mid" x="10" y="8" width="29" height="19" rx="5" transform="rotate(5 24.5 17.5)" />
                <circle className="item-icon-accent" cx="16" cy="16" r="9" />
                <path d="M14 10.5v11m-2.5-8.5h5.4c3.1 0 3.1 4 0 4h-5.4m5.2 0c3.5 0 3.5 4 0 4h-5.2m3.2-12v3m0 9v2" className="item-icon-paper-stroke" />
                <rect className="item-icon-ink" x="7" y="21" width="37" height="23" rx="7" opacity=".28" />
                <rect className="item-icon-paper" x="4" y="18" width="38" height="24" rx="7" />
                <path d="M7 23h31" className="item-icon-mid-stroke" />
                <rect className="item-icon-mid" x="26" y="25" width="19" height="12" rx="4" />
                <circle className="item-icon-ink" cx="32" cy="31" r="2" />
            </>;
            break;
        case 'driver_license':
            glyph = <>
                <rect className="item-icon-paper" x="4" y="10" width="40" height="29" rx="5" />
                <rect className="item-icon-accent" x="4" y="10" width="40" height="7" rx="5" />
                <circle className="item-icon-mid" cx="14" cy="25" r="5" />
                <path d="M8.5 35c.8-4.2 2.7-6.3 5.5-6.3s4.7 2.1 5.5 6.3M24 22h14M24 28h11M24 34h8" className="item-icon-ink-stroke" />
            </>;
            break;
        case 'email':
            glyph = <>
                <rect className="item-icon-paper" x="6" y="10" width="36" height="29" rx="5" />
                <path d="m8 14 16 13 16-13" className="item-icon-ink-stroke" />
                <path d="m8 36 11-11m21 11L29 25" className="item-icon-mid-stroke" />
                <circle className="item-icon-accent" cx="38" cy="11" r="5" />
            </>;
            break;
        case 'medical_record':
            glyph = <>
                <rect className="item-icon-paper" x="9" y="7" width="30" height="35" rx="5" />
                <rect className="item-icon-mid" x="17" y="5" width="14" height="7" rx="3" />
                <path d="M24 34s-9-5.1-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.9-9 11-9 11Z" className="item-icon-accent" />
                <path d="M24 21v8m-4-4h8" className="item-icon-paper-stroke" />
            </>;
            break;
        case 'membership':
            glyph = <>
                <rect className="item-icon-paper" x="4" y="11" width="40" height="27" rx="6" />
                <path d="M4 19h40" className="item-icon-mid-stroke" />
                <path d="m14 25 1.4 2.6 3 .5-2.2 2.1.5 3-2.7-1.4-2.7 1.4.5-3-2.2-2.1 3-.5L14 25Zm10 0 1.4 2.6 3 .5-2.2 2.1.5 3-2.7-1.4-2.7 1.4.5-3-2.2-2.1 3-.5L24 25Zm10 0 1.4 2.6 3 .5-2.2 2.1.5 3-2.7-1.4-2.7 1.4.5-3-2.2-2.1 3-.5L34 25Z" className="item-icon-accent" />
            </>;
            break;
        case 'passport':
            glyph = <>
                <rect className="item-icon-paper" x="9" y="5" width="30" height="38" rx="5" />
                <circle className="item-icon-mid" cx="24" cy="23" r="10" />
                <circle cx="24" cy="23" r="7" className="item-icon-paper-stroke" />
                <path d="M17 23h14M24 16c3 3.6 3 10.4 0 14m0-14c-3 3.6-3 10.4 0 14" className="item-icon-paper-stroke" />
                <path d="M17 36h14" className="item-icon-ink-stroke" />
            </>;
            break;
        case 'ssh_key':
            glyph = <>
                <rect className="item-icon-paper" x="4" y="8" width="40" height="31" rx="5" />
                <rect className="item-icon-ink" x="7" y="12" width="34" height="23" rx="3" />
                <path d="m11 18 5 4-5 4m8 0h6" className="item-icon-paper-stroke" />
                <circle className="item-icon-accent" cx="33" cy="30" r="5" />
                <path d="m36.5 26.5 6-6m-2 2 2 2m-4 0 2 2" className="item-icon-accent-stroke" />
            </>;
            break;
        case 'social_security_number':
            glyph = <>
                <rect className="item-icon-paper" x="5" y="9" width="38" height="30" rx="6" />
                <path d="M24 13c4 3 7.5 3.2 7.5 3.2v7.3c0 6-3.1 9.3-7.5 11.5-4.4-2.2-7.5-5.5-7.5-11.5v-7.3S20 16 24 13Z" className="item-icon-mid" />
                <circle className="item-icon-paper" cx="24" cy="21" r="2" />
                <path d="M20.5 27h7M10 17h4m-4 6h3m21-6h4m-3 6h3" className="item-icon-ink-stroke" />
            </>;
            break;
        case 'wireless_router':
            glyph = <>
                <rect className="item-icon-paper" x="5" y="23" width="38" height="16" rx="5" />
                <path d="M11 23V12m26 11V12" className="item-icon-ink-stroke" />
                <path d="M16 19c4.4-4.4 11.6-4.4 16 0m-12 0c2.2-2.2 5.8-2.2 8 0" className="item-icon-mid-stroke" />
                <circle className="item-icon-accent" cx="24" cy="21" r="2" />
                <circle className="item-icon-mid" cx="12" cy="31" r="2" />
                <circle className="item-icon-accent" cx="18" cy="31" r="2" />
                <path d="M27 31h10" className="item-icon-ink-stroke" />
            </>;
            break;
    }

    return (
        <span className={`vault-type-icon vault-type-icon--${kind}`} style={{ '--item-type-icon-size': `${size}px` } as CSSProperties} aria-hidden="true">
            <svg viewBox="0 0 48 48" role="presentation">{glyph}</svg>
        </span>
    );
}

function authMethodLabel(item: DecryptedVaultItem): string {
    if (item.type === 'card') {
        const last4 = item.cardNumber?.slice(-4);
        return last4 ? `Card •••• ${last4}` : 'Card';
    }
    if (item.type === 'passkey') return 'Passkey (experimental)';
    if (item.type === 'custom') return ITEM_DEFINITIONS[item.kind].label;
    const map: Record<string, string> = {
        PASSWORD: 'Password',
        GOOGLE_SSO: 'Sign in with Google',
        MICROSOFT_SSO: 'Sign in with Microsoft',
        CLASSLINK_SSO: 'ClassLink SSO',
        APPLE_SSO: 'Sign in with Apple',
        OKTA_SSO: 'Okta SSO',
        SAML_GENERIC: 'SSO',
        PASSKEY: 'Passkey',
        MAGIC_LINK: 'Magic link',
        OTP_ONLY: 'OTP only',
        CARD: 'Card',
    };
    return map[item.authMethod] || item.authMethod;
}

function toUiItem(item: DecryptedVaultItem): VaultItem {
    return {
        id: item.id,
        type: item.type,
        kind: item.type === 'custom' ? item.kind : undefined,
        title: item.title,
        identity: item.identity,
        domain: item.type === 'login' || item.type === 'passkey' ? item.domain : undefined,
        password: item.type === 'login' ? item.password : undefined,
        cardNumber: item.type === 'card' ? item.cardNumber : undefined,
        expiry: item.type === 'card' ? item.expiry : undefined,
        cvv: item.type === 'card' ? item.cvv : undefined,
        authMethod: authMethodLabel(item),
        fields: item.type === 'custom' ? item.fields : {},
        strength: item.type === 'login' ? item.strength : undefined,
        risk: item.type === 'login' ? item.risk : undefined,
        lastUsed: formatRelativeTime(item.lastUsedAt),
        sortDate: item.lastUsedAt || item.updatedAt || item.createdAt,
        note: item.note,
        mark: item.mark,
        markTone: item.markTone,
        credentialId: item.type === 'passkey' ? item.credentialId : undefined,
        experimental: item.type === 'passkey' ? true : undefined,
        vaultId: item.vaultId,
        tagIds: item.tagIds,
        favorite: item.favorite,
        archivedAt: item.archivedAt,
        deletedAt: item.deletedAt,
    };
}

function randomPassword(length = 20) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=';
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

function maskCard(value = '') {
    return value ? `•••• •••• •••• ${value.slice(-4)}` : '•••• •••• •••• ••••';
}

function formatRemaining(ms: number | null | undefined) {
    if (ms == null) return '—';
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

function copyText(value: string, setCopied: (label: string) => void, label: string) {
    void navigator.clipboard?.writeText(value).then(() => {
        setCopied(label);
        window.setTimeout(() => setCopied(''), 1600);
    });
}

function clearSensitiveUi(
    setItems: (items: VaultItem[]) => void,
    setRevealed: (v: boolean) => void,
    setCopied: (v: string) => void,
    setUnlockValue: (v: string) => void,
    setSetupPassword: (v: string) => void,
    setSetupConfirm: (v: string) => void,
) {
    setItems([]);
    setRevealed(false);
    setCopied('');
    setUnlockValue('');
    setSetupPassword('');
    setSetupConfirm('');
}

function faviconUrl(item: VaultItem): string | null {
    if (!item.domain || item.type !== 'login') return null;
    try {
        if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return null;
        const pageUrl = new URL(item.domain.includes('://') ? item.domain : `https://${item.domain}`).href;
        return `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(pageUrl)}&size=64`;
    } catch {
        return null;
    }
}

function hexWithAlpha(hex: string, alpha: string) {
    return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : 'rgba(121, 149, 180, 0.22)';
}

function itemDefinition(item: VaultItem) {
    if (item.type === 'custom' && item.kind) return ITEM_DEFINITIONS[item.kind];
    if (item.type === 'card') return ITEM_DEFINITIONS.card;
    if (item.type === 'login') return ITEM_DEFINITIONS.login;
    return { label: 'Passkey', icon: Fingerprint, tone: '#a78bfa', primary: false, fields: [] as FieldDefinition[] };
}

function isSensitiveField(field: FieldDefinition) {
    return field.type === 'password' || ['recoveryPhrase', 'privateKey'].includes(field.key);
}

function ExactSidebarDrawerCloseIcon({ size = 16 }: { size?: number }) {
    return (
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M13 3H8V13H13C13.5523 13 14 12.5523 14 12V4C14 3.44772 13.5523 3 13 3ZM3 3H6V13H3C2.44772 13 2 12.5523 2 12V4C2 3.44772 2.44772 3 3 3ZM3 1C1.34315 1 0 2.34315 0 4V12C0 13.6569 1.34315 15 3 15H13C14.6569 15 16 13.6569 16 12V4C16 2.34315 14.6569 1 13 1H3ZM3.5 4C3.22386 4 3 4.22386 3 4.5C3 4.77614 3.22386 5 3.5 5H4.5C4.77614 5 5 4.77614 5 4.5C5 4.22386 4.77614 4 4.5 4H3.5ZM3 6.5C3 6.22386 3.22386 6 3.5 6H4.5C4.77614 6 5 6.22386 5 6.5C5 6.77614 4.77614 7 4.5 7H3.5C3.22386 7 3 6.77614 3 6.5ZM3.5 8C3.22386 8 3 8.22386 3 8.5C3 8.77614 3.22386 9 3.5 9H4.5C4.77614 9 5 8.77614 5 8.5C5 8.22386 4.77614 8 4.5 8H3.5Z" fill="currentColor" />
        </svg>
    );
}

function ExactSidebarChevronIcon({ size = 16 }: { size?: number }) {
    return (
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
            <path d="M3.51668 5.48335C3.78868 5.21136 4.22498 5.19683 4.51446 5.45013L7.67078 8.2119C7.85929 8.37685 8.14077 8.37685 8.32928 8.2119L11.4856 5.45013C11.7751 5.19683 12.2114 5.21136 12.4834 5.48335C12.7687 5.76869 12.7687 6.23131 12.4834 6.51665L8.70714 10.2929C8.31661 10.6834 7.68345 10.6834 7.29292 10.2929L3.51668 6.51665C3.23134 6.23131 3.23134 5.76869 3.51668 5.48335Z" fill="currentColor" />
        </svg>
    );
}

function ExactSidebarPlusIcon({ size = 16 }: { size?: number }) {
    return (
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M8 3C7.44772 3 7 3.44772 7 4V7H4C3.44771 7 3 7.44772 3 8C3 8.55228 3.44772 9 4 9H7V12C7 12.5523 7.44772 13 8 13C8.55228 13 9 12.5523 9 12V9H12C12.5523 9 13 8.55228 13 8C13 7.44772 12.5523 7 12 7H9V4C9 3.44772 8.55228 3 8 3Z" fill="currentColor" />
        </svg>
    );
}

function ExactAllItemsIcon({ size = 16 }: { size?: number }) {
    return (
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M13 1H3C1.346 1 0 2.346 0 4V13C0 13.7956 0.31607 14.5587 0.87868 15.1213C1.44129 15.6839 2.20435 16 3 16H13C13.7956 16 14.5587 15.6839 15.1213 15.1213C15.6839 14.5587 16 13.7956 16 13V4C16 2.346 14.654 1 13 1ZM6.244 10.959C5.98 10.475 5.552 10 5 10H2V7.115H14V10H11C10.448 10 10.02 10.474 9.756 10.959C9.58398 11.2745 9.33012 11.5379 9.02112 11.7214C8.71211 11.9048 8.35937 12.0017 8 12.0017C7.64063 12.0017 7.28789 11.9048 6.97888 11.7214C6.66988 11.5379 6.41602 11.2745 6.244 10.959ZM3 3H13C13.2652 3 13.5196 3.10536 13.7071 3.29289C13.8946 3.48043 14 3.73478 14 4V5.115H2V4C2 3.449 2.449 3 3 3Z" fill="#ABB7C2" />
        </svg>
    );
}

function ExactTagIcon({ size = 16, color = '#43A670' }: { size?: number; color?: string }) {
    return (
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
            <path fill={color} fillRule="evenodd" d="M8 15a7 7 0 0 1-7-7V4a3 3 0 0 1 3-3h4a7 7 0 1 1 0 14ZM5.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
        </svg>
    );
}

function ExactFavoritesIcon({ size = 16 }: { size?: number }) {
    return (
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M15.7099 6.88499L13.0759 9.92399L13.3989 13.942C13.4153 14.1438 13.3796 14.3464 13.2952 14.5304C13.2109 14.7145 13.0806 14.8737 12.917 14.993C12.7534 15.1122 12.5619 15.1875 12.3608 15.2115C12.1598 15.2354 11.956 15.2074 11.7689 15.13L7.99991 13.575L4.23091 15.13C4.04392 15.2073 3.84019 15.2354 3.63925 15.2114C3.43831 15.1875 3.24688 15.1124 3.0833 14.9932C2.91971 14.8741 2.78945 14.715 2.70499 14.5311C2.62053 14.3472 2.58469 14.1447 2.60091 13.943L2.92191 9.92299L0.289914 6.88599C0.156368 6.73265 0.0646395 6.54744 0.023596 6.34829C-0.0174476 6.14913 -0.00641827 5.94275 0.0556178 5.7491C0.117654 5.55545 0.228598 5.38108 0.377727 5.24285C0.526855 5.10461 0.709124 5.00719 0.906914 4.95999L4.86091 4.01399L6.99391 0.560988C7.09978 0.389363 7.2478 0.247676 7.42388 0.149404C7.59996 0.0511317 7.79826 -0.000457764 7.99991 -0.000457764C8.20156 -0.000457764 8.39986 0.0511317 8.57595 0.149404C8.75203 0.247676 8.90005 0.389363 9.00591 0.560988L11.1369 4.01399L15.0919 4.95999C15.2897 5.00701 15.472 5.10425 15.6212 5.2423C15.7704 5.38036 15.8815 5.55457 15.9438 5.74809C16.006 5.94162 16.0172 6.14793 15.9765 6.34708C15.9357 6.54624 15.8442 6.7315 15.7109 6.88499H15.7099Z" fill="#DC6602" />
        </svg>
    );
}

function hexToRgbUnit(hex: string) {
    const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '6e8fb8';
    return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
}

function ExactVaultIcon({ color }: { color: string }) {
    const [red, green, blue] = hexToRgbUnit(color);
    const usesReferenceColors = color.toLowerCase() === '#6e8fb8';
    const matrix = [
        0.2126 * red, 0.7152 * red, 0.0722 * red, 0, 0,
        0.2126 * green, 0.7152 * green, 0.0722 * green, 0, 0,
        0.2126 * blue, 0.7152 * blue, 0.0722 * blue, 0, 0,
        0, 0, 0, 1, 0,
    ].join(' ');
    return (
        <svg viewBox="0 0 256 256" width="100%" height="100%" aria-hidden="true" className="vault-source-icon">
            <defs>
                <filter id={`vault-tint-${color.slice(1)}`} colorInterpolationFilters="sRGB">
                    <feColorMatrix type="matrix" values={matrix} />
                </filter>
            </defs>
            <image
                href={vaultIconUrl}
                width="256"
                height="256"
                preserveAspectRatio="xMidYMid meet"
                filter={usesReferenceColors ? undefined : `url(#vault-tint-${color.slice(1)})`}
            />
        </svg>
    );
}

function ExactArchiveIcon({ size = 16 }: { size?: number }) {
    return (
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M1.50004 1C1.1458 0.999474 0.802806 1.12433 0.531805 1.35246C0.260803 1.58059 0.0792835 1.89727 0.0193966 2.24641C-0.0404902 2.59555 0.0251201 2.95462 0.204607 3.26002C0.384094 3.56543 0.665874 3.79745 1.00004 3.915V12C1.00004 12.7957 1.31611 13.5587 1.87872 14.1213C2.44133 14.6839 3.20439 15 4.00004 15H12C12.7957 15 13.5588 14.6839 14.1214 14.1213C14.684 13.5587 15 12.7957 15 12V3.915C15.3342 3.79745 15.616 3.56543 15.7955 3.26002C15.975 2.95462 16.0406 2.59555 15.9807 2.24641C15.9208 1.89727 15.7393 1.58059 15.4683 1.35246C15.1973 1.12433 14.8543 0.999474 14.5 1H1.50004Z" fill="#B9BDC2" />
            <path d="M0.0849609 3H15.915C15.8115 3.29258 15.6199 3.54587 15.3665 3.72497C15.113 3.90407 14.8103 4.00016 14.5 4H1.49996C1.18963 4.00016 0.886897 3.90407 0.63347 3.72497C0.380043 3.54587 0.188403 3.29258 0.0849609 3ZM5.99996 6H9.99996C10.2652 6 10.5195 6.10536 10.7071 6.29289C10.8946 6.48043 11 6.73478 11 7C11 7.26522 10.8946 7.51957 10.7071 7.70711C10.5195 7.89464 10.2652 8 9.99996 8H5.99996C5.73474 8 5.48039 7.89464 5.29285 7.70711C5.10532 7.51957 4.99996 7.26522 4.99996 7C4.99996 6.73478 5.10532 6.48043 5.29285 6.29289C5.48039 6.10536 5.73474 6 5.99996 6Z" fill="#656E76" />
        </svg>
    );
}

function ExactRecentlyDeletedIcon({ size = 16 }: { size?: number }) {
    return (
        <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width={size} height={size} aria-hidden="true">
            <path d="M5.5 8H10.5" stroke="#F4512A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path fillRule="evenodd" clipRule="evenodd" d="M3.38 4H4C4.26522 4 4.51957 4.10536 4.70711 4.29289C4.89464 4.48043 5 4.73478 5 5C5 5.26522 4.89464 5.51957 4.70711 5.70711C4.51957 5.89464 4.26522 6 4 6H1C0.734784 6 0.48043 5.89464 0.292893 5.70711C0.105357 5.51957 0 5.26522 0 5V2C0 1.73478 0.105357 1.48043 0.292893 1.29289C0.48043 1.10536 0.734784 1 1 1C1.26522 1 1.51957 1.10536 1.70711 1.29289C1.89464 1.48043 2 1.73478 2 2V2.548C3.503 0.97 5.705 0 8 0C9.53345 0.000178223 11.0345 0.44107 12.3245 1.27017C13.6145 2.09928 14.639 3.28166 15.2761 4.67651C15.9131 6.07137 16.1358 7.61993 15.9177 9.13779C15.6997 10.6556 15.0499 12.0788 14.0459 13.2379C13.0419 14.397 11.7259 15.2431 10.2547 15.6754C8.78347 16.1078 7.21898 16.1082 5.74752 15.6766C4.27606 15.245 2.95964 14.3997 1.95501 13.2411C0.950391 12.0826 0.299899 10.6597 0.081 9.142C0.0433393 8.87944 0.111524 8.61266 0.270555 8.40037C0.429586 8.18808 0.666436 8.04766 0.929 8.01C1.19156 7.97234 1.45834 8.04052 1.67063 8.19956C1.88292 8.35859 2.02334 8.59544 2.061 8.858C2.28306 10.3551 3.06249 11.713 4.2432 12.6598C5.4239 13.6066 6.91872 14.0724 8.42827 13.9639C9.93782 13.8554 11.3507 13.1807 12.3839 12.0748C13.417 10.9688 13.9943 9.51344 14 8C14 6.4087 13.3679 4.88258 12.2426 3.75736C11.1174 2.63214 9.5913 2 8 2C6.206 2 4.5 2.784 3.38 4Z" fill="#A6A6A6" />
        </svg>
    );
}

function ListSearchIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2.5 4h1M2.5 8h1M6 4h3.5M6 8h2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
            <circle cx="11.4" cy="10.6" r="3.15" stroke="currentColor" strokeWidth="1.55" />
            <path d="m13.75 13 2 2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
        </svg>
    );
}

function SortItemsIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2.5 4h6M2.5 8h4M2.5 12h2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
            <path d="M13 3v10m0 0-2.4-2.5M13 13l2.4-2.5" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ItemMark({ item, large = false }: { item: VaultItem; large?: boolean }) {
    const favicon = faviconUrl(item);
    const definition = itemDefinition(item);
    const tone = item.markTone === '#e5e5e5' ? definition.tone : item.markTone;
    const typeIconKind = item.type === 'custom' && item.kind ? item.kind : item.type === 'card' ? 'card' : null;
    return (
        <span
            className={`vault-item-mark${typeIconKind ? ' is-type-icon' : ''}${favicon ? ' has-favicon' : ''} relative ${large ? 'h-[60px] w-[60px] rounded-[13px] text-[18px]' : 'h-8 w-8 rounded-[7px] text-[11px]'} flex shrink-0 items-center justify-center overflow-hidden border font-bold tracking-[-0.03em]`}
            style={typeIconKind || favicon ? undefined : {
                color: tone,
                background: hexWithAlpha(tone, '35'),
                borderColor: hexWithAlpha(tone, '55'),
                boxShadow: `0 7px 18px -10px ${hexWithAlpha(tone, 'bb')}, inset 0 1px 0 rgba(255,255,255,.09)`,
            }}
            aria-hidden="true"
        >
            {typeIconKind ? <SoftItemTypeIcon kind={typeIconKind} size={large ? 60 : 32} /> : item.mark}
            {favicon && (
                <img
                    src={favicon}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
            )}
        </span>
    );
}

function monthLabel(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'RECENT';
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date).toUpperCase();
}

function FocuzPassAccessLockIcon() {
    return (
        <svg className="vault-access-lock-icon" viewBox="0 0 32 32" role="img" aria-label="Locked vault">
            <defs>
                <linearGradient id="fp-access-lock-body" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F1E9DE" />
                    <stop offset="38%" stopColor="#D9CDBF" />
                    <stop offset="72%" stopColor="#AB9B89" />
                    <stop offset="100%" stopColor="#756A5E" />
                </linearGradient>
                <linearGradient id="fp-access-lock-shackle" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F6F1EA" />
                    <stop offset="44%" stopColor="#CFC4B8" />
                    <stop offset="100%" stopColor="#81766B" />
                </linearGradient>
            </defs>
            <path d="M8.3 14.2V10a7.7 7.7 0 0 1 15.4 0v4.2h-4.2v-4a3.5 3.5 0 0 0-7 0v4Z" fill="#665C53" transform="translate(0 1.25)" />
            <path d="M8.3 14.2V10a7.7 7.7 0 0 1 15.4 0v4.2h-4.2v-4a3.5 3.5 0 0 0-7 0v4Z" fill="url(#fp-access-lock-shackle)" />
            <rect x="4" y="13.2" width="24" height="16" rx="6.5" fill="#665A4F" transform="translate(0 1.4)" />
            <rect x="4" y="12" width="24" height="16" rx="6.5" fill="url(#fp-access-lock-body)" />
            <path d="M8.5 13.6h14.8" fill="none" stroke="#FFFFFF" strokeWidth="1.15" strokeLinecap="round" opacity=".58" />
            <circle cx="16" cy="19.2" r="3.2" fill="#62584F" />
            <path d="M14.7 21.2h2.6l-.55 4.1h-1.5Z" fill="#62584F" />
            <circle cx="15.2" cy="18.35" r=".8" fill="#EDE5DA" opacity=".48" />
        </svg>
    );
}

function VaultEmptyIllustration() {
    return (
        <div className="vault-empty-canvas" aria-label="No vault item selected">
            <svg viewBox="0 0 168 126" role="img" aria-hidden="true">
                <defs>
                    <linearGradient id="fp-empty-back" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#62646A" />
                        <stop offset="100%" stopColor="#383A3F" />
                    </linearGradient>
                    <linearGradient id="fp-empty-front" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E8E5DF" />
                        <stop offset="45%" stopColor="#CBC6BD" />
                        <stop offset="100%" stopColor="#918B82" />
                    </linearGradient>
                    <linearGradient id="fp-empty-seal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D5C2A7" />
                        <stop offset="100%" stopColor="#8D7860" />
                    </linearGradient>
                </defs>
                <rect x="39" y="17" width="91" height="72" rx="17" fill="#242529" transform="rotate(-7 84.5 53) translate(0 5)" opacity=".72" />
                <rect x="39" y="14" width="91" height="72" rx="17" fill="url(#fp-empty-back)" transform="rotate(-7 84.5 50)" />
                <path d="M55 21.5h43" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity=".18" />
                <rect x="27" y="35" width="113" height="76" rx="19" fill="#191A1D" transform="translate(0 4)" opacity=".72" />
                <rect x="27" y="32" width="113" height="76" rx="19" fill="url(#fp-empty-front)" />
                <path d="M45 35.5h68" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" opacity=".62" />
                <circle cx="54" cy="65" r="14" fill="url(#fp-empty-seal)" />
                <circle cx="54" cy="62" r="4.6" fill="#625A51" />
                <path d="M51.8 65.5h4.4l-.9 7h-2.6Z" fill="#625A51" />
                <rect x="79" y="52" width="40" height="7" rx="3.5" fill="#6F6C68" opacity=".88" />
                <rect x="79" y="65" width="29" height="5.5" rx="2.75" fill="#77736E" opacity=".58" />
                <rect x="42" y="91" width="82" height="4.5" rx="2.25" fill="#716D67" opacity=".38" />
            </svg>
            <strong>Select an item</strong>
            <span>Choose a saved item from the list to view its details.</span>
        </div>
    );
}

function DetailField({
    label,
    value,
    secret,
    reveal,
    onToggleReveal,
    onCopy,
    copied,
}: {
    label: string;
    value: string;
    secret?: boolean;
    reveal?: boolean;
    onToggleReveal?: () => void;
    onCopy?: () => void;
    copied?: boolean;
}) {
    return (
        <div className="vault-detail-field group border-b py-3 last:border-b-0">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{label}</p>
            <div className="flex min-h-6 items-center gap-2">
                <p className={`min-w-0 flex-1 truncate text-[13px] text-neutral-300 ${secret && !reveal ? 'tracking-[0.12em]' : ''}`}>
                    {secret && !reveal ? '••••••••••••••••' : value}
                </p>
                {secret && onToggleReveal && (
                    <button
                        type="button"
                        onClick={onToggleReveal}
                        className="vault-icon-button"
                        aria-label={reveal ? `Hide ${label}` : `Reveal ${label}`}
                    >
                        {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                )}
                {onCopy && (
                    <button type="button" onClick={onCopy} className="vault-icon-button" aria-label={`Copy ${label}`}>
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                )}
            </div>
        </div>
    );
}

function LegacyVaultModal({
    mode,
    item,
    onClose,
    onSave,
    busy,
}: {
    mode: 'add' | 'edit';
    item?: VaultItem;
    onClose: () => void;
    onSave: (item: {
        id?: string;
        type: VaultItemType;
        title: string;
        identity: string;
        domain?: string;
        password?: string;
        cardNumber?: string;
        expiry?: string;
        cvv?: string;
        note?: string;
    }) => void;
    busy?: boolean;
}) {
    const [type, setType] = useState<VaultItemType>(item?.type ?? 'login');
    const [title, setTitle] = useState(item?.title ?? '');
    const [identity, setIdentity] = useState(item?.identity ?? '');
    const [domain, setDomain] = useState(item?.domain ?? '');
    const [password, setPassword] = useState(item?.password ?? '');
    const [cardNumber, setCardNumber] = useState(item?.cardNumber ?? '');
    const [expiry, setExpiry] = useState(item?.expiry ?? '');
    const [cvv, setCvv] = useState(item?.cvv ?? '');
    const [note, setNote] = useState(item?.note ?? '');
    const titleRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        titleRef.current?.focus();
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim() || !identity.trim() || busy) return;
        onSave({
            id: item?.id,
            type,
            title: title.trim(),
            identity: identity.trim(),
            domain: type !== 'card' ? domain.trim() : undefined,
            password: type === 'login' ? password : undefined,
            cardNumber: type === 'card' ? cardNumber.replace(/\s/g, '') : undefined,
            expiry: type === 'card' ? expiry : undefined,
            cvv: type === 'card' ? cvv : undefined,
            note: note.trim() || undefined,
        });
    };

    return (
        <ModalPortal>
            <motion.div
                className="fixed inset-0 z-[500] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(event) => event.target === event.currentTarget && onClose()}
            >
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="vault-modal-title"
                    className="vault-modal w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#151516] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.99 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                >
                    <form onSubmit={submit}>
                        <div className="flex items-start justify-between border-b border-white/[0.065] px-6 py-5">
                            <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">FocuzPass</p>
                                <h2 id="vault-modal-title" className="text-[19px] font-semibold tracking-[-0.025em] text-white">
                                    {mode === 'add' ? 'Add to your vault' : `Edit ${item?.title}`}
                                </h2>
                            </div>
                            <button type="button" onClick={onClose} className="vault-icon-button h-8 w-8" aria-label="Close">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 scrollbar-hide">
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/[0.035] p-1" role="radiogroup" aria-label="Item type">
                                {(Object.keys(TYPE_META) as VaultItemType[]).map((value) => {
                                    const Icon = TYPE_META[value].icon;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            role="radio"
                                            aria-checked={type === value}
                                            onClick={() => setType(value)}
                                            className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${type === value ? 'bg-white/[0.09] text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                                        >
                                            <Icon size={13} />
                                            {TYPE_META[value].label}
                                        </button>
                                    );
                                })}
                            </div>

                            {type === 'passkey' && (
                                <p className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] leading-5 text-neutral-400">
                                    Passkey provider interception is experimental. FocuzPass stores metadata only — the browser still owns WebAuthn private keys.
                                </p>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="vault-field sm:col-span-2">
                                    <span>Name</span>
                                    <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === 'card' ? 'Chase Sapphire' : 'GitHub'} required />
                                </label>
                                <label className="vault-field sm:col-span-2">
                                    <span>{type === 'card' ? 'Cardholder' : 'Username or email'}</span>
                                    <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder={type === 'card' ? 'Jane Doe' : 'you@example.com'} required />
                                </label>
                                {type !== 'card' && (
                                    <label className="vault-field sm:col-span-2">
                                        <span>Website</span>
                                        <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" />
                                    </label>
                                )}
                                {type === 'login' && (
                                    <label className="vault-field sm:col-span-2">
                                        <span>Password</span>
                                        <div className="relative">
                                            <input className="pr-10" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter or generate a password" autoComplete="off" />
                                            <button type="button" onClick={() => setPassword(randomPassword())} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-200" aria-label="Generate password">
                                                <Sparkles size={14} />
                                            </button>
                                        </div>
                                    </label>
                                )}
                                {type === 'card' && (
                                    <>
                                        <label className="vault-field sm:col-span-2">
                                            <span>Card number</span>
                                            <input inputMode="numeric" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="0000 0000 0000 0000" autoComplete="off" />
                                        </label>
                                        <label className="vault-field">
                                            <span>Expiry</span>
                                            <input value={expiry} onChange={(event) => setExpiry(event.target.value)} placeholder="MM/YY" autoComplete="off" />
                                        </label>
                                        <label className="vault-field">
                                            <span>CVV</span>
                                            <input value={cvv} onChange={(event) => setCvv(event.target.value)} placeholder="•••" autoComplete="off" />
                                        </label>
                                    </>
                                )}
                                <label className="vault-field sm:col-span-2">
                                    <span>Private note</span>
                                    <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" rows={3} />
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-white/[0.065] px-6 py-4">
                            <button type="button" onClick={onClose} className="vault-button vault-button-secondary">Cancel</button>
                            <button type="submit" disabled={busy} className="vault-button vault-button-primary">
                                <ShieldCheck size={14} />
                                {mode === 'add' ? 'Save item' : 'Save changes'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </ModalPortal>
    );
}

void LegacyVaultModal;

type ItemDraft = {
    id?: string;
    kind: EditableItemKind;
    title: string;
    identity: string;
    domain?: string;
    password?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    fields?: Record<string, string>;
    note?: string;
    vaultId: string;
    tagIds: string[];
    markTone: string;
};

function draftFromItem(item: VaultItem, tagIds = item.tagIds): ItemDraft | null {
    if (item.type === 'passkey') return null;
    const kind = item.type === 'login' ? 'login' : item.type === 'card' ? 'card' : item.kind || 'password';
    return {
        id: item.id,
        kind,
        title: item.title,
        identity: item.identity,
        domain: item.domain,
        password: item.password,
        cardNumber: item.cardNumber,
        expiry: item.expiry,
        cvv: item.cvv,
        fields: item.type === 'custom' ? item.fields : undefined,
        note: item.note,
        vaultId: item.vaultId,
        tagIds,
        markTone: item.markTone,
    };
}

const COLLECTION_COLORS = ['#6e8fb8', '#8da9c4', '#78b89a', '#d79ab6', '#b49bd6', '#d5a16f', '#cf7f79', '#80b8bd'];
const COLLECTION_ICONS = [
    { id: 'vault', icon: ShieldEllipsis },
    { id: 'home', icon: UserRound },
    { id: 'work', icon: Landmark },
    { id: 'star', icon: Star },
    { id: 'tag', icon: ExactTagIcon },
];

function CollectionMark({ color, icon, size = 14 }: { color: string; icon: string; size?: number }) {
    const Icon = COLLECTION_ICONS.find((option) => option.id === icon)?.icon || ShieldEllipsis;
    return (
        <span className={`vault-collection-mark${icon === 'vault' ? ' is-vault' : ''}`} style={{ color }}>
            {icon === 'vault' ? <ExactVaultIcon color={color} /> : icon === 'tag' ? <ExactTagIcon size={size} color={color} /> : <Icon size={size} />}
        </span>
    );
}

function CollectionModal({ mode, onClose, onCreate, busy }: {
    mode: 'vault' | 'tag';
    onClose: () => void;
    onCreate: (value: { name: string; color: string; icon: string }) => void;
    busy?: boolean;
}) {
    const [name, setName] = useState('');
    const [color, setColor] = useState(mode === 'vault' ? COLLECTION_COLORS[0]! : COLLECTION_COLORS[2]!);
    const [icon, setIcon] = useState(mode === 'vault' ? 'vault' : 'tag');
    return (
        <ModalPortal>
            <motion.div className="vault-modal-backdrop z-[620]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.form
                    className="vault-collection-modal"
                    onSubmit={(event) => { event.preventDefault(); if (name.trim() && !busy) onCreate({ name: name.trim(), color, icon }); }}
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.99 }}
                >
                    <div className="vault-modal-titlebar">
                        <div><small>FocuzPass</small><h2>New {mode}</h2></div>
                        <button type="button" onClick={onClose} aria-label="Close"><X size={16} /></button>
                    </div>
                    <div className="vault-collection-preview"><CollectionMark color={color} icon={icon} size={20} /><span>{name || (mode === 'vault' ? 'Vault name' : 'Tag name')}</span></div>
                    <label className="vault-field"><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === 'vault' ? 'Family, Work, Personal…' : 'Starter kit, Finance…'} /></label>
                    <div className="vault-choice-group"><span>Color</span><div className="vault-color-grid">{COLLECTION_COLORS.map((value) => <button key={value} type="button" className={color === value ? 'is-selected' : ''} style={{ background: value }} onClick={() => setColor(value)} aria-label={`Use ${value}`} />)}</div></div>
                    <div className="vault-choice-group"><span>Icon</span><div className="vault-icon-grid">{COLLECTION_ICONS.map((option) => { const Icon = option.icon; return <button key={option.id} type="button" className={icon === option.id ? 'is-selected' : ''} onClick={() => setIcon(option.id)} aria-label={`Use ${option.id} icon`}><Icon size={16} /></button>; })}</div></div>
                    <div className="vault-modal-actions"><button type="button" onClick={onClose} className="vault-button vault-button-secondary">Cancel</button><button type="submit" className="vault-button vault-button-primary" disabled={busy}><Plus size={14} /> Create {mode}</button></div>
                </motion.form>
            </motion.div>
        </ModalPortal>
    );
}

function ItemPickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (kind: EditableItemKind) => void }) {
    const [showMore, setShowMore] = useState(false);
    const [query, setQuery] = useState('');
    const entries = Object.entries(ITEM_DEFINITIONS) as [EditableItemKind, (typeof ITEM_DEFINITIONS)[EditableItemKind]][];
    const primary = entries.filter(([, definition]) => definition.primary);
    const extra = entries.filter(([, definition]) => !definition.primary);
    const normalized = query.trim().toLowerCase();
    const matches = entries.filter(([, definition]) => definition.label.toLowerCase().includes(normalized));
    const topItems = normalized ? [] : primary;
    const lowerItems = normalized ? matches : extra;
    return (
        <ModalPortal>
            <motion.div className="vault-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
                <motion.div role="dialog" aria-modal="true" aria-labelledby="vault-picker-title" className="vault-picker-modal" initial={{ opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}>
                    <button type="button" className="vault-modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
                    <h2 id="vault-picker-title">What would you like to add?</h2>
                    <label className="vault-picker-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try searching anything" autoFocus /></label>
                    {!normalized && <div className="vault-primary-types">
                        {topItems.map(([kind, definition]) => (
                            <button key={kind} type="button" onClick={() => onSelect(kind)}>
                                <SoftItemTypeIcon kind={kind} size={42} />
                                <strong>{definition.label}</strong>
                            </button>
                        ))}
                    </div>}
                    {!normalized && <button type="button" className="vault-show-more" onClick={() => setShowMore((value) => !value)}>{showMore ? 'Show less' : 'Show more'}<ChevronDown size={14} className={showMore ? 'rotate-180' : ''} /></button>}
                    <AnimatePresence initial={false}>
                        {(showMore || normalized) && (
                            <motion.div className="vault-extra-types" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                {lowerItems.map(([kind, definition]) => (
                                    <button key={kind} type="button" onClick={() => onSelect(kind)}>
                                        <SoftItemTypeIcon kind={kind} size={31} />
                                        {definition.label}
                                    </button>
                                ))}
                                {normalized && lowerItems.length === 0 && <p className="vault-picker-empty">No matching item type</p>}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </ModalPortal>
    );
}

function valuesForItem(item: VaultItem | undefined, kind: EditableItemKind) {
    if (!item) return {} as Record<string, string>;
    if (kind === 'login') return { identity: item.identity, password: item.password || '', domain: item.domain || '' };
    if (kind === 'card') return { identity: item.identity, cardNumber: item.cardNumber || '', expiry: item.expiry || '', cvv: item.cvv || '' };
    return item.fields || {};
}

function ItemEditorModal({ kind, item, vaults, tags, defaultVaultId, onClose, onSave, onCreateTag, busy }: {
    kind: EditableItemKind;
    item?: VaultItem;
    vaults: VaultCollection[];
    tags: VaultTag[];
    defaultVaultId?: string;
    onClose: () => void;
    onSave: (draft: ItemDraft) => void;
    onCreateTag: (value: { name: string; color: string; icon: string }) => Promise<VaultTag>;
    busy?: boolean;
}) {
    const definition = ITEM_DEFINITIONS[kind];
    const [title, setTitle] = useState(item?.title || definition.label);
    const [values, setValues] = useState<Record<string, string>>(() => valuesForItem(item, kind));
    const [note, setNote] = useState(item?.note || '');
    const [vaultId, setVaultId] = useState(item?.vaultId || defaultVaultId || vaults[0]?.id || '');
    const [tagIds, setTagIds] = useState<string[]>(item?.tagIds || []);
    const [tagModalOpen, setTagModalOpen] = useState(false);
    const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));
    const availableTags = tags.filter((tag) => !tagIds.includes(tag.id));
    const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim() || busy) return;
        onSave({
            id: item?.id,
            kind,
            title: title.trim(),
            identity: kind === 'login' || kind === 'card' ? (values.identity || '').trim() : (values[definition.fields[0]?.key || ''] || '').trim(),
            domain: kind === 'login' ? values.domain?.trim() : undefined,
            password: kind === 'login' ? values.password : undefined,
            cardNumber: kind === 'card' ? values.cardNumber?.replace(/\s/g, '') : undefined,
            expiry: kind === 'card' ? values.expiry : undefined,
            cvv: kind === 'card' ? values.cvv : undefined,
            fields: kind === 'login' || kind === 'card' ? undefined : values,
            note: note.trim() || undefined,
            vaultId,
            tagIds,
            markTone: item?.markTone || definition.tone,
        });
    };
    return (
        <ModalPortal>
            <motion.div className="vault-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
                <motion.div role="dialog" aria-modal="true" className="vault-editor-modal" initial={{ opacity: 0, y: 16, scale: 0.988 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}>
                    <form onSubmit={submit}>
                        <div className="vault-editor-titlebar">
                            <button type="button" onClick={onClose} aria-label="Back"><ChevronLeft size={18} /></button>
                            <div><small>{item ? 'Editing' : 'Creating'}</small><h2>{item ? 'Edit item' : 'New item'}</h2></div>
                            <button type="button" onClick={onClose} aria-label="Close"><X size={17} /></button>
                        </div>
                        <div className="vault-editor-scroll">
                            <div className="vault-editor-identity">
                                <SoftItemTypeIcon kind={kind} size={58} />
                                <label><span>Item name</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={definition.label} autoFocus /></label>
                            </div>
                            <section className="vault-editor-section">
                                <div className="vault-editor-section-heading"><div><strong>Item details</strong><small>Your information is encrypted locally</small></div><span>{definition.label}</span></div>
                                <div className="vault-editor-field-card">
                                    {definition.fields.map((field) => (
                                        <label key={field.key} className="vault-editor-field">
                                            <span>{field.label}</span>
                                            {field.type === 'textarea' ? (
                                                <textarea value={values[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)} placeholder={field.placeholder} rows={field.key === 'recoveryPhrase' || field.key.toLowerCase().includes('key') ? 4 : 2} />
                                            ) : (
                                                <div className="relative">
                                                    <input type={field.type === 'date' ? 'date' : field.type === 'password' ? 'password' : 'text'} inputMode={field.type === 'number' ? 'numeric' : undefined} value={values[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)} placeholder={field.placeholder} autoComplete="off" />
                                                    {field.key === 'password' && <button type="button" onClick={() => setValue(field.key, randomPassword())} aria-label="Generate password"><Sparkles size={14} /></button>}
                                                </div>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </section>
                            <section className="vault-editor-section">
                                <div className="vault-editor-section-heading"><div><strong>Notes</strong><small>Optional private context for this item</small></div></div>
                                <label className="vault-editor-note"><span>Private notes</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add any notes about this item here." rows={3} /></label>
                            </section>
                            <section className="vault-editor-section">
                                <div className="vault-editor-section-heading"><div><strong>Organization</strong><small>Choose where this item appears</small></div></div>
                                <label className="vault-editor-select"><span>Vault</span><select value={vaultId} onChange={(event) => setVaultId(event.target.value)}>{vaults.map((vault) => <option key={vault.id} value={vault.id}>{vault.name}</option>)}</select></label>
                                <div className="vault-editor-tags">
                                    <div className="vault-editor-tags-heading">
                                        <div><strong>Tags</strong><small>{selectedTags.length ? `${selectedTags.length} attached` : 'No tags attached'}</small></div>
                                        <button type="button" className="vault-editor-new-tag" onClick={() => setTagModalOpen(true)}><Plus size={13} /> New tag</button>
                                    </div>
                                    {selectedTags.length > 0 && (
                                        <div className="vault-editor-selected-tags" aria-label="Selected tags">
                                            {selectedTags.map((tag) => (
                                                <button key={tag.id} type="button" style={{ '--tag-tone': tag.color } as CSSProperties} onClick={() => setTagIds((current) => current.filter((id) => id !== tag.id))} aria-label={`Remove ${tag.name} tag`}>
                                                    <ExactTagIcon size={12} color={tag.color} /><span>{tag.name}</span><X size={12} />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {availableTags.length > 0 && (
                                        <div className="vault-editor-available-tags" aria-label="Available tags">
                                            {availableTags.map((tag) => (
                                                <button key={tag.id} type="button" style={{ '--tag-tone': tag.color } as CSSProperties} onClick={() => setTagIds((current) => [...current, tag.id])} aria-label={`Add ${tag.name} tag`}>
                                                    <Plus size={11} /><ExactTagIcon size={12} color={tag.color} /><span>{tag.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {tags.length === 0 && <p className="vault-editor-tags-empty">Create a tag to organize this item.</p>}
                                </div>
                            </section>
                        </div>
                        <div className="vault-modal-actions"><span>Changes stay on this device</span><div><button type="button" onClick={onClose} className="vault-button vault-button-secondary">Cancel</button><button type="submit" disabled={busy} className="vault-button vault-button-primary"><ShieldCheck size={14} /> Save item</button></div></div>
                    </form>
                    <AnimatePresence>{tagModalOpen && <CollectionModal mode="tag" busy={busy} onClose={() => setTagModalOpen(false)} onCreate={(value) => { void onCreateTag(value).then((tag) => { setTagIds((current) => [...current, tag.id]); setTagModalOpen(false); }).catch(() => undefined); }} />}</AnimatePresence>
                </motion.div>
            </motion.div>
        </ModalPortal>
    );
}

function CompanionScreen() {
    const reduceMotion = useReducedMotion();
    const extensionInstalled =
        typeof document !== 'undefined' &&
        !!document.documentElement.getAttribute('data-focuznow-extension');

    const openExtension = () => {
        try {
            window.postMessage({ type: 'OPEN_EXTENSION_OPTIONS', tab: 'focuzpass' }, '*');
        } catch {
            /* ignore */
        }
    };

    return (
        <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
            <motion.div
                className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div className="vault-lock-orbit mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.035] text-neutral-300">
                    <Laptop size={24} />
                </div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Extension required</p>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white">Connect FocuzPass</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-500">
                    Your vault is encrypted on this device inside the FocuzNow extension. Install or reload the extension, then reopen this tab — the same vault opens here and in the extension.
                </p>
                <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    {extensionInstalled ? (
                        <button
                            type="button"
                            className="vault-button vault-button-primary h-10 justify-center"
                            onClick={openExtension}
                        >
                            Open FocuzPass in extension
                            <ArrowRight size={14} />
                        </button>
                    ) : (
                        <a
                            href="https://chrome.google.com/webstore/detail/your-extension-id"
                            target="_blank"
                            rel="noreferrer"
                            className="vault-button vault-button-primary h-10 justify-center"
                        >
                            <Download size={14} />
                            Get the FocuzNow extension
                        </a>
                    )}
                    <button
                        type="button"
                        className="vault-button vault-button-secondary h-10 justify-center"
                        onClick={() => window.location.reload()}
                    >
                        Retry connection
                    </button>
                </div>
                <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-neutral-600">
                    <ShieldCheck size={11} /> Secrets never sync to FocuzNow cloud
                </p>
            </motion.div>
        </section>
    );
}

export default function FocuzPassTab({
    avatarUrl,
    username = 'Username',
    accountName = 'FocuzNow Account',
    onExit,
}: {
    avatarUrl?: string | null;
    username?: string;
    accountName?: string;
    onExit?: () => void;
}) {
    const reduceMotion = useReducedMotion();
    const [boot, setBoot] = useState<BootState>('loading');
    const [status, setStatus] = useState<VaultStatus | null>(null);
    const [items, setItems] = useState<VaultItem[]>([]);
    const [vaults, setVaults] = useState<VaultCollection[]>([]);
    const [tags, setTags] = useState<VaultTag[]>([]);
    const [view, setView] = useState<VaultView>({ kind: 'all' });
    const [filter, setFilter] = useState<VaultFilter>('all');
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState('');
    const [modal, setModal] = useState<'picker' | 'editor' | null>(null);
    const [editorKind, setEditorKind] = useState<EditableItemKind>('login');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [collectionModal, setCollectionModal] = useState<'vault' | 'tag' | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [vaultsOpen, setVaultsOpen] = useState(true);
    const [tagsOpen, setTagsOpen] = useState(true);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [unlockValue, setUnlockValue] = useState('');
    const [setupPassword, setSetupPassword] = useState('');
    const [setupConfirm, setSetupConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    const clearSecrets = useCallback(() => {
        clearSensitiveUi(setItems, setRevealed, setCopied, setUnlockValue, setSetupPassword, setSetupConfirm);
        setVaults([]);
        setTags([]);
    }, []);

    const loadUnlocked = useCallback(async () => {
        const snapshot = await focuzPassSnapshot();
        const ui = snapshot.items.map(toUiItem);
        setItems(ui);
        setVaults(snapshot.vaults);
        setTags(snapshot.tags);
        setSelectedId((current) => (ui.some((item) => item.id === current) ? current : ''));
        setBoot('ready');
    }, []);

    const refreshStatus = useCallback(async () => {
        try {
            const next = await focuzPassStatus();
            setStatus(next);
            if (!next.configured) {
                clearSecrets();
                setBoot('setup');
                return;
            }
            if (!next.unlocked) {
                clearSecrets();
                setBoot('locked');
                return;
            }
            await loadUnlocked();
        } catch (err) {
            const needsExtension =
                isWebPlatform() &&
                ((err as { needsExtension?: boolean })?.needsExtension ||
                    /extension/i.test(err instanceof Error ? err.message : ''));
            if (needsExtension) {
                clearSecrets();
                setBoot('companion');
                return;
            }
            throw err;
        }
    }, [clearSecrets, loadUnlocked]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                await refreshStatus();
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load FocuzPass');
                    setBoot('error');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshStatus]);

    useEffect(() => {
        const onMessage = (message: { type?: string }) => {
            if (message?.type === 'FOCUZPASS_LOCKED') {
                clearSecrets();
                setBoot('locked');
                setStatus((current) => (current ? { ...current, unlocked: false, itemCount: 0, remainingMs: null } : current));
            }
        };
        try {
            chrome.runtime?.onMessage?.addListener(onMessage);
            return () => chrome.runtime?.onMessage?.removeListener(onMessage);
        } catch {
            return undefined;
        }
    }, [clearSecrets]);

    useEffect(() => {
        if (boot !== 'ready') return;
        const onActivity = () => {
            void focuzPassTouch().catch(() => undefined);
        };
        window.addEventListener('pointerdown', onActivity);
        window.addEventListener('keydown', onActivity);
        const timer = window.setInterval(() => {
            void focuzPassStatus()
                .then((next) => {
                    setStatus(next);
                    if (!next.unlocked) {
                        clearSecrets();
                        setBoot('locked');
                    }
                })
                .catch(() => undefined);
        }, 30000);
        return () => {
            window.removeEventListener('pointerdown', onActivity);
            window.removeEventListener('keydown', onActivity);
            window.clearInterval(timer);
        };
    }, [boot, clearSecrets]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, []);

    const counts = useMemo(() => ({
        all: items.filter((item) => !item.archivedAt && !item.deletedAt).length,
        login: items.filter((item) => item.type === 'login' && !item.archivedAt && !item.deletedAt).length,
        card: items.filter((item) => item.type === 'card' && !item.archivedAt && !item.deletedAt).length,
        passkey: items.filter((item) => item.type === 'passkey' && !item.archivedAt && !item.deletedAt).length,
        custom: items.filter((item) => item.type === 'custom' && !item.archivedAt && !item.deletedAt).length,
        risk: items.filter((item) => item.risk && !item.archivedAt && !item.deletedAt).length,
    }), [items]);

    const filteredItems = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return items.filter((item) => {
            const active = !item.archivedAt && !item.deletedAt;
            const matchesView =
                (view.kind === 'all' && active) ||
                (view.kind === 'favorites' && active && item.favorite) ||
                (view.kind === 'archive' && Boolean(item.archivedAt) && !item.deletedAt) ||
                (view.kind === 'deleted' && Boolean(item.deletedAt)) ||
                (view.kind === 'vault' && active && item.vaultId === view.id) ||
                (view.kind === 'tag' && active && item.tagIds.includes(view.id));
            const matchesType = filter === 'all' || (filter === 'risk' ? Boolean(item.risk) : item.type === filter);
            const matchesQuery = !normalized || [item.title, item.identity, item.domain, item.authMethod, ...Object.values(item.fields)].some((value) => value?.toLowerCase().includes(normalized));
            return matchesView && matchesType && matchesQuery;
        }).sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
    }, [filter, items, query, view]);

    const groupedItems = useMemo(() => {
        const groups = new Map<string, VaultItem[]>();
        filteredItems.forEach((item) => {
            const label = monthLabel(item.sortDate);
            groups.set(label, [...(groups.get(label) || []), item]);
        });
        return Array.from(groups.entries());
    }, [filteredItems]);

    const selected = selectedId ? filteredItems.find((item) => item.id === selectedId) : undefined;
    const associatedPasskey = selected?.type === 'login'
        ? items.find((item) => item.type === 'passkey' && !item.deletedAt && !item.archivedAt && item.domain?.toLowerCase() === selected.domain?.toLowerCase() && item.identity.toLowerCase() === selected.identity.toLowerCase())
        : undefined;
    const selectedVault = selected ? vaults.find((vault) => vault.id === selected.vaultId) : undefined;
    const viewTitle = view.kind === 'favorites'
        ? 'Favorites'
        : view.kind === 'archive'
          ? 'Archive'
          : view.kind === 'deleted'
            ? 'Recently Deleted'
            : view.kind === 'vault'
              ? vaults.find((vault) => vault.id === view.id)?.name || 'Vault'
              : view.kind === 'tag'
                ? tags.find((tag) => tag.id === view.id)?.name || 'Tag'
                : 'All Items';

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 2200);
    };

    const saveItem = async (draft: ItemDraft, options: { closeModal?: boolean; toastMessage?: string } = {}) => {
        setBusy(true);
        setError('');
        try {
            const coreType = draft.kind === 'login' ? 'login' : draft.kind === 'card' ? 'card' : 'custom';
            const saved = await focuzPassUpsert({
                id: draft.id,
                type: coreType,
                kind: draft.kind !== 'login' && draft.kind !== 'card' ? draft.kind : undefined,
                title: draft.title,
                identity: draft.identity,
                domain: draft.domain,
                password: draft.password,
                cardNumber: draft.cardNumber,
                expiry: draft.expiry,
                cvv: draft.cvv,
                fields: draft.fields,
                note: draft.note,
                authMethod: coreType === 'login' ? 'PASSWORD' : coreType === 'card' ? 'CARD' : undefined,
                vaultId: draft.vaultId,
                tagIds: draft.tagIds,
                markTone: draft.markTone,
            });
            const ui = toUiItem(saved);
            setItems((current) => {
                const exists = current.some((candidate) => candidate.id === ui.id);
                return exists ? current.map((candidate) => (candidate.id === ui.id ? ui : candidate)) : [ui, ...current];
            });
            setSelectedId(ui.id);
            if (options.closeModal !== false) setModal(null);
            showToast(options.toastMessage || `${ui.title} saved to your vault`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save item');
        } finally {
            setBusy(false);
        }
    };

    const deleteSelected = async () => {
        if (!selected) return;
        setBusy(true);
        try {
            await focuzPassDelete(selected.id);
            await loadUnlocked();
            setSelectedId('');
            setActionsOpen(false);
            showToast(`${selected.title} moved to Recently Deleted`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete item');
        } finally {
            setBusy(false);
        }
    };

    const createCollection = async (mode: 'vault' | 'tag', value: { name: string; color: string; icon: string }) => {
        setBusy(true);
        try {
            if (mode === 'vault') {
                const created = await focuzPassCreateVault(value);
                setVaults((current) => [...current, created]);
                setView({ kind: 'vault', id: created.id });
                showToast(`${created.name} vault created`);
                setCollectionModal(null);
                return created;
            }
            const created = await focuzPassCreateTag(value);
            setTags((current) => [...current, created]);
            showToast(`${created.name} tag created`);
            setCollectionModal(null);
            return created;
        } catch (err) {
            const message = err instanceof Error ? err.message : `Could not create ${mode}`;
            setError(message);
            showToast(message);
            throw err;
        } finally {
            setBusy(false);
        }
    };

    const updateSelectedAction = async (
        action: 'favorite' | 'archive' | 'unarchive' | 'restore' | 'purge' | 'duplicate',
        value?: boolean,
    ) => {
        if (!selected) return;
        setBusy(true);
        try {
            const result = action === 'favorite'
                ? await focuzPassItemAction({ action, id: selected.id, value: Boolean(value) })
                : await focuzPassItemAction({ action, id: selected.id });
            await loadUnlocked();
            setSelectedId(result?.id || '');
            setActionsOpen(false);
            showToast(action === 'duplicate' ? `${selected.title} duplicated` : action === 'favorite' ? (value ? 'Added to Favorites' : 'Removed from Favorites') : action === 'archive' ? `${selected.title} archived` : action === 'restore' ? `${selected.title} restored` : action === 'purge' ? `${selected.title} permanently deleted` : `${selected.title} updated`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update item');
        } finally {
            setBusy(false);
        }
    };

    const moveSelected = async (vaultId: string) => {
        if (!selected) return;
        setBusy(true);
        try {
            await focuzPassItemAction({ action: 'move', id: selected.id, vaultId });
            await loadUnlocked();
            setActionsOpen(false);
            showToast(`Moved ${selected.title}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : `Could not move ${selected.title}`;
            setError(message);
            showToast(message);
        } finally {
            setBusy(false);
        }
    };

    const handleSetup = async (event: FormEvent) => {
        event.preventDefault();
        if (setupPassword.length < 8) {
            setError('Master password must be at least 8 characters');
            return;
        }
        if (setupPassword !== setupConfirm) {
            setError('Passwords do not match');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const next = await focuzPassSetup(setupPassword);
            setStatus(next);
            setSetupPassword('');
            setSetupConfirm('');
            await loadUnlocked();
            showToast('Vault created on this device');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Setup failed');
        } finally {
            setBusy(false);
        }
    };

    const handleUnlock = async (event: FormEvent) => {
        event.preventDefault();
        if (!unlockValue.trim()) return;
        setBusy(true);
        setError('');
        try {
            const next = await focuzPassUnlock(unlockValue);
            setUnlockValue('');
            setStatus(next);
            await loadUnlocked();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unlock failed');
        } finally {
            setBusy(false);
        }
    };

    const handleLock = async () => {
        setBusy(true);
        try {
            const next = await focuzPassLock();
            clearSecrets();
            setStatus(next);
            setBoot('locked');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lock failed');
        } finally {
            setBusy(false);
        }
    };

    const openSelectedEditor = () => {
        if (!selected || selected.type === 'passkey') return;
        setEditingId(selected.id);
        setEditorKind(selected.type === 'login' ? 'login' : selected.type === 'card' ? 'card' : selected.kind || 'password');
        setModal('editor');
    };

    const removeSelectedTag = async (tagId: string) => {
        if (!selected || selected.type === 'passkey' || busy) return;
        const tag = tags.find((candidate) => candidate.id === tagId);
        const draft = draftFromItem(selected, selected.tagIds.filter((id) => id !== tagId));
        if (!draft) return;
        await saveItem(draft, { closeModal: false, toastMessage: `${tag?.name || 'Tag'} removed from ${selected.title}` });
    };

    const detailPanel = selected ? (
        <motion.div
            key={selected.id}
            className="vault-detail-page"
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
            <div className="vault-detail-topbar">
                <div className="vault-detail-location">
                    {selectedVault && <><CollectionMark color={selectedVault.color} icon={selectedVault.icon} size={13} /><strong>{selectedVault.name}</strong></>}
                    <span><ShieldCheck size={13} /> Private <ChevronDown size={11} /></span>
                </div>
                <div className="vault-detail-actions" onClick={(event) => event.stopPropagation()}>
                    {selected.deletedAt && <button type="button" onClick={() => void updateSelectedAction('restore')}><ArchiveRestore size={14} /> Restore</button>}
                    {selected.archivedAt && !selected.deletedAt && <button type="button" onClick={() => void updateSelectedAction('unarchive')}><ArchiveRestore size={14} /> Restore</button>}
                    {selected.type !== 'passkey' && !selected.deletedAt && <button type="button" onClick={openSelectedEditor}><Pencil size={14} /> Edit</button>}
                    <div className="vault-actions-wrap">
                        <button type="button" className="vault-more-button" onClick={() => setActionsOpen((open) => !open)} aria-label="More item actions" aria-expanded={actionsOpen}><EllipsisVertical size={18} /></button>
                        <AnimatePresence>
                            {actionsOpen && (
                                <motion.div className="vault-item-actions-menu" initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -3, scale: 0.985 }}>
                                    {selected.deletedAt ? (
                                        <>
                                            <button type="button" onClick={() => void updateSelectedAction('restore')}><ArchiveRestore size={15} /> Restore</button>
                                            <button type="button" className="is-danger" onClick={() => void updateSelectedAction('purge')}><Trash2 size={15} /> Delete permanently</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" onClick={() => void updateSelectedAction('favorite', !selected.favorite)}><ExactFavoritesIcon size={15} /> {selected.favorite ? 'Remove from Favorites' : 'Add to Favorites'}</button>
                                            {vaults.length > 1 && <div className="vault-move-group"><span><FolderInput size={13} /> Move to</span>{vaults.filter((vault) => vault.id !== selected.vaultId).map((vault) => <button type="button" key={vault.id} onClick={() => void moveSelected(vault.id)}><CollectionMark color={vault.color} icon={vault.icon} size={11} /> {vault.name}</button>)}</div>}
                                            <button type="button" onClick={() => void updateSelectedAction('duplicate')}><CopyPlus size={15} /> Duplicate</button>
                                            <button type="button" onClick={() => void updateSelectedAction(selected.archivedAt ? 'unarchive' : 'archive')}><ExactArchiveIcon size={15} /> {selected.archivedAt ? 'Restore from Archive' : 'Archive'}</button>
                                            <button type="button" className="is-danger" onClick={() => void deleteSelected()}><Trash2 size={15} /> Delete</button>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <div className="vault-detail-scroll">
                <div className="vault-detail-body">
                    <div className="vault-detail-heading"><ItemMark item={selected} large /><h2>{selected.title}</h2></div>
                    {selected.type === 'login' && (
                        <>
                            <div className="vault-credential-card">
                                <DetailField label="Username" value={selected.identity || 'Not added'} onCopy={selected.identity ? () => copyText(selected.identity, setCopied, 'identity') : undefined} copied={copied === 'identity'} />
                                {associatedPasskey && <div className="vault-passkey-row"><div><span>Passkey</span><strong>Created {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(associatedPasskey.sortDate))}</strong></div><Fingerprint size={19} /></div>}
                                <DetailField label="Password" value={selected.password || ''} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={selected.password ? () => copyText(selected.password || '', setCopied, 'password') : undefined} copied={copied === 'password'} />
                            </div>
                            {selected.strength && <div className={`vault-password-health is-${selected.strength}`}><span>Password strength</span><strong>{selected.strength === 'okay' ? 'Fair' : selected.strength}</strong><i /></div>}
                            {selected.domain && <a className="vault-website-link" href={selected.domain.includes('://') ? selected.domain : `https://${selected.domain}`} target="_blank" rel="noreferrer"><span>Website</span><strong>{selected.domain}</strong></a>}
                        </>
                    )}
                    {selected.type === 'card' && <div className="vault-credential-card"><DetailField label="Cardholder" value={selected.identity || 'Not added'} onCopy={selected.identity ? () => copyText(selected.identity, setCopied, 'identity') : undefined} copied={copied === 'identity'} /><DetailField label="Card number" value={selected.cardNumber || ''} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={selected.cardNumber ? () => copyText(selected.cardNumber || '', setCopied, 'card') : undefined} copied={copied === 'card'} /><DetailField label="Expiry" value={selected.expiry || 'Not added'} />{selected.cvv && <DetailField label="Security code" value={selected.cvv} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.cvv || '', setCopied, 'cvv')} copied={copied === 'cvv'} />}</div>}
                    {selected.type === 'custom' && selected.kind && <div className="vault-credential-card">{ITEM_DEFINITIONS[selected.kind].fields.map((field) => <DetailField key={field.key} label={field.label} value={selected.fields[field.key] || 'Not added'} secret={isSensitiveField(field) && Boolean(selected.fields[field.key])} reveal={revealed} onToggleReveal={isSensitiveField(field) && selected.fields[field.key] ? () => setRevealed((value) => !value) : undefined} onCopy={selected.fields[field.key] ? () => copyText(selected.fields[field.key]!, setCopied, field.key) : undefined} copied={copied === field.key} />)}</div>}
                    {selected.type === 'passkey' && <div className="vault-credential-card"><DetailField label="Username" value={selected.identity || 'Not added'} /><DetailField label="Passkey" value={selected.credentialId || 'Browser-managed credential'} /></div>}
                    {selected.note && <div className="vault-detail-note"><span>Notes</span><p>{selected.note}</p></div>}
                    {selected.tagIds.length > 0 && <div className="vault-detail-tags"><span>Tags</span><div>{selected.tagIds.map((tagId) => { const tag = tags.find((candidate) => candidate.id === tagId); return tag ? <span key={tag.id} className="vault-detail-tag" style={{ '--tag-tone': tag.color } as CSSProperties}><button type="button" className="vault-detail-tag-link" onClick={() => { setView({ kind: 'tag', id: tag.id }); setSelectedId(''); }}><ExactTagIcon size={12} color={tag.color} /> {tag.name}</button>{selected.type !== 'passkey' && <button type="button" className="vault-detail-tag-remove" onClick={() => void removeSelectedTag(tag.id)} disabled={busy} aria-label={`Remove ${tag.name} tag`}><X size={11} /></button>}</span> : null; })}</div></div>}
                </div>
            </div>
        </motion.div>
    ) : <VaultEmptyIllustration />;

    if (boot === 'loading') {
        return (
            <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
                <p className="text-sm text-neutral-500">Opening FocuzPass…</p>
            </section>
        );
    }

    if (boot === 'companion') {
        return <CompanionScreen />;
    }

    if (boot === 'error') {
        return (
            <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
                <div className="max-w-md text-center">
                    <p className="text-sm text-neutral-300">Could not open FocuzPass</p>
                    <p className="mt-2 text-[12px] text-neutral-600">{error}</p>
                    <button type="button" className="vault-button vault-button-primary mt-4" onClick={() => void refreshStatus()}>Retry</button>
                </div>
            </section>
        );
    }

    if (boot === 'setup') {
        return (
            <section className="focuz-pass vault-access-screen">
                <motion.div
                    className="vault-access-card"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="vault-lock-orbit vault-access-symbol">
                        <KeyRound size={24} />
                    </div>
                    <p className="vault-access-kicker">First-run setup</p>
                    <h2 className="vault-access-heading">Create your local vault</h2>
                    <p className="vault-access-copy">
                        Choose a master password. It is never stored — only a device-local encrypted vault blob is saved.
                    </p>
                    <form className="vault-access-form" onSubmit={handleSetup}>
                        <label className="vault-access-field">
                            <span>Master password</span>
                            <input type="password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} autoFocus placeholder="At least 8 characters" autoComplete="new-password" />
                        </label>
                        <label className="vault-access-field">
                            <span>Confirm master password</span>
                            <input type="password" value={setupConfirm} onChange={(event) => setSetupConfirm(event.target.value)} placeholder="Repeat master password" autoComplete="new-password" />
                        </label>
                        {error && <p className="vault-access-error" role="alert">{error}</p>}
                        <button type="submit" disabled={busy} className="vault-button vault-button-primary vault-access-submit">
                            {busy ? 'Creating vault…' : 'Create encrypted vault'}
                            {!busy && <ArrowRight size={14} />}
                        </button>
                    </form>
                    <p className="vault-access-footnote"><ShieldCheck size={13} /> Your password never leaves this device</p>
                </motion.div>
            </section>
        );
    }

    if (boot === 'locked') {
        return (
            <section className="focuz-pass vault-access-screen">
                <motion.div
                    className="vault-access-card"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="vault-lock-orbit vault-access-symbol">
                        <FocuzPassAccessLockIcon />
                    </div>
                    <p className="vault-access-kicker">FocuzPass is locked</p>
                    <h2 className="vault-access-heading">Your vault is locked</h2>
                    <p className="vault-access-copy">Unlock to access logins, cards, and passkey metadata stored on this device.</p>
                    <form className="vault-access-form" onSubmit={handleUnlock}>
                        <label className="vault-access-field">
                            <span>Master password</span>
                            <input type="password" value={unlockValue} onChange={(event) => setUnlockValue(event.target.value)} autoFocus placeholder="Enter your master password" autoComplete="current-password" />
                        </label>
                        {error && <p className="vault-access-error" role="alert">{error}</p>}
                        <button type="submit" disabled={busy} className="vault-button vault-button-primary vault-access-submit">
                            {busy ? 'Unlocking…' : 'Unlock vault'}
                            {!busy && <ArrowRight size={14} />}
                        </button>
                    </form>
                    <p className="vault-access-footnote"><Laptop size={13} /> Decrypted only for this browser session</p>
                </motion.div>
            </section>
        );
    }

    return (
        <section className="focuz-pass focuz-pass-ready h-full w-full">
            <div className="vault-shell">
                <aside className="vault-nav">
                    <div className="vault-brand-row">
                        <span>FocuzPass</span>
                        <button type="button" onClick={onExit} aria-label="Return to FocuzNow dashboard" title="Return to FocuzNow">
                            <ExactSidebarDrawerCloseIcon size={15} />
                        </button>
                    </div>

                    <div className="vault-profile-wrap">
                        <button type="button" className="vault-profile" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
                            <span className="vault-profile-avatar">
                                {avatarUrl ? <img src={avatarUrl} alt="" /> : <ShieldEllipsis size={15} />}
                            </span>
                            <span className="vault-profile-copy">
                                <strong className="truncate">{username}</strong>
                                <small className="truncate">{accountName}</small>
                            </span>
                        </button>
                        <AnimatePresence>
                            {profileOpen && (
                                <motion.div className="vault-profile-menu" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}>
                                    <button type="button" onClick={() => void handleLock()}><Lock size={13} /> Lock vault</button>
                                    {onExit && <button type="button" onClick={onExit}><PanelLeft size={13} /> FocuzNow dashboard</button>}
                                    <span>Locks in {formatRemaining(status?.remainingMs)}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <nav className="vault-primary-nav" aria-label="FocuzPass navigation">
                        <button type="button" className={`vault-nav-item${view.kind === 'all' ? ' is-active' : ''}`} onClick={() => { setView({ kind: 'all' }); setFilter('all'); setQuery(''); setSelectedId(''); }}><ExactAllItemsIcon size={16} /> All Items</button>
                        <button type="button" className={`vault-nav-item${view.kind === 'favorites' ? ' is-active' : ''}`} onClick={() => { setView({ kind: 'favorites' }); setSelectedId(''); }}><ExactFavoritesIcon size={16} /> Favorites</button>

                        <section className="vault-nav-section" aria-label="Vaults">
                            <div className="vault-nav-heading">
                                <button type="button" className="vault-nav-section-toggle" onClick={() => setVaultsOpen((open) => !open)} aria-expanded={vaultsOpen}>
                                    <span className="vault-nav-section-content">
                                        <span className={`vault-nav-disclosure${vaultsOpen ? ' is-open' : ''}`}><ExactSidebarChevronIcon /></span>
                                        <strong className="vault-nav-section-label">Vaults</strong>
                                    </span>
                                </button>
                                <button type="button" className="vault-nav-add" onClick={() => setCollectionModal('vault')} aria-label="New Vault"><ExactSidebarPlusIcon /></button>
                            </div>
                            <div className={`vault-nav-section-items${vaultsOpen ? '' : ' is-collapsed'}`} aria-hidden={!vaultsOpen}>
                                <div>
                                    {vaults.map((vault) => (
                                        <button key={vault.id} type="button" tabIndex={vaultsOpen ? 0 : -1} className={`vault-nav-item${view.kind === 'vault' && view.id === vault.id ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'vault', id: vault.id }); setSelectedId(''); }}><CollectionMark color={vault.color} icon={vault.icon} size={16} /> <span className="truncate">{vault.name}</span></button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="vault-nav-section" aria-label="Tags">
                            <div className="vault-nav-heading">
                                <button type="button" className="vault-nav-section-toggle" onClick={() => setTagsOpen((open) => !open)} aria-expanded={tagsOpen}>
                                    <span className="vault-nav-section-content">
                                        <span className={`vault-nav-disclosure${tagsOpen ? ' is-open' : ''}`}><ExactSidebarChevronIcon /></span>
                                        <strong className="vault-nav-section-label">Tags</strong>
                                    </span>
                                </button>
                                <button type="button" className="vault-nav-add" onClick={() => setCollectionModal('tag')} aria-label="New Tag"><ExactSidebarPlusIcon /></button>
                            </div>
                            <div className={`vault-nav-section-items${tagsOpen ? '' : ' is-collapsed'}`} aria-hidden={!tagsOpen}>
                                <div>
                                    {tags.map((tag) => (
                                        <button key={tag.id} type="button" tabIndex={tagsOpen ? 0 : -1} className={`vault-nav-item${view.kind === 'tag' && view.id === tag.id ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'tag', id: tag.id }); setSelectedId(''); }}><CollectionMark color={tag.color} icon={tag.icon} size={16} /> <span className="truncate">{tag.name}</span></button>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </nav>

                    <div className="vault-nav-bottom">
                        <button type="button" className={`vault-nav-item${view.kind === 'archive' ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'archive' }); setSelectedId(''); }}><ExactArchiveIcon size={16} /> Archive</button>
                        <button type="button" className={`vault-nav-item${view.kind === 'deleted' ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'deleted' }); setSelectedId(''); }}><ExactRecentlyDeletedIcon size={16} /> Recently Deleted</button>
                    </div>
                </aside>

                <header className="vault-toolbar">
                    <label className="vault-search">
                        <Search size={14} aria-hidden="true" />
                        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search in ${viewTitle}`} />
                        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={12} /></button>}
                    </label>
                    <button type="button" className="vault-help" onClick={() => showToast('Use / to jump to search. Your vault stays on this device.')}>Help</button>
                    <button type="button" onClick={() => setModal('picker')} className="vault-new-item"><Plus size={13} /> New Item</button>
                </header>

                <div className="vault-content-grid">
                    <div className="vault-list">
                        <div className="vault-list-toolbar">
                            <div className="relative">
                                <button type="button" className="vault-category-button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}>
                                    <LayoutGrid size={10} />
                                    <span>{filter === 'all' ? 'All Categories' : FILTERS.find((option) => option.id === filter)?.label}</span>
                                    <ChevronDown size={8} />
                                </button>
                                <AnimatePresence>
                                    {filtersOpen && (
                                        <motion.div className="vault-category-menu" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}>
                                            {FILTERS.map((option) => {
                                                const FilterIcon = option.icon;
                                                return (
                                                    <button key={option.id} type="button" className={filter === option.id ? 'is-active' : ''} onClick={() => { setFilter(option.id); setFiltersOpen(false); }}>
                                                        <FilterIcon size={10} />
                                                        <span>{option.label}</span>
                                                        <small>{counts[option.id]}</small>
                                                    </button>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="vault-list-actions">
                                <button type="button" onClick={() => searchRef.current?.focus()} aria-label="Search this item list"><ListSearchIcon /></button>
                                <button type="button" onClick={() => showToast('Items are grouped by most recent activity.')} aria-label="Sort items"><SortItemsIcon /></button>
                            </div>
                        </div>

                        <div className="vault-list-scroll">
                            <AnimatePresence mode="popLayout">
                                {filteredItems.length > 0 ? groupedItems.map(([group, groupItems]) => (
                                    <motion.section key={group} className="vault-month-group" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
                                        <p>{group}</p>
                                        {groupItems.map((item) => {
                                            const isSelected = selected?.id === item.id;
                                            return (
                                                <motion.button
                                                    layout
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => { setSelectedId(item.id); setRevealed(false); setActionsOpen(false); }}
                                                    className={`vault-row ${isSelected ? 'is-selected' : ''}`}
                                                    initial={reduceMotion ? false : { opacity: 0, y: 2 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <ItemMark item={item} />
                                                    <span>
                                                        <strong>{item.title}</strong>
                                                        <small>{item.authMethod === 'Password' ? item.identity : item.authMethod}</small>
                                                    </span>
                                                </motion.button>
                                            );
                                        })}
                                    </motion.section>
                                )) : items.length === 0 ? (
                                    <motion.div className="vault-list-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <p>No items yet</p>
                                        <button type="button" onClick={() => { setEditingId(null); setModal('picker'); }}>+ New Item</button>
                                    </motion.div>
                                ) : (
                                    <motion.div className="vault-list-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <p>No matching items</p>
                                        <button type="button" onClick={() => { setFilter('all'); setQuery(''); }}>Clear filters</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <aside className="vault-detail" onClick={() => actionsOpen && setActionsOpen(false)}>
                        <div className="vault-detail-current">{detailPanel}</div>
                        <div className="vault-detail-legacy" aria-hidden="true">
                        <AnimatePresence mode="wait">
                            {selected ? (
                                <motion.div
                                    key={selected.id}
                                    className="flex h-full min-h-[490px] flex-col"
                                    initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -8 }}
                                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <div className="flex items-start gap-3 border-b border-white/[0.055] p-5">
                                        <ItemMark item={selected} large />
                                        <div className="min-w-0 flex-1 pt-0.5">
                                            <p className="truncate text-[15px] font-semibold tracking-[-0.015em] text-neutral-100">{selected.title}</p>
                                            <p className="mt-1 truncate text-[10px] text-neutral-600">{selected.domain || TYPE_META[selected.type].label}</p>
                                        </div>
                                        <button type="button" className="vault-icon-button h-8 w-8" aria-label="More actions"><MoreHorizontal size={15} /></button>
                                    </div>

                                    <div className="flex-1 px-5 py-2">
                                        <DetailField label={selected.type === 'card' ? 'Cardholder' : 'Identity'} value={selected.identity} onCopy={() => copyText(selected.identity, setCopied, 'identity')} copied={copied === 'identity'} />
                                        {selected.type === 'login' && selected.password && (
                                            <DetailField label="Password" value={selected.password} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.password || '', setCopied, 'password')} copied={copied === 'password'} />
                                        )}
                                        {selected.type === 'card' && (
                                            <>
                                                <DetailField label="Card number" value={revealed ? (selected.cardNumber || '') : maskCard(selected.cardNumber)} secret={!revealed} reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.cardNumber || '', setCopied, 'card')} copied={copied === 'card'} />
                                                <DetailField label="Expiry" value={selected.expiry || '—'} />
                                                {selected.cvv && (
                                                    <DetailField label="CVV" value={selected.cvv} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.cvv || '', setCopied, 'cvv')} copied={copied === 'cvv'} />
                                                )}
                                            </>
                                        )}
                                        {selected.type === 'passkey' && (
                                            <>
                                                <DetailField label="Credential id" value={selected.credentialId || 'Metadata only'} />
                                                <DetailField label="Provider support" value="Experimental — browser owns WebAuthn keys" />
                                            </>
                                        )}
                                        <DetailField label="Sign-in method" value={selected.authMethod} />
                                        {selected.note && <DetailField label="Private note" value={selected.note} />}
                                    </div>

                                    <div className="border-t border-white/[0.055] p-4">
                                        <div className="mb-3 flex items-center justify-between rounded-lg border border-white/[0.055] bg-white/[0.018] px-3 py-2.5">
                                            <span className="flex items-center gap-2 text-[10px] text-neutral-500"><ShieldCheck size={13} className={selected.risk ? 'text-red-300' : 'text-emerald-400'} /> {selected.risk ? 'Security review recommended' : 'No security issues found'}</span>
                                            {selected.strength && <span className={`text-[9px] font-semibold uppercase tracking-[0.08em] ${selected.strength === 'strong' ? 'text-emerald-400' : selected.strength === 'okay' ? 'text-neutral-400' : 'text-red-300'}`}>{selected.strength}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={openSelectedEditor} className="vault-button vault-button-secondary flex-1 justify-center">Edit item</button>
                                            <button type="button" onClick={() => void deleteSelected()} className="vault-icon-button h-9 w-9 hover:border-red-400/20 hover:bg-red-400/[0.06] hover:text-red-300" aria-label={`Delete ${selected.title}`}><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <VaultEmptyIllustration />
                            )}
                        </AnimatePresence>
                        </div>
                    </aside>
                </div>

            </div>

            <AnimatePresence>
                {modal === 'picker' && <ItemPickerModal onClose={() => setModal(null)} onSelect={(kind) => { setEditingId(null); setEditorKind(kind); setModal('editor'); }} />}
                {modal === 'editor' && <ItemEditorModal kind={editorKind} item={editingId ? items.find((item) => item.id === editingId) : undefined} vaults={vaults} tags={tags} defaultVaultId={view.kind === 'vault' ? view.id : undefined} onClose={() => { setModal(null); setEditingId(null); }} onSave={(draft) => void saveItem(draft)} onCreateTag={async (value) => (await createCollection('tag', value)) as VaultTag} busy={busy} />}
                {collectionModal && <CollectionModal mode={collectionModal} onClose={() => setCollectionModal(null)} onCreate={(value) => { void createCollection(collectionModal, value).catch((err) => { setError(err instanceof Error ? err.message : `Could not create ${collectionModal}`); }); }} busy={busy} />}
            </AnimatePresence>

            <AnimatePresence>
                {toast && (
                    <motion.div
                        role="status"
                        className="fixed bottom-6 left-1/2 z-[600] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/[0.09] bg-[#1b1b1d] px-3 py-2 text-[11px] text-neutral-200 shadow-2xl"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                    >
                        <Check size={13} className="text-emerald-400" />
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
