/** Public booking pages live at /schedule/:slug — must bypass dashboard/auth redirects. */
export function normalizePathname(): string {
    if (typeof window === 'undefined') return '/';
    const p = window.location.pathname.replace(/\/$/, '');
    return p || '/';
}

export function getScheduleSlug(): string | null {
    const m = normalizePathname().match(/^\/schedule\/([^/]+)$/i);
    return m ? decodeURIComponent(m[1]) : null;
}

export function isScheduleRoute(): boolean {
    return getScheduleSlug() !== null;
}
