# Pro dashboard visual guide (dopamine / delight)

Implemented in the extension with a user toggle: **Settings → Pro dashboard visuals** (Pro subscribers only). When off, the dashboard uses the regular layout.

Goal: make subscription feel rewarding on every visit, using the same emotional language as the **Habits** check-in (360° spin, glow, instant color flip).

---

## 1. Pro identity layer (always on)

**Where:** Extension sidebar header (`OptionsApp` — next to “focuznow” wordmark) and web dashboard top bar.

| Element | Free | Pro |
|--------|------|-----|
| Badge | Hidden or gray “FREE” | Animated **PRO ✦** pill: `bg-purple-500/15`, `border-purple-400/40`, soft pulse every 4s |
| Avatar ring | `border-white/10` | `ring-2 ring-purple-500/50` + slow rotating gradient (CSS `conic-gradient`) |
| Page background | Flat `#0a0a0a` | Subtle purple vignette: radial gradient top-right at 8% opacity |

**Micro-copy:** Under badge, one line: `Subscribed to Pro` (not “Pro plan active” — sounds more owned).

---

## 2. “Welcome back, Pro” hero (Today / Overview)

**Where:** `OverviewTab` top — first card above stats.

**On load (once per day):**

1. Card slides up 12px + fades in (300ms, `ease-out`).
2. Left: small crown/sparkle icon in purple circle (same size as habit check button: 56px).
3. Title: `You're in the zone` or `Pro session unlocked`.
4. Subtitle: streak + blocks today, e.g. `7-day streak · 12 blocks today`.

**Optional confetti:** Only when `?subscription=success` or first visit after upgrade — 0.8s particle burst (reuse framer-motion or light CSS), then never again that week.

---

## 3. Stat cards — “level up” feedback

**Where:** Overview stat row (time tracked, sites, focus score).

| Interaction | Animation |
|-------------|-----------|
| Hover | `scale(1.02)`, purple glow shadow |
| Beat personal best | Number counts up (odometer 400ms) + brief green flash on label |
| Pro-only metric | Fourth card: **Focus score** with semi-donut fill animating 0 → value over 600ms |

Use the same **tabular-nums** + **purple accent** as habit streak numbers.

---

## 4. Habit parity — “Pro check-in” for focus

Mirror the habit button in `Pages.tsx` (`HabitsTab`):

- When user completes a Pomodoro or hits daily focus goal, show a **full-width toast** with:
  - Check icon rotating 360° (reuse `rotate-[360deg]` + `duration-500`)
  - Copy: `Deep work logged · +1 to your streak`
- Optional sound: soft chime (Pro-only setting).

---

## 5. Sidebar nav — unlocked feel

**Where:** Extension sidebar FOCUS section.

- Pro items (AI Coach, advanced analytics): remove lock icon; add tiny **✦** suffix in purple.
- Active tab: keep purple rail; add 2px **glow line** under label (`box-shadow: 0 0 12px rgba(168,85,247,0.5)`).
- On tab switch: content cross-fade 150ms (not instant swap).

---

## 6. Subscription card (Account) — status as trophy

**Where:** `AccountSettings` subscription `GlassCard`.

**Pro state:**

```
┌─────────────────────────────────────┐
│  ✦  Subscribed to Pro               │
│  Active · renews Mar 21, 2026       │
│  [ MANAGE SUBSCRIPTION ]            │
└─────────────────────────────────────┘
```

- Border: animated gradient border (slow 6s rotation) — subtle, not disco.
- No “Upgrade” button visible when Pro (only Manage).
- After returning from Stripe portal: green checkmark flash on card + `Billing updated` notice (2.5s).

---

## 7. Streak / XP bar (gamification strip)

**Where:** Below sidebar search or above Today content.

- Thin progress bar: XP to next “Focus level”.
- Pro: bar fill uses purple→pink gradient; on streak increment, bar **pulses once** and `+1` floats up (like mobile game loot).

---

## 8. Blocked page — positive reframe for Pro

**Where:** `BlockedView`.

- Pro users see alternate line: `You chose focus. 47 distractions stopped today.`
- CTA: `Back to dashboard` → web `focuznow.com/dashboard` (not chrome-extension URL).

---

## 9. Motion tokens (keep consistent)

| Token | Value |
|-------|--------|
| Success duration | 400–500ms |
| Easing | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Glow | `shadow-[0_0_20px_rgba(168,85,247,0.35)]` |
| Habit spin | `transition-all duration-500` + `rotate-[360deg]` |
| Respect `prefers-reduced-motion` | Disable spin/confetti; keep color changes only |

---

## 10. Implementation order (recommended)

1. Pro badge + subscription card copy (Account) — **low effort, high clarity**
2. Overview hero + stat hover glow — **daily dopamine**
3. Post-upgrade confetti + `subscription=success` query — **one-time wow**
4. Habit-style Pomodoro completion toast — **ties product loops together**
5. Sidebar ✦ + animated tab glow — **polish**

---

## 11. What to avoid

- Don’t block core free features behind annoying Pro animations.
- Don’t autoplay sound without a toggle.
- Don’t use chrome-extension URLs in any post-Stripe CTA.
- Don’t show “Upgrade to Pro” anywhere when `subscriptionTier === 'pro'` (server + UI).

---

## Reference: habit check-in pattern

Reuse from `HabitsTab` in `Pages.tsx`:

- Button: `w-14 h-14`, `rounded-2xl`, checked state `bg-purple-600`, `rotate-[360deg]`, `shadow-purple-600/40`.
- Label flips to `text-purple-400` when complete.
- Status line: `COMPLETED TODAY` in uppercase tracking-widest.

Apply the same **size, timing, and purple semantics** to Pro celebration moments so the app feels like one cohesive system.
