export type CardBrand =
    | 'visa'
    | 'mastercard'
    | 'amex'
    | 'discover'
    | 'jcb'
    | 'diners'
    | 'unionpay'
    | 'maestro'
    | 'unknown';

export type FocuzPassFieldFormat =
    | 'text'
    | 'email'
    | 'phone'
    | 'url'
    | 'card-number'
    | 'card-expiry'
    | 'cvv'
    | 'date'
    | 'postal-code'
    | 'routing-number'
    | 'swift'
    | 'ip-address'
    | 'port'
    | 'ssn'
    | 'address';

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    jcb: 'JCB',
    diners: 'Diners Club',
    unionpay: 'UnionPay',
    maestro: 'Maestro',
    unknown: 'Card',
};

export type PhoneCountry = {
    iso: string;
    name: string;
    dialCode: string;
    localLengths: number[];
    style?: 'nanp' | 'french' | 'indian' | 'australian' | 'british' | 'japanese';
};

export const PHONE_COUNTRIES: PhoneCountry[] = [
    { iso: 'US', name: 'United States', dialCode: '+1', localLengths: [10], style: 'nanp' },
    { iso: 'CA', name: 'Canada', dialCode: '+1', localLengths: [10], style: 'nanp' },
    { iso: 'GB', name: 'United Kingdom', dialCode: '+44', localLengths: [9, 10], style: 'british' },
    { iso: 'AU', name: 'Australia', dialCode: '+61', localLengths: [9], style: 'australian' },
    { iso: 'IN', name: 'India', dialCode: '+91', localLengths: [10], style: 'indian' },
    { iso: 'FR', name: 'France', dialCode: '+33', localLengths: [9], style: 'french' },
    { iso: 'DE', name: 'Germany', dialCode: '+49', localLengths: [10, 11] },
    { iso: 'ES', name: 'Spain', dialCode: '+34', localLengths: [9] },
    { iso: 'IT', name: 'Italy', dialCode: '+39', localLengths: [9, 10] },
    { iso: 'NL', name: 'Netherlands', dialCode: '+31', localLengths: [9] },
    { iso: 'BE', name: 'Belgium', dialCode: '+32', localLengths: [9] },
    { iso: 'CH', name: 'Switzerland', dialCode: '+41', localLengths: [9] },
    { iso: 'AT', name: 'Austria', dialCode: '+43', localLengths: [10, 11] },
    { iso: 'IE', name: 'Ireland', dialCode: '+353', localLengths: [9] },
    { iso: 'NZ', name: 'New Zealand', dialCode: '+64', localLengths: [8, 9, 10] },
    { iso: 'MX', name: 'Mexico', dialCode: '+52', localLengths: [10] },
    { iso: 'BR', name: 'Brazil', dialCode: '+55', localLengths: [10, 11] },
    { iso: 'AR', name: 'Argentina', dialCode: '+54', localLengths: [10] },
    { iso: 'JP', name: 'Japan', dialCode: '+81', localLengths: [9, 10], style: 'japanese' },
    { iso: 'KR', name: 'South Korea', dialCode: '+82', localLengths: [9, 10] },
    { iso: 'CN', name: 'China', dialCode: '+86', localLengths: [11] },
    { iso: 'SG', name: 'Singapore', dialCode: '+65', localLengths: [8] },
    { iso: 'AE', name: 'United Arab Emirates', dialCode: '+971', localLengths: [9] },
    { iso: 'SA', name: 'Saudi Arabia', dialCode: '+966', localLengths: [9] },
    { iso: 'ZA', name: 'South Africa', dialCode: '+27', localLengths: [9] },
    { iso: 'NG', name: 'Nigeria', dialCode: '+234', localLengths: [10] },
    { iso: 'KE', name: 'Kenya', dialCode: '+254', localLengths: [9] },
    { iso: 'GH', name: 'Ghana', dialCode: '+233', localLengths: [9] },
    { iso: 'PK', name: 'Pakistan', dialCode: '+92', localLengths: [10] },
    { iso: 'BD', name: 'Bangladesh', dialCode: '+880', localLengths: [10] },
    { iso: 'PH', name: 'Philippines', dialCode: '+63', localLengths: [10] },
    { iso: 'ID', name: 'Indonesia', dialCode: '+62', localLengths: [9, 10, 11, 12] },
    { iso: 'MY', name: 'Malaysia', dialCode: '+60', localLengths: [9, 10] },
    { iso: 'TH', name: 'Thailand', dialCode: '+66', localLengths: [9] },
    { iso: 'VN', name: 'Vietnam', dialCode: '+84', localLengths: [9, 10] },
    { iso: 'PL', name: 'Poland', dialCode: '+48', localLengths: [9] },
    { iso: 'SE', name: 'Sweden', dialCode: '+46', localLengths: [9] },
    { iso: 'NO', name: 'Norway', dialCode: '+47', localLengths: [8] },
    { iso: 'DK', name: 'Denmark', dialCode: '+45', localLengths: [8] },
    { iso: 'FI', name: 'Finland', dialCode: '+358', localLengths: [9, 10] },
    { iso: 'PT', name: 'Portugal', dialCode: '+351', localLengths: [9] },
    { iso: 'GR', name: 'Greece', dialCode: '+30', localLengths: [10] },
    { iso: 'TR', name: 'Turkey', dialCode: '+90', localLengths: [10] },
    { iso: 'IL', name: 'Israel', dialCode: '+972', localLengths: [9] },
    { iso: 'UA', name: 'Ukraine', dialCode: '+380', localLengths: [9] },
    { iso: 'CZ', name: 'Czechia', dialCode: '+420', localLengths: [9] },
    { iso: 'RO', name: 'Romania', dialCode: '+40', localLengths: [9] },
    { iso: 'HU', name: 'Hungary', dialCode: '+36', localLengths: [9] },
];

