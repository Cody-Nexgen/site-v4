import { useCallback, useEffect, useState } from 'react';
import {
    fetchUnseenHostBookings,
    markHostBookingsSeen,
    type HostBookingNotification,
} from '../lib/schedulingApi';
import { syncBookingsToCalendar } from '../lib/bookingCalendarSync';
import { supabase } from '../lib/supabase';

export function useHostBookingNotifications(enabled: boolean) {
    const [bookings, setBookings] = useState<HostBookingNotification[]>([]);
    const [open, setOpen] = useState(false);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        const unseen = await fetchUnseenHostBookings(supabase);
        if (unseen.length === 0) return;
        await syncBookingsToCalendar(unseen);
        setBookings(unseen);
        setOpen(true);
    }, [enabled]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const dismiss = useCallback(async () => {
        const ids = bookings.map((b) => b.id);
        await markHostBookingsSeen(supabase, ids);
        setBookings([]);
        setOpen(false);
    }, [bookings]);

    return { bookings, open, dismiss, refresh };
}
