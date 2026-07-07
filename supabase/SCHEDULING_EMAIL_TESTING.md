# Scheduling email testing guide

Test the three email paths: **guest confirmation**, **host new-booking**, and **24-hour guest reminder**.

---

## Important: what triggers emails?

Emails are sent when a **guest completes a public booking** at `/schedule/<slug>` (row inserted into `scheduling_bookings`).

Creating an event only in the **extension calendar** (local storage) does **not** call the edge function and will show **no logs**.

---

## Prerequisites

| Item | How to verify |
|------|----------------|
| Migration applied | `supabase db push` succeeded; version `20260518120000` in `schema_migrations` |
| Edge functions deployed | `scheduling-booking-notify`, `scheduling-send-reminders` in Dashboard → Edge Functions (run `supabase functions deploy scheduling-booking-notify`) |
| Migrations applied | Includes `20260518120000`, `20260519110000` (booking_id + DB email trigger) |
| Resend secrets | `RESEND_API_KEY`, `RESEND_FROM` (do **not** add `SUPABASE_*` — those are auto-injected) |
| Resend domain | `RESEND_FROM` uses a verified domain (or Resend test address for sandbox) |
| Host signed in | Extension/website account owns the scheduling link |
| Guest email bookings | Reminders only send when `guest_email` is set (link/video location type) |

**Reminder window (production logic):** a booking is picked up when its start time (in the link’s `timezone`) falls **23–25 hours from now**, and `reminder_sent_at` is null.

---

## 1. Test immediate emails (confirmation + host)

These fire when a guest completes a booking (client calls `scheduling-booking-notify`).

### Steps

1. In the extension, create a scheduling link with location **Link** (or any type that asks for **email**).
2. Open the public URL: `https://focuznow.com/schedule/<your-slug>` (or local website).
3. Book a slot **at least 2 days out** (so it doesn’t overlap reminder tests).
4. Use a real inbox you control for **guest email** (host email = your FocuzNow account email).

### Expected

| Recipient | Subject (approx.) | When |
|-----------|-------------------|------|
| Guest | `Confirmed: <title> with <host>` | Within ~1 minute |
| Host | `New booking: <guest> — <title>` | Within ~1 minute |

### Manual invoke (if UI email didn’t send)

1. Supabase → **Table Editor** → `scheduling_bookings` → copy the latest `id`.
2. Dashboard → **Edge Functions** → `scheduling-booking-notify` → **Invoke**, body:

```json
{
  "bookingId": "PASTE-BOOKING-UUID-HERE"
}
```

Or from PowerShell (replace URL, anon key, booking id):

```powershell
$body = '{"bookingId":"YOUR-BOOKING-UUID"}'
Invoke-RestMethod `
  -Uri "https://zbgbszatstigtbfvdfpb.supabase.co/functions/v1/scheduling-booking-notify" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer YOUR_ANON_KEY"
    "Content-Type"  = "application/json"
  } `
  -Body $body
```

**Success:** response `{"ok":true,...}`. Check **Edge Functions → Logs** and Resend dashboard → **Emails**.

### Phone / in-person / custom links

- **Phone:** guest confirmation email is **not** sent (no email collected). Host email should still send.
- **In person:** name only — host email only.
- **Custom:** name + details — host email only.

---

## 2. Test 24-hour reminder email

Reminders are sent by **`scheduling-send-reminders`** (cron hourly, or manual invoke). They only go to guests with an email.

### Option A — Fast test (SQL + manual invoke) **recommended**

Pick a slot **~24 hours from now** in your link’s timezone.

**Step 1 — Find your link slug and timezone**

```sql
select slug, payload->>'timezone' as tz, payload->>'title' as title
from scheduling_links
where active = true
order by updated_at desc
limit 5;
```

**Step 2 — Insert a test booking in the reminder window**

Run in **SQL Editor** (adjust slug, email, and times):

```sql
-- Example: meeting ~24h from now in America/New_York
-- 1) Set these variables mentally, then plug into the insert:

with params as (
  select
    'YOUR-SLUG-HERE'::text as slug,
    'reminder-test@example.com'::text as guest_email,
    'Reminder Test Guest'::text as guest_name,
    'America/New_York'::text as tz
),
slot as (
  select
    -- Local start = now + 24 hours in link TZ
    (timezone((select tz from params), now()) + interval '24 hours') as local_start
),
computed as (
  select
    (local_start::date) as booking_date,
    (extract(hour from local_start)::int * 60 + extract(minute from local_start)::int) as start_min,
  from slot
)
insert into scheduling_bookings (
  link_id,
  slug,
  booking_date,
  start_min,
  duration_min,
  guest_name,
  guest_email,
  reminder_sent_at
)
select
  sl.id,
  p.slug,
  c.booking_date,
  c.start_min,
  30,
  p.guest_name,
  p.guest_email,
  null  -- must be null to qualify
from params p
cross join computed c
join scheduling_links sl on sl.slug = p.slug and sl.active = true
returning id, booking_date, start_min;
```