export function digitsOnly(value: string): string {
    return value.replace(/\D/g, '');
}

export function detectCardBrand(value: string): CardBrand {
    const digits = digitsOnly(value);
    if (/^3[47]/.test(digits)) return 'amex';
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'mastercard';
    if (/^4/.test(digits)) return 'visa';
    if (/^(6011|65|64[4-9]|622(12[6-9]|1[3-9]\d|[2-8]\d{2}|9[01]\d|92[0-5]))/.test(digits)) return 'discover';
    if (/^35(2[89]|[3-8]\d)/.test(digits)) return 'jcb';
    if (/^(30[0-5]|3[68-9])/.test(digits)) return 'diners';
    if (/^62/.test(digits)) return 'unionpay';
    if (/^(50|5[6-9]|6\d)/.test(digits)) return 'maestro';
    return 'unknown';
}

export function cardBrandLengths(brand: CardBrand): number[] {
    switch (brand) {
        case 'amex': return [15];
        case 'diners': return [14, 16, 17, 18, 19];
        case 'mastercard': return [16];
        case 'visa': return [13, 16, 19];
        case 'discover':
        case 'jcb':
        case 'unionpay':
        case 'maestro': return [16, 17, 18, 19];
        default: return [13, 14, 15, 16, 17, 18, 19];
    }
}

export function formatCardNumber(value: string): string {
    const brand = detectCardBrand(value);
    const maxLength = Math.max(...cardBrandLengths(brand));
    const digits = digitsOnly(value).slice(0, maxLength);
    if (brand === 'amex') return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
    if (brand === 'diners' && digits.length <= 14) return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 14)].filter(Boolean).join(' ');
    return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function passesLuhn(value: string): boolean {
    const digits = digitsOnly(value);
    if (digits.length < 12) return false;
    let sum = 0;
    let double = false;
    for (let index = digits.length - 1; index >= 0; index -= 1) {
        let digit = Number(digits[index]);
        if (double) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        double = !double;
    }
    return sum % 10 === 0;
}

export function isValidCardNumber(value: string): boolean {
    const digits = digitsOnly(value);
    const brand = detectCardBrand(digits);
    return cardBrandLengths(brand).includes(digits.length) && passesLuhn(digits);
}

export function formatCardExpiry(value: string): string {
    let digits = digitsOnly(value).slice(0, 4);
    if (digits.length === 1 && Number(digits) > 1) digits = `0${digits}`;
    if (digits.length >= 2) {
        const month = Math.min(12, Math.max(1, Number(digits.slice(0, 2)) || 1));
        digits = `${String(month).padStart(2, '0')}${digits.slice(2)}`;
    }
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function isValidCardExpiry(value: string, now = new Date()): boolean {
    const match = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!match) return false;
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    return year > currentYear || (year === currentYear && month >= currentMonth);
}

export function phoneCountryFromValue(value: string): PhoneCountry {
    const raw = value.trim();
    if (!raw.startsWith('+')) return PHONE_COUNTRIES[0]!;
    const digits = digitsOnly(raw);
    return [...PHONE_COUNTRIES]
        .sort((a, b) => digitsOnly(b.dialCode).length - digitsOnly(a.dialCode).length)
        .find((country) => digits.startsWith(digitsOnly(country.dialCode))) || PHONE_COUNTRIES[0]!;
}

export function phoneLocalDigits(value: string, country: PhoneCountry): string {
    const digits = digitsOnly(value);
    const dialDigits = digitsOnly(country.dialCode);
    const local = value.trim().startsWith('+') && digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits;
    return local.slice(0, Math.max(...country.localLengths));
}

