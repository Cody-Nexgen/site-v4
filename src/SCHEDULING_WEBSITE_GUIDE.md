# FocuzNow scheduling — website integration guide

This guide explains how to make `https://focuznow.com/schedule/:slug` open a public booking page (like Calendly / Notion Calendar) using the same link data created in the extension.

## 1. Data model

Each scheduling link is stored in the extension as `SchedulingLink` (`src/lib/schedulingTypes.ts`):

| Field | Purpose |
|-------|---------|
| `slug` | URL segment, e.g. `meeting-with-alex-a1b2` |
| `title` | Shown on booking page header |
| `durationMin` / `bufferMin` | Slot length and gap |
| `availability` | `{ days: [1..5], startHour, startMin, endHour, endMin }` (0=Sun) |
| `timezone` | IANA zone shown to guests |
| `hostName` / `hostEmail` | Organizer block (replace “Account” on mockups) |
| `description` | Optional text under duration |
| `singleUse` | One booking then invalidate (enforce in API) |

Extension storage key: `focuznow_scheduling_links` in `chrome.storage.local`.

## 2. Extension → website sync (implemented)

The extension syncs links to Supabase on create (when signed in) and on sign-in. Run the migration first:

`supabase/migrations/20260517_scheduling.sql`

The booking page on **focuznow.com** cannot read extension storage. Sync links to your backend when the user creates or updates a link:

1. **Supabase table** `scheduling_links` (example):

```sql
create table scheduling_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  slug text unique not null,
  payload jsonb not null,
  created_at timestamptz default now()
);
```

2. **On `saveLink` in the extension**, after writing to `chrome.storage.local`, call your API:

```ts
await supabase.from('scheduling_links').upsert({
  user_id: session.user.id,
  slug: link.slug,
  payload: link,
});
```

3. **Public read** (no auth): Edge function or Next.js route:

`GET /api/schedule/[slug]` → `select payload from scheduling_links where slug = $1`

Return the JSON body; the booking UI already expects this shape (see `src/booking/BookingApp.tsx`).

## 3. Website route

Add a page at:

`/schedule/[slug]`

- Reuse `BookingApp.tsx` from `src/booking/BookingApp.tsx` in your Next.js app, or port the layout.
- Load link via `fetch('/api/schedule/' + slug)`.
- Left column: `title`, `hostName`, `durationMin`, `description`.
- Right: month grid + time buttons generated from `availability` (same logic as `slotsForDay` in `BookingApp.tsx`).

## 4. Confirm booking (you implement)

When a guest picks a slot:

1. `POST /api/schedule/[slug]/book` with `{ date, time, guestEmail, guestName }`.
2. Validate against `availability`, `singleUse`, optional `expiresAt`.
3. Create calendar event / send email / store in `bookings` table.
4. If `singleUse`, delete or deactivate the link.

## 5. Test locally in the extension

1. `npm run build` in `src/`.
2. Load unpacked extension from `src/dist`.
3. Create a link in **Calendar → One-off link → Create**.
4. Click **↗** next to the link in the sidebar, or open:
   `chrome-extension://<id>/src/booking/index.html?slug=<your-slug>`

## 6. URL to share

Production: `https://focuznow.com/schedule/<slug>`

The extension copies this URL on create (see `bookingUrl()` in `schedulingTypes.ts`).

## 7. focuznow.com + extension behavior

- Command palette is **disabled** on `focuznow.com` to avoid spam with the site’s own UI.
- `OPEN_EXTENSION_OPTIONS` from the site is debounced (3s) so it won’t flood the options tab.
- Session sync still uses `FOCUZNOW_SESSION_SYNC` via the content script on focuznow.com only.
