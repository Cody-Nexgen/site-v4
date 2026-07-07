import type { SupabaseClient } from '@supabase/supabase-js';
import { signOutOnAuthError } from './authErrors';
import type { SchedulingLink } from './schedulingTypes';
import type { BookedSlot } from './schedulingSlots';

export type CreateBookingInput = {
    slug: string;
    bookingDate: string;
    startMin: number;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    guestDetails?: string;
};

export type CreateBookingResult = {
    ok: boolean;
    bookingId?: string;
    error?: string;
};

export function slotToAvailability(slot: { start: string; end: string }) {
    const [startH, startM] = slot.start.split(':').map((n) => parseInt(n, 10) || 0);
    const [endH, endM] = slot.end.split(':').map((n) => parseInt(n, 10) || 0);
    return { startHour: startH, startMin: startM, endHour: endH, endMin: endM };
}

export function buildDateAvailability(
    dateSlots: Record<string, { start: string; end: string }>,
): Record<string, ReturnType<typeof slotToAvailability>> {
    const out: Record<string, ReturnType<typeof slotToAvailability>> = {};
    for (const [key, slot] of Object.entries(dateSlots)) {
        out[key] = slotToAvailability(slot);
    }
    return out;
}

async function ensureSupabaseSession(supabase: SupabaseClient): Promise<{ ok: boolean; userId?: string; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
        return { ok: true, userId: session.user.id };
    }
    return { ok: false, error: 'NOT_AUTHENTICATED' };
}

function parseRpcBoolean(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === 't';
}

export async function isSchedulingSlugAvailable(
    supabase: SupabaseClient,
    slug: string,
    excludeLinkId?: string,
): Promise<{ available: boolean; error?: string }> {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
        return { available: false, error: 'Slug is required' };
    }

    const { data, error } = await supabase.rpc('is_scheduling_slug_available', {
        p_slug: normalized,
        p_exclude_id: excludeLinkId ?? null,
    });

    if (!error && data != null) {
        return { available: parseRpcBoolean(data) };
    }

    const existing = await fetchSchedulingLink(supabase, normalized);
    if (!existing) {
        return { available: true };
    }
    if (excludeLinkId && existing.id === excludeLinkId) {
        return { available: true };
    }
    return {
        available: false,
        error: error?.message,
    };
}

export async function upsertSchedulingLink(
    supabase: SupabaseClient,
    userId: string,
    link: SchedulingLink,
): Promise<{ ok: boolean; error?: string; linkId?: string }> {
    const auth = await ensureSupabaseSession(supabase);
    if (!auth.ok || !auth.userId) {
        await signOutOnAuthError(auth.error ?? 'NOT_AUTHENTICATED');
        return { ok: false, error: 'NOT_AUTHENTICATED' };
    }
    if (auth.userId !== userId) {
        await signOutOnAuthError('Session user mismatch');
        return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    const { data, error } = await supabase.rpc('upsert_scheduling_link', {
        p_id: link.id,
        p_slug: link.slug,
        p_payload: link,
        p_active: true,
    });

    if (error) {
        const msg = error.message || '';
        if (msg.includes('NOT_AUTHENTICATED') || msg.includes('42501')) {
            await signOutOnAuthError(msg);
            return { ok: false, error: 'NOT_AUTHENTICATED' };
        }
        return { ok: false, error: error.message };
    }

    const result = data as { ok?: boolean; error?: string; id?: string } | null;
    if (result?.ok === false) {
        if (result.error === 'SLUG_TAKEN') {
            return {
                ok: false,
                error: 'This URL slug is already taken. Pick a different slug in Customize link.',
            };
        }
        if (result.error === 'ID_CONFLICT' || result.error === 'FORBIDDEN') {
            return {
                ok: false,
                error: 'Could not sync this link. Re-open it from the sidebar and save again.',
            };
        }
        if (result.error === 'NOT_AUTHENTICATED') {
            await signOutOnAuthError('NOT_AUTHENTICATED');
            return { ok: false, error: 'NOT_AUTHENTICATED' };
        }
        return { ok: false, error: result.error || 'Sync failed' };
    }

    return { ok: true, linkId: result?.id || link.id };
}

export async function fetchSchedulingLink(
    supabase: SupabaseClient,
    slug: string,
): Promise<SchedulingLink | null> {
    const { data, error } = await supabase.rpc('get_scheduling_link', { link_slug: slug });
    if (error || !data) return null;
    return data as SchedulingLink;
}

export async function fetchSchedulingLinkLocal(slug: string): Promise<SchedulingLink | null> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
    return new Promise((resolve) => {
        chrome.storage.local.get(['focuznow_scheduling_links'], (res) => {
            const links = (res.focuznow_scheduling_links as SchedulingLink[]) || [];
            resolve(links.find((l) => l.slug === slug) ?? null);
        });
    });
}

