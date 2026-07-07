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
