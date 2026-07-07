import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildGuestReminderEmail, sendResendEmail, type BookingEmailPayload } from '../_shared/schedulingEmail.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        const { data: rows, error } = await supabase.rpc('get_bookings_needing_reminders');

        if (error) {
            console.error('get_bookings_needing_reminders', error);
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const results: { id: string; ok: boolean; error?: string }[] = [];

        for (const row of rows || []) {
            const b: BookingEmailPayload = {
                id: row.id,
                slug: row.slug,
                booking_date: row.booking_date,
                start_min: row.start_min,
                duration_min: row.duration_min,
                guest_name: row.guest_name,
                guest_email: row.guest_email,
                guest_phone: row.guest_phone,
                guest_details: row.guest_details,
                link_title: row.link_title,
                host_name: row.host_name,
                host_email: row.host_email,
                timezone: row.timezone,
                location_type: row.location_type,
                location_value: row.location_value,
            };

            if (!b.guest_email) continue;

            const mail = buildGuestReminderEmail(b);
            const sent = await sendResendEmail({
                to: b.guest_email,
                subject: mail.subject,
                html: mail.html,
            });

            if (sent.ok) {
                await supabase.rpc('mark_booking_reminder_sent', { p_booking_id: b.id });
            }

            results.push({ id: b.id, ok: sent.ok, error: sent.error });
        }

        return new Response(JSON.stringify({ processed: results.length, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