export async function fetchBookedSlots(
    supabase: SupabaseClient,
    slug: string,
    fromDate: string,
    toDate: string,
): Promise<BookedSlot[]> {
    const { data, error } = await supabase.rpc('get_scheduling_booked_slots', {
        link_slug: slug,
        from_date: fromDate,
        to_date: toDate,
    });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: { booking_date: string; start_min: number }) => ({
        bookingDate: row.booking_date,
        startMin: row.start_min,
    }));
}

export async function createSchedulingBooking(
    supabase: SupabaseClient,
    input: CreateBookingInput,
): Promise<CreateBookingResult> {
    const { data, error } = await supabase.rpc('create_scheduling_booking', {
        link_slug: input.slug,
        p_booking_date: input.bookingDate,
        p_start_min: input.startMin,
        p_guest_name: input.guestName.trim(),
        p_guest_email: input.guestEmail?.trim() || null,
        p_guest_phone: input.guestPhone?.trim() || null,
        p_guest_details: input.guestDetails?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };

    const row = data as { ok?: boolean; booking_id?: string } | null;
    let bookingId = row?.booking_id;

    if (!bookingId) {
        const { data: fallbackId, error: fallbackError } = await supabase.rpc('get_booking_id_for_slot', {
            p_slug: input.slug,
            p_booking_date: input.bookingDate,
            p_start_min: input.startMin,
        });
        if (!fallbackError && fallbackId) {
            bookingId = fallbackId as string;
        }
    }

    return { ok: true, bookingId };
}

export type NotifyBookingResult = { ok: boolean; error?: string; detail?: unknown };

export async function notifySchedulingBooking(
    supabase: SupabaseClient,
    bookingId: string,
): Promise<NotifyBookingResult> {
    if (!bookingId) {
        return { ok: false, error: 'Missing booking id — apply latest DB migrations.' };
    }

    const { data, error } = await supabase.functions.invoke('scheduling-booking-notify', {
        body: { bookingId },
    });

    if (error) {
        console.error('[scheduling-booking-notify]', error);
        return { ok: false, error: error.message };
    }

    const payload = data as { ok?: boolean; error?: string } | null;
    if (payload?.ok === false) {
        console.error('[scheduling-booking-notify] response', payload);
        return { ok: false, error: payload.error || 'Email send failed', detail: payload };
    }

    return { ok: true, detail: payload };
}

export type HostBookingNotification = {
    id: string;
    slug: string;
    booking_date: string;
    start_min: number;
    duration_min: number;
    guest_name: string;
    guest_email: string | null;
    guest_phone: string | null;
    guest_details: string | null;
    link_title: string;
    link_payload: Record<string, unknown>;
    created_at: string;
};

export async function fetchUnseenHostBookings(
    supabase: SupabaseClient,
): Promise<HostBookingNotification[]> {
    const { data, error } = await supabase.rpc('get_unseen_host_bookings');
    if (error || !Array.isArray(data)) return [];
    return data as HostBookingNotification[];
}

/** All host bookings for calendar sync (seen and unseen). */
export async function fetchHostBookingsForCalendar(
    supabase: SupabaseClient,
): Promise<HostBookingNotification[]> {
    const { data, error } = await supabase.rpc('get_host_bookings_for_calendar');
    if (error || !Array.isArray(data)) return [];
    return data as HostBookingNotification[];
}

export async function markHostBookingsSeen(
    supabase: SupabaseClient,
    bookingIds: string[],
): Promise<void> {
    if (bookingIds.length === 0) return;
    await supabase.rpc('mark_host_bookings_seen', { p_booking_ids: bookingIds });
}

/** Sync all local links to Supabase (e.g. after sign-in). */
export async function syncAllSchedulingLinks(
    supabase: SupabaseClient,
    userId: string,
    links: SchedulingLink[],
): Promise<void> {
    await Promise.all(links.map((link) => upsertSchedulingLink(supabase, userId, link)));
}
