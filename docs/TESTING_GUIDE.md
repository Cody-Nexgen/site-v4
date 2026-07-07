# FocuzNow testing guide

Manual QA checklist for the extension, scheduling, billing, and Pro dashboard. Run after `npm run build` in `src/` and applying Supabase migrations.

---

## Prerequisites

| Step | Command / action |
|------|------------------|
| Build extension | `cd src && npm run build` |
| Load extension | Chrome → `chrome://extensions` → Load unpacked → `src/dist` |
| Supabase migrations | `supabase db push` (includes scheduling, billing, `get_host_bookings_for_calendar`, `is_scheduling_slug_available`) |
| Edge functions | Deploy `create-checkout-session`, `create-portal-session`, `scheduling-booking-notify` |
| Stripe secrets | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` on functions; Customer Portal enabled in Stripe Dashboard |
| Sign in | Use a real FocuzNow account in the extension options page |

---

## 1. Scheduling links (cloud sync + slug)

1. Open **Calendar** (fullscreen scheduling view).
2. **+ New scheduling link** → Recurring or One-off.
3. Expand **Customize link** → set slug (e.g. `your-name-intro`), duration, booking window, expiration, single-use.
4. Confirm live text: **“This URL is available”** (green) or **“already taken”** (red). Save is disabled when taken.
5. Click **Create** / **Save**.
6. **Pass:** notice says link created/updated and copied; no `FORBIDDEN` or generic sync failure.
7. **Fail fixes:** run migration `20260521130000_scheduling_slug_check_upsert_fix.sql`; pick a unique slug if `demo` is taken globally.

### Sidebar edit

1. Under **Scheduling**, click **Edit** on a saved link.
2. Change slug or duration → **Save**.
3. **Pass:** panel reloads draft; cloud sync succeeds when signed in.

### Public booking → host calendar

1. Copy link → open `https://focuznow.com/schedule/<slug>` (or extension booking page).
2. Book a slot as guest (use email if required).
3. Return to host calendar (same account).
4. **Pass:** event appears on the correct day/time (`booking_<id>`), after refresh or reopen.

---

## 2. Calendar UX

| Test | Pass criteria |
|------|----------------|
| Click event | Opens edit modal; event does **not** follow cursor |
| Drag event | Only moves after small pointer movement (~6px) |
| Booking window | Recurring + one-off links respect min notice + max horizon on public page |
| Link expiration | Days after expiry are not bookable |
| Single-use | Second booking on same link fails after first booking |

---

## 3. Billing (Manage subscription)

### Extension (Account tab)

1. Sign in as **Pro** (active subscription in `subscriptions` with `stripe_customer_id`).
2. Click **Update payment method** / manage billing.
3. **Pass:** Stripe Customer Portal opens in a new tab.
4. If not subscribed: clear message to **Upgrade to Pro** first (not generic “non-2xx” only).

### Website

1. Go to `https://focuznow.com/manage_subscription` while signed in.
2. **Pass:** plan details load; **Change payment method** opens Stripe portal.
3. **Cancel** flow shows confirmation (optional).

### Checkout

1. Free user → **Upgrade to Pro** → Stripe Checkout opens.
2. Complete test payment (Stripe test mode).
3. Return to `?billing=return&subscription=success`.
4. **Pass:** Pro theme unlocks; subscription row in Supabase.

**Troubleshooting**

- `NO_CUSTOMER`: user is Pro in app but missing `stripe_customer_id` — complete checkout once or fix `subscriptions` row.
- Redeploy `create-portal-session` after code changes.

---

## 4. Pro theme & custom theme

| Test | Pass criteria |
|------|----------------|
| Pro Gold | Gold accents; badge beside logo (not clipped) |
| Custom theme | Accent from color picker; **no** gold hovers on nav/cards |
| Motion | Calm by default; bouncy motion only if “full gold experience” enabled (if exposed) |
| Avatars | `rounded-lg`, no spinning ring |

---

## 5. Draggable site timer

1. **Settings** → enable **Draggable Site Timer**.
2. Open any normal website.
3. **Pass:** pill timer top-right; hover shows **− / +** sliding in from the **left** of the clock (timer stays anchored on the right).
4. Drag timer → position persists; scale buttons work.

---

## 6. Regression smoke

- [ ] Block list / focus session still works
- [ ] Habits check-in (no broken spin on Pro Gold)
- [ ] Integrations section **removed** from main sidebar
- [ ] Theme selector: 4 public + Pro Gold + Custom (Pro only)

---

## 7. Scheduling emails (optional)

See [supabase/SCHEDULING_EMAIL_TESTING.md](../supabase/SCHEDULING_EMAIL_TESTING.md) for guest confirmation, host notification, and reminder tests.

---

## Reporting issues

Include: steps, signed-in email (not password), slug used, exact error string, and whether `supabase db push` + function deploy were run on that project.
