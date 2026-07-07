import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
    buildGuestConfirmationEmail,
    buildHostNewBookingEmail,
    sendResendEmail,
    type BookingEmailPayload,
} from '../_shared/schedulingEmail.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    console.log('[scheduling-booking-notify] invoked', req.method);

    try {
        const { bookingId } = await req.json();
        console.log('[scheduling-booking-notify] bookingId', bookingId);
        if (!bookingId || typeof bookingId !== 'string') {
            return new Response(JSON.stringify({ error: 'bookingId required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        const { data, error } = await supabase.rpc('get_booking_for_notify', {
            p_booking_id: bookingId,
        });

        if (error || !data) {
            console.error('get_booking_for_notify', error);
            return new Response(JSON.stringify({ error: 'booking not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const b = data as BookingEmailPayload;

        if (!b.host_email) {
            return new Response(JSON.stringify({ error: 'host email missing' }), {
                status: 422,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const hostMail = buildHostNewBookingEmail(b);
        const hostResult = await sendResendEmail({
            to: b.host_email,
            subject: hostMail.subject,
            html: hostMail.html,
        });

        let guestResult: { ok: boolean; error?: string } = { ok: true };
        if (b.guest_email && b.guest_email.length >= 3) {
            const guestMail = buildGuestConfirmationEmail(b);
            guestResult = await sendResendEmail({
                to: b.guest_email,
                subject: guestMail.subject,
                html: guestMail.html,
            });
        }

        return new Response(
            JSON.stringify({
                ok: hostResult.ok && guestResult.ok,
                host: hostResult,
                guest: guestResult,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
