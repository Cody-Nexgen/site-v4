/** IANA id → readable label (no underscores in UI). */
export const TIMEZONE_OPTIONS: { id: string; label: string }[] = [
    { id: 'Pacific/Honolulu', label: 'Hawaii Time' },
    { id: 'America/Anchorage', label: 'Alaska Time' },
    { id: 'America/Los_Angeles', label: 'Pacific Time' },
    { id: 'America/Denver', label: 'Mountain Time' },
    { id: 'America/Chicago', label: 'Central Time' },
    { id: 'America/New_York', label: 'Eastern Time' },
    { id: 'America/Halifax', label: 'Atlantic Time' },
    { id: 'America/Sao_Paulo', label: 'Brasilia Time' },
    { id: 'Europe/London', label: 'Greenwich Mean Time' },
    { id: 'Europe/Paris', label: 'Central European Time' },
    { id: 'Europe/Helsinki', label: 'Eastern European Time' },
    { id: 'Asia/Dubai', label: 'Gulf Time' },
    { id: 'Asia/Kolkata', label: 'India Time' },
    { id: 'Asia/Singapore', label: 'Singapore Time' },
    { id: 'Asia/Tokyo', label: 'Japan Time' },
    { id: 'Australia/Sydney', label: 'Australian Eastern Time' },
    { id: 'Pacific/Auckland', label: 'New Zealand Time' },
];

export function timezoneLabel(iana: string): string {
    const hit = TIMEZONE_OPTIONS.find((t) => t.id === iana);
    if (hit) return hit.label;
    return iana.replace(/_/g, ' ').split('/').pop() || iana;
}

export function currentTimezoneId(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'America/New_York';
    }
}
