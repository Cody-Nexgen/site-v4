/** Stable id for scheduling links stored in Supabase (text primary key). */
export function newSchedulingLinkId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `link_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
