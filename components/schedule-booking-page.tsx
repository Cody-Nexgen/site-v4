import '@focuznow-ext/index.css';
import BookingApp from '@focuznow-ext/booking/BookingApp';
import { supabase } from '@/lib/supabase';

/** Public booking page at /schedule/:slug — mounted outside main App auth flow. */
export default function ScheduleBookingPage() {
    return <BookingApp client={supabase} />;
}
