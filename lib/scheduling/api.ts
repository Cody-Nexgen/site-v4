import type { SupabaseClient } from '@supabase/supabase-js';
import type { SchedulingLink } from './types';
import type { BookedSlot } from './slots';

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

export async function fetchSchedulingLink(
    supabase: SupabaseClient,
    slug: string,
): Promise<SchedulingLink | null> {
    const { data, error } = await supabase.rpc('get_scheduling_link', { link_slug: slug });
    if (error || !data) return null;
    return data as SchedulingLink;
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

    const row = data as { ok?: boolean; booking_id?: string; error?: string } | null;
    if (row?.ok === false) {
        return { ok: false, error: row.error || 'Booking failed' };
    }

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

export type MySchedulingLink = SchedulingLink & {
    /** Row id in `scheduling_links` (also the canonical id inside the payload). */
    id: string;
    active: boolean;
};

/** Scheduling links owned by the signed-in user, via RLS on `scheduling_links`. */
export async function fetchMySchedulingLinks(
    supabase: SupabaseClient,
): Promise<MySchedulingLink[]> {
    const { data, error } = await supabase
        .from('scheduling_links')
        .select('id, slug, payload, active, created_at')
        .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data
        .filter((row: { active: boolean }) => row.active)
        .map((row: { id: string; slug: string; payload: SchedulingLink; active: boolean }) => ({
            ...row.payload,
            id: row.id,
            slug: row.slug,
            active: row.active,
        }));
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

/** All bookings across the host's scheduling links (seen and unseen), for calendar display. */
export async function fetchHostBookingsForCalendar(
    supabase: SupabaseClient,
): Promise<HostBookingNotification[]> {
    const { data, error } = await supabase.rpc('get_host_bookings_for_calendar');
    if (error || !Array.isArray(data)) return [];
    return data as HostBookingNotification[];
}

export type NotifyBookingResult = { ok: boolean; error?: string; detail?: unknown };

/** Invoke edge function after a booking row exists. DB trigger also fires on insert as backup. */
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
