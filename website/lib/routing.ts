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

/** Public focus room at /room/:id */
export function getFocusRoomId(): string | null {
    if (typeof window === 'undefined') return null;
    const m = window.location.pathname.match(/^\/room\/([^/]+)/i);
    return m ? decodeURIComponent(m[1]) : null;
}

export function isFocusRoomRoute(): boolean {
    return getFocusRoomId() !== null;
}

/** Public focus profile at /u/:username */
export function getPublicProfileUsername(): string | null {
    if (typeof window === 'undefined') return null;
    const m = window.location.pathname.match(/^\/u\/([^/]+)/i);
    return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

export function isPublicProfileRoute(): boolean {
    return getPublicProfileUsername() !== null;
}