export function formatPhoneLocal(value: string, country: PhoneCountry): string {
    const digits = phoneLocalDigits(value, country);
    if (!digits) return '';
    if (country.style === 'nanp') {
        if (digits.length <= 3) return `(${digits}`;
        if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    if (country.style === 'french') return [digits.slice(0, 1), digits.slice(1, 3), digits.slice(3, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(' ');
    if (country.style === 'indian') return [digits.slice(0, 5), digits.slice(5, 10)].filter(Boolean).join(' ');
    if (country.style === 'australian') return [digits.slice(0, 1), digits.slice(1, 5), digits.slice(5, 9)].filter(Boolean).join(' ');
    if (country.style === 'british') return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)].filter(Boolean).join(' ');
    if (country.style === 'japanese') return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6, 10)].filter(Boolean).join('-');
    return digits.match(/.{1,3}/g)?.join(' ') || digits;
}

export function formatInternationalPhone(value: string, country: PhoneCountry): string {
    const local = formatPhoneLocal(value, country);
    return local ? `${country.dialCode} ${local}` : '';
}

export function formatPhone(value: string): string {
    return formatInternationalPhone(value, phoneCountryFromValue(value));
}

export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

export function isValidPhone(value: string): boolean {
    const country = phoneCountryFromValue(value);
    return country.localLengths.includes(phoneLocalDigits(value, country).length);
}

export function isValidUrl(value: string): boolean {
    const raw = value.trim();
    if (!raw) return false;
    try {
        const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
        return Boolean(url.hostname && url.hostname.includes('.'));
    } catch {
        return false;
    }
}

export function formatSsn(value: string): string {
    const digits = digitsOnly(value).slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function validRoutingNumber(value: string): boolean {
    const digits = digitsOnly(value);
    if (digits.length !== 9) return false;
    const numbers = [...digits].map(Number);
    const checksum = 3 * (numbers[0]! + numbers[3]! + numbers[6]!)
        + 7 * (numbers[1]! + numbers[4]! + numbers[7]!)
        + (numbers[2]! + numbers[5]! + numbers[8]!);
    return checksum % 10 === 0;
}

export function formatFieldValue(format: FocuzPassFieldFormat | undefined, value: string): string {
    switch (format) {
        case 'card-number': return formatCardNumber(value);
        case 'card-expiry': return formatCardExpiry(value);
        case 'cvv': return digitsOnly(value).slice(0, 4);
        case 'phone': return formatPhone(value);
        case 'routing-number': return digitsOnly(value).slice(0, 9);
        case 'port': return digitsOnly(value).slice(0, 5);
        case 'ssn': return formatSsn(value);
        default: return value;
    }
}

export function validateFieldValue(
    format: FocuzPassFieldFormat | undefined,
    value: string,
    options: { required?: boolean; cardNumber?: string; now?: Date } = {},
): string | null {
    const trimmed = value.trim();
    if (!trimmed) return options.required ? 'This field is required.' : null;
    switch (format) {
        case 'email': return isValidEmail(trimmed) ? null : 'Enter a valid email address.';
        case 'phone': return isValidPhone(trimmed) ? null : 'Enter a complete phone number for the selected country.';
        case 'url': return isValidUrl(trimmed) ? null : 'Enter a valid website or hostname.';
        case 'card-number': return isValidCardNumber(trimmed) ? null : 'Enter a valid card number.';
        case 'card-expiry': return isValidCardExpiry(trimmed, options.now) ? null : 'Use a current or future expiry in MM/YY format.';
        case 'cvv': {
            const expected = detectCardBrand(options.cardNumber || '') === 'amex' ? 4 : 3;
            return new RegExp(`^\\d{${expected}}$`).test(trimmed) ? null : `Enter the ${expected}-digit security code.`;
        }
        case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !Number.isNaN(Date.parse(`${trimmed}T00:00:00`)) ? null : 'Choose a valid date.';
        case 'postal-code': return /^[a-z0-9][a-z0-9 -]{1,11}$/i.test(trimmed) ? null : 'Enter a valid postal code.';
        case 'routing-number': return validRoutingNumber(trimmed) ? null : 'Enter a valid 9-digit routing number.';
        case 'swift': return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(trimmed) ? null : 'Enter a valid 8 or 11 character SWIFT/BIC.';
        case 'ip-address': {
            const parts = trimmed.split('.');
            return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255) ? null : 'Enter a valid IPv4 address.';
        }
        case 'port': return Number.isInteger(Number(trimmed)) && Number(trimmed) >= 1 && Number(trimmed) <= 65535 ? null : 'Enter a port between 1 and 65535.';
        case 'ssn': {
            const digits = digitsOnly(trimmed);
            return /^\d{9}$/.test(digits) && !/^(000|666|9\d\d)/.test(digits) && digits.slice(3, 5) !== '00' && digits.slice(5) !== '0000' ? null : 'Enter a valid Social Security number.';
        }
        default: return null;
    }
}
