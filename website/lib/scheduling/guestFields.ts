import type { LinkLocationType } from './types';

export type GuestFieldConfig = {
    name: boolean;
    email: boolean;
    phone: boolean;
    details: boolean;
};

export function guestFieldsForLocation(locationType?: LinkLocationType): GuestFieldConfig {
    switch (locationType) {
        case 'phone':
            return { name: true, email: false, phone: true, details: false };
        case 'in_person':
            return { name: true, email: false, phone: false, details: false };
        case 'custom':
            return { name: true, email: false, phone: false, details: true };
        default:
            return { name: true, email: true, phone: false, details: false };
    }
}

export function validateGuestInput(
    fields: GuestFieldConfig,
    values: { name: string; email: string; phone: string; details: string },
): string | null {
    if (!values.name.trim()) return 'Please enter your name.';
    if (fields.email && !values.email.trim()) return 'Please enter your email.';
    if (fields.phone && !values.phone.trim()) return 'Please enter your phone number.';
    if (fields.details && !values.details.trim()) return 'Please add the requested details.';
    if (fields.email && values.email.trim().length < 3) return 'Please enter a valid email.';
    return null;
}
