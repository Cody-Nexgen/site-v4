import type { SupabaseClient } from '@supabase/supabase-js';
import type { SchedulingLink } from './types';
import type { BookedSlot } from './slots';

export type CreateBookingInput = {
    slug: string;
    bookingDate: string;
    startMin: number;
    guestName: string;
    guestEmail: string;
    guestPhone?: string;
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
): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.rpc('create_scheduling_booking', {
        link_slug: input.slug,
        p_booking_date: input.bookingDate,
        p_start_min: input.startMin,
        p_guest_name: input.guestName.trim(),
        p_guest_email: input.guestEmail.trim(),
        p_guest_phone: input.guestPhone?.trim() || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