**Step 3 — Confirm the booking is eligible**

```sql
select * from get_bookings_needing_reminders();
```

You should see **one row** with your test booking. If empty:

- Start time may be outside the 23–25h window — tweak `interval '24 hours'` to `23 hours 30 minutes`.
- `guest_email` null or `reminder_sent_at` already set.
- Wrong `timezone` on the link payload.

**Step 4 — Invoke the reminder function**

Dashboard → **Edge Functions** → `scheduling-send-reminders` → **Invoke** (empty body `{}`).

Or PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "https://zbgbszatstigtbfvdfpb.supabase.co/functions/v1/scheduling-send-reminders" `
  -Method POST `
  -Headers @{
    "Authorization" = "Bearer YOUR_ANON_KEY"
    "Content-Type"  = "application/json"
  } `
  -Body "{}"
```

**Expected**

- Guest receives: `Reminder: <title> tomorrow`
- Response includes `"ok": true` for that booking id
- Row updated: `reminder_sent_at` is set (second invoke should **not** email again)

```sql
select id, guest_email, reminder_sent_at
from scheduling_bookings
where guest_email = 'reminder-test@example.com';
```

### Option B — End-to-end (real booking, wait ~24h)

1. Create a link with **email** required (default / video link).
2. Book a slot exactly **tomorrow** at the same time as now (in the link timezone).
3. Ensure cron is enabled on `scheduling-send-reminders`: `0 * * * *` (every hour).
4. Wait until the slot is 23–25 hours away; within the next hour cron run, guest should get the reminder.

Use Option A when you don’t want to wait.

---

## 3. Test host extension modal + calendar (no email)

1. Book as a guest (different browser / incognito).
2. Open the Chrome extension popup or options while logged in as **host**.
3. **Expected:** “New booking” modal with guest details; event on focus calendar with full description in notes.

Dismiss modal → `host_seen_at` set; reopen extension → modal should **not** show again for that booking.

```sql
select id, guest_name, host_seen_at
from scheduling_bookings
order by created_at desc
limit 5;
```

---

## 4. Checklist

| # | Test | Pass? |
|---|------|-------|
| 1 | Guest confirmation after book (link type + email) | ☐ |
| 2 | Host email after book | ☐ |
| 3 | `scheduling-booking-notify` invoke with booking UUID | ☐ |
| 4 | Reminder SQL row appears in `get_bookings_needing_reminders()` | ☐ |
| 5 | `scheduling-send-reminders` sends reminder once | ☐ |
| 6 | Second remind invoke does not duplicate (`reminder_sent_at` set) | ☐ |
| 7 | Phone booking: host email only, no guest email | ☐ |
| 8 | Host modal + calendar event on extension open | ☐ |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| **No edge function logs at all** | Function not deployed, or notify never called (calendar-only event, missing `booking_id`) | Deploy function; book via `/schedule/slug`; run `supabase db push` |
| No emails at all | Missing `RESEND_API_KEY` / `RESEND_FROM` | Add secrets; redeploy functions |
| Resend 403 / domain error | Unverified `from` address | Verify domain in Resend or use their sandbox sender |
| Notify 404 | Wrong `bookingId` or migration not applied | Check `get_booking_for_notify` exists |
| Reminder never sends | Slot not in 23–25h window | Re-run eligibility SQL; adjust test booking time |
| Reminder never sends | No `guest_email` | Book with link type that collects email |
| Reminder never sends | Cron not scheduled | Add schedule on `scheduling-send-reminders` |
| Guest confirmation only on book | `notifySchedulingBooking` failed silently | Check browser network tab for `/scheduling-booking-notify`; invoke manually |
| `get_bookings_needing_reminders` permission denied | Called as anon | Only service role (edge function) can call it |

**Logs:** Supabase Dashboard → **Edge Functions** → select function → **Logs**.

**Resend:** [resend.com](https://resend.com) → **Emails** for delivery status and bounces.

---

## Cleanup after testing

```sql
delete from scheduling_bookings
where guest_email = 'reminder-test@example.com'
   or guest_name = 'Reminder Test Guest';
```

---

## Cron setup (production)

1. Dashboard → **Edge Functions** → `scheduling-send-reminders`
2. **Schedules** → add: `0 * * * *` (every hour at :00)
3. Reminders send automatically for any booking entering the 23–25 hour window that hour
