import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS as DndCss } from '@dnd-kit/utilities';
import {
    AE as FlagAE, AR as FlagAR, AT as FlagAT, AU as FlagAU, BD as FlagBD, BE as FlagBE,
    BR as FlagBR, CA as FlagCA, CH as FlagCH, CN as FlagCN, CZ as FlagCZ, DE as FlagDE,
    DK as FlagDK, ES as FlagES, FI as FlagFI, FR as FlagFR, GB as FlagGB, GH as FlagGH,
    GR as FlagGR, HU as FlagHU, ID as FlagID, IE as FlagIE, IL as FlagIL, IN as FlagIN,
    IT as FlagIT, JP as FlagJP, KE as FlagKE, KR as FlagKR, MX as FlagMX, MY as FlagMY,
    NG as FlagNG, NL as FlagNL, NO as FlagNO, NZ as FlagNZ, PH as FlagPH, PK as FlagPK,
    PL as FlagPL, PT as FlagPT, RO as FlagRO, SA as FlagSA, SE as FlagSE, SG as FlagSG,
    TH as FlagTH, TR as FlagTR, UA as FlagUA, US as FlagUS, VN as FlagVN, ZA as FlagZA,
} from 'country-flag-icons/react/3x2';
import {
    ArchiveRestore,
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    BookOpen,
    Braces,
    Briefcase,
    Check,
    CircleHelp,
    ChevronDown,
    Copy,
    CopyPlus,
    CreditCard,
    Download,
    EllipsisVertical,
    Cloud,
    Eye,
    EyeOff,
    Fingerprint,
    FolderInput,
    Funnel,
    GripVertical,
    HeartPulse,
    Home,
    IdCard,
    KeyRound,
    Landmark,
    Laptop,
    LayoutGrid,
    Lock,
    LockKeyhole,
    Mail,
    MapPin,
    MoreHorizontal,
    PanelLeft,
    Pencil,
    Plus,
    QrCode,
    RotateCw,
    Router,
    Search,
    ShieldCheck,
    Sparkles,
    Star,
    Tag,
    Terminal,
    TicketCheck,
    Trash2,
    Unplug,
    WalletCards,
    X,
} from 'lucide-react';
import { ImportPasswords } from './focuzpass/ImportPasswords';
import { TransferVault } from './focuzpass/TransferVault';
import { ChangeMasterPassword } from './focuzpass/ChangeMasterPassword';
import { COLLECTION_ICON_GROUPS, collectionIcon, searchCollectionIcons } from './focuzpass/collectionIcons';
import { FloatingPanel } from './focuzpass/FloatingPanel';
import { ColorPicker } from './focuzpass/ColorPicker';
import { DatePicker } from './focuzpass/DatePicker';
import { markLetters, readableTitle, tileHue } from '../lib/focuzPass/displayName';
import { PLACES_MIN_CHARS, newPlacesSession, placesDetails, placesSuggest, type PlaceSuggestion } from '../lib/focuzPass/places';
import { PasskeySettings } from './focuzpass/PasskeySettings';
import { CloudSync } from './focuzpass/CloudSync';
import { FormEvent, Fragment, useCallback, useId, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import ModalPortal from '../components/ModalPortal';
import { Toast } from '../components/fz/Toast';
import { Dialog } from '../components/fz/Dialog';
import { Menu, type MenuItem } from '../components/fz/Menu';
import { Button } from '../components/fz/Button';
import {
    focuzPassCreateTag,
    focuzPassCreateVault,
    focuzPassDelete,
    focuzPassItemAction,
    focuzPassLock,
    focuzPassCloudStatus,
    focuzPassCloudSync,
    subscribeFocuzPassEvents,
    focuzPassOpenAccessWindow,
    focuzPassPing,
    focuzPassReadRememberedOrder,
    focuzPassReorder,
    focuzPassSiteIcon,
    focuzPassSnapshot,
    focuzPassStatus,
    focuzPassTouch,
    focuzPassUpsert,
    type CustomItemKind,
    type DecryptedVaultItem,
    type SiteIcon,
    type VaultCollection,
    type VaultStatus,
    type VaultTag,
} from '../lib/focuzPass/client';
import {
    CARD_BRAND_LABELS,
    detectCardBrand,
    type CardBrand,
    digitsOnly,
    formatFieldValue,
    formatInternationalPhone,
    formatPhoneLocal,
    PHONE_COUNTRIES,
    phoneCountryFromValue,
    phoneLocalDigits,
    validateFieldValue,
    type FocuzPassFieldFormat,
    type PhoneCountry,
} from '../lib/focuzPass/fieldUtils';
import { formatRelativeTime } from '../lib/focuzPass/vaultCore';
import { isWebPlatform } from '../lib/platform';
import { extensionPresent } from '../lib/platform/webPlatform';

type VaultItemType = 'login' | 'card' | 'passkey' | 'custom';
type EditableItemKind = 'login' | 'card' | CustomItemKind;
type VaultFilter = 'all' | Exclude<VaultItemType, 'custom'> | CustomItemKind | 'risk';
type PasswordStrength = 'weak' | 'okay' | 'strong';
type VaultSort = 'custom' | 'activity' | 'created-newest' | 'created-oldest' | 'name-asc' | 'name-desc' | 'type';
type CreatedFilter = 'any' | '7d' | '30d' | '90d' | 'year';

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
    createdAt: string;
    sortOrder: number;
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
    { id: 'identity', label: 'Identities', icon: IdCard },
    { id: 'password', label: 'Passwords', icon: KeyRound },
    { id: 'email', label: 'Email accounts', icon: Mail },
    { id: 'bank_account', label: 'Bank accounts', icon: Landmark },
    { id: 'crypto_wallet', label: 'Crypto wallets', icon: WalletCards },
    { id: 'driver_license', label: 'Driver licenses', icon: BadgeCheck },
    { id: 'medical_record', label: 'Medical records', icon: HeartPulse },
    { id: 'membership', label: 'Memberships', icon: TicketCheck },
    { id: 'passport', label: 'Passports', icon: BookOpen },
    { id: 'api_credentials', label: 'API credentials', icon: Braces },
    { id: 'ssh_key', label: 'SSH keys', icon: Terminal },
    { id: 'social_security_number', label: 'Social Security', icon: ShieldCheck },
    { id: 'wireless_router', label: 'Wireless routers', icon: Router },
    { id: 'risk', label: 'Security review', icon: ShieldCheck },
];

const SORT_OPTIONS: { id: VaultSort; label: string; description: string }[] = [
    { id: 'custom', label: 'Custom order', description: 'Hold and drag items into place' },
    { id: 'activity', label: 'Recent activity', description: 'Recently used or edited first' },
    { id: 'created-newest', label: 'Newest created', description: 'Newest additions first' },
    { id: 'created-oldest', label: 'Oldest created', description: 'Oldest additions first' },
    { id: 'name-asc', label: 'Name A–Z', description: 'Alphabetical ascending' },
    { id: 'name-desc', label: 'Name Z–A', description: 'Alphabetical descending' },
    { id: 'type', label: 'Item type', description: 'Group similar credentials' },
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
            { key: 'phone', label: 'Phone', placeholder: '(555) 000-0000' },
            { key: 'address', label: 'Address', placeholder: 'Start typing an address…' },
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
    const Icon = ITEM_DEFINITIONS[kind].icon;
    return (
        <span className={`vault-type-icon vault-type-icon--${kind} is-flat`} style={{ '--item-type-icon-size': `${size}px` } as CSSProperties} aria-hidden="true">
            <Icon strokeWidth={1.75} fill="currentColor" fillOpacity={0.16} />
        </span>
    );
}

