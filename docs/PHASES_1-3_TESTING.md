# FocuzNow Phases 1–3 — Deploy & Testing Guide

Extension is already built (`src/dist`). Reload it in Chrome after backend deploy — no rebuild needed unless you change code.

---

## Part A — One-time pre-test setup

### 1. Install Supabase CLI (if missing)

```powershell
# Option A: npm
npm install -g supabase

# Option B: scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Verify: `supabase --version`

### 2. Log in and link your project

From the repo root (`focuznow v3`):

```powershell
Set-Location "c:\Users\divij\Documents\Coding\Python\Suj\focuznow v3"

supabase login

# Project ref is in supabase/.temp/project-ref (yours: zbgbszatstigtbfvdfpb)
supabase link --project-ref zbgbszatstigtbfvdfpb
```

### 3. Apply database migrations

```powershell
supabase db push
```

**Confirm these Phase 1 + 3 migrations ran** (Supabase Dashboard → Database → Migrations, or SQL):

| Migration | Purpose |
|-----------|---------|
| `20260707120000_public_focus_profiles.sql` | Public profile toggle, `focus_stats`, RPCs |
| `20260707140000_friends_focus_rooms.sql` | Friends, presence, weekly leaderboard, focus rooms |

Quick SQL sanity check:

```sql
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'sync_my_focus_stats',
    'get_public_focus_profile',
    'send_friend_request',
    'list_my_friends',
    'create_focus_room',
    'heartbeat_focus_session'
  );
```

You should see all six.

### 4. Set edge function secrets

Supabase auto-injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. You set the rest:

```powershell
# Minimum for AI Coach (Phase 3 auto-schedule)
supabase secrets set GEMINI_API_KEY=your-gemini-api-key-here

# Or from the template file (edit values first):
supabase secrets set --env-file supabase/.secrets.env
```

**Also required if you test billing / checkout:**

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_ID=price_...
```

**Optional (scheduling email tests only):**

```powershell
supabase secrets set RESEND_API_KEY=re_... RESEND_FROM="FocuzNow <hello@yourdomain.com>"
```

List what’s set (names only): `supabase secrets list`

### 5. Deploy edge functions (CLI)

**Minimum for Phase 3 AI scheduling** (shared prompt lives in `_shared/aiCoachChat.ts`, bundled into this function):

```powershell
supabase functions deploy ai-coach-chat
```

**Deploy everything** (billing, scheduling emails, AI, account delete):

```powershell
supabase functions deploy
```

That deploys all folders under `supabase/functions/`:

| Function | Needed for |
|----------|------------|
| `ai-coach-chat` | AI Coach, auto-schedule (Phase 3) — **required** |
| `create-checkout-session` | Pro upgrade |
| `create-portal-session` | Manage subscription |
| `delete-account` | Account deletion |
| `scheduling-booking-notify` | Booking emails |
| `scheduling-send-reminders` | Reminder cron |
| `chat-with-groq` | Legacy/alternate chat (optional) |

**Verify deploy:**

```powershell
supabase functions list
```

Dashboard → Edge Functions → open `ai-coach-chat` → Logs (should be empty until first request).

**Smoke-test AI Coach from terminal** (replace `$TOKEN` with a logged-in user JWT from extension DevTools → Application → local storage `sb-auth-token`, or Supabase session):

```powershell
curl -X POST "https://zbgbszatstigtbfvdfpb.supabase.co/functions/v1/ai-coach-chat" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -H "apikey: YOUR_SUPABASE_ANON_KEY" `
  -H "Content-Type: application/json" `
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"hi"}],"stream":false}'
```

Pro account required — expect `403 PRO_REQUIRED` on free tier (that’s correct).

### 6. Load the extension

1. Chrome → `chrome://extensions`
2. Developer mode → **Load unpacked** → select `src/dist`
3. If already loaded: click **Reload** on the extension card

### 7. Test accounts

| Account | Use |
|---------|-----|
| **Account A** | Primary — Pro recommended for AI Coach |
| **Account B** | Second browser profile or incognito — friends & focus rooms |

Both need: signed in, username set (Account tab, min 3 chars).

### 8. Website (public profile only)

Public profiles live at `https://focuznow.com/u/your-username`.

For local testing: `cd website && npm run dev` → `http://localhost:3000/u/your-username`

---

## Part B — Phase 1 tests (XP, challenges, shop, public profile)

### B1 — XP & levels

1. Open extension options → **Today** (Overview).
2. **Pass:** compact level card shows level, rank, XP bar.
3. Complete a **25m focus session** (Sessions tab → start pomodoro → wait or shorten duration in settings for faster test).
4. **Pass:** XP increases; Progress tab shows updated stats.
5. Resist a blocked site (visit something on blocklist).
6. **Pass:** block-resist XP/coins if applicable (check Progress / shop balance).

### B2 — Timed challenges

1. Go to **Progress** (formerly Achievements).
2. Start a challenge (e.g. “No Shorts 7 Days” or pomodoro challenge).
3. **Pass:** challenge shows as active with progress.
4. Trigger relevant action (complete pomodoros, avoid shorts, etc.).
5. **Pass:** progress increments; completion awards XP/coins.

