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
    Funnel,
    GripVertical,
    HeartPulse,
    IdCard,
    KeyRound,
    Landmark,
    LayoutGrid,
    Laptop,
    MapPin,
    Lock,
    Mail,
    MoreHorizontal,
    PanelLeft,
    Pencil,
    Plus,
    Router,
    Search,
    ShieldCheck,
    Sparkles,
    Terminal,
    TicketCheck,
    Trash2,
    WalletCards,
    X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import ModalPortal from '../components/ModalPortal';
import {
    focuzPassCreateTag,
    focuzPassCreateVault,
    focuzPassDelete,
    focuzPassItemAction,
    focuzPassLock,
    focuzPassReorder,
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
import {
    CARD_BRAND_LABELS,
    detectCardBrand,
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

const ITEM_ICON_PALETTES: Record<EditableItemKind, { top: string; main: string; lower: string; depth: string; ink: string; light: string }> = {
    login: { top: '#C8FBF5', main: '#55D3D1', lower: '#248F95', depth: '#155B62', ink: '#174F58', light: '#EDFFFC' },
    card: { top: '#CDEEFF', main: '#5AB8E7', lower: '#2D82B2', depth: '#185372', ink: '#174E70', light: '#F0FAFF' },
    identity: { top: '#DDD9FF', main: '#8C86E9', lower: '#5953BA', depth: '#37337C', ink: '#373271', light: '#F5F3FF' },
    password: { top: '#D7F7FF', main: '#60CBE8', lower: '#2785AE', depth: '#15536F', ink: '#164E69', light: '#F1FCFF' },
    api_credentials: { top: '#C6F6EE', main: '#4DC7B2', lower: '#258979', depth: '#155B52', ink: '#14584F', light: '#EFFFFB' },
    bank_account: { top: '#FFE6A8', main: '#F0B246', lower: '#B97722', depth: '#784B16', ink: '#744816', light: '#FFF8DF' },
    crypto_wallet: { top: '#E3D9FF', main: '#9A7AE3', lower: '#6047A8', depth: '#3B2B70', ink: '#41306F', light: '#F7F3FF' },
    driver_license: { top: '#FFD8E7', main: '#E67CA7', lower: '#A9436E', depth: '#702A49', ink: '#6F2948', light: '#FFF3F8' },
    email: { top: '#FFD5E9', main: '#D9699F', lower: '#993B6A', depth: '#642444', ink: '#682747', light: '#FFF2F8' },
    medical_record: { top: '#FFD8D8', main: '#E87379', lower: '#AE3E48', depth: '#74262E', ink: '#7D2C35', light: '#FFF5F5' },
    membership: { top: '#E9DCFF', main: '#A67BDD', lower: '#7044AA', depth: '#472A70', ink: '#4C2E74', light: '#FAF6FF' },
    passport: { top: '#D5E8FF', main: '#5C99D9', lower: '#3265A0', depth: '#1D416B', ink: '#234E7B', light: '#F3F8FF' },
    ssh_key: { top: '#D8E4E4', main: '#719493', lower: '#466463', depth: '#2A4141', ink: '#263E3D', light: '#F1F7F6' },
    social_security_number: { top: '#D8E5FF', main: '#668DD7', lower: '#3D61A4', depth: '#273F70', ink: '#2B4677', light: '#F4F7FF' },
    wireless_router: { top: '#D7EEF4', main: '#71AFC2', lower: '#477B8D', depth: '#2A5260', ink: '#2F5866', light: '#F3FBFD' },
};

function SoftItemTypeIcon({ kind, size = 32 }: { kind: EditableItemKind; size?: number }) {
    const gradientId = useFocusIconId(`fp-item-${kind}`);
    const palette = ITEM_ICON_PALETTES[kind];
    const fill = `url(#${gradientId})`;
    let glyph: ReactNode;

    switch (kind) {
        case 'login': glyph = <><rect x="4" y="5.5" width="24" height="24" rx="8" fill={palette.depth} /><rect x="4" y="4" width="24" height="24" rx="8" fill={fill} /><path d="M9 5.5h13" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".5" /><rect x="9" y="8.5" width="14" height="14" rx="4.5" fill={palette.light} /><circle cx="16" cy="14.5" r="2.7" fill={palette.ink} /><path d="M14.9 16.6h2.2l-.45 4h-1.3Z" fill={palette.ink} /></>; break;
        case 'card': glyph = <><rect x="3" y="7.5" width="26" height="19" rx="6" fill={palette.depth} /><rect x="3" y="6" width="26" height="19" rx="6" fill={fill} /><path d="M7.5 7.2h16" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".52" /><rect x="3" y="11" width="26" height="5" fill={palette.ink} /><rect x="7" y="20" width="8" height="2.7" rx="1.35" fill={palette.light} opacity=".82" /><circle cx="24" cy="21.3" r="2.5" fill={palette.light} opacity=".72" /></>; break;
        case 'identity': glyph = <><rect x="3" y="7.5" width="26" height="20" rx="6" fill={palette.depth} /><rect x="3" y="6" width="26" height="20" rx="6" fill={fill} /><path d="M7.5 7.3h16" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".48" /><rect x="6" y="10" width="9" height="12" rx="3" fill={palette.light} opacity=".86" /><circle cx="10.5" cy="14" r="2.5" fill={palette.ink} opacity=".72" /><path d="M7.7 20.3c.6-2.5 1.5-3.6 2.8-3.6s2.2 1.1 2.8 3.6" fill={palette.ink} opacity=".72" /><rect x="18" y="11" width="7" height="2.2" rx="1.1" fill={palette.light} /><rect x="18" y="16" width="6" height="2" rx="1" fill={palette.ink} opacity=".55" /></>; break;
        case 'password': glyph = <><path d="M4 14.8a9 9 0 1 1 16.7 4.7L29 27.8h-4.2v-3h-3v-3h-3l-1.1-1.1A9 9 0 0 1 4 14.8Z" fill={palette.depth} transform="translate(0 1.4)" /><path d="M4 14.8a9 9 0 1 1 16.7 4.7L29 27.8h-4.2v-3h-3v-3h-3l-1.1-1.1A9 9 0 0 1 4 14.8Z" fill={fill} /><path d="M7.5 10.5c2.2-3.4 6.7-4.3 10-1.8" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".5" /><circle cx="12.8" cy="14.5" r="3" fill={palette.light} /><circle cx="12.8" cy="14.5" r="1.2" fill={palette.ink} /></>; break;
        case 'api_credentials': glyph = <><rect x="3" y="5.5" width="26" height="22" rx="7" fill={palette.depth} /><rect x="3" y="4" width="26" height="22" rx="7" fill={fill} /><path d="M8 5.4h15" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".46" /><rect x="6" y="9" width="20" height="13" rx="4" fill={palette.ink} /><path d="m11.5 13-2.5 2 2.5 2m9-4 2.5 2-2.5 2m-3-5-3 6" fill="none" stroke={palette.light} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>; break;
        case 'bank_account': glyph = <><circle cx="16" cy="17" r="13" fill={palette.depth} /><circle cx="16" cy="15.5" r="13" fill={fill} /><path d="M8.5 8.5c3.5-3.3 8.9-4.2 13.2-1.5" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".5" /><path d="m8 14 8-5 8 5H8Zm2 2h12m-10 0v6m4-6v6m4-6v6M9 24h14" fill="none" stroke={palette.ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></>; break;
        case 'crypto_wallet': glyph = <><circle cx="10" cy="10" r="7" fill={palette.depth} transform="translate(0 1)" /><circle cx="10" cy="10" r="7" fill={palette.light} /><path d="M9.6 5.8v8.3m-2-6.2h4.2c2 0 2 2.6 0 2.6H7.6m4 0c2.2 0 2.2 2.6 0 2.6h-4" fill="none" stroke={palette.ink} strokeWidth="1.25" strokeLinecap="round" /><rect x="5" y="12.5" width="24" height="16" rx="6" fill={palette.depth} /><rect x="4" y="11" width="24" height="16" rx="6" fill={fill} /><path d="M8 12.4h14" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".42" /><rect x="18" y="16" width="12" height="7" rx="3" fill={palette.light} /><circle cx="22" cy="19.5" r="1.3" fill={palette.ink} /></>; break;
        case 'driver_license': glyph = <><rect x="3" y="7.5" width="26" height="20" rx="6" fill={palette.depth} /><rect x="3" y="6" width="26" height="20" rx="6" fill={fill} /><path d="M7 7.3h17" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".5" /><rect x="3" y="6" width="26" height="5" rx="5" fill={palette.light} opacity=".6" /><circle cx="10" cy="16" r="3.4" fill={palette.light} /><path d="M6.7 22c.5-2.7 1.6-4 3.3-4s2.8 1.3 3.3 4" fill={palette.ink} opacity=".7" /><rect x="17" y="14" width="8" height="2.2" rx="1.1" fill={palette.ink} opacity=".65" /><rect x="17" y="19" width="6" height="2" rx="1" fill={palette.light} /></>; break;
        case 'email': glyph = <><rect x="3" y="7.5" width="26" height="20" rx="6" fill={palette.depth} /><rect x="3" y="6" width="26" height="20" rx="6" fill={fill} /><path d="M7 7.4h17" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".48" /><path d="m5.5 10 10.5 8.4L26.5 10" fill={palette.light} opacity=".9" /><path d="m5.5 23 7.5-6m13.5 6L19 17" fill="none" stroke={palette.ink} strokeWidth="1.5" strokeLinecap="round" opacity=".72" /></>; break;
        case 'medical_record': glyph = <><rect x="6" y="5.5" width="20" height="24" rx="7" fill={palette.depth} /><rect x="6" y="4" width="20" height="24" rx="7" fill={fill} /><path d="M10 5.4h12" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".5" /><rect x="11" y="2.5" width="10" height="5" rx="2.5" fill={palette.light} /><circle cx="16" cy="17" r="6" fill={palette.light} opacity=".88" /><path d="M16 13.5v7m-3.5-3.5h7" stroke={palette.ink} strokeWidth="2" strokeLinecap="round" /></>; break;
        case 'membership': glyph = <><path d="M3 8a5 5 0 0 1 5-5h16a5 5 0 0 1 5 5v4a4 4 0 0 0 0 8v4a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-4a4 4 0 0 0 0-8Z" fill={palette.depth} transform="translate(0 1)" /><path d="M3 7a5 5 0 0 1 5-5h16a5 5 0 0 1 5 5v4a4 4 0 0 0 0 8v4a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-4a4 4 0 0 0 0-8Z" fill={fill} /><path d="M8 3.5h14" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".48" /><path d="m11 11 1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.5L8 20l.6-3.2-2.4-2.3 3.3-.5Z" fill={palette.light} /><rect x="18" y="12" width="7" height="2.3" rx="1.15" fill={palette.light} /><rect x="18" y="18" width="5" height="2" rx="1" fill={palette.ink} opacity=".55" /></>; break;
        case 'passport': glyph = <><rect x="6" y="3.5" width="20" height="27" rx="7" fill={palette.depth} /><rect x="6" y="2" width="20" height="27" rx="7" fill={fill} /><path d="M10 3.5h12" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".5" /><circle cx="16" cy="14" r="6" fill={palette.light} opacity=".9" /><circle cx="16" cy="14" r="4.3" fill="none" stroke={palette.ink} strokeWidth="1.2" /><path d="M11.7 14h8.6M16 9.7c1.8 2.1 1.8 6.5 0 8.6m0-8.6c-1.8 2.1-1.8 6.5 0 8.6" fill="none" stroke={palette.ink} strokeWidth="1" strokeLinecap="round" /><rect x="11" y="23" width="10" height="2" rx="1" fill={palette.light} /></>; break;
        case 'ssh_key': glyph = <><rect x="3" y="5.5" width="26" height="22" rx="7" fill={palette.depth} /><rect x="3" y="4" width="26" height="22" rx="7" fill={fill} /><path d="M8 5.3h15" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".45" /><rect x="6" y="8" width="20" height="14" rx="4" fill={palette.ink} /><path d="m10 12 3 2.5-3 2.5m5 0h4" fill="none" stroke={palette.light} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="23" cy="22" r="5" fill={palette.light} /><circle cx="22" cy="21" r="1.4" fill="none" stroke={palette.ink} strokeWidth="1.2" /><path d="m24 23 4 4m-1.4-1.4-1.5 1.5" fill="none" stroke={palette.ink} strokeWidth="1.2" strokeLinecap="round" /></>; break;
        case 'social_security_number': glyph = <><rect x="3" y="7.5" width="26" height="20" rx="7" fill={palette.depth} /><rect x="3" y="6" width="26" height="20" rx="7" fill={fill} /><path d="M8 7.4h15" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".48" /><path d="M16 9.5c3 2.2 5.5 2.4 5.5 2.4v4.8c0 4.3-2.2 6.6-5.5 8.1-3.3-1.5-5.5-3.8-5.5-8.1v-4.8S13 11.7 16 9.5Z" fill={palette.light} /><circle cx="16" cy="15.5" r="1.5" fill={palette.ink} /><rect x="13.5" y="19" width="5" height="1.6" rx=".8" fill={palette.ink} /></>; break;
        case 'wireless_router': glyph = <><path d="M8 15V7m16 8V7" fill="none" stroke={palette.ink} strokeWidth="2.4" strokeLinecap="round" /><path d="M10.5 12c3-3 8-3 11 0m-8 0c1.4-1.3 3.7-1.3 5 0" fill="none" stroke={palette.light} strokeWidth="1.8" strokeLinecap="round" /><rect x="3" y="15.5" width="26" height="12" rx="6" fill={palette.depth} /><rect x="3" y="14" width="26" height="12" rx="6" fill={fill} /><path d="M8 15.3h15" stroke="#fff" strokeWidth="1.05" strokeLinecap="round" opacity=".48" /><circle cx="9" cy="20" r="1.5" fill={palette.light} /><circle cx="14" cy="20" r="1.5" fill={palette.ink} /><rect x="19" y="19" width="6" height="2" rx="1" fill={palette.light} /></>; break;
    }

    return (
        <span className={`vault-type-icon vault-type-icon--${kind}`} style={{ '--item-type-icon-size': `${size}px` } as CSSProperties} aria-hidden="true">
            <svg viewBox="0 0 32 32" role="presentation">
                <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={palette.top} /><stop offset="39%" stopColor={palette.main} /><stop offset="73%" stopColor={palette.lower} /><stop offset="100%" stopColor={palette.depth} /></linearGradient></defs>
                {glyph}
            </svg>
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
        createdAt: item.createdAt,
        sortOrder: item.sortOrder,
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

function CardBrandMark({ number, compact = false }: { number?: string; compact?: boolean }) {
    const brand = detectCardBrand(number || '');
    const label = CARD_BRAND_LABELS[brand];
    return (
        <span className={`vault-card-brand is-${brand}${compact ? ' is-compact' : ''}`} title={label} aria-label={label}>
            {brand === 'mastercard' && <span className="vault-card-circles"><i /><i /></span>}
            <strong>{brand === 'amex' ? 'AMEX' : brand === 'diners' ? 'DC' : brand === 'unionpay' ? 'UP' : brand === 'unknown' ? 'CARD' : brand.toUpperCase()}</strong>
        </span>
    );
}

function useFocusIconId(prefix: string) {
    return `${prefix}-${useId().replace(/:/g, '')}`;
}

function mixHex(first: string, second: string, amount: number) {
    const parse = (value: string) => /^#[0-9a-f]{6}$/i.test(value)
        ? [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16))
        : [110, 143, 184];
    const start = parse(first);
    const end = parse(second);
    return `#${start.map((value, index) => Math.round(value + ((end[index] || 0) - value) * amount).toString(16).padStart(2, '0')).join('')}`;
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

function ExactAllItemsIcon({ size = 20 }: { size?: number }) {
    const gradientId = useFocusIconId('fp-all');
    return (
        <svg className="fp-style-icon" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F2F6F9" /><stop offset="38%" stopColor="#CBD5DE" /><stop offset="72%" stopColor="#A7B3BF" /><stop offset="100%" stopColor="#7E8B98" /></linearGradient></defs>
            <rect x="3" y="5.8" width="26" height="22" rx="7" fill="#66727D" />
            <rect x="3" y="4.5" width="26" height="22" rx="7" fill={`url(#${gradientId})`} />
            <path d="M9 5.7H23" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
            <rect x="7" y="9" width="18" height="4" rx="2" fill="#73818D" />
            <rect x="9" y="17" width="14" height="3.8" rx="1.9" fill="#73818D" />
        </svg>
    );
}

function ExactTagIcon({ size = 20, color = '#52D58E' }: { size?: number; color?: string }) {
    const gradientId = useFocusIconId('fp-tag');
    const top = mixHex(color, '#ffffff', 0.34);
    const lower = mixHex(color, '#000000', 0.2);
    const depth = mixHex(color, '#000000', 0.38);
    return (
        <svg className="fp-style-icon" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={top} /><stop offset="40%" stopColor={color} /><stop offset="74%" stopColor={lower} /><stop offset="100%" stopColor={depth} /></linearGradient></defs>
            <path transform="translate(0 1.5)" fill={depth} d="M4 8C4 5.6 5.6 4 8 4h6c1.4 0 2.5.45 3.45 1.4L27 14.95a3.82 3.82 0 0 1 0 5.4L20.35 27a3.82 3.82 0 0 1-5.4 0L5.4 17.45A4.82 4.82 0 0 1 4 14Z" />
            <path fill={`url(#${gradientId})`} d="M4 8C4 5.6 5.6 4 8 4h6c1.4 0 2.5.45 3.45 1.4L27 14.95a3.82 3.82 0 0 1 0 5.4L20.35 27a3.82 3.82 0 0 1-5.4 0L5.4 17.45A4.82 4.82 0 0 1 4 14Z" />
            <path d="M7.2 5.7H13" fill="none" stroke="#FFFFFF" strokeWidth="1.15" strokeLinecap="round" opacity=".5" />
            <circle cx="10" cy="10" r="2.5" fill={depth} />
            <circle cx="9.5" cy="9.3" r=".75" fill="#FFFFFF" opacity=".48" />
        </svg>
    );
}

function ExactFavoritesIcon({ size = 20 }: { size?: number }) {
    const gradientId = useFocusIconId('fp-favorite');
    const star = "M16 2.8c.8 0 1.45.45 1.8 1.15l2.4 4.9 5.4.8c1.4.2 1.95 1.9.95 2.9l-3.9 3.8.9 5.4c.25 1.4-1.25 2.5-2.5 1.85L16 20.95l-5.05 2.65c-1.25.65-2.75-.45-2.5-1.85l.9-5.4-3.9-3.8c-1-1-.45-2.7.95-2.9l5.4-.8 2.4-4.9c.35-.7 1-1.15 1.8-1.15Z";
    return (
        <svg className="fp-style-icon" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFD076" /><stop offset="38%" stopColor="#FFA037" /><stop offset="72%" stopColor="#F47A18" /><stop offset="100%" stopColor="#C94D08" /></linearGradient></defs>
            <path transform="translate(0 1.6)" fill="#A9450A" d={star} />
            <path fill={`url(#${gradientId})`} d={star} />
            <path d="M11.5 9c1.7-3.2 5.6-4 8-1" fill="none" stroke="#FFF7D7" strokeWidth="1.15" strokeLinecap="round" opacity=".58" />
        </svg>
    );
}

function ExactVaultIcon({ color }: { color: string }) {
    const outerId = useFocusIconId('fp-vault');
    const wheelId = useFocusIconId('fp-vault-wheel');
    const isDefaultVault = color.toLowerCase() === '#6e8fb8';
    const top = isDefaultVault ? '#F8FBFD' : mixHex(color, '#ffffff', 0.72);
    const upper = isDefaultVault ? '#DDE5EB' : mixHex(color, '#ffffff', 0.42);
    const face = isDefaultVault ? '#AEBAC4' : color;
    const lower = isDefaultVault ? '#8996A1' : mixHex(color, '#000000', 0.15);
    const depth = isDefaultVault ? '#707C87' : mixHex(color, '#000000', 0.3);
    return (
        <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true" className="vault-source-icon fp-style-icon">
            <defs>
                <linearGradient id={outerId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={top} /><stop offset="42%" stopColor={upper} /><stop offset="75%" stopColor={face} /><stop offset="100%" stopColor={lower} /></linearGradient>
                <radialGradient id={wheelId} cx="38%" cy="28%" r="78%"><stop offset="0%" stopColor="#C5CED6" /><stop offset="55%" stopColor="#8996A1" /><stop offset="100%" stopColor="#53606C" /></radialGradient>
            </defs>
            <rect x="3" y="4.5" width="26" height="26" rx="9" fill={depth} />
            <rect x="3" y="3" width="26" height="26" rx="9" fill={`url(#${outerId})`} />
            <path d="M8 4.4h15" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity=".66" />
            <circle cx="16" cy="16" r="8" fill={`url(#${wheelId})`} />
            <circle cx="16" cy="16" r="3.1" fill="#E9EEF2" />
            <circle cx="16" cy="16" r="1.15" fill="#66727E" />
            <rect x="15" y="7" width="2" height="4" rx="1" fill="#EAF0F4" />
            <rect x="21" y="15" width="4" height="2" rx="1" fill="#EAF0F4" />
            <rect x="15" y="21" width="2" height="4" rx="1" fill="#EAF0F4" />
            <rect x="7" y="15" width="4" height="2" rx="1" fill="#EAF0F4" />
        </svg>
    );
}

function ExactArchiveIcon({ size = 20 }: { size?: number }) {
    const gradientId = useFocusIconId('fp-archive');
    return (
        <svg className="fp-style-icon" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EDF2F5" /><stop offset="40%" stopColor="#CBD4DC" /><stop offset="73%" stopColor="#A4B0BA" /><stop offset="100%" stopColor="#788591" /></linearGradient></defs>
            <rect x="5" y="10.5" width="22" height="17" rx="7" fill="#74808B" />
            <rect x="5" y="9" width="22" height="17" rx="7" fill={`url(#${gradientId})`} />
            <rect x="4" y="6" width="24" height="8" rx="4" fill="#8995A0" />
            <rect x="4" y="4.8" width="24" height="8" rx="4" fill={`url(#${gradientId})`} />
            <path d="M8 6h15" fill="none" stroke="#FFFFFF" strokeWidth="1.15" strokeLinecap="round" opacity=".62" />
            <rect x="11" y="17" width="10" height="3.6" rx="1.8" fill="#687581" />
        </svg>
    );
}

function ExactRecentlyDeletedIcon({ size = 20 }: { size?: number }) {
    const gradientId = useFocusIconId('fp-history');
    return (
        <svg className="fp-style-icon" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
            <defs><radialGradient id={gradientId} cx="38%" cy="28%" r="78%"><stop offset="0%" stopColor="#FFD0C3" /><stop offset="42%" stopColor="#FF927A" /><stop offset="74%" stopColor="#EA624B" /><stop offset="100%" stopColor="#B83D2F" /></radialGradient></defs>
            <circle cx="16" cy="17.4" r="12" fill="#8F2E24" />
            <circle cx="16" cy="16" r="12" fill={`url(#${gradientId})`} />
            <path d="M8.5 10c2.5-4.2 9-6.1 13.7-2.5" fill="none" stroke="#FFF5F0" strokeWidth="1.25" strokeLinecap="round" opacity=".68" />
            <path d="M16 9.5v6.7l4.6 2.7" fill="none" stroke="#8E3028" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8.2 7.4H4.7v3.5" fill="none" stroke="#FFF9F5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
    const typeIconKind = item.type === 'custom' && item.kind ? item.kind : null;
    const isCard = item.type === 'card';
    return (
        <span
            className={`vault-item-mark${typeIconKind || isCard ? ' is-type-icon' : ''}${isCard ? ' is-card-brand' : ''}${favicon ? ' has-favicon' : ''} relative ${large ? 'h-[60px] w-[60px] rounded-[13px] text-[18px]' : 'h-8 w-8 rounded-[7px] text-[11px]'} flex shrink-0 items-center justify-center overflow-hidden border font-bold tracking-[-0.03em]`}
            style={typeIconKind || isCard || favicon ? undefined : {
                color: tone,
                background: hexWithAlpha(tone, '35'),
                borderColor: hexWithAlpha(tone, '55'),
                boxShadow: `0 7px 18px -10px ${hexWithAlpha(tone, 'bb')}, inset 0 1px 0 rgba(255,255,255,.09)`,
            }}
            aria-hidden="true"
        >
            {isCard ? <CardBrandMark number={item.cardNumber} compact={!large} /> : typeIconKind ? <SoftItemTypeIcon kind={typeIconKind} size={large ? 60 : 32} /> : item.mark}
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

function SortableVaultRow({ item, selected, draggable, onSelect, onContextMenu, onMore }: {
    item: VaultItem;
    selected: boolean;
    draggable: boolean;
    onSelect: () => void;
    onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
    onMore: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !draggable });
    return (
        <div
            ref={setNodeRef}
            role="button"
            tabIndex={0}
            onPointerDown={(event) => { if (draggable) listeners?.onPointerDown?.(event); }}
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
            <span className="vault-row-drag" {...attributes} {...listeners} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => { event.stopPropagation(); listeners?.onPointerDown?.(event); }} aria-label={`Drag ${item.title} to reorder`}><GripVertical size={13} /></span>
            <ItemMark item={item} />
            <span className="vault-row-copy">
                <strong>{item.title}</strong>
                <small>{item.authMethod === 'Password' ? item.identity : item.authMethod}</small>
            </span>
            <button type="button" className="vault-row-more" onPointerDown={(event) => event.stopPropagation()} onClick={onMore} aria-label={`More actions for ${item.title}`}><EllipsisVertical size={15} /></button>
        </div>
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
    { id: 'vault' },
    { id: 'home' },
    { id: 'work' },
    { id: 'star' },
    { id: 'tag' },
];

function FocusCollectionGlyph({ color, icon, size }: { color: string; icon: string; size: number }) {
    const gradientId = useFocusIconId(`fp-collection-${icon}`);
    if (icon === 'vault') return <ExactVaultIcon color={color} />;
    if (icon === 'tag') return <ExactTagIcon size={size} color={color} />;
    const top = mixHex(color, '#ffffff', 0.42);
    const lower = mixHex(color, '#000000', 0.2);
    const depth = mixHex(color, '#000000', 0.38);
    let glyph: ReactNode;
    if (icon === 'home') {
        glyph = <><path d="m4 15 12-11 12 11v12H4Z" fill={depth} transform="translate(0 1.4)" /><path d="m4 14 12-11 12 11v12H4Z" fill={`url(#${gradientId})`} /><path d="m8 13 8-7 8 7" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".48" /><rect x="12" y="17" width="8" height="9" rx="3" fill="#F4F2EF" opacity=".86" /></>;
    } else if (icon === 'work') {
        glyph = <><rect x="3" y="10.5" width="26" height="18" rx="7" fill={depth} /><rect x="3" y="9" width="26" height="18" rx="7" fill={`url(#${gradientId})`} /><path d="M9 10.4h14" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".5" /><path d="M11 9V7c0-1.7 1.3-3 3-3h4c1.7 0 3 1.3 3 3v2" fill="none" stroke={lower} strokeWidth="2.5" strokeLinecap="round" /><rect x="3" y="15" width="26" height="5" fill={lower} opacity=".75" /><rect x="13" y="16" width="6" height="4" rx="2" fill="#F3F1ED" /></>;
    } else {
        const star = "M16 3.2c.8 0 1.4.4 1.8 1.2l2.3 4.7 5.2.8c1.4.2 1.9 1.9.9 2.9l-3.8 3.7.9 5.2c.2 1.4-1.2 2.4-2.5 1.8L16 21l-4.9 2.5c-1.3.6-2.7-.4-2.5-1.8l.9-5.2-3.8-3.7c-1-1-.5-2.7.9-2.9l5.2-.8 2.3-4.7c.4-.8 1-1.2 1.9-1.2Z";
        glyph = <><path d={star} transform="translate(0 1.4)" fill={depth} /><path d={star} fill={`url(#${gradientId})`} /><path d="M11.5 9c1.6-3 5.3-3.8 7.6-1" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".5" /></>;
    }
    return <svg className="fp-style-icon" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true"><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={top} /><stop offset="42%" stopColor={color} /><stop offset="75%" stopColor={lower} /><stop offset="100%" stopColor={depth} /></linearGradient></defs>{glyph}</svg>;
}

function CollectionMark({ color, icon, size = 14 }: { color: string; icon: string; size?: number }) {
    return (
        <span className={`vault-collection-mark${icon === 'vault' ? ' is-vault' : ''}`} style={{ color }}>
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
                    <div className="vault-choice-group"><span>Icon</span><div className="vault-icon-grid">{COLLECTION_ICONS.map((option) => <button key={option.id} type="button" className={icon === option.id ? 'is-selected' : ''} onClick={() => setIcon(option.id)} aria-label={`Use ${option.id} icon`}><FocusCollectionGlyph color={color} icon={option.id} size={22} /></button>)}</div></div>
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
    const selectCountry = (next: PhoneCountry) => {
        const localDigits = phoneLocalDigits(value, country);
        setCountry(next);
        onChange(formatInternationalPhone(localDigits, next));
        setOpen(false);
    };
    return (
        <div className="vault-phone-input" onBlur={(event) => {
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
            <AnimatePresence>{open && (
                <motion.div className="vault-phone-country-menu" role="listbox" initial={{ opacity: 0, y: -5, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.99 }}>
                    {PHONE_COUNTRIES.map((option) => (
                        <button key={option.iso} type="button" role="option" aria-selected={option.iso === country.iso} onClick={() => selectCountry(option)}>
                            <CountryFlagIcon iso={option.iso} /><strong>{option.name}</strong><small>{option.dialCode}</small>{option.iso === country.iso && <Check size={12} />}
                        </button>
                    ))}
                </motion.div>
            )}</AnimatePresence>
        </div>
    );
}

type AddressSuggestion = {
    place_id?: number;
    display_name?: string;
    address?: {
        house_number?: string;
        road?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        state?: string;
        postcode?: string;
        country?: string;
        country_code?: string;
    };
};

function AddressAutocompleteInput({ value, onChange, onBlur, invalid }: {
    value: string;
    onChange: (value: string, parts?: Record<string, string>) => void;
    onBlur: () => void;
    invalid?: boolean;
}) {
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const acceptedValue = useRef('');

    useEffect(() => {
        const query = value.trim();
        if (query.length < 4 || query === acceptedValue.current) {
            setSuggestions([]);
            setOpen(false);
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setLoading(true);
            void fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then((response) => response.ok ? response.json() : Promise.reject(new Error('Address search failed')))
                .then((rows: AddressSuggestion[]) => {
                    setSuggestions((rows || []).filter((row) => row.display_name));
                    setOpen(true);
                })
                .catch((error: unknown) => {
                    if ((error as { name?: string })?.name !== 'AbortError') setSuggestions([]);
                })
                .finally(() => setLoading(false));
        }, 420);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [value]);

    const choose = (suggestion: AddressSuggestion) => {
        const address = suggestion.address || {};
        const label = suggestion.display_name || '';
        acceptedValue.current = label;
        onChange(label, {
            address: label,
            addressLine1: [address.house_number, address.road].filter(Boolean).join(' '),
            city: address.city || address.town || address.village || address.municipality || '',
            region: address.state || '',
            postalCode: address.postcode || '',
            country: address.country || '',
            countryCode: address.country_code?.toUpperCase() || '',
        });
        setOpen(false);
    };

    return (
        <div className="vault-address-autocomplete" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setOpen(false);
                onBlur();
            }
        }}>
            <MapPin size={14} />
            <input value={value} onChange={(event) => { acceptedValue.current = ''; onChange(event.target.value); }} onFocus={() => suggestions.length && setOpen(true)} placeholder="Start typing an address…" autoComplete="street-address" aria-invalid={invalid} />
            {loading && <span className="vault-address-spinner" aria-label="Finding addresses" />}
            <AnimatePresence>{open && suggestions.length > 0 && (
                <motion.div className="vault-address-suggestions" role="listbox" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                    {suggestions.map((suggestion) => (
                        <button key={suggestion.place_id || suggestion.display_name} type="button" role="option" onClick={() => choose(suggestion)}>
                            <MapPin size={14} /><span>{suggestion.display_name}</span>
                        </button>
                    ))}
                    <small>Address suggestions · OpenStreetMap</small>
                </motion.div>
            )}</AnimatePresence>
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

function ItemEditorModal({ kind, item, vaults, tags, defaultVaultId, onClose, onSave, onCreateTag, busy }: {
    kind: EditableItemKind;
    item?: VaultItem;
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
        <ModalPortal>
            <motion.div className="vault-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
                <motion.div role="dialog" aria-modal="true" className="vault-editor-modal" initial={{ opacity: 0, y: 16, scale: 0.988 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }}>
                    <form onSubmit={submit} noValidate>
                        <div className="vault-editor-titlebar">
                            <button type="button" onClick={onClose} aria-label="Back"><ChevronLeft size={18} /></button>
                            <div><small>{item ? 'Editing' : 'Creating'}</small><h2>{item ? 'Edit item' : 'New item'}</h2></div>
                            <button type="button" onClick={onClose} aria-label="Close"><X size={17} /></button>
                        </div>
                        <div className="vault-editor-scroll">
                            <div className="vault-editor-identity">
                                {kind === 'card' ? <CardBrandMark number={values.cardNumber} /> : <SoftItemTypeIcon kind={kind} size={58} />}
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
                                            ) : isAddress ? (
                                                <AddressAutocompleteInput value={values.address || ''} onChange={setAddressValue} onBlur={() => validateField(field)} invalid={Boolean(fieldErrors[field.key])} />
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
                        <div className="vault-modal-actions"><span className={localError ? 'is-error' : ''}>{localError || 'Changes stay on this device'}</span><div><button type="button" onClick={onClose} className="vault-button vault-button-secondary">Cancel</button><button type="submit" disabled={saving || busy} className="vault-button vault-button-primary"><ShieldCheck size={14} /> {saving ? 'Saving…' : 'Save item'}</button></div></div>
                    </form>
                    <AnimatePresence>{tagModalOpen && <CollectionModal mode="tag" busy={tagBusy} onClose={() => setTagModalOpen(false)} onCreate={(value) => { void createTag(value); }} />}</AnimatePresence>
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
                <div className="vault-companion-symbol"><Laptop size={22} /></div>
                <p className="vault-companion-eyebrow">Extension required</p>
                <h2>Connect FocuzPass</h2>
                <p className="vault-companion-copy">
                    Your vault is encrypted on this device inside the FocuzNow extension. Install or reload the extension, then reopen this tab — the same vault opens here and in the extension.
                </p>
                <div className="vault-companion-actions">
                    {extensionInstalled ? (
                        <button
                            type="button"
                            className="vault-button vault-button-primary"
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
                            className="vault-button vault-button-primary"
                        >
                            <Download size={14} />
                            Get the FocuzNow extension
                        </a>
                    )}
                    <button
                        type="button"
                        className="vault-button vault-button-secondary"
                        onClick={() => window.location.reload()}
                    >
                        Retry connection
                    </button>
                </div>
                <p className="vault-companion-footnote">
                    <ShieldCheck size={11} /> Secrets never sync to FocuzNow cloud
                </p>
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
}: {
    avatarUrl?: string | null;
    avatarFallbackUrl?: string | null;
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
    const [typeFilters, setTypeFilters] = useState<VaultFilter[]>([]);
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState('');
    const [modal, setModal] = useState<'picker' | 'editor' | null>(null);
    const [editorKind, setEditorKind] = useState<EditableItemKind>('login');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [collectionModal, setCollectionModal] = useState<'vault' | 'tag' | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);
    const [listSearchOpen, setListSearchOpen] = useState(false);
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
    const [unlockValue, setUnlockValue] = useState('');
    const [setupPassword, setSetupPassword] = useState('');
    const [setupConfirm, setSetupConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const listSearchRef = useRef<HTMLInputElement>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 7 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

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
            if (event.key === 'Escape') {
                setRowMenu(null);
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
        return items.filter((item) => {
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
        if (sortMode === 'custom') return [['Custom order', filteredItems] as [string, VaultItem[]]];
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
            await focuzPassReorder(merged.map((item) => item.id));
        } catch (err) {
            await loadUnlocked();
            setToast(err instanceof Error ? err.message : 'Could not save the custom order');
            window.setTimeout(() => setToast(''), 2200);
        }
    };

    const selected = selectedId ? filteredItems.find((item) => item.id === selectedId) : undefined;
    const rowMenuItem = rowMenu ? items.find((item) => item.id === rowMenu.itemId) : undefined;
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
            showToast(`${target.title} moved to Recently Deleted`);
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
            <div className={`vault-shell${navCollapsed ? ' is-nav-collapsed' : ''}`}>
                <aside className="vault-nav">
                    <div className="vault-brand-row">
                        <span>FocuzPass</span>
                        <button type="button" onClick={() => setNavCollapsed((collapsed) => !collapsed)} aria-label={navCollapsed ? 'Expand FocuzPass sidebar' : 'Collapse FocuzPass sidebar'} title={navCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                            <ExactSidebarDrawerCloseIcon size={15} />
                        </button>
                    </div>

                    <div className="vault-profile-wrap">
                        <button type="button" className="vault-profile" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen}>
                            <VaultProfileAvatar avatarUrl={avatarUrl} fallbackUrl={avatarFallbackUrl} name={username || accountName} />
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
                                <button type="button" className="vault-nav-add" onClick={() => setCollectionModal('vault')} aria-label="New Vault"><ExactSidebarPlusIcon /></button>
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
                                <button type="button" className="vault-nav-add" onClick={() => setCollectionModal('tag')} aria-label="New Tag"><ExactSidebarPlusIcon /></button>
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
                        <button type="button" className={`vault-nav-item${view.kind === 'deleted' ? ' is-active-subtle' : ''}`} onClick={() => { setView({ kind: 'deleted' }); setSelectedId(''); }}><ExactRecentlyDeletedIcon size={20} /><span className="vault-nav-label">Recently Deleted</span></button>
                    </div>
                </aside>

                <header className="vault-toolbar">
                    {onExit && <button type="button" className="vault-back-button" onClick={onExit}><ArrowLeft size={14} /><span>FocuzNow</span></button>}
                    <label className="vault-search">
                        <Search size={14} aria-hidden="true" />
                        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search in ${viewTitle}`} />
                        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={12} /></button>}
                    </label>
                    <button type="button" className="vault-help" onClick={() => showToast('Use / to jump to search. Your vault stays on this device.')}>Help</button>
                    <button type="button" onClick={() => setModal('picker')} className="vault-new-item"><Plus size={13} /> New Item</button>
                </header>

                <AnimatePresence>
                    {filtersOpen && (
                        <ModalPortal>
                            <div className="vault-filter-layer">
                                <motion.button type="button" className="vault-filter-scrim" aria-label="Close filters" onClick={() => setFiltersOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                                <motion.aside className="vault-filter-drawer" role="dialog" aria-modal="true" aria-label="Filter vault items" initial={{ x: -28, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -22, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.2, 0, 0, 1] }}>
                                    <header><div><small>Current view</small><h2>Filter {viewTitle}</h2></div><button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={16} /></button></header>
                                    <div className="vault-filter-drawer-scroll">
                                        <section>
                                            <div className="vault-filter-drawer-heading"><div><strong>Item type</strong><small>Select one or more</small></div>{typeFilters.length > 0 && <button type="button" onClick={() => setTypeFilters([])}>Clear</button>}</div>
                                            <div className="vault-filter-checkbox-grid">
                                                {FILTERS.filter((option) => option.id !== 'all' && option.id !== 'risk').map((option) => {
                                                    const FilterIcon = option.icon;
                                                    const checked = typeFilters.includes(option.id);
                                                    return (
                                                        <button key={option.id} type="button" role="checkbox" aria-checked={checked} className={checked ? 'is-checked' : ''} onClick={() => toggleTypeFilter(option.id)}>
                                                            <span className="vault-filter-checkbox">{checked && <Check size={11} />}</span><FilterIcon size={14} /><span>{option.label}</span><small>{countForFilter(option.id)}</small>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                        <section>
                                            <div className="vault-filter-drawer-heading"><div><strong>Created</strong><small>Choose a quick range or exact dates</small></div></div>
                                            <div className="vault-filter-radio-list">
                                                {([['any', 'Any time'], ['7d', 'Past 7 days'], ['30d', 'Past 30 days'], ['90d', 'Past 90 days'], ['year', 'This year']] as [CreatedFilter, string][]).map(([value, label]) => (
                                                    <button key={value} type="button" role="radio" aria-checked={createdFilter === value && !createdFrom && !createdTo} className={createdFilter === value && !createdFrom && !createdTo ? 'is-checked' : ''} onClick={() => { setCreatedFilter(value); setCreatedFrom(''); setCreatedTo(''); }}>
                                                        <span>{createdFilter === value && !createdFrom && !createdTo && <i />}</span>{label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="vault-filter-date-range">
                                                <label><span>From</span><input type="date" value={createdFrom} onChange={(event) => { setCreatedFrom(event.target.value); setCreatedFilter('any'); }} /></label>
                                                <i>to</i>
                                                <label><span>To</span><input type="date" value={createdTo} min={createdFrom || undefined} onChange={(event) => { setCreatedTo(event.target.value); setCreatedFilter('any'); }} /></label>
                                            </div>
                                        </section>
                                        <section>
                                            <div className="vault-filter-drawer-heading"><div><strong>More filters</strong><small>Narrow this view further</small></div></div>
                                            <button type="button" role="checkbox" aria-checked={favoritesOnly} className={`vault-filter-wide-check${favoritesOnly ? ' is-checked' : ''}`} onClick={() => setFavoritesOnly((current) => !current)}><span className="vault-filter-checkbox">{favoritesOnly && <Check size={11} />}</span><ExactFavoritesIcon size={15} /><div><strong>Favorites only</strong><small>Show starred items</small></div></button>
                                            <button type="button" role="checkbox" aria-checked={riskOnly} className={`vault-filter-wide-check${riskOnly ? ' is-checked' : ''}`} onClick={() => setRiskOnly((current) => !current)}><span className="vault-filter-checkbox">{riskOnly && <Check size={11} />}</span><ShieldCheck size={15} /><div><strong>Security review</strong><small>Weak or reused credentials</small></div></button>
                                        </section>
                                    </div>
                                    <footer><button type="button" onClick={() => { setTypeFilters([]); setCreatedFilter('any'); setCreatedFrom(''); setCreatedTo(''); setFavoritesOnly(false); setRiskOnly(false); }}>Clear all</button><button type="button" className="is-primary" onClick={() => setFiltersOpen(false)}>Show {filteredItems.length} items</button></footer>
                                </motion.aside>
                            </div>
                        </ModalPortal>
                    )}
                </AnimatePresence>

                <div className="vault-content-grid">
                    <div className="vault-list">
                        <div className="vault-list-toolbar">
                            <div className="vault-category-summary"><LayoutGrid size={11} /><span>All Categories</span></div>
                            <div className="vault-list-actions">
                                <button type="button" className={listSearchOpen ? 'is-active' : ''} onClick={() => { setListSearchOpen((open) => { const next = !open; if (next) window.setTimeout(() => listSearchRef.current?.focus(), 0); return next; }); setSortOpen(false); }} aria-label="Search this item list"><ListSearchIcon /></button>
                                <button type="button" className={filtersOpen || activeFilterCount ? 'is-active' : ''} onClick={() => { setFiltersOpen(true); setSortOpen(false); }} aria-label={`Filter items${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} aria-expanded={filtersOpen}><Funnel size={13} />{activeFilterCount > 0 && <small>{activeFilterCount}</small>}</button>
                                <div className="relative">
                                    <button type="button" className={sortOpen ? 'is-active' : ''} onClick={() => { setSortOpen((open) => !open); setFiltersOpen(false); }} aria-label="Sort items" aria-expanded={sortOpen}><SortItemsIcon /></button>
                                    <AnimatePresence>{sortOpen && <motion.div className="vault-sort-menu" initial={{ opacity: 0, y: -5, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.99 }}>
                                        <div className="vault-sort-menu-heading"><span>Sort by</span><small>{SORT_OPTIONS.find((option) => option.id === sortMode)?.label}</small></div>
                                        {SORT_OPTIONS.map((option) => <button key={option.id} type="button" className={sortMode === option.id ? 'is-active' : ''} onClick={() => { setSortMode(option.id); setSortOpen(false); }}><span className="vault-sort-radio">{sortMode === option.id && <i />}</span><span><strong>{option.label}</strong><small>{option.description}</small></span>{option.id === 'custom' && <GripVertical size={13} />}</button>)}
                                    </motion.div>}</AnimatePresence>
                                </div>
                            </div>
                        </div>

                        <AnimatePresence initial={false}>{listSearchOpen && <motion.label className="vault-list-inline-search" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><Search size={12} /><input ref={listSearchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, websites, fields…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear list search"><X size={11} /></button>}</motion.label>}</AnimatePresence>

                        <div className="vault-list-scroll">
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => { void handleDragEnd(event); }}>
                            <SortableContext items={filteredItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                            <AnimatePresence initial={false}>
                                {filteredItems.length > 0 ? groupedItems.map(([group, groupItems]) => (
                                    <motion.section key={group} className={`vault-month-group${sortMode === 'custom' ? ' is-custom-order' : ''}`} initial={false} animate={{ opacity: 1 }}>
                                        <p>{group}</p>
                                        {groupItems.map((item) => {
                                            const isSelected = selected?.id === item.id;
                                            return (
                                                <SortableVaultRow
                                                    key={item.id}
                                                    item={item}
                                                    selected={isSelected}
                                                    draggable={sortMode === 'custom'}
                                                    onSelect={() => { setSelectedId(item.id); setRevealed(false); setActionsOpen(false); }}
                                                    onContextMenu={(event) => { event.preventDefault(); setSelectedId(item.id); setRevealed(false); setActionsOpen(false); setRowMenu({ itemId: item.id, x: Math.min(event.clientX, window.innerWidth - 228), y: Math.min(event.clientY, window.innerHeight - 300) }); }}
                                                    onMore={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setSelectedId(item.id); setRowMenu({ itemId: item.id, x: Math.min(rect.right, window.innerWidth - 228), y: Math.min(rect.bottom + 5, window.innerHeight - 300) }); }}
                                                />
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
                                        <button type="button" onClick={() => { setTypeFilters([]); setCreatedFilter('any'); setCreatedFrom(''); setCreatedTo(''); setFavoritesOnly(false); setRiskOnly(false); setQuery(''); }}>Clear filters</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            </SortableContext>
                            </DndContext>
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
                {modal === 'editor' && <ItemEditorModal kind={editorKind} item={editingId ? items.find((item) => item.id === editingId) : undefined} vaults={vaults} tags={tags} defaultVaultId={view.kind === 'vault' ? view.id : undefined} onClose={() => { setModal(null); setEditingId(null); }} onSave={(draft) => saveItem(draft, { throwOnError: true })} onCreateTag={createTagForEditor} busy={busy} />}
                {collectionModal && <CollectionModal mode={collectionModal} onClose={() => setCollectionModal(null)} onCreate={(value) => { void createCollection(collectionModal, value).catch((err) => { setError(err instanceof Error ? err.message : `Could not create ${collectionModal}`); }); }} busy={busy} />}
            </AnimatePresence>

            <AnimatePresence>
                {rowMenu && rowMenuItem && (
                    <ModalPortal>
                        <motion.div className="vault-context-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && setRowMenu(null)}>
                            <motion.div className="vault-item-actions-menu vault-row-actions-menu" style={{ left: rowMenu.x, top: rowMenu.y }} initial={{ opacity: 0, y: -3, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -2, scale: 0.99 }} onMouseDown={(event) => event.stopPropagation()}>
                                {rowMenuItem.deletedAt ? (
                                    <>
                                        <button type="button" onClick={() => void updateItemAction(rowMenuItem, 'restore')}><ArchiveRestore size={15} /> Restore</button>
                                        <button type="button" className="is-danger" onClick={() => void updateItemAction(rowMenuItem, 'purge')}><Trash2 size={15} /> Delete permanently</button>
                                    </>
                                ) : (
                                    <>
                                        <button type="button" onClick={() => void updateItemAction(rowMenuItem, 'favorite', !rowMenuItem.favorite)}><ExactFavoritesIcon size={15} /> {rowMenuItem.favorite ? 'Remove from Favorites' : 'Add to Favorites'}</button>
                                        {vaults.length > 1 && <div className="vault-move-group"><span><FolderInput size={13} /> Move to</span>{vaults.filter((vault) => vault.id !== rowMenuItem.vaultId).map((vault) => <button type="button" key={vault.id} onClick={() => void moveItem(rowMenuItem, vault.id)}><CollectionMark color={vault.color} icon={vault.icon} size={11} /> {vault.name}</button>)}</div>}
                                        <button type="button" onClick={() => void updateItemAction(rowMenuItem, 'duplicate')}><CopyPlus size={15} /> Duplicate</button>
                                        <button type="button" onClick={() => void updateItemAction(rowMenuItem, rowMenuItem.archivedAt ? 'unarchive' : 'archive')}><ExactArchiveIcon size={15} /> {rowMenuItem.archivedAt ? 'Restore from Archive' : 'Archive'}</button>
                                        <button type="button" className="is-danger" onClick={() => void deleteItem(rowMenuItem)}><Trash2 size={15} /> Delete</button>
                                    </>
                                )}
                            </motion.div>
                        </motion.div>
                    </ModalPortal>
                )}
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
