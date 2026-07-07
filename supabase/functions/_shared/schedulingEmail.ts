export type BookingEmailPayload = {
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
    host_name: string;
    host_email: string;
    timezone: string;
    location_type: string | null;
    location_value: string | null;
    description?: string | null;
};

function formatTime(startMin: number): string {
    const h = Math.floor(startMin / 60);
    const m = startMin % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
}

function locationLine(b: BookingEmailPayload): string {
    switch (b.location_type) {
        case 'phone':
            return 'Phone call';
        case 'in_person':
            return b.location_value ? `In person: ${b.location_value}` : 'In person';
        case 'custom':
            return b.location_value ? `Location: ${b.location_value}` : 'Custom location';
        case 'link':
            return b.location_value ? `Meeting link: ${b.location_value}` : 'Online meeting';
        default:
            return b.location_value || '—';
    }
}

function guestBlock(b: BookingEmailPayload): string {
    const lines = [`<strong>Name:</strong> ${escapeHtml(b.guest_name)}`];
    if (b.guest_email) lines.push(`<strong>Email:</strong> ${escapeHtml(b.guest_email)}`);
    if (b.guest_phone) lines.push(`<strong>Phone:</strong> ${escapeHtml(b.guest_phone)}`);
    if (b.guest_details) lines.push(`<strong>Details:</strong> ${escapeHtml(b.guest_details)}`);
    return lines.join('<br/>');
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function wrapHtml(title: string, body: string): string {
    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#111;color:#eee;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;color:#fff">${escapeHtml(title)}</h1>
${body}
<p style="margin-top:24px;font-size:12px;color:#888">FocuzNow scheduling</p>
</div></body></html>`;
}

export function buildHostNewBookingEmail(b: BookingEmailPayload): { subject: string; html: string } {
    const when = `${b.booking_date} at ${formatTime(b.start_min)} (${b.timezone})`;
    const body = `
<p style="color:#ccc;line-height:1.6">You have a new booking for <strong>${escapeHtml(b.link_title)}</strong>.</p>
<p style="color:#aaa"><strong>When:</strong> ${escapeHtml(when)}<br/>
<strong>Duration:</strong> ${b.duration_min} minutes<br/>
<strong>Location:</strong> ${escapeHtml(locationLine(b))}</p>
${b.description ? `<p style="color:#aaa"><strong>Event notes:</strong> ${escapeHtml(b.description)}</p>` : ''}
<hr style="border:none;border-top:1px solid #333;margin:20px 0"/>
<p style="color:#ccc;font-weight:600">Guest details</p>
<p style="color:#aaa;line-height:1.8">${guestBlock(b)}</p>`;
    return {
        subject: `New booking: ${b.guest_name} — ${b.link_title}`,
        html: wrapHtml('New booking', body),
    };
}

export function buildGuestConfirmationEmail(b: BookingEmailPayload): { subject: string; html: string } {
    const when = `${b.booking_date} at ${formatTime(b.start_min)} (${b.timezone})`;
    const body = `
<p style="color:#ccc;line-height:1.6">Hi ${escapeHtml(b.guest_name)},</p>
<p style="color:#ccc;line-height:1.6">You're confirmed for <strong>${escapeHtml(b.link_title)}</strong> with ${escapeHtml(b.host_name)}.</p>
<p style="color:#aaa"><strong>When:</strong> ${escapeHtml(when)}<br/>
<strong>Duration:</strong> ${b.duration_min} minutes<br/>
<strong>Location:</strong> ${escapeHtml(locationLine(b))}</p>
<p style="color:#888;font-size:13px">You'll receive a reminder email 24 hours before your appointment.</p>`;
    return {
        subject: `Confirmed: ${b.link_title} with ${b.host_name}`,
        html: wrapHtml("You're booked", body),
    };
}

export function buildGuestReminderEmail(b: BookingEmailPayload): { subject: string; html: string } {
    const when = `${b.booking_date} at ${formatTime(b.start_min)} (${b.timezone})`;
    const body = `
<p style="color:#ccc;line-height:1.6">Hi ${escapeHtml(b.guest_name)},</p>
<p style="color:#ccc;line-height:1.6">Reminder: your meeting <strong>${escapeHtml(b.link_title)}</strong> with ${escapeHtml(b.host_name)} is in about 24 hours.</p>
<p style="color:#aaa"><strong>When:</strong> ${escapeHtml(when)}<br/>
<strong>Duration:</strong> ${b.duration_min} minutes<br/>
<strong>Location:</strong> ${escapeHtml(locationLine(b))}</p>`;
    return {
        subject: `Reminder: ${b.link_title} tomorrow`,
        html: wrapHtml('Upcoming meeting', body),
    };
}

export async function sendResendEmail(opts: {
    to: string;
    subject: string;
    html: string;
    from?: string;
}): Promise<{ ok: boolean; error?: string }> {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = opts.from || Deno.env.get('RESEND_FROM') || 'FocuzNow <onboarding@resend.dev>';

    if (!apiKey) {
        console.error('RESEND_API_KEY not set');
        return { ok: false, error: 'RESEND_API_KEY not configured' };
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: [opts.to],
            subject: opts.subject,
            html: opts.html,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        console.error('Resend error', res.status, text);
        return { ok: false, error: text };
    }

    return { ok: true };
}