### B3 — Focus Shop

1. Open **Focus Shop** tab.
2. **Pass:** cosmetic items listed with coin prices.
3. Purchase a frame or badge (need enough coins from sessions/blocks).
4. **Pass:** coins deducted; item owned.
5. Equip item.
6. **Pass:** equipped state persists after reload.

### B4 — Public focus profile

1. **Account** → set username (e.g. `testuser123`) → save.
2. Toggle **Public focus profile** ON.
3. **Pass:** link appears to `focuznow.com/u/testuser123`.
4. Open that URL (production or localhost website).
5. **Pass:** level, rank, XP, streak, pomodoros, equipped cosmetics display.
6. Toggle public profile OFF.
7. **Pass:** URL returns not found / private.

---

## Part C — Phase 2 tests (Smart YouTube, Emergency Override)

No database migration for Phase 2 — extension-only.

### C1 — Smart YouTube Mode

1. **Settings → Customization** (or in-app block section).
2. Enable **Smart YouTube Mode** (allow educational, block entertainment).
3. Open `youtube.com` — watch an educational-style video.
4. **Pass:** video plays.
5. Open Shorts or entertainment-style content.
6. **Pass:** blocked or limited per smart mode rules.
7. Toggle smart mode OFF → Shorts behavior returns to normal setting.

### C2 — Emergency Override

1. **Settings** → enable **Emergency Override** (set daily limit ≥ 1, cooldown reasonable).
2. Visit a **blocked** site → blocked page appears.
3. Click **Emergency Unlock** → enter reason → submit.
4. **Pass:** temporary access granted; site loads.
5. **Patterns** tab (or override log if exposed).
6. **Pass:** override logged with reason and timestamp.
7. Exhaust daily limit → try again.
8. **Pass:** denied with clear message.
9. Enable **Nuclear Lockdown** → try emergency unlock.
10. **Pass:** emergency override disabled during lockdown.

---

## Part D — Phase 3 tests (AI schedule, friends, focus rooms)

Requires migrations + `ai-coach-chat` deploy. AI Coach requires **Pro**.

### D1 — AI Auto Schedule

1. **Sessions** → Deep Work Planner → set a daily goal + add a planner task on Today tab.
2. Click **Auto-schedule with AI**.
3. **Pass:** navigates to AI Coach; prompt auto-sent in new chat.
4. **Pass:** coach replies with plan; confirm cards appear for:
   - `planner_set` (daily planner items)
   - `calendar_add_events` (focus blocks)
5. Approve actions.
6. **Pass:** Today tab planner updated; Calendar tab shows new events.
7. Optional: ask coach “Set my daily goal to X” → `daily_goal_set` works.

### D2 — Friends

**Setup:** Account A and Account B both signed in with different usernames.

1. Account A → **Friends** → add `@accountB_username`.
2. Account B → **Friends** → **Pass:** pending request visible.
3. Account B → **Accept**.
4. **Pass:** both see each other in friends list.
5. Account B → start a focus session (Sessions → pomodoro).
6. Account A → Friends tab (wait up to 30s or refresh).
7. **Pass:** Account B shows **Focusing** with live indicator.
8. Account B → complete focus session.
9. **Pass:** weekly leaderboard updates minutes for Account B (and you on your own row).
10. Invalid username → **Pass:** “User not found” (not crash).

### D3 — Live Focus Rooms

1. Account A → **Sessions** → Focus Room → create room (25 min).
2. **Pass:** shared countdown + participant count = 1.
3. Copy invite link.
4. Account B → open link (or paste room ID → Join).
5. **Pass:** both see participant count = 2; member avatars/names listed.
6. **Pass:** no chat UI (silent room only).
7. Account B → Leave room.
8. **Pass:** count drops to 1 for Account A.
9. After `ends_at` → **Pass:** room shows expired / not found.

---

## Part E — Quick regression (all phases)

- [ ] Sign in / sign out still works
- [ ] Block list add/remove
- [ ] Habits check-in
- [ ] Forest plants tree after focus session
- [ ] Pro checkout / portal (if Stripe configured)
- [ ] Scheduling link create + public book (if testing scheduling)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `function not found` / 404 on AI Coach | `supabase functions deploy ai-coach-chat` |
| `GEMINI_API_KEY is not configured` | `supabase secrets set GEMINI_API_KEY=...` then redeploy |
| Friends RPC errors | Run `supabase db push`; confirm migration `20260707140000` |
| Public profile empty | Toggle public profile ON; complete a session; check Account sync |
| AI Coach “Pro required” | Use Pro test account or complete Stripe test checkout |
| Extension changes not visible | Reload extension at `chrome://extensions` |
| Coach actions don’t apply | Confirm action cards → click Approve on each |

---

## Deploy checklist (copy/paste)

```powershell
Set-Location "c:\Users\divij\Documents\Coding\Python\Suj\focuznow v3"
supabase login
supabase link --project-ref zbgbszatstigtbfvdfpb
supabase db push
supabase secrets set GEMINI_API_KEY=your-key
supabase functions deploy ai-coach-chat
# supabase functions deploy   # ← all functions, if you want
supabase functions list
```

Then reload extension from `src/dist` and run Parts B → D.