function authMethodLabel(item: DecryptedVaultItem): string {
    if (item.type === 'card') {
        const last4 = item.cardNumber?.slice(-4);
        return last4 ? `Card •••• ${last4}` : 'Card';
    }
    if (item.type === 'passkey') return 'Passkey';
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

/** The site part of a saved address: "https://www.discord.com/login" -> "discord.com". */
function siteHost(domain?: string): string {
    return (domain || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0] || '';
}

/** One account on one site: a login and the passkey saved for it share this. */
function accountKey(item: { domain?: string; identity: string }): string {
    const host = siteHost(item.domain);
    return host && item.identity ? `${host}|${item.identity.trim().toLowerCase()}` : '';
}

function toUiItem(item: DecryptedVaultItem): VaultItem {
    // A raw address saved as the title ("account.hoyolab.com") reads as the site's name ("Hoyolab").
    const title = readableTitle(item.title);
    return {
        id: item.id,
        type: item.type,
        kind: item.type === 'custom' ? item.kind : undefined,
        title,
        identity: item.identity,
        domain: item.type === 'login' || item.type === 'passkey' || (item.type === 'custom' && item.kind === 'password') ? (item as { domain?: string }).domain : undefined,
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
        createdAt: item.createdAt,
        sortOrder: item.sortOrder,
        note: item.note,
        mark: markLetters(title),
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
) {
    setItems([]);
    setRevealed(false);
    setCopied('');
}

function itemDefinition(item: VaultItem) {
    if (item.type === 'custom' && item.kind) return ITEM_DEFINITIONS[item.kind];
    if (item.type === 'card') return ITEM_DEFINITIONS.card;
    if (item.type === 'login') return ITEM_DEFINITIONS.login;
    return { label: 'Passkey', icon: Fingerprint, tone: '#93c5fd', primary: false, fields: [] as FieldDefinition[] };
}

function isSensitiveField(field: FieldDefinition) {
    return field.type === 'password' || ['recoveryPhrase', 'privateKey'].includes(field.key);
}

function fieldFormat(kind: EditableItemKind, field: FieldDefinition): FocuzPassFieldFormat | undefined {
    const key = field.key.toLowerCase();
    if (kind === 'card' && key === 'cardnumber') return 'card-number';
    if (kind === 'card' && key === 'expiry') return 'card-expiry';
    if (kind === 'card' && key === 'cvv') return 'cvv';
    if (field.type === 'date') return 'date';
    if (key.includes('email')) return 'email';
    if (key.includes('phone')) return 'phone';
    if (['domain', 'website', 'hostname'].includes(key)) return 'url';
    if (key === 'postalcode') return 'postal-code';
    if (key === 'routingnumber') return 'routing-number';
    if (key === 'swift') return 'swift';
    if (key === 'ipaddress') return 'ip-address';
    if (key === 'port') return 'port';
    if (key === 'ssn') return 'ssn';
    if (key.startsWith('address') || ['city', 'region', 'country'].includes(key)) return 'address';
    return undefined;
}

function fieldRequired(kind: EditableItemKind, field: FieldDefinition): boolean {
    if (kind === 'card') return ['identity', 'cardNumber', 'expiry', 'cvv'].includes(field.key);
    if (kind === 'login') return ['identity', 'password', 'domain'].includes(field.key);
    if (kind === 'identity') return ['fullName'].includes(field.key);
    if (kind === 'email') return ['email', 'password'].includes(field.key);
    return false;
}

function inputTypeForField(kind: EditableItemKind, field: FieldDefinition) {
    const format = fieldFormat(kind, field);
    if (field.type === 'date') return 'date';
    if (field.type === 'password') return 'password';
    if (format === 'email') return 'email';
    if (format === 'phone') return 'tel';
    if (format === 'url') return 'url';
    return 'text';
}

function inputModeForField(kind: EditableItemKind, field: FieldDefinition): 'text' | 'email' | 'tel' | 'url' | 'numeric' | undefined {
    const format = fieldFormat(kind, field);
    if (['card-number', 'card-expiry', 'cvv', 'routing-number', 'port', 'ssn'].includes(format || '')) return 'numeric';
    if (format === 'email') return 'email';
    if (format === 'phone') return 'tel';
    if (format === 'url') return 'url';
    return undefined;
}

function autocompleteForField(kind: EditableItemKind, field: FieldDefinition): string {
    const key = field.key.toLowerCase();
    const exact: Record<string, string> = {
        identity: kind === 'card' ? 'cc-name' : 'username',
        fullname: 'name', email: 'email', recoveryemail: 'email', phone: 'tel',
        addressline1: 'address-line1', addressline2: 'address-line2', city: 'address-level2',
        region: 'address-level1', postalcode: 'postal-code', country: 'country-name',
        cardnumber: 'cc-number', expiry: 'cc-exp', cvv: 'cc-csc', dateofbirth: 'bday',
        organization: 'organization', username: 'username', password: 'current-password',
    };
    return exact[key] || 'off';
}

const CARD_FONT = 'Inter, Arial, Helvetica, sans-serif';

/** Two interlocking circles with their overlap, as in the Mastercard and Maestro marks. */
function CircleMark({ left, right, overlap }: { left: string; right: string; overlap: string }) {
    return (
        <>
            <circle cx="19.5" cy="15" r="9" fill={left} />
            <circle cx="28.5" cy="15" r="9" fill={right} />
            <path d="M24 7.21A9 9 0 0 1 24 22.79A9 9 0 0 1 24 7.21Z" fill={overlap} />
        </>
    );
}

/** Each network's mark in its own colours, drawn so it stays sharp from the list row to the detail page. */
function CardBrandArt({ brand }: { brand: CardBrand }) {
    switch (brand) {
        case 'visa':
            return <text x="24" y="20.4" textAnchor="middle" fontFamily={CARD_FONT} fontSize="15" fontStyle="italic" fontWeight="900" letterSpacing="-0.6" fill="#1434CB">VISA</text>;
        case 'mastercard':
            return <CircleMark left="#EB001B" right="#F79E1B" overlap="#FF5F00" />;
        case 'maestro':
            return <CircleMark left="#EB001B" right="#00A2E5" overlap="#7375CF" />;
        case 'amex':
            return <text x="24" y="19.2" textAnchor="middle" fontFamily={CARD_FONT} fontSize="11" fontWeight="900" letterSpacing="-0.2" fill="#FFFFFF">AMEX</text>;
        case 'discover':
            return (
                <text x="24" y="17.6" textAnchor="middle" fontFamily={CARD_FONT} fontSize="7.4" fontWeight="800" letterSpacing="-0.2" fill="#231F20">
                    DISC<tspan fill="#FF6000">O</tspan>VER
                </text>
            );
        case 'jcb':
            return (
                <>
                    {([['#0E4C96', 'J'], ['#E21836', 'C'], ['#007B40', 'B']] as const).map(([fill, letter], i) => (
                        <g key={letter}>
                            <rect x={9.5 + i * 10} y="6" width="9" height="18" rx="3" fill={fill} />
                            <text x={14 + i * 10} y="18" textAnchor="middle" fontFamily={CARD_FONT} fontSize="8" fontWeight="800" fill="#FFFFFF">{letter}</text>
                        </g>
                    ))}
                </>
            );
        case 'diners':
            return (
                <>
                    <circle cx="24" cy="15" r="9.5" fill="#0079BE" />
                    <ellipse cx="24" cy="15" rx="6" ry="7" fill="#FFFFFF" />
                    <rect x="23.1" y="7.6" width="1.8" height="14.8" fill="#0079BE" />
                </>
            );
        case 'unionpay':
            return (
                <g transform="skewX(-12) translate(3 0)">
                    <rect x="10" y="6" width="10" height="18" rx="2.5" fill="#E21836" />
                    <rect x="19" y="6" width="10" height="18" rx="2.5" fill="#00447C" />
                    <rect x="28" y="6" width="10" height="18" rx="2.5" fill="#007B84" />
                </g>
            );
        default:
            return <text x="24" y="18.4" textAnchor="middle" fontFamily={CARD_FONT} fontSize="8.5" fontWeight="800" letterSpacing="0.4" fill="currentColor">CARD</text>;
    }
}

function CardBrandMark({ number, compact = false }: { number?: string; compact?: boolean }) {
    const brand = detectCardBrand(number || '');
    const label = CARD_BRAND_LABELS[brand];
    return (
        <span className={`vault-card-brand is-${brand}${compact ? ' is-compact' : ''}`} title={label} aria-label={label}>
            <svg viewBox="0 0 48 30" className="vault-card-brand-art" aria-hidden="true">
                <CardBrandArt brand={brand} />
            </svg>
        </span>
    );
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

/**
 * FocuzPass's own solid sidebar icons: filled shapes with details cut out (masks, so the cut-outs
 * show whatever is behind them), drawn on a 20px grid. Solid reads friendlier than thin outlines.
 */
function SolidIcon({ size = 20, tone, children, mask }: { size?: number; tone?: string; children: ReactNode; mask?: ReactNode }) {
    const id = useId().replace(/:/g, '');
    return (
        <span className={`fp-flat-glyph fp-solid-icon${tone ? ` tone-${tone}` : ''}`} style={{ width: size, height: size }} aria-hidden="true">
            <svg viewBox="0 0 20 20" width="84%" height="84%">
                {mask && (
                    <defs>
                        <mask id={`m${id}`}>
                            <rect width="20" height="20" fill="#fff" />
                            <g fill="#000">{mask}</g>
                        </mask>
                    </defs>
                )}
                <g fill="currentColor" mask={mask ? `url(#m${id})` : undefined}>{children}</g>
            </svg>
        </span>
    );
}

function ExactAllItemsIcon({ size = 20 }: { size?: number }) {
    return (
        <SolidIcon size={size}>
            <rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.9" />
            <rect x="11" y="2.5" width="6.5" height="6.5" rx="1.9" opacity="0.5" />
            <rect x="2.5" y="11" width="6.5" height="6.5" rx="1.9" opacity="0.5" />
            <rect x="11" y="11" width="6.5" height="6.5" rx="1.9" />
        </SolidIcon>
    );
}

/** Pull a collection colour toward the text ramp so it sits calmly in the flat UI. */
/** The colour as chosen: blending it toward grey turned a picked red into pink. Presets are already soft. */
function softTone(color?: string) {
    return color || undefined;
}

/** A tag: a small tag shape in its colour (a bare dot read like a status light). */
function TagDot({ size = 20, color }: { size?: number; color?: string }) {
    const shape = Math.max(10, Math.round(size * 0.72));
    return (
        <span className="fp-flat-glyph" style={{ width: size, height: size }} aria-hidden="true">
            <svg className="fp-tag-shape" width={shape} height={shape} viewBox="0 0 16 16">
                <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h4.38a1.5 1.5 0 0 1 1.06.44l4.62 4.62a1.5 1.5 0 0 1 0 2.12l-4.38 4.38a1.5 1.5 0 0 1-2.12 0L2.44 8.94A1.5 1.5 0 0 1 2 7.88V3.5Z" fill={softTone(color) ?? 'var(--fz-text-3)'} />
                <circle cx="5.25" cy="5.25" r="1.15" style={{ fill: 'var(--fp-tag-hole, rgb(0 0 0 / 0.35))' }} />
            </svg>
        </span>
    );
}

function ExactTagIcon({ size = 20, color }: { size?: number; color?: string }) {
    return <TagDot size={size} color={color} />;
}

function ExactFavoritesIcon({ size = 20 }: { size?: number }) {
    return (
        <SolidIcon size={size} tone="favorite">
            <path d="M10 2.3c.4 0 .75.23.92.6l1.8 3.82 4.16.55c.83.11 1.17 1.13.56 1.71l-3.05 2.9.78 4.13c.16.82-.71 1.46-1.45 1.06L10 15.06l-3.72 2c-.74.4-1.6-.23-1.45-1.05l.78-4.14-3.05-2.9c-.6-.58-.27-1.6.56-1.7l4.16-.56 1.8-3.82c.17-.37.53-.6.92-.6Z" />
        </SolidIcon>
    );
}

/** A vault: its icon in its own colour, duotone like the rest of the sidebar (no tile behind it). */
function VaultChip({ color, icon: Icon, size = 20 }: { color: string; icon: typeof KeyRound; size?: number }) {
    return (
        <span className="fp-flat-glyph is-duotone fp-vault-glyph" style={{ width: size, height: size, color }} aria-hidden="true">
            <Icon strokeWidth={1.75} fill="currentColor" fillOpacity={0.28} />
        </span>
    );
}

/** The default vault mark: a solid safe with a keyhole, in the vault's colour. */
function ExactVaultIcon({ color, size = 20 }: { color: string; size?: number }) {
    return (
        <span style={{ color, display: 'inline-flex' }}>
            <SolidIcon size={size} mask={<><circle cx="10" cy="9.3" r="2" /><rect x="9.15" y="9.6" width="1.7" height="4" rx="0.85" /></>}>
                <rect x="2.6" y="3" width="14.8" height="14" rx="3.4" />
            </SolidIcon>
        </span>
    );
}

function ExactArchiveIcon({ size = 20 }: { size?: number }) {
    return (
        <SolidIcon size={size} tone="archive" mask={<rect x="7.6" y="9.4" width="4.8" height="1.8" rx="0.9" />}>
            <rect x="2" y="3" width="16" height="4.4" rx="1.6" />
            <path d="M3.3 8.6h13.4v6.2a2.4 2.4 0 0 1-2.4 2.4H5.7a2.4 2.4 0 0 1-2.4-2.4V8.6Z" />
        </SolidIcon>
    );
}

function ExactRecentlyDeletedIcon({ size = 20 }: { size?: number }) {
    return (
        <SolidIcon size={size} tone="deleted" mask={<><rect x="7.4" y="8.4" width="1.5" height="6" rx="0.75" /><rect x="11.1" y="8.4" width="1.5" height="6" rx="0.75" /></>}>
            <rect x="7.3" y="2.2" width="5.4" height="2.4" rx="1.1" />
            <rect x="2.6" y="4" width="14.8" height="2.4" rx="1.2" />
            <path d="M4.2 7.2h11.6l-.75 8.6a2 2 0 0 1-2 1.8H6.95a2 2 0 0 1-2-1.8L4.2 7.2Z" />
        </SolidIcon>
    );
}

function VaultProfileAvatar({ avatarUrl, fallbackUrl, name }: { avatarUrl?: string | null; fallbackUrl?: string | null; name: string }) {
    const [failedSources, setFailedSources] = useState<string[]>([]);
    const sources = [avatarUrl, fallbackUrl].filter((source, index, all): source is string => Boolean(source) && all.indexOf(source) === index);
    const source = sources.find((candidate) => !failedSources.includes(candidate));
    const initial = (name.trim().charAt(0) || 'F').toUpperCase();
    return (
        <span className="vault-profile-avatar">
            {source ? (
                <img src={source} alt="" referrerPolicy="no-referrer" onError={() => setFailedSources((current) => current.includes(source) ? current : [...current, source])} />
            ) : (
                <span className="vault-profile-avatar-fallback" aria-hidden="true">{initial}</span>
            )}
        </span>
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

/**
 * The site's own icon for a login, fetched by the extension once the element is on screen.
 * Null until it arrives, or when the site has none (the lettermark stays).
 */
function useSiteIcon(domain: string | undefined, ref: RefObject<HTMLElement | null>): SiteIcon | null {
    const [loaded, setLoaded] = useState<{ domain: string; icon: SiteIcon | null } | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!domain || !el) return;
        let alive = true;
        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                observer.disconnect();
                void focuzPassSiteIcon(domain).then((icon) => alive && setLoaded({ domain, icon }));
            },
            { rootMargin: '200px' },
        );
        observer.observe(el);
        return () => {
            alive = false;
            observer.disconnect();
        };
    }, [domain, ref]);
    return domain && loaded?.domain === domain ? loaded.icon : null;
}

function SiteIconImage({ icon }: { icon: SiteIcon }) {
    return (
        <img
            src={icon.src}
            alt=""
            className={icon.bleed ? 'vault-site-icon is-bleed' : 'vault-site-icon'}
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
    );
}

/** The new-item editor's mark: the site's icon once a website is typed in, else the type icon. */
function EditorSiteMark({ domain, children }: { domain: string; children: ReactNode }) {
    const [settled, setSettled] = useState(domain.trim());
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const t = window.setTimeout(() => setSettled(domain.trim()), 600);
        return () => window.clearTimeout(t);
    }, [domain]);
    const icon = useSiteIcon(/\.[a-z]{2,}/i.test(settled) ? settled : undefined, ref);
    return (
        <span ref={ref} className={`vault-editor-site-mark${icon ? ' has-favicon' : ''}`}>
            {icon ? <SiteIconImage icon={icon} /> : children}
        </span>
    );
}

/**
 * Focus on mount without scrolling. The item panel slides in from off-screen, and plain autoFocus
 * made the browser scroll the list sideways to reach it: every row jumped left and back.
 */
function focusWithoutScroll(element: HTMLElement | null) {
    element?.focus({ preventScroll: true });
}

function ItemMark({ item, large = false }: { item: VaultItem; large?: boolean }) {
    const markRef = useRef<HTMLSpanElement>(null);
    // A plain "Password" item is a site login too: its site's icon, or a letter tile, not a generic glyph.
    const siteLike = item.type === 'login' || item.type === 'passkey' || (item.type === 'custom' && item.kind === 'password');
    const favicon = useSiteIcon(siteLike ? item.domain : undefined, markRef);
    const definition = itemDefinition(item);
    const tone = item.markTone === '#e5e5e5' ? definition.tone : item.markTone;
    const typeIconKind = item.type === 'custom' && item.kind && item.kind !== 'password' ? item.kind : null;
    const isCard = item.type === 'card';
    return (
        <span
            ref={markRef}
            className={`vault-item-mark${typeIconKind || isCard ? ' is-type-icon' : ''}${isCard ? ' is-card-brand' : ''}${favicon ? ' has-favicon' : ''} relative ${large ? 'h-[60px] w-[60px] rounded-lg text-lg' : 'h-8 w-8 rounded-lg text-[11px]'} flex shrink-0 items-center justify-center overflow-hidden border font-bold tracking-[-0.03em]`}
            style={typeIconKind || isCard || favicon ? ({ '--item-tone': tone } as CSSProperties) : ({ '--tile-h': tileHue(item.title) } as CSSProperties)}
            data-letter-tile={typeIconKind || isCard || favicon ? undefined : ''}
            aria-hidden="true"
        >
            {isCard ? <CardBrandMark number={item.cardNumber} compact={!large} /> : typeIconKind ? <SoftItemTypeIcon kind={typeIconKind} size={large ? 60 : 32} /> : item.mark}
            {favicon && <SiteIconImage icon={favicon} />}
        </span>
    );
}

function SortableVaultRow({ item, vaultName, selected, draggable, onSelect, onContextMenu, onMore }: {
    item: VaultItem;
    vaultName: string;
    selected: boolean;
    draggable: boolean;
    onSelect: () => void;
    onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
    onMore: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !draggable });
    const typeLabel = item.type === 'custom' && item.kind ? ITEM_DEFINITIONS[item.kind].label : TYPE_META[item.type].label;
    return (
        <div
            ref={setNodeRef}
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                }
            }}
            onContextMenu={onContextMenu}
            className={`vault-row${selected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}${draggable ? ' is-draggable' : ''}`}
            style={{ transform: DndCss.Transform.toString(transform), transition }}
        >
            {draggable ? (
                <span
                    className="vault-row-drag"
                    {...attributes}
                    {...listeners}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => {
                        event.stopPropagation();
                        listeners?.onPointerDown?.(event);
                    }}
                    aria-label={`Drag ${item.title} to reorder`}
                    title="Drag to reorder"
                >
                    <GripVertical size={16} />
                </span>
            ) : <span className="vault-row-drag is-placeholder" aria-hidden="true" />}
            <ItemMark item={item} />
            <span className="vault-row-copy">
                <strong>{item.title}</strong>
                <small>{item.authMethod === 'Password' || (item.type === 'passkey' && item.identity) ? item.identity : item.authMethod}</small>
            </span>
            <span className="vault-row-type">{typeLabel}</span>
            <span className="vault-row-vault">{vaultName}</span>
            <span className="vault-row-activity">{item.lastUsed}</span>
            <button type="button" className="vault-row-more" onPointerDown={(event) => event.stopPropagation()} onClick={onMore} aria-label={`More actions for ${item.title}`}><EllipsisVertical size={15} /></button>
        </div>
    );
}

/** §6.2: context menu built on the shared Menu primitive (pointer or anchored). */
function VaultCommandMenu({ item, vaults, anchor, point, onAction, onMove, onDelete, onClose }: {
    item: VaultItem;
    vaults: VaultCollection[];
    anchor?: React.RefObject<HTMLElement | null>;
    point?: { x: number; y: number };
    onAction: (action: 'favorite' | 'archive' | 'unarchive' | 'restore' | 'purge' | 'duplicate', value?: boolean) => void;
    onMove: (vaultId: string) => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    const currentVault = vaults.find((vault) => vault.id === item.vaultId);
    const otherVaults = vaults.filter((vault) => vault.id !== item.vaultId);
    const descriptor = item.domain || (item.type === 'custom' && item.kind ? ITEM_DEFINITIONS[item.kind].label : TYPE_META[item.type].label);
    const items: MenuItem[] = item.deletedAt
        ? [
              { id: 'restore', label: 'Restore item', icon: <ArchiveRestore size={14} />, onSelect: () => onAction('restore') },
              { id: 'purge', label: 'Delete permanently', icon: <Trash2 size={14} />, danger: true, onSelect: () => onAction('purge') },
          ]
        : [
              {
                  type: 'custom',
                  id: 'identity',
                  node: (
                      <div className="vault-command-menu__identity">
                          <ItemMark item={item} />
                          <span><strong>{item.title}</strong><small>{descriptor}</small></span>
                          <ShieldCheck size={14} aria-label="Private item" style={{ color: currentVault?.color || item.markTone }} />
                      </div>
                  ),
              },
              { id: 'favorite', label: item.favorite ? 'Remove from Favorites' : 'Add to Favorites', icon: <ExactFavoritesIcon size={14} />, onSelect: () => onAction('favorite', !item.favorite) },
              { id: 'duplicate', label: 'Duplicate', icon: <CopyPlus size={14} />, onSelect: () => onAction('duplicate') },
              ...(otherVaults.length
                  ? [{
                        id: 'move',
                        label: 'Move to vault',
                        icon: <FolderInput size={14} />,
                        submenu: otherVaults.map((vault) => ({
                            id: vault.id,
                            label: vault.name,
                            icon: <CollectionMark color={vault.color} icon={vault.icon} size={14} />,
                            onSelect: () => onMove(vault.id),
                        })),
                    } satisfies MenuItem]
                  : []),
              { type: 'separator', id: 'lifecycle' },
              { id: 'archive', label: item.archivedAt ? 'Restore from archive' : 'Archive', icon: <ExactArchiveIcon size={14} />, onSelect: () => onAction(item.archivedAt ? 'unarchive' : 'archive') },
              { id: 'delete', label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: onDelete },
          ];
    return <Menu open onClose={onClose} anchor={anchor} point={point} items={items} minWidth={220} />;
}

function monthLabel(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'RECENT';
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function FocuzPassAccessLockIcon() {
    return <Lock className="vault-access-lock-icon is-flat" strokeWidth={1.75} role="img" aria-label="Locked vault" />;
}

function VaultEmptyIllustration() {
    return (
        <div className="vault-empty-canvas" aria-label="No vault item selected">
            <span className="fp-empty-glyph" aria-hidden="true">
                <KeyRound strokeWidth={1.75} />
            </span>
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
            <p className="mb-1 text-label text-neutral-500">{label}</p>
            <div className="flex min-h-6 items-center gap-2">
                <p className={`min-w-0 flex-1 truncate text-xs text-neutral-300 ${secret && !reveal ? 'tracking-[0.12em]' : ''}`}>
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
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(event) => event.target === event.currentTarget && onClose()}
            >
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="vault-modal-title"
                    className="vault-modal w-full max-w-[520px] overflow-hidden rounded-lg border border-white/8 bg-surface shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.99 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                >
                    <form onSubmit={submit}>
                        <div className="flex items-start justify-between border-b border-white/8 px-6 py-5">
                            <div>
                                <p className="mb-1 text-[11px] font-[460] text-neutral-500">FocuzPass</p>
                                <h2 id="vault-modal-title" className="text-xl font-semibold tracking-[-0.025em] text-white">
                                    {mode === 'add' ? 'Add to your vault' : `Edit ${item?.title}`}
                                </h2>
                            </div>
                            <button type="button" onClick={onClose} className="vault-icon-button h-8 w-8" aria-label="Close">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 scrollbar-hide">
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/4 p-1" role="radiogroup" aria-label="Item type">
                                {(Object.keys(TYPE_META) as VaultItemType[]).map((value) => {
                                    const Icon = TYPE_META[value].icon;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            role="radio"
                                            aria-checked={type === value}
                                            onClick={() => setType(value)}
                                            className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors ${type === value ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                                        >
                                            <Icon size={13} />
                                            {TYPE_META[value].label}
                                        </button>
                                    );
                                })}
                            </div>

                            {type === 'passkey' && (
                                <p className="rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-[11px] leading-5 text-neutral-400">
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
                                            <button type="button" onClick={() => setPassword(randomPassword())} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-neutral-500 hover:bg-white/6 hover:text-neutral-200" aria-label="Generate password">
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

                        <div className="flex items-center justify-end gap-2 border-t border-white/8 px-6 py-4">
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
const COLLECTION_GLYPHS: Record<string, typeof KeyRound> = { home: Home, work: Briefcase, star: Star, tag: Tag };

function FocusCollectionGlyph({ color, icon, size }: { color: string; icon: string; size: number }) {
    if (icon === 'vault') return <ExactVaultIcon color={color} size={size} />;
    if (icon === 'tag') return <TagDot size={size} color={color} />;
    return <VaultChip color={color} icon={COLLECTION_GLYPHS[icon] ?? collectionIcon(icon) ?? Tag} size={size} />;
}

/** The icon choices: the default mark, then a searchable, grouped set (rendered only while the dialog is open). */
function CollectionIconPicker({ mode, color, value, onChange }: { mode: 'vault' | 'tag'; color: string; value: string; onChange: (id: string) => void }) {
    const [query, setQuery] = useState('');
    const results = query.trim() ? searchCollectionIcons(query) : null;
    const button = (id: string, label: string) => (
        <button key={id} type="button" className={value === id ? 'is-selected' : ''} onClick={() => onChange(id)} aria-label={`Use ${label} icon`} aria-pressed={value === id} title={label}>
            <FocusCollectionGlyph color={color} icon={id} size={18} />
        </button>
    );
    return (
        <div className="vault-icon-picker">
            <label className="vault-icon-search"><Search size={13} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search icons" aria-label="Search icons" /></label>
            <div className="vault-icon-scroll">
                {results ? (
                    results.length ? <div className="vault-icon-grid">{results.map((entry) => button(entry.id, entry.id))}</div> : <p className="vault-icon-empty">No icons match “{query.trim()}”</p>
                ) : (
                    <>
                        <div className="vault-icon-grid">{button(mode, mode === 'vault' ? 'vault' : 'tag dot')}</div>
                        {COLLECTION_ICON_GROUPS.map((group) => (
                            <section key={group.label}>
                                <p className="vault-icon-group">{group.label}</p>
                                <div className="vault-icon-grid">{group.icons.map((entry) => button(entry.id, entry.id))}</div>
                            </section>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

function CollectionMark({ color, icon, size = 14 }: { color: string; icon: string; size?: number }) {
    return (
        <span className={`vault-collection-mark${icon === 'vault' ? ' is-vault' : ''}`} style={{ color: softTone(color) }}>
            <FocusCollectionGlyph color={color} icon={icon} size={size} />
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
    const create = () => {
        if (name.trim() && !busy) onCreate({ name: name.trim(), color, icon });
    };
    return (
        <Dialog
            open
            onClose={onClose}
            size="sm"
            title={`New ${mode}`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={create} disabled={busy || !name.trim()} iconLeft={<Plus size={14} />}>Create {mode}</Button>
                </>
            }
        >
            <form onSubmit={(event) => { event.preventDefault(); create(); }} className="vault-collection-form space-y-4">
                <div className="vault-collection-preview"><CollectionMark color={color} icon={icon} size={20} /><span>{name || (mode === 'vault' ? 'Vault name' : 'Tag name')}</span></div>
                <label className="vault-field"><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={mode === 'vault' ? 'Family, Work, Personal…' : 'Starter kit, Finance…'} /></label>
                <div className="vault-choice-group"><span>Color</span><ColorPicker value={color} presets={COLLECTION_COLORS} onChange={setColor} /></div>
                <div className="vault-choice-group"><span>Icon</span><CollectionIconPicker mode={mode} color={color} value={icon} onChange={setIcon} /></div>
            </form>
        </Dialog>
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
    // §6.2: arrow keys move through the tile grid.
    const gridKeyDown = (event: React.KeyboardEvent) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
        const tiles = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button[data-tile]'));
        if (!tiles.length) return;
        const index = tiles.indexOf(document.activeElement as HTMLButtonElement);
        const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? 3 : -3;
        const next = tiles[Math.max(0, Math.min(tiles.length - 1, index + delta))] || tiles[0];
        event.preventDefault();
        next?.focus();
    };
    return (
        <Dialog open onClose={onClose} size="md" title="What would you like to add?">
            <div onKeyDown={gridKeyDown}>
                <label className="vault-picker-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try searching anything" autoFocus /></label>
                {!normalized && <div className="vault-primary-types">
                    {topItems.map(([kind, definition]) => (
                        <button key={kind} type="button" data-tile onClick={() => onSelect(kind)}>
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
                                <button key={kind} type="button" data-tile onClick={() => onSelect(kind)}>
                                    <SoftItemTypeIcon kind={kind} size={31} />
                                    {definition.label}
                                </button>
                            ))}
                            {normalized && lowerItems.length === 0 && <p className="vault-picker-empty">No matching item type</p>}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Dialog>
    );
}

const PHONE_FLAGS: Record<string, typeof FlagUS> = {
    AE: FlagAE, AR: FlagAR, AT: FlagAT, AU: FlagAU, BD: FlagBD, BE: FlagBE, BR: FlagBR,
    CA: FlagCA, CH: FlagCH, CN: FlagCN, CZ: FlagCZ, DE: FlagDE, DK: FlagDK, ES: FlagES,
    FI: FlagFI, FR: FlagFR, GB: FlagGB, GH: FlagGH, GR: FlagGR, HU: FlagHU, ID: FlagID,
    IE: FlagIE, IL: FlagIL, IN: FlagIN, IT: FlagIT, JP: FlagJP, KE: FlagKE, KR: FlagKR,
    MX: FlagMX, MY: FlagMY, NG: FlagNG, NL: FlagNL, NO: FlagNO, NZ: FlagNZ, PH: FlagPH,
    PK: FlagPK, PL: FlagPL, PT: FlagPT, RO: FlagRO, SA: FlagSA, SE: FlagSE, SG: FlagSG,
    TH: FlagTH, TR: FlagTR, UA: FlagUA, US: FlagUS, VN: FlagVN, ZA: FlagZA,
};

function CountryFlagIcon({ iso }: { iso: string }) {
    const Flag = PHONE_FLAGS[iso] || FlagUS;
    return <span className="vault-country-flag"><Flag role="img" aria-label={`${iso} flag`} /></span>;
}

function InternationalPhoneInput({ value, onChange, onBlur, invalid }: {
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    invalid?: boolean;
}) {
    const [country, setCountry] = useState<PhoneCountry>(() => phoneCountryFromValue(value));
    const [open, setOpen] = useState(false);
    const fieldRef = useRef<HTMLDivElement>(null);
    const selectCountry = (next: PhoneCountry) => {
        const localDigits = phoneLocalDigits(value, country);
        setCountry(next);
        onChange(formatInternationalPhone(localDigits, next));
        setOpen(false);
    };
    return (
        <div ref={fieldRef} className="vault-phone-input" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setOpen(false);
                onBlur();
            }
        }}>
            <button type="button" className="vault-phone-country" onClick={() => setOpen((current) => !current)} aria-label={`Choose phone country, currently ${country.name}`} aria-expanded={open}>
                <CountryFlagIcon iso={country.iso} /><small>{country.dialCode}</small><ChevronDown size={10} />
            </button>
            <input
                type="tel"
                inputMode="tel"
                value={formatPhoneLocal(value, country)}
                onChange={(event) => onChange(formatInternationalPhone(event.target.value, country))}
                placeholder={country.style === 'nanp' ? '(555) 000-0000' : 'Phone number'}
                autoComplete="tel-national"
                aria-invalid={invalid}
            />
            <FloatingPanel anchor={fieldRef} open={open} onClose={() => setOpen(false)} className="vault-floating-list" minWidth={300}>
                {PHONE_COUNTRIES.map((option) => (
                    <button key={option.iso} type="button" role="option" aria-selected={option.iso === country.iso} className={option.iso === country.iso ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => selectCountry(option)}>
                        <CountryFlagIcon iso={option.iso} /><span><strong>{option.name}</strong></span><small>{option.dialCode}</small>{option.iso === country.iso && <Check size={12} />}
                    </button>
                ))}
            </FloatingPanel>
        </div>
    );
}

/** An address already saved in another identity item, offered while typing a new one. */
type SavedAddress = { label: string; parts: Record<string, string> };

const ADDRESS_PART_KEYS = ['addressLine1', 'addressLine2', 'city', 'region', 'postalCode', 'country', 'countryCode'] as const;

/** Addresses from the vault's own identity items. Nothing typed here leaves this device. */
function savedAddressesFrom(items: VaultItem[], excludeId?: string): SavedAddress[] {
    const seen = new Set<string>();
    const out: SavedAddress[] = [];
    for (const item of items) {
        if (item.id === excludeId || item.type !== 'custom' || item.kind !== 'identity' || item.deletedAt) continue;
        const fields = item.fields || {};
        const label = (fields.address || [fields.addressLine1, fields.addressLine2, fields.city, fields.region, fields.postalCode, fields.country].filter(Boolean).join(', ')).trim();
        const key = label.toLowerCase();
        if (!label || seen.has(key)) continue;
        seen.add(key);
        const parts: Record<string, string> = {};
        for (const part of ADDRESS_PART_KEYS) parts[part] = fields[part] || '';
        out.push({ label, parts });
    }
    return out;
}

type AddressOption =
    | { kind: 'saved'; key: string; label: string; detail?: string; address: SavedAddress }
    | { kind: 'place'; key: string; label: string; detail?: string; place: PlaceSuggestion };

function AddressAutocompleteInput({ value, onChange, onBlur, invalid, saved = [] }: {
    value: string;
    onChange: (value: string, parts?: Record<string, string>) => void;
    onBlur: () => void;
    invalid?: boolean;
    saved?: SavedAddress[];
}) {
    const fieldRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
    // One Places session per typing session; a new one starts after an address is picked.
    const sessionRef = useRef('');
    const timerRef = useRef(0);
    const lookupRef = useRef<AbortController | null>(null);
    const typed = value.trim().toLowerCase();
    const savedMatches = saved
        .filter((address) => address.label.toLowerCase() !== typed && (!typed || address.label.toLowerCase().includes(typed)))
        .slice(0, 4);
    const options: AddressOption[] = [
        ...savedMatches.map((address) => ({ kind: 'saved' as const, key: `s:${address.label}`, label: address.label, address })),
        ...places
            .filter((place) => !savedMatches.some((address) => address.label.toLowerCase().startsWith(place.main.toLowerCase())))
            .map((place) => ({ kind: 'place' as const, key: `p:${place.placeId}`, label: place.main, detail: place.secondary, place })),
    ];
    const showing = open && options.length > 0;

    const lookUp = (text: string) => {
        window.clearTimeout(timerRef.current);
        lookupRef.current?.abort();
        if (text.trim().length < PLACES_MIN_CHARS) {
            setPlaces([]);
            return;
        }
        timerRef.current = window.setTimeout(() => {
            sessionRef.current ||= newPlacesSession();
            const controller = new AbortController();
            lookupRef.current = controller;
            void placesSuggest(text, sessionRef.current, controller.signal).then((found) => {
                if (!controller.signal.aborted) setPlaces(found);
            });
        }, 300);
    };
    useEffect(() => () => {
        window.clearTimeout(timerRef.current);
        lookupRef.current?.abort();
    }, []);

    const choose = async (option: AddressOption) => {
        setOpen(false);
        setPlaces([]);
        if (option.kind === 'saved') {
            onChange(option.address.label, option.address.parts);
            return;
        }
        const label = [option.place.main, option.place.secondary].filter(Boolean).join(', ');
        onChange(label);
        const token = sessionRef.current;
        sessionRef.current = '';
        const address = token ? await placesDetails(option.place.placeId, token) : null;
        if (!address) return;
        const { formatted, ...parts } = address;
        onChange(formatted || label, parts);
    };

    return (
        <div ref={fieldRef} className="vault-address-autocomplete">
            <MapPin size={14} />
            <input
                value={value}
                onChange={(event) => {
                    onChange(event.target.value);
                    setOpen(true);
                    setActive(0);
                    lookUp(event.target.value);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    setOpen(false);
                    onBlur();
                }}
                onKeyDown={(event) => {
                    if (!showing) return;
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        const step = event.key === 'ArrowDown' ? 1 : -1;
                        setActive((current) => (current + step + options.length) % options.length);
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        void choose(options[Math.min(active, options.length - 1)]!);
                    } else if (event.key === 'Escape') {
                        event.stopPropagation();
                        setOpen(false);
                    }
                }}
                name="street-address"
                placeholder="Start typing an address…"
                autoComplete="street-address"
                autoCapitalize="words"
                spellCheck={false}
                role="combobox"
                aria-expanded={showing}
                aria-autocomplete="list"
                aria-invalid={invalid}
            />
            <FloatingPanel anchor={fieldRef} open={showing} onClose={() => setOpen(false)} className="vault-floating-list" minWidth={320}>
                {options.map((option, index) => (
                    <Fragment key={option.key}>
                        {(index === 0 || options[index - 1]!.kind !== option.kind) && (
                            <p className="vault-floating-heading">{option.kind === 'saved' ? 'Saved addresses' : 'Suggestions'}</p>
                        )}
                        <button
                            type="button"
                            role="option"
                            aria-selected={index === active}
                            className={index === active ? 'is-active' : ''}
                            // Keep focus in the field so picking doesn't blur it first.
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => void choose(option)}
                        >
                            <MapPin size={13} />
                            <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>
                        </button>
                    </Fragment>
                ))}
                {options.some((option) => option.kind === 'place') && <p className="vault-floating-credit">Address suggestions by Google</p>}
            </FloatingPanel>
        </div>
    );
}

function valuesForItem(item: VaultItem | undefined, kind: EditableItemKind) {
    if (!item) return {} as Record<string, string>;
    if (kind === 'login') return { identity: item.identity, password: item.password || '', domain: item.domain || '' };
    if (kind === 'card') return { identity: item.identity, cardNumber: item.cardNumber || '', expiry: item.expiry || '', cvv: item.cvv || '' };
    const fields = { ...(item.fields || {}) };
    if (kind === 'identity' && !fields.address) {
        fields.address = [fields.addressLine1, fields.addressLine2, fields.city, fields.region, fields.postalCode, fields.country].filter(Boolean).join(', ');
    }
    return fields;
}

function ItemEditorModal({ kind, item, vaults, tags, defaultVaultId, savedAddresses, onClose, onSave, onCreateTag, busy }: {
    kind: EditableItemKind;
    item?: VaultItem;
    savedAddresses?: SavedAddress[];
    vaults: VaultCollection[];
    tags: VaultTag[];
    defaultVaultId?: string;
    onClose: () => void;
    onSave: (draft: ItemDraft) => Promise<void>;
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
    const [saving, setSaving] = useState(false);
    const [tagBusy, setTagBusy] = useState(false);
    const [localError, setLocalError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));
    const availableTags = tags.filter((tag) => !tagIds.includes(tag.id));
    const setValue = (field: FieldDefinition, value: string) => {
        const formatted = formatFieldValue(fieldFormat(kind, field), value);
        setValues((current) => ({ ...current, [field.key]: formatted }));
        setFieldErrors((current) => {
            if (!current[field.key]) return current;
            const next = { ...current };
            delete next[field.key];
            return next;
        });
    };
    const setAddressValue = (value: string, parts?: Record<string, string>) => {
        setValues((current) => parts
            ? { ...current, ...parts, address: value }
            : { ...current, address: value, addressLine1: '', city: '', region: '', postalCode: '', country: '', countryCode: '' });
        setFieldErrors((current) => {
            if (!current.address) return current;
            const next = { ...current };
            delete next.address;
            return next;
        });
    };
    const validateField = (field: FieldDefinition, value = values[field.key] || '') => {
        const message = validateFieldValue(fieldFormat(kind, field), value, {
            required: fieldRequired(kind, field),
            cardNumber: values.cardNumber,
        });
        setFieldErrors((current) => {
            const next = { ...current };
            if (message) next[field.key] = message;
            else delete next[field.key];
            return next;
        });
        return message;
    };
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (saving) return;
        const nextErrors: Record<string, string> = {};
        if (!title.trim()) nextErrors.title = 'Give this item a name.';
        for (const field of definition.fields) {
            const message = validateFieldValue(fieldFormat(kind, field), values[field.key] || '', {
                required: fieldRequired(kind, field),
                cardNumber: values.cardNumber,
            });
            if (message) nextErrors[field.key] = message;
        }
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors);
            setLocalError('Fix the highlighted fields before saving.');
            return;
        }
        setSaving(true);
        setLocalError('');
        try {
            await onSave({
                id: item?.id,
                kind,
                title: title.trim(),
                identity: kind === 'login' || kind === 'card' ? (values.identity || '').trim() : (values[definition.fields[0]?.key || ''] || '').trim(),
                domain: kind === 'login' ? values.domain?.trim() : undefined,
                password: kind === 'login' ? values.password : undefined,
                cardNumber: kind === 'card' ? digitsOnly(values.cardNumber || '') : undefined,
                expiry: kind === 'card' ? values.expiry : undefined,
                cvv: kind === 'card' ? values.cvv : undefined,
                fields: kind === 'login' || kind === 'card' ? undefined : values,
                note: note.trim() || undefined,
                vaultId,
                tagIds,
                markTone: item?.markTone || definition.tone,
            });
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'Could not save this item.');
        } finally {
            setSaving(false);
        }
    };
    const createTag = async (value: { name: string; color: string; icon: string }) => {
        if (tagBusy) return;
        setTagBusy(true);
        setLocalError('');
        try {
            const tag = await onCreateTag(value);
            setTagIds((current) => current.includes(tag.id) ? current : [...current, tag.id]);
            setTagModalOpen(false);
        } catch (err) {
            setLocalError(err instanceof Error ? err.message : 'Could not create this tag.');
        } finally {
            setTagBusy(false);
        }
    };
    return (
        <Dialog
            open
            onClose={onClose}
            size="lg"
            title={item ? `Edit ${item.title}` : `New ${definition.label.toLowerCase()}`}
            description={item ? 'Editing' : 'Creating'}
            footer={
                <>
                    <span className={`mr-auto text-meta ${localError ? 'text-[var(--fz-danger)]' : 'text-[var(--fz-text-4)]'}`}>
                        {localError || 'Changes stay on this device'}
                    </span>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" form="fz-vault-editor-form" loading={saving || busy} iconLeft={<ShieldCheck size={14} />}>
                        {saving ? 'Saving…' : 'Save item'}
                    </Button>
                </>
            }
        >
            <div className="vault-editor-modal-inner">
                    <form id="fz-vault-editor-form" onSubmit={submit} noValidate>
                        <div className="vault-editor-scroll">
                            <div className="vault-editor-identity">
                                {kind === 'card' ? (
                                    <CardBrandMark number={values.cardNumber} />
                                ) : kind === 'login' ? (
                                    <EditorSiteMark domain={values.domain || ''}><SoftItemTypeIcon kind={kind} size={58} /></EditorSiteMark>
                                ) : (
                                    <SoftItemTypeIcon kind={kind} size={58} />
                                )}
                                <label className={fieldErrors.title ? 'has-error' : ''}><span>Item name</span><input value={title} onChange={(event) => { setTitle(event.target.value); setFieldErrors((current) => { const next = { ...current }; delete next.title; return next; }); }} placeholder={definition.label} autoFocus />{fieldErrors.title && <small>{fieldErrors.title}</small>}</label>
                            </div>
                            <section className="vault-editor-section">
                                <div className="vault-editor-section-heading"><div><strong>Item details</strong><small>Your information is encrypted locally</small></div><span>{definition.label}</span></div>
                                <div className="vault-editor-field-card">
                                    {definition.fields.map((field) => {
                                        const format = fieldFormat(kind, field);
                                        const isPhone = format === 'phone';
                                        const isAddress = kind === 'identity' && field.key === 'address';
                                        return (
                                        <label key={field.key} className={`vault-editor-field${fieldErrors[field.key] ? ' has-error' : ''}`}>
                                            <span>{field.label}</span>
                                            {field.type === 'textarea' ? (
                                                <textarea value={values[field.key] || ''} onChange={(event) => setValue(field, event.target.value)} onBlur={() => validateField(field)} placeholder={field.placeholder} rows={field.key === 'recoveryPhrase' || field.key.toLowerCase().includes('key') ? 4 : 2} />
                                            ) : isPhone ? (
                                                <InternationalPhoneInput value={values[field.key] || ''} onChange={(value) => setValue(field, value)} onBlur={() => validateField(field)} invalid={Boolean(fieldErrors[field.key])} />
                                            ) : field.type === 'date' ? (
                                                <DatePicker value={values[field.key] || ''} onChange={(value) => { setValue(field, value); validateField(field, value); }} placeholder={field.placeholder} ariaLabel={field.label} />
                                            ) : isAddress ? (
                                                <AddressAutocompleteInput value={values.address || ''} onChange={setAddressValue} onBlur={() => validateField(field)} invalid={Boolean(fieldErrors[field.key])} saved={savedAddresses} />
                                            ) : (
                                                <div className="relative">
                                                    <input type={inputTypeForField(kind, field)} inputMode={inputModeForField(kind, field)} value={values[field.key] || ''} onChange={(event) => setValue(field, event.target.value)} onBlur={() => validateField(field)} placeholder={field.placeholder} autoComplete={autocompleteForField(kind, field)} aria-invalid={Boolean(fieldErrors[field.key])} />
                                                    {field.key === 'cardNumber' && <span className="vault-editor-card-brand"><CardBrandMark number={values.cardNumber} compact /></span>}
                                                    {field.key === 'password' && <button type="button" onClick={() => setValue(field, randomPassword())} aria-label="Generate password"><Sparkles size={14} /></button>}
                                                </div>
                                            )}
                                            {fieldErrors[field.key] && <small className="vault-editor-field-error">{fieldErrors[field.key]}</small>}
                                        </label>
                                    );})}
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
                    </form>
            </div>
            <AnimatePresence>{tagModalOpen && <CollectionModal mode="tag" busy={tagBusy} onClose={() => setTagModalOpen(false)} onCreate={(value) => { void createTag(value); }} />}</AnimatePresence>
        </Dialog>
    );
}

type CompanionReason = 'missing' | 'reload' | 'unresponsive';

const COMPANION_COPY: Record<CompanionReason, { eyebrow: string; title: string; body: string }> = {
    missing: {
        eyebrow: 'Extension required',
        title: 'Connect FocuzPass',
        body: 'Your vault is encrypted on this device inside the FocuzNow extension. Install it and this page connects on its own — the same vault opens here and in the extension.',
    },
    reload: {
        eyebrow: 'Extension updated',
        title: 'Reload to reconnect',
        body: 'FocuzNow was just updated or reloaded, so this tab lost its link to the extension. Reload the page and your vault opens here again.',
    },
    unresponsive: {
        eyebrow: 'Not responding',
        title: 'FocuzPass didn’t answer',
        body: 'The extension is installed but didn’t respond in time — it may still be starting up. Try again in a moment.',
    },
};

function companionReasonFor(err: unknown): CompanionReason {
    const message = err instanceof Error ? err.message : '';
    if (/context unavailable|reload the page|refresh this page/i.test(message)) return 'reload';
    return extensionPresent() ? 'unresponsive' : 'missing';
}

function CompanionScreen({ reason, onRetry }: { reason: CompanionReason; onRetry: () => Promise<void> }) {
    const reduceMotion = useReducedMotion();
    const [retrying, setRetrying] = useState(false);
    const copy = COMPANION_COPY[reason];
    const SymbolIcon = reason === 'reload' ? RotateCw : reason === 'unresponsive' ? Unplug : Laptop;

    const retry = useCallback(async () => {
        setRetrying(true);
        try {
            await onRetry();
        } finally {
            setRetrying(false);
        }
    }, [onRetry]);

    // Reconnect by itself the moment the extension's page bridge shows up
    // (it announces itself when installed or re-injected after a reload).
    useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.source === window && event.data?.type === 'FOCUZNOW_EXTENSION_READY') void retry();
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [retry]);

    const openExtension = () => {
        try {
            window.postMessage({ type: 'OPEN_EXTENSION_OPTIONS', tab: 'focuzpass' }, '*');
        } catch {
            /* ignore */
        }
    };

    const retryLabel = retrying ? 'Connecting…' : reason === 'unresponsive' ? 'Try again' : 'Retry connection';

    return (
        <section className="focuz-pass vault-companion-screen">
            <motion.div
                className="vault-companion-card"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div className="vault-companion-preview" aria-hidden="true">
                    <div className="vault-companion-preview-head"><span><ShieldCheck size={13} /> Local vault</span><i /></div>
                    <div className="vault-companion-preview-row"><SoftItemTypeIcon kind="login" size={34} /><span><strong>Saved login</strong><small>Ready to fill on this device</small></span><Check size={14} /></div>
                    <div className="vault-companion-preview-row"><CardBrandMark number="4111111111111111" /><span><strong>Payment card</strong><small>Protected card details</small></span><Lock size={14} /></div>
                    <div className="vault-companion-preview-row"><SoftItemTypeIcon kind="identity" size={34} /><span><strong>Identity & address</strong><small>One-click form filling</small></span><MapPin size={14} /></div>
                </div>
                <div className="vault-companion-symbol"><SymbolIcon size={22} /></div>
                <p className="vault-companion-eyebrow">{copy.eyebrow}</p>
                <h2>{copy.title}</h2>
                <p className="vault-companion-copy">{copy.body}</p>
                <div className="vault-companion-actions">
                    {reason === 'reload' ? (
                        <button type="button" className="vault-button vault-button-primary" onClick={() => window.location.reload()}>
                            <RotateCw size={14} />
                            Reload page
                        </button>
                    ) : reason === 'unresponsive' ? (
                        <button type="button" className="vault-button vault-button-primary" onClick={() => void retry()} disabled={retrying}>
                            {retryLabel}
                        </button>
                    ) : (
                        <a
                            href="https://chrome.google.com/webstore/detail/your-extension-id"
                            target="_blank"
                            rel="noreferrer"
                            className="vault-button vault-button-primary"
                        >
                            <Download size={14} />
                            Get the FocuzNow extension
                        </a>
                    )}
                    {reason === 'unresponsive' ? (
                        <button type="button" className="vault-button vault-button-secondary" onClick={openExtension}>
                            Open in extension
                            <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button type="button" className="vault-button vault-button-secondary" onClick={() => void retry()} disabled={retrying}>
                            {retryLabel}
                        </button>
                    )}
                </div>
                <p className="vault-companion-footnote">
                    <ShieldCheck size={11} /> Secrets never sync to FocuzNow cloud
                </p>
            </motion.div>
        </section>
    );
}

/** The locked screen in the web vault: the same card, with the Security Key and master password right here. */
function WebVaultUnlockCard({
    webVault,
    reduceMotion,
}: {
    webVault: { unlock: (input: { secretKey: string; masterPassword: string }) => Promise<void>; email?: string };
    reduceMotion: boolean | null;
}) {
    const [secretKey, setSecretKey] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await webVault.unlock({ secretKey, masterPassword });
            setMasterPassword('');
            setSecretKey('');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Your vault didn\'t open.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <section className="focuz-pass vault-access-screen">
            <motion.div className="vault-access-card" initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="vault-lock-orbit vault-access-symbol">
                    <FocuzPassAccessLockIcon />
                </div>
                <p className="vault-access-kicker">Web vault</p>
                <h2 className="vault-access-heading">Your vault is locked</h2>
                <p className="vault-access-copy">
                    {webVault.email ? <>Signed in as {webVault.email}. </> : null}
                    This browser doesn&apos;t have the FocuzNow extension, so FocuzPass opens here with your Security Key and master password.
                </p>
                <form className="vault-access-form" onSubmit={(event) => void submit(event)} data-focuzpass-ignore="">
                    <label className="vault-access-field">
                        <span>Security Key</span>
                        <input
                            value={secretKey}
                            onChange={(event) => { setSecretKey(event.target.value); setError(''); }}
                            placeholder="A1-XXXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                            autoComplete="off"
                            spellCheck={false}
                            autoFocus
                            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', letterSpacing: '0.03em' }}
                        />
                    </label>
                    <label className="vault-access-field">
                        <span>Master password</span>
                        <input type="password" value={masterPassword} onChange={(event) => { setMasterPassword(event.target.value); setError(''); }} autoComplete="current-password" placeholder="Your FocuzPass master password" />
                    </label>
                    {error && <p className="vault-access-error" role="alert">{error}</p>}
                    <button type="submit" disabled={busy || !secretKey || !masterPassword} className="vault-button vault-button-primary vault-access-submit">
                        {busy ? 'Opening your vault…' : 'Unlock'}
                        {!busy && <ArrowRight size={14} />}
                    </button>
                </form>
                <p className="vault-access-footnote"><Laptop size={13} /> Decrypted only in this tab. Locks after 5 minutes idle or when you close it.</p>
            </motion.div>
        </section>
    );
}

export default function FocuzPassTab({
    avatarUrl,
    avatarFallbackUrl,
    username = 'Username',
    accountName = 'FocuzNow Account',
    onExit,
    webVault,
}: {
    avatarUrl?: string | null;
    avatarFallbackUrl?: string | null;
    username?: string;
    accountName?: string;
    onExit?: () => void;
    /** The web vault (no extension): unlock here with the Security Key and master password. */
    webVault?: { unlock: (input: { secretKey: string; masterPassword: string }) => Promise<void>; email?: string };
}) {
    const reduceMotion = useReducedMotion();
    const [boot, setBoot] = useState<BootState>('loading');
    const [companionReason, setCompanionReason] = useState<CompanionReason>('missing');
    const [status, setStatus] = useState<VaultStatus | null>(null);
    const [items, setItems] = useState<VaultItem[]>([]);
    const [vaults, setVaults] = useState<VaultCollection[]>([]);
    const [tags, setTags] = useState<VaultTag[]>([]);
    const [view, setView] = useState<VaultView>({ kind: 'all' });
    const [typeFilters, setTypeFilters] = useState<VaultFilter[]>([]);
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState('');
    const [modal, setModal] = useState<'picker' | 'editor' | null>(null);
    const [editorKind, setEditorKind] = useState<EditableItemKind>('login');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [collectionModal, setCollectionModal] = useState<'vault' | 'tag' | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [cloudOpen, setCloudOpen] = useState(false);
    const [passkeysOpen, setPasskeysOpen] = useState(false);
    // One-time nudge for Pro users whose vault is only on this device (never an automatic move).
    const [cloudPrompt, setCloudPrompt] = useState(false);
    useEffect(() => {
        if (boot !== 'ready') return;
        let alive = true;
        void (async () => {
            try {
                const stored = await chrome.storage.local.get(['subscriptionTier', 'focuzpass.cloudPromptDismissed']);
                if (stored.subscriptionTier !== 'pro' || stored['focuzpass.cloudPromptDismissed']) return;
                const status = await focuzPassCloudStatus();
                if (alive && status && status.state !== 'on') setCloudPrompt(true);
            } catch {
                /* no nudge then */
            }
        })();
        return () => {
            alive = false;
        };
    }, [boot]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);
    const [sortMode, setSortMode] = useState<VaultSort>('custom');
    const [createdFilter, setCreatedFilter] = useState<CreatedFilter>('any');
    const [createdFrom, setCreatedFrom] = useState('');
    const [createdTo, setCreatedTo] = useState('');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [riskOnly, setRiskOnly] = useState(false);
    const [navCollapsed, setNavCollapsed] = useState(false);
    const [rowMenu, setRowMenu] = useState<{ itemId: string; x: number; y: number } | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [vaultsOpen, setVaultsOpen] = useState(true);
    const [tagsOpen, setTagsOpen] = useState(true);
    const [actionsOpen, setActionsOpen] = useState(false);
    const actionsButtonRef = useRef<HTMLButtonElement>(null);
    const [accessWindowBusy, setAccessWindowBusy] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 2200);
    };

    const searchRef = useRef<HTMLInputElement>(null);
    const helpRef = useRef<HTMLButtonElement>(null);
    const profileRef = useRef<HTMLButtonElement>(null);
    const filterRef = useRef<HTMLButtonElement>(null);
    const sortRef = useRef<HTMLButtonElement>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const accessLaunchRef = useRef<BootState | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const clearSecrets = useCallback(() => {
        clearSensitiveUi(setItems, setRevealed, setCopied);
        setVaults([]);
        setTags([]);
    }, []);

    const loadUnlocked = useCallback(async () => {
        const snapshot = await focuzPassSnapshot();
        const rememberedOrder = await focuzPassReadRememberedOrder();
        const rememberedRank = new Map(rememberedOrder.map((id, index) => [id, index]));
        const ui = snapshot.items.map(toUiItem).sort((a, b) => {
            const aRank = rememberedRank.get(a.id);
            const bRank = rememberedRank.get(b.id);
            if (aRank != null && bRank != null) return aRank - bRank;
            if (aRank != null) return -1;
            if (bRank != null) return 1;
            return a.sortOrder - b.sortOrder;
        }).map((item, index) => ({ ...item, sortOrder: index }));
        const vaultOrder = snapshot.items
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item) => item.id);
        const visibleOrder = ui.map((item) => item.id);
        if (rememberedOrder.length > 0 && visibleOrder.some((id, index) => id !== vaultOrder[index])) {
            void focuzPassReorder(visibleOrder).catch(() => undefined);
        }
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
                setCompanionReason(companionReasonFor(err));
                setBoot('companion');
                return;
            }
            throw err;
        }
    }, [clearSecrets, loadUnlocked]);

    const retryConnection = useCallback(async () => {
        try {
            await refreshStatus();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load FocuzPass');
            setBoot('error');
        }
    }, [refreshStatus]);

    const launchAccessWindow = useCallback(async () => {
        // The web vault unlocks on this page; only the extension has a separate secure window.
        if (accessWindowBusy || webVault) return;
        setAccessWindowBusy(true);
        setError('');
        // Never leave the button stuck on "Opening…" if the extension is slow to answer.
        const release = window.setTimeout(() => setAccessWindowBusy(false), 4000);
        try {
            await focuzPassOpenAccessWindow();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not open the secure FocuzPass window';
            setError(/unknown focuzpass message/i.test(message)
                ? 'Reload the extension once to enable the new secure unlock window.'
                : message);
        } finally {
            window.clearTimeout(release);
            setAccessWindowBusy(false);
        }
    }, [accessWindowBusy, webVault]);

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

    // Keep the extension worker awake while FocuzPass is on screen, so opening the
    // secure unlock window (or any vault action) doesn't wait on a cold start.
    useEffect(() => {
        if (boot === 'companion' || boot === 'error') return;
        const ping = () => {
            if (document.visibilityState === 'visible') void focuzPassPing().catch(() => undefined);
        };
        const timer = window.setInterval(ping, 20_000);
        document.addEventListener('visibilitychange', ping);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', ping);
        };
    }, [boot]);

    // Coming back to FocuzPass picks up what other devices changed (the worker also syncs on its own
    // every couple of minutes). Changes that arrive reload the list through FOCUZPASS_VAULT_CHANGED.
    useEffect(() => {
        if (boot !== 'ready') return;
        let last = 0;
        const nudge = () => {
            if (document.visibilityState !== 'visible' || Date.now() - last < 30_000) return;
            last = Date.now();
            void focuzPassCloudSync().catch(() => undefined);
        };
        nudge();
        document.addEventListener('visibilitychange', nudge);
        window.addEventListener('focus', nudge);
        return () => {
            document.removeEventListener('visibilitychange', nudge);
            window.removeEventListener('focus', nudge);
        };
    }, [boot]);

    useEffect(() => {
        const onMessage = (message: { type?: string; inboxMerged?: number }) => {
            if (message?.type === 'FOCUZPASS_LOCKED') {
                clearSecrets();
                setBoot('locked');
                setStatus((current) => (current ? { ...current, unlocked: false, itemCount: 0, remainingMs: null } : current));
            }
            if (message?.type === 'FOCUZPASS_ACCESS_CHANGED') {
                if (typeof message.inboxMerged === 'number' && message.inboxMerged > 0) {
                    showToast(`${message.inboxMerged} login${message.inboxMerged === 1 ? '' : 's'} added while locked`);
                }
                void refreshStatus().catch(() => undefined);
            }
            if (message?.type === 'FOCUZPASS_VAULT_CHANGED') {
                void refreshStatus().catch(() => undefined);
            }
        };
        return subscribeFocuzPassEvents(onMessage);
    }, [clearSecrets, refreshStatus]);

    useEffect(() => {
        if (boot !== 'setup' && boot !== 'locked') {
            accessLaunchRef.current = null;
            return;
        }
        if (accessLaunchRef.current !== boot) {
            accessLaunchRef.current = boot;
            void launchAccessWindow();
        }
        const timer = window.setInterval(() => {
            void focuzPassStatus()
                .then(async (next) => {
                    setStatus(next);
                    if (next.unlocked) await loadUnlocked();
                })
                .catch(() => undefined);
        }, 750);
        return () => window.clearInterval(timer);
    }, [boot, launchAccessWindow, loadUnlocked]);

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
            if (event.key === 'Escape') {
                setRowMenu(null);
                setActionsOpen(false);
                setProfileOpen(false);
                setFiltersOpen(false);
                setSortOpen(false);
                return;
            }
            if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, []);

    const countForFilter = useCallback((candidate: VaultFilter) => items.filter((item) => {
        const active = !item.archivedAt && !item.deletedAt;
        const inView = (view.kind === 'all' && active)
            || (view.kind === 'favorites' && active && item.favorite)
            || (view.kind === 'archive' && Boolean(item.archivedAt) && !item.deletedAt)
            || (view.kind === 'deleted' && Boolean(item.deletedAt))
            || (view.kind === 'vault' && active && item.vaultId === view.id)
            || (view.kind === 'tag' && active && item.tagIds.includes(view.id));
        if (!inView) return false;
        if (candidate === 'all') return true;
        if (candidate === 'risk') return Boolean(item.risk);
        if (candidate === 'login' || candidate === 'card' || candidate === 'passkey') return item.type === candidate;
        return item.type === 'custom' && item.kind === candidate;
    }).length, [items, view]);

    const toggleTypeFilter = (candidate: VaultFilter) => {
        setTypeFilters((current) => current.includes(candidate)
            ? current.filter((value) => value !== candidate)
            : [...current, candidate]);
    };

    const filteredItems = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        const now = Date.now();
        const createdAfter = createdFilter === '7d'
            ? now - 7 * 86400000
            : createdFilter === '30d'
                ? now - 30 * 86400000
                : createdFilter === '90d'
                    ? now - 90 * 86400000
                    : createdFilter === 'year'
                        ? new Date(new Date().getFullYear(), 0, 1).getTime()
                        : 0;
        const customFrom = createdFrom ? new Date(`${createdFrom}T00:00:00`).getTime() : 0;
        const customTo = createdTo ? new Date(`${createdTo}T23:59:59.999`).getTime() : 0;
        // A passkey saved for an account that also has a login shows as part of that login, not twice.
        const loginAccounts = new Set(items.filter((item) => item.type === 'login' && !item.deletedAt).map(accountKey).filter(Boolean));
        const onlyPasskeys = typeFilters.length === 1 && typeFilters[0] === 'passkey';
        return items.filter((item) => {
            if (item.type === 'passkey' && !onlyPasskeys && !item.deletedAt && loginAccounts.has(accountKey(item))) return false;
            const active = !item.archivedAt && !item.deletedAt;
            const matchesView =
                (view.kind === 'all' && active) ||
                (view.kind === 'favorites' && active && item.favorite) ||
                (view.kind === 'archive' && Boolean(item.archivedAt) && !item.deletedAt) ||
                (view.kind === 'deleted' && Boolean(item.deletedAt)) ||
                (view.kind === 'vault' && active && item.vaultId === view.id) ||
                (view.kind === 'tag' && active && item.tagIds.includes(view.id));
            const matchesType = typeFilters.length === 0 || typeFilters.some((candidate) =>
                candidate === 'login' || candidate === 'card' || candidate === 'passkey'
                    ? item.type === candidate
                    : item.type === 'custom' && item.kind === candidate,
            );
            const matchesQuery = !normalized || [item.title, item.identity, item.domain, item.authMethod, ...Object.values(item.fields)].some((value) => value?.toLowerCase().includes(normalized));
            const createdTime = new Date(item.createdAt).getTime();
            const matchesCreated = (!createdAfter || createdTime >= createdAfter)
                && (!customFrom || createdTime >= customFrom)
                && (!customTo || createdTime <= customTo);
            return matchesView && matchesType && matchesQuery && matchesCreated && (!favoritesOnly || item.favorite) && (!riskOnly || Boolean(item.risk));
        }).sort((a, b) => {
            if (sortMode === 'custom') return a.sortOrder - b.sortOrder;
            if (sortMode === 'created-newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortMode === 'created-oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            if (sortMode === 'name-asc') return a.title.localeCompare(b.title);
            if (sortMode === 'name-desc') return b.title.localeCompare(a.title);
            if (sortMode === 'type') return `${a.type}-${a.kind || ''}-${a.title}`.localeCompare(`${b.type}-${b.kind || ''}-${b.title}`);
            return new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime();
        });
    }, [createdFilter, createdFrom, createdTo, favoritesOnly, items, query, riskOnly, sortMode, typeFilters, view]);

    const groupedItems = useMemo(() => {
        // Your own order is one list with no heading (the sort menu already says what it is).
        if (sortMode === 'custom') return [['', filteredItems] as [string, VaultItem[]]];
        const groups = new Map<string, VaultItem[]>();
        filteredItems.forEach((item) => {
            const label = monthLabel(sortMode.startsWith('created-') ? item.createdAt : item.sortDate);
            groups.set(label, [...(groups.get(label) || []), item]);
        });
        return Array.from(groups.entries());
    }, [filteredItems, sortMode]);

    const activeFilterCount = typeFilters.length
        + (createdFilter !== 'any' ? 1 : 0)
        + (createdFrom || createdTo ? 1 : 0)
        + (favoritesOnly ? 1 : 0)
        + (riskOnly ? 1 : 0);

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!event.over || event.active.id === event.over.id) return;
        const oldIndex = filteredItems.findIndex((item) => item.id === event.active.id);
        const newIndex = filteredItems.findIndex((item) => item.id === event.over?.id);
        if (oldIndex < 0 || newIndex < 0) return;
        const reorderedVisible = arrayMove(filteredItems, oldIndex, newIndex);
        const visibleIds = new Set(filteredItems.map((item) => item.id));
        const allOrdered = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
        let visibleIndex = 0;
        const merged = allOrdered.map((item) => visibleIds.has(item.id) ? reorderedVisible[visibleIndex++]! : item);
        const orderById = new Map(merged.map((item, index) => [item.id, index]));
        setItems((current) => current.map((item) => ({ ...item, sortOrder: orderById.get(item.id) ?? item.sortOrder })));
        try {
            const result = await focuzPassReorder(merged.map((item) => item.id));
            if (!result.persistedInVault) showToast('Order saved. Reload the extension once to finish updating.');
        } catch (err) {
            await loadUnlocked();
            setToast(err instanceof Error ? err.message : 'Could not save the custom order');
            window.setTimeout(() => setToast(''), 2200);
        }
    };

    const selected = selectedId ? filteredItems.find((item) => item.id === selectedId) : undefined;
    const rowMenuItem = rowMenu ? items.find((item) => item.id === rowMenu.itemId) : undefined;
    const associatedPasskey = selected?.type === 'login'
        ? items.find((item) => item.type === 'passkey' && !item.deletedAt && !item.archivedAt && accountKey(item) !== '' && accountKey(item) === accountKey(selected))
        : undefined;
    const selectedVault = selected ? vaults.find((vault) => vault.id === selected.vaultId) : undefined;
    // Only fields that have something in them show; empty ones just aren't listed.
    const filledCustomFields = selected?.type === 'custom' && selected.kind
        ? ITEM_DEFINITIONS[selected.kind].fields.filter((field) => Boolean(selected.fields[field.key]?.trim()))
        : [];
    const viewTitle = view.kind === 'favorites'
        ? 'Favorites'
        : view.kind === 'archive'
          ? 'Archive'
          : view.kind === 'deleted'
            ? 'Recently deleted'
            : view.kind === 'vault'
              ? vaults.find((vault) => vault.id === view.id)?.name || 'Vault'
              : view.kind === 'tag'
                ? tags.find((tag) => tag.id === view.id)?.name || 'Tag'
                : 'All Items';

    const saveItem = async (draft: ItemDraft, options: { closeModal?: boolean; toastMessage?: string; throwOnError?: boolean } = {}) => {
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
            if (options.throwOnError) throw err;
        } finally {
            setBusy(false);
        }
    };

    const deleteItem = async (target: VaultItem) => {
        setBusy(true);
        try {
            await focuzPassDelete(target.id);
            await loadUnlocked();
            if (selectedId === target.id) setSelectedId('');
            setActionsOpen(false);
            setRowMenu(null);
            showToast(`${target.title} moved to Recently deleted`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete item');
        } finally {
            setBusy(false);
        }
    };

    const deleteSelected = async () => {
        if (selected) await deleteItem(selected);
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

    const createTagForEditor = async (value: { name: string; color: string; icon: string }): Promise<VaultTag> => {
        try {
            const created = await focuzPassCreateTag(value);
            setTags((current) => current.some((tag) => tag.id === created.id) ? current : [...current, created]);
            showToast(`${created.name} tag created`);
            return created;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not create tag';
            setError(message);
            throw err;
        }
    };

    const updateItemAction = async (
        target: VaultItem,
        action: 'favorite' | 'archive' | 'unarchive' | 'restore' | 'purge' | 'duplicate',
        value?: boolean,
    ) => {
        setBusy(true);
        try {
            const result = action === 'favorite'
                ? await focuzPassItemAction({ action, id: target.id, value: Boolean(value) })
                : await focuzPassItemAction({ action, id: target.id });
            await loadUnlocked();
            setSelectedId(result?.id || '');
            setActionsOpen(false);
            setRowMenu(null);
            showToast(action === 'duplicate' ? `${target.title} duplicated` : action === 'favorite' ? (value ? 'Added to Favorites' : 'Removed from Favorites') : action === 'archive' ? `${target.title} archived` : action === 'restore' ? `${target.title} restored` : action === 'purge' ? `${target.title} permanently deleted` : `${target.title} updated`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update item');
        } finally {
            setBusy(false);
        }
    };

    const updateSelectedAction = async (
        action: 'favorite' | 'archive' | 'unarchive' | 'restore' | 'purge' | 'duplicate',
        value?: boolean,
    ) => {
        if (selected) await updateItemAction(selected, action, value);
    };

    const moveItem = async (target: VaultItem, vaultId: string) => {
        setBusy(true);
        try {
            await focuzPassItemAction({ action: 'move', id: target.id, vaultId });
            await loadUnlocked();
            setActionsOpen(false);
            setRowMenu(null);
            showToast(`Moved ${target.title}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : `Could not move ${target.title}`;
            setError(message);
            showToast(message);
        } finally {
            setBusy(false);
        }
    };

    const moveSelected = async (vaultId: string) => {
        if (selected) await moveItem(selected, vaultId);
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

    // Switching items swaps the contents in place; only opening the inspector animates (below).
    const detailPanel = selected ? (
        <div key={selected.id} className="vault-detail-page">
            <div className="vault-detail-topbar">
                <div className="vault-detail-location">
                    <button ref={focusWithoutScroll} type="button" className="vault-inspector-close" onClick={() => { setSelectedId(''); setActionsOpen(false); }} aria-label="Close item details"><X size={14} /></button>
                    {selectedVault && <><CollectionMark color={selectedVault.color} icon={selectedVault.icon} size={13} /><strong>{selectedVault.name}</strong></>}
                </div>
                <div className="vault-detail-actions" onClick={(event) => event.stopPropagation()}>
                    {selected.deletedAt && <button type="button" onClick={() => void updateSelectedAction('restore')}><ArchiveRestore size={14} /> Restore</button>}
                    {selected.archivedAt && !selected.deletedAt && <button type="button" onClick={() => void updateSelectedAction('unarchive')}><ArchiveRestore size={14} /> Restore</button>}
                    {selected.type !== 'passkey' && !selected.deletedAt && <button type="button" onClick={openSelectedEditor}><Pencil size={14} /> Edit</button>}
                    <div className="vault-actions-wrap">
                        <button ref={actionsButtonRef} type="button" className="vault-more-button" onClick={() => setActionsOpen((open) => !open)} aria-label="More item actions" aria-expanded={actionsOpen}><EllipsisVertical size={18} /></button>
                        {actionsOpen && (
                            <VaultCommandMenu
                                item={selected}
                                vaults={vaults}
                                anchor={actionsButtonRef}
                                onAction={(action, value) => void updateSelectedAction(action, value)}
                                onMove={(vaultId) => void moveSelected(vaultId)}
                                onDelete={() => void deleteSelected()}
                                onClose={() => setActionsOpen(false)}
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="vault-detail-scroll">
                <div className="vault-detail-body">
                    <div className="vault-detail-heading"><ItemMark item={selected} large /><h2>{selected.title}</h2></div>
                    {selected.type === 'login' && (
                        <>
                            {(selected.identity || selected.password || associatedPasskey) && <div className="vault-credential-card">
                                {selected.identity && <DetailField label="Username" value={selected.identity} onCopy={() => copyText(selected.identity, setCopied, 'identity')} copied={copied === 'identity'} />}
                                {associatedPasskey && <div className="vault-passkey-row"><div><span>Passkey</span><strong>Created {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(associatedPasskey.sortDate))}</strong></div><Fingerprint size={19} /></div>}
                                {selected.password && <DetailField label="Password" value={selected.password} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.password || '', setCopied, 'password')} copied={copied === 'password'} />}
                            </div>}
                            {selected.strength && <div className={`vault-password-health is-${selected.strength}`}><span>Password strength</span><strong>{selected.strength === 'okay' ? 'Fair' : selected.strength}</strong><i /></div>}
                            {selected.domain && <a className="vault-website-link" href={selected.domain.includes('://') ? selected.domain : `https://${selected.domain}`} target="_blank" rel="noreferrer"><span>Website</span><strong>{selected.domain}</strong></a>}
                        </>
                    )}
                    {selected.type === 'card' && (selected.identity || selected.cardNumber || selected.expiry || selected.cvv) && <div className="vault-credential-card">{selected.identity && <DetailField label="Cardholder" value={selected.identity} onCopy={() => copyText(selected.identity, setCopied, 'identity')} copied={copied === 'identity'} />}{selected.cardNumber && <DetailField label="Card number" value={selected.cardNumber} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.cardNumber || '', setCopied, 'card')} copied={copied === 'card'} />}{selected.expiry && <DetailField label="Expiry" value={selected.expiry} />}{selected.cvv && <DetailField label="Security code" value={selected.cvv} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.cvv || '', setCopied, 'cvv')} copied={copied === 'cvv'} />}</div>}
                    {selected.type === 'custom' && selected.kind && filledCustomFields.length > 0 && <div className="vault-credential-card">{filledCustomFields.map((field) => <DetailField key={field.key} label={field.label} value={selected.fields[field.key]!} secret={isSensitiveField(field)} reveal={revealed} onToggleReveal={isSensitiveField(field) ? () => setRevealed((value) => !value) : undefined} onCopy={() => copyText(selected.fields[field.key]!, setCopied, field.key)} copied={copied === field.key} />)}</div>}
                    {selected.type === 'passkey' && <><div className="vault-credential-card">{selected.identity && <DetailField label="Username" value={selected.identity} onCopy={() => copyText(selected.identity, setCopied, 'identity')} copied={copied === 'identity'} />}<div className="vault-passkey-row"><div><span>Passkey</span><strong>Created {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(selected.createdAt))}</strong></div><Fingerprint size={19} /></div></div>{selected.domain && <a className="vault-website-link" href={selected.domain.includes('://') ? selected.domain : `https://${selected.domain}`} target="_blank" rel="noreferrer"><span>Website</span><strong>{selected.domain}</strong></a>}</>}
                    {selected.note && <div className="vault-detail-note"><span>Notes</span><p>{selected.note}</p></div>}
                    {selected.tagIds.length > 0 && <div className="vault-detail-tags"><span>Tags</span><div>{selected.tagIds.map((tagId) => { const tag = tags.find((candidate) => candidate.id === tagId); return tag ? <span key={tag.id} className="vault-detail-tag" style={{ '--tag-tone': tag.color } as CSSProperties}><button type="button" className="vault-detail-tag-link" onClick={() => { setView({ kind: 'tag', id: tag.id }); setSelectedId(''); }}><ExactTagIcon size={12} color={tag.color} /> {tag.name}</button>{selected.type !== 'passkey' && <button type="button" className="vault-detail-tag-remove" onClick={() => void removeSelectedTag(tag.id)} disabled={busy} aria-label={`Remove ${tag.name} tag`}><X size={11} /></button>}</span> : null; })}</div></div>}
                </div>
            </div>
        </div>
    ) : <VaultEmptyIllustration />;

    if (boot === 'loading') {
        return (
            <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
                <p className="text-sm text-neutral-500">Opening FocuzPass…</p>
            </section>
        );
    }

    if (boot === 'companion') {
        return <CompanionScreen reason={companionReason} onRetry={retryConnection} />;
    }

    if (boot === 'error') {
        return (
            <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
                <div className="max-w-md text-center">
                    <p className="text-sm text-neutral-300">Could not open FocuzPass</p>
                    <p className="mt-2 text-xs text-neutral-600">{error}</p>
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
                    <p className="vault-access-kicker">Secure extension window</p>
                    <h2 className="vault-access-heading">Create your vault privately</h2>
                    <p className="vault-access-copy">
                        Master-password setup now happens in a separate FocuzPass window, outside the dashboard and website.
                    </p>
                    {error && <p className="vault-access-error" role="alert">{error}</p>}
                    <button type="button" disabled={accessWindowBusy} className="vault-button vault-button-primary vault-access-submit" onClick={() => void launchAccessWindow()}>
                        {accessWindowBusy ? 'Opening secure window…' : 'Open setup window'}
                        {!accessWindowBusy && <ArrowRight size={14} />}
                    </button>
                    <p className="vault-access-footnote"><ShieldCheck size={13} /> Your password never leaves this device</p>
                </motion.div>
            </section>
        );
    }

    if (boot === 'locked' && webVault) return <WebVaultUnlockCard webVault={webVault} reduceMotion={reduceMotion} />;

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
                    <h2 className="vault-access-heading">FocuzPass is locked</h2>
                    <p className="vault-access-copy">Unlock it with your master password. This page opens your vault as soon as you do.</p>
                    {error && <p className="vault-access-error" role="alert">{error}</p>}
                    <button type="button" disabled={accessWindowBusy} className="vault-button vault-button-primary vault-access-submit" onClick={() => void launchAccessWindow()}>
                        <KeyRound size={14} />
                        {accessWindowBusy ? 'Opening…' : 'Unlock FocuzPass'}
                    </button>
                    <ul className="vault-access-notes">
                        <li><LockKeyhole size={14} aria-hidden="true" /><span><strong>Unlocks in its own window</strong>Your master password is typed there, never into this page.</span></li>
                        <li><Laptop size={14} aria-hidden="true" /><span><strong>Open for this browser session</strong>It locks again when you're away or close the browser.</span></li>
                    </ul>
                </motion.div>
            </section>
        );
    }

    return (
        <section className="focuz-pass focuz-pass-ready h-full w-full">
            <div className={`vault-shell${navCollapsed ? ' is-nav-collapsed' : ''}`}>
                <aside className="vault-nav">
                    <div className="vault-brand-row">
                        {onExit ? (
                            <span className="vault-brand-trail">
                                <button type="button" className="vault-brand-back" onClick={onExit} title="Back to FocuzNow" aria-label="Back to FocuzNow"><ArrowLeft size={14} /></button>
                                <span>FocuzPass</span>
                            </span>
                        ) : <span>FocuzPass</span>}
                        <button type="button" onClick={() => setNavCollapsed((collapsed) => !collapsed)} aria-label={navCollapsed ? 'Expand FocuzPass sidebar' : 'Collapse FocuzPass sidebar'} title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                            <ExactSidebarDrawerCloseIcon size={15} />
                        </button>
                    </div>

                    <div className="vault-profile-wrap">
                        <button ref={profileRef} type="button" className={`vault-profile${profileOpen ? ' is-open' : ''}`} onClick={() => setProfileOpen((open) => !open)} aria-haspopup="menu" aria-expanded={profileOpen}>
                            <VaultProfileAvatar avatarUrl={avatarUrl} fallbackUrl={avatarFallbackUrl} name={username || accountName} />
                            <span className="vault-profile-copy">
                                <strong className="truncate">{username}</strong>
                                <small className="truncate">{accountName}</small>
                            </span>
                        </button>
                        <Menu
                            open={profileOpen}
                            onClose={() => setProfileOpen(false)}
                            anchor={profileRef}
                            minWidth={250}
                            items={[
                                { type: 'label', id: 'add', label: 'Add logins' },
                                { id: 'import', label: 'Import passwords', icon: <Download size={14} />, onSelect: () => setImportOpen(true) },
                                { id: 'transfer', label: 'Transfer between devices', icon: <QrCode size={14} />, onSelect: () => setTransferOpen(true) },
                                { type: 'separator', id: 'sep-settings' },
                                { type: 'label', id: 'settings', label: 'Settings' },
                                { id: 'cloud', label: 'Cloud sync', icon: <Cloud size={14} />, onSelect: () => { setCloudPrompt(false); setCloudOpen(true); } },
                                ...(!webVault ? [{ id: 'passkeys', label: 'Passkeys', icon: <Fingerprint size={14} />, onSelect: () => setPasskeysOpen(true) } satisfies MenuItem] : []),
                                { id: 'password', label: 'Change master password', icon: <KeyRound size={14} />, onSelect: () => setChangePasswordOpen(true) },
                                { type: 'separator', id: 'sep-exit' },
                                ...(onExit ? [{ id: 'dashboard', label: 'FocuzNow dashboard', icon: <PanelLeft size={14} />, onSelect: onExit } satisfies MenuItem] : []),
                                { id: 'lock', label: 'Lock FocuzPass', icon: <Lock size={14} />, shortcut: status?.remainingMs != null ? `in ${formatRemaining(status.remainingMs)}` : undefined, onSelect: () => void handleLock() },
                            ]}
                        />
                    </div>

                    <nav className="vault-primary-nav" aria-label="FocuzPass navigation">
                        <button type="button" className={`vault-nav-item${view.kind === 'all' ? ' is-active' : ''}`} onClick={() => { setView({ kind: 'all' }); setTypeFilters([]); setQuery(''); setSelectedId(''); }}><ExactAllItemsIcon size={20} /><span className="vault-nav-label">All Items</span></button>
                        <button type="button" className={`vault-nav-item${view.kind === 'favorites' ? ' is-active' : ''}`} onClick={() => { setView({ kind: 'favorites' }); setSelectedId(''); }}><ExactFavoritesIcon size={20} /><span className="vault-nav-label">Favorites</span></button>

                        <section className="vault-nav-section" aria-label="Vaults">
                            <div className="vault-nav-heading">
                                <button type="button" className="vault-nav-section-toggle" onClick={() => setVaultsOpen((open) => !open)} aria-expanded={vaultsOpen}>
                                    <span className="vault-nav-section-content">
                                        <span className={`vault-nav-disclosure${vaultsOpen ? ' is-open' : ''}`}><ExactSidebarChevronIcon /></span>
                                        <strong className="vault-nav-section-label">Vaults</strong>
                                    </span>
                                </button>
                                <button type="button" className="vault-nav-add" onClick={() => setCollectionModal('vault')} aria-label="New vault"><ExactSidebarPlusIcon /></button>
                            </div>
                            <div className={`vault-nav-section-items${vaultsOpen ? '' : ' is-collapsed'}`} aria-hidden={!vaultsOpen}>
                                <div>
                                    {vaults.map((vault) => (
                                        <button key={vault.id} type="button" tabIndex={vaultsOpen ? 0 : -1} className={`vault-nav-item${view.kind === 'vault' && view.id === vault.id ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'vault', id: vault.id }); setSelectedId(''); }}><CollectionMark color={vault.color} icon={vault.icon} size={20} /> <span className="vault-nav-label truncate">{vault.name}</span></button>
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
                                <button type="button" className="vault-nav-add" onClick={() => setCollectionModal('tag')} aria-label="New tag"><ExactSidebarPlusIcon /></button>
                            </div>
                            <div className={`vault-nav-section-items${tagsOpen ? '' : ' is-collapsed'}`} aria-hidden={!tagsOpen}>
                                <div>
                                    {tags.map((tag) => (
                                        <button key={tag.id} type="button" tabIndex={tagsOpen ? 0 : -1} className={`vault-nav-item${view.kind === 'tag' && view.id === tag.id ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'tag', id: tag.id }); setSelectedId(''); }}><CollectionMark color={tag.color} icon={tag.icon} size={20} /> <span className="vault-nav-label truncate">{tag.name}</span></button>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </nav>

                    <div className="vault-nav-bottom">
                        <button type="button" className={`vault-nav-item${view.kind === 'archive' ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'archive' }); setSelectedId(''); }}><ExactArchiveIcon size={20} /><span className="vault-nav-label">Archive</span></button>
                        <button type="button" className={`vault-nav-item${view.kind === 'deleted' ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'deleted' }); setSelectedId(''); }}><ExactRecentlyDeletedIcon size={20} /><span className="vault-nav-label">Recently deleted</span></button>
                    </div>
                </aside>

                <header className="vault-toolbar">
                    <label className="vault-search">
                        <Search size={14} aria-hidden="true" />
                        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search in ${viewTitle}`} />
                        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={12} /></button>}
                    </label>
                    <button ref={helpRef} type="button" className={`vault-help${helpOpen ? ' is-active' : ''}`} aria-haspopup="menu" aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}><CircleHelp size={14} /><span>Help</span></button>
                    <Menu
                        open={helpOpen}
                        onClose={() => setHelpOpen(false)}
                        anchor={helpRef}
                        align="end"
                        minWidth={260}
                        items={[
                            { type: 'label', id: 'shortcuts', label: 'Shortcuts' },
                            { id: 'search', label: 'Search your vault', icon: <Search size={14} />, shortcut: '/', onSelect: () => searchRef.current?.focus() },
                            { id: 'new', label: 'New item', icon: <Plus size={14} />, onSelect: () => setModal('picker') },
                            { type: 'separator', id: 'sep-start' },
                            { type: 'label', id: 'start', label: 'Get your logins in' },
                            { id: 'import', label: 'Import from another password manager', icon: <Download size={14} />, onSelect: () => setImportOpen(true) },
                            { id: 'transfer', label: 'Move logins from another device', icon: <QrCode size={14} />, onSelect: () => setTransferOpen(true) },
                            { id: 'cloud', label: 'Sync across devices', icon: <Cloud size={14} />, onSelect: () => { setCloudPrompt(false); setCloudOpen(true); } },
                            ...(!webVault ? [{ id: 'passkeys', label: 'Passkeys', icon: <Fingerprint size={14} />, onSelect: () => setPasskeysOpen(true) } satisfies MenuItem] : []),
                            { type: 'separator', id: 'sep-privacy' },
                            {
                                type: 'custom',
                                id: 'privacy',
                                node: (
                                    <div className="vault-help-privacy">
                                        <ShieldCheck size={14} aria-hidden="true" />
                                        <span>
                                            <strong>Only you can open your vault</strong>
                                            <small>Items are encrypted on this device with your master password. With Cloud sync on, FocuzNow only stores encrypted copies it can't read.</small>
                                        </span>
                                    </div>
                                ),
                            },
                            { type: 'separator', id: 'sep-support' },
                            { id: 'lock', label: 'Lock FocuzPass', icon: <Lock size={14} />, onSelect: () => void handleLock() },
                            { id: 'support', label: 'Contact support', icon: <Mail size={14} />, onSelect: () => window.open('mailto:support@focuznow.com?subject=FocuzPass%20help', '_blank', 'noopener') },
                        ]}
                    />
                    <button type="button" onClick={() => setModal('picker')} className="vault-new-item is-primary"><Plus size={14} /> New item</button>
                </header>


                <div className="vault-content-grid vault-library-layout">
                    <div className="vault-list">
                        <div className="vault-list-toolbar">
                            <div className="vault-category-summary">
                                <span>{viewTitle}</span>
                                <span className="vault-list-count">{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}</span>
                            </div>
                            <div className="vault-list-actions">
                                <button ref={filterRef} type="button" className={filtersOpen || activeFilterCount ? 'is-active' : ''} onClick={() => { setFiltersOpen((open) => !open); setSortOpen(false); }} aria-label={`Filter items${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} aria-haspopup="menu" aria-expanded={filtersOpen}><Funnel size={13} />{activeFilterCount > 0 && <small>{activeFilterCount}</small>}</button>
                                <Menu
                                    open={filtersOpen}
                                    onClose={() => setFiltersOpen(false)}
                                    anchor={filterRef}
                                    align="end"
                                    minWidth={260}
                                    className="vault-filter-menu"
                                    items={[
                                        { type: 'label', id: 'types', label: 'Item type' },
                                        // Only types this view has (or that are already ticked): sixteen rows of zeros pushed the rest off-screen.
                                        ...FILTERS.filter((option) => option.id !== 'all' && option.id !== 'risk' && (countForFilter(option.id) > 0 || typeFilters.includes(option.id))).map((option) => ({
                                            id: `type-${option.id}`,
                                            label: option.label,
                                            checked: typeFilters.includes(option.id),
                                            shortcut: String(countForFilter(option.id)),
                                            keepOpen: true,
                                            onSelect: () => toggleTypeFilter(option.id),
                                        } satisfies MenuItem)),
                                        { type: 'separator', id: 'sep-added' },
                                        { type: 'label', id: 'added', label: 'Added' },
                                        ...([['any', 'Any time'], ['7d', 'Past 7 days'], ['30d', 'Past 30 days'], ['90d', 'Past 90 days'], ['year', 'This year']] as [CreatedFilter, string][]).map(([value, label]) => ({
                                            id: `added-${value}`,
                                            label,
                                            checked: createdFilter === value && !createdFrom && !createdTo,
                                            keepOpen: true,
                                            onSelect: () => { setCreatedFilter(value); setCreatedFrom(''); setCreatedTo(''); },
                                        } satisfies MenuItem)),
                                        {
                                            type: 'custom',
                                            id: 'added-range',
                                            node: (
                                                <div className="vault-filter-menu-range">
                                                    <DatePicker value={createdFrom} placeholder="From" ariaLabel="Added from" onChange={(value) => { setCreatedFrom(value); setCreatedFilter('any'); }} />
                                                    <span>to</span>
                                                    <DatePicker value={createdTo} placeholder="Until" ariaLabel="Added until" min={createdFrom || undefined} onChange={(value) => { setCreatedTo(value); setCreatedFilter('any'); }} />
                                                </div>
                                            ),
                                        },
                                        { type: 'separator', id: 'sep-more' },
                                        { id: 'favorites', label: 'Favorites only', checked: favoritesOnly, keepOpen: true, onSelect: () => setFavoritesOnly((current) => !current) },
                                        { id: 'risk', label: 'Needs a security review', checked: riskOnly, keepOpen: true, onSelect: () => setRiskOnly((current) => !current) },
                                        { type: 'separator', id: 'sep-clear' },
                                        { id: 'clear', label: 'Clear all filters', icon: <X size={14} />, disabled: activeFilterCount === 0, keepOpen: true, onSelect: () => { setTypeFilters([]); setCreatedFilter('any'); setCreatedFrom(''); setCreatedTo(''); setFavoritesOnly(false); setRiskOnly(false); } },
                                    ]}
                                />
                                <button ref={sortRef} type="button" className={sortOpen ? 'is-active' : ''} onClick={() => { setSortOpen((open) => !open); setFiltersOpen(false); }} aria-label="Sort items" aria-haspopup="menu" aria-expanded={sortOpen}><SortItemsIcon /></button>
                                <Menu
                                    open={sortOpen}
                                    onClose={() => setSortOpen(false)}
                                    anchor={sortRef}
                                    align="end"
                                    minWidth={220}
                                    items={[
                                        { type: 'label', id: 'sort', label: 'Sort by' },
                                        ...SORT_OPTIONS.map((option) => ({
                                            id: option.id,
                                            label: option.label,
                                            checked: sortMode === option.id,
                                            shortcut: option.id === 'custom' ? 'Drag' : undefined,
                                            onSelect: () => setSortMode(option.id),
                                        } satisfies MenuItem)),
                                    ]}
                                />
                            </div>
                        </div>

                        {cloudPrompt && (
                            <div className="mx-3 mb-1 mt-2 flex items-center gap-2.5 rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3 py-2 text-[12.5px] text-[var(--fz-text-2)]" role="status">
                                <Cloud size={14} className="shrink-0 text-[var(--fz-text-3)]" />
                                <span className="min-w-0 flex-1">
                                    <strong className="font-medium text-[var(--fz-text-1)]">Use FocuzPass on your other devices.</strong> Turn on Cloud sync; your vault stays encrypted so only you can open it.
                                </span>
                                <button type="button" className="rounded-[7px] bg-[var(--fz-text-1)] px-2.5 py-1 text-[12px] font-medium text-[var(--fz-bg)]" onClick={() => { setCloudPrompt(false); setCloudOpen(true); }}>Turn on</button>
                                <button type="button" aria-label="Not now" className="flex size-6 items-center justify-center rounded-[6px] text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)]" onClick={() => { setCloudPrompt(false); void chrome.storage.local.set({ 'focuzpass.cloudPromptDismissed': true }).catch(() => undefined); }}><X size={12} /></button>
                            </div>
                        )}


                        <div className="vault-list-scroll">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => { void handleDragEnd(event); }}>
                            <SortableContext items={filteredItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                            <AnimatePresence initial={false}>
                                {filteredItems.length > 0 ? groupedItems.map(([group, groupItems]) => (
                                    <motion.section key={group} className={`vault-month-group${sortMode === 'custom' ? ' is-custom-order' : ''}`} initial={false} animate={{ opacity: 1 }}>
                                        {group && <p>{group}</p>}
                                        {groupItems.map((item) => {
                                            const isSelected = selected?.id === item.id;
                                            return (
                                                <SortableVaultRow
                                                    key={item.id}
                                                    item={item}
                                                    vaultName={vaults.find((vault) => vault.id === item.vaultId)?.name || 'Personal'}
                                                    selected={isSelected}
                                                    draggable={sortMode === 'custom'}
                                                    onSelect={() => { setSelectedId(item.id); setRevealed(false); setActionsOpen(false); }}
                                                    onContextMenu={(event) => { event.preventDefault(); setSelectedId(item.id); setRevealed(false); setActionsOpen(false); setRowMenu({ itemId: item.id, x: Math.max(10, Math.min(event.clientX, window.innerWidth - 274)), y: Math.max(10, Math.min(event.clientY, window.innerHeight - 430)) }); }}
                                                    onMore={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setSelectedId(item.id); setRowMenu({ itemId: item.id, x: Math.max(10, Math.min(rect.right - 262, window.innerWidth - 274)), y: Math.max(10, Math.min(rect.bottom + 5, window.innerHeight - 430)) }); }}
                                                />
                                            );
                                        })}
                                    </motion.section>
                                )) : items.length === 0 ? (
                                    <motion.div className="vault-list-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <p>No items yet</p>
                                        <button type="button" onClick={() => { setEditingId(null); setModal('picker'); }}>+ New item</button>
                                    </motion.div>
                                ) : (
                                    <motion.div className="vault-list-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <p>No matching items</p>
                                        <button type="button" onClick={() => { setTypeFilters([]); setCreatedFilter('any'); setCreatedFrom(''); setCreatedTo(''); setFavoritesOnly(false); setRiskOnly(false); setQuery(''); }}>Clear filters</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            </SortableContext>
                            </DndContext>
                        </div>
                    </div>

                    <AnimatePresence>
                    {selected && (
                        <motion.aside
                            className="vault-detail vault-inspector"
                            aria-label={`Details for ${selected.title}`}
                            onClick={() => actionsOpen && setActionsOpen(false)}
                            onKeyDown={(event) => {
                                if (event.key !== 'Escape') return;
                                event.preventDefault();
                                setSelectedId('');
                                setActionsOpen(false);
                            }}
                            initial={reduceMotion ? false : { x: '104%', opacity: 0.8 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={reduceMotion ? { opacity: 0 } : { x: '104%', opacity: 0.8 }}
                            transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
                        >
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
                                    <div className="flex items-start gap-3 border-b border-white/8 p-5">
                                        <ItemMark item={selected} large />
                                        <div className="min-w-0 flex-1 pt-0.5">
                                            <p className="truncate text-sm font-[460] tracking-[-0.015em] text-neutral-100">{selected.title}</p>
                                            <p className="mt-1 truncate text-[11px] text-neutral-600">{selected.domain || TYPE_META[selected.type].label}</p>
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

                                    <div className="border-t border-white/8 p-4">
                                        <div className="mb-3 flex items-center justify-between rounded-lg border border-white/8 bg-white/4 px-3 py-2.5">
                                            <span className="flex items-center gap-2 text-[11px] text-neutral-500"><ShieldCheck size={13} className={selected.risk ? 'text-red-300' : 'text-emerald-400'} /> {selected.risk ? 'Security review recommended' : 'No security issues found'}</span>
                                            {selected.strength && <span className={`text-meta font-medium capitalize ${selected.strength === 'strong' ? 'text-emerald-400' : selected.strength === 'okay' ? 'text-neutral-400' : 'text-red-300'}`}>{selected.strength}</span>}
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
                        </motion.aside>
                    )}
                    </AnimatePresence>
                </div>

            </div>

            <AnimatePresence>
                {modal === 'picker' && <ItemPickerModal onClose={() => setModal(null)} onSelect={(kind) => { setEditingId(null); setEditorKind(kind); setModal('editor'); }} />}
                {modal === 'editor' && <ItemEditorModal kind={editorKind} item={editingId ? items.find((item) => item.id === editingId) : undefined} savedAddresses={editorKind === 'identity' ? savedAddressesFrom(items, editingId || undefined) : undefined} vaults={vaults} tags={tags} defaultVaultId={view.kind === 'vault' ? view.id : undefined} onClose={() => { setModal(null); setEditingId(null); }} onSave={(draft) => saveItem(draft, { throwOnError: true })} onCreateTag={createTagForEditor} busy={busy} />}
                <ImportPasswords key="import" open={importOpen} onClose={() => setImportOpen(false)} vaults={vaults} onImported={loadUnlocked} />
                <CloudSync key="cloud-sync" open={cloudOpen} onClose={() => setCloudOpen(false)} />
                <PasskeySettings key="passkeys" open={passkeysOpen} onClose={() => setPasskeysOpen(false)} />
                <ChangeMasterPassword key="change-password" open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} onChanged={() => showToast('Master password changed. Use the new one next time you unlock.')} />
                <TransferVault key="transfer" open={transferOpen} onClose={() => setTransferOpen(false)} itemCount={items.filter((item) => !item.deletedAt).length} />
                {collectionModal && <CollectionModal mode={collectionModal} onClose={() => setCollectionModal(null)} onCreate={(value) => { void createCollection(collectionModal, value).catch((err) => { setError(err instanceof Error ? err.message : `Could not create ${collectionModal}`); }); }} busy={busy} />}
            </AnimatePresence>

            {rowMenu && rowMenuItem && (
                <VaultCommandMenu
                    item={rowMenuItem}
                    vaults={vaults}
                    point={{ x: rowMenu.x, y: rowMenu.y }}
                    onAction={(action, value) => void updateItemAction(rowMenuItem, action, value)}
                    onMove={(vaultId) => void moveItem(rowMenuItem, vaultId)}
                    onDelete={() => void deleteItem(rowMenuItem)}
                    onClose={() => setRowMenu(null)}
                />
            )}

            <Toast message={toast} onDone={() => setToast('')} />
        </section>
    );
}
