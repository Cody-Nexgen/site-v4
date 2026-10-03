# FocuzNow iOS: design spec ("Beam")

Status: v1, 2026-10-03. It goes with `docs/focuznow-ios-plan.md` (tech) and is built in `ios/App/`.
Benchmark: Opal's polish, meaning a hero visual, immersive sessions, real charts and atmosphere.
**Our own identity:** no gems, no stock photos, no Opal layouts.

---

## 1. The idea

FocuzNow's mark is the **Beam Z**. In the app, focus is **light**:
- **The Beam:** the signature visual on Today. It's a tall glass prism holding living, flowing light (an animated `MeshGradient`).
  - It **fills up** as you focus toward today's goal.
  - Its **colour warms** as your Focus Score rises (cool indigo, then violet, then a sunset coral-gold).
  - During a session, specks of light rise inside it.
- **Skies:** every screen sits on a slow, living gradient sky (no photos) that follows the time of day. Dawn is peach and lilac, day is soft blue, dusk is coral and indigo, night is deep navy and violet.
- **Scenes:** the session screen is a full-bleed drawn landscape:
  - layered ridges drawn in code (`Canvas`), with a sun or moon and stars;
  - four scenes: **Dawn Ridge, Night Lake, Desert Dusk, Aurora**;
  - **dims as time passes** to show progress.

The mood: calm, cinematic, alive, but never sci-fi. Big numbers, few words, a lot of room.

## 2. Tokens

### Colour
| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | #07080D | #F4F5FA | behind skies |
| `ink` (text 1) | #F7F7FB | #0E1020 | titles, numbers |
| `ink2` | 72% white | 62% ink | body |
| `ink3` | 46% white | 42% ink | captions, labels |
| `line` | 10% white | 8% ink | hairlines |
| `glass` | system glass (26) / ultraThinMaterial (18) | same | floating chrome |
| `surface` | 6% white | 70% white | solid cards on a sky |

**Beam gradient** (the brand accent; used sparingly): `#5B6CFF → #A35BFF → #FF7A6B` (indigo, violet, coral).
- Focus Score ramp: 0–3 `#5B7BFF`, 4–6 `#8F6BFF`, 7–8 `#C266FF`, 9–10 `#FF8A5B`.
- **Status colours:** good `#5BE3A6`, warn `#FFC25B`, danger `#FF6B7A`.

**Sky palettes** (3×3 mesh, top → bottom):
- **Dawn:** #2B2550 #6E4C8C #F2A07B / #FFC9A8 …
- **Day:** #1E3A70 #3D6FD0 #8FC0FF …
- **Dusk:** #1A1440 #6B2E7A #FF7A6B …
- **Night:** #04060F #121A3A #2A1F5C …

Light mode uses the same hues at roughly 25% saturation over `bg`, with a white veil.

### Type (SF)
- **Hero numbers:** SF Pro **Rounded**, Heavy, 64–88pt, `.numericText()` transitions.
- **Titles:** SF Pro Display Bold, 28–34pt.
- **Body:** SF Pro Text 15–17pt.
- **Labels:** SF Pro Text Semibold 11pt, **ALL CAPS, +1.2 tracking**, `ink3` (for example `NOW`, `SCREEN TIME`).

### Shape, depth and motion
- **Corners:** 28 (sheets, hero cards), 20 (cards), 14 (chips), capsule for buttons.
- **Glass only floats:** tab bar, top bar, the session mini-bar, floating buttons. Content cards are `surface` with a 1px `line`.
- **Motion:** springs (`.smooth`, 0.35–0.5s).
  - The Beam's mesh loops every ~12s.
  - Numbers roll with `.numericText()`.
  - Haptics on start, complete, and a block hit.
- **Reduce Motion:** skies and the Beam freeze to a still frame; no particles.

## 3. Components
- **Beam:** a prism capsule (~170×300) with a mesh interior, inner highlight, outer bloom, fill level and particles.
- **SkyBackground(mood):** a full-screen animated mesh.
- **Scene(kind, progress):** a landscape drawn in `Canvas`.
- **StatTrio:** three labelled numbers (for example `LAST HOUR ▼0.4 · SCREEN TIME 3h 17m · PICKUPS 123`).
- **DayWave:** a Swift Charts area plus line through the day, with a "now" dot and dashed future.
- **SessionBar:** a glass capsule showing `● Deep work · 18:42 · ⌃`; tap it to open the session.
- **GlassButton / BeamButton:** capsule buttons. The BeamButton uses the Beam gradient (primary action, at most one per screen).
- **Chip, AppStack** (overlapping app icons), **Row, SectionLabel.**

---

## 4. Screens

### 4.1 Launch
```
┌──────────────────────┐
│        (night sky)   │
│                      │
│          ▮           │  ← Beam rises from a line of light (0.6s)
│        FocuzNow      │
└──────────────────────┘
```

### 4.2 Onboarding (4 pages, swipe; skip top right)
```
┌──────────────────────┐         ┌──────────────────────┐
│ ●○○○           Skip  │         │ ○●○○           Skip  │
│                      │         │   [IG][TT][YT]  ✕    │ ← app icons fade out
│        ▮▮  Beam      │         │                      │
│                      │         │                      │
│  Your focus,         │         │  Block what pulls    │
│  made visible.       │         │  you away.           │
│  Every minute you    │         │  Pick apps & sites;  │
│  focus fills the Beam│         │  FocuzNow shields    │
│                      │         │  them while you work │
│ [  Continue  ]       │         │ [  Continue  ]       │
└──────────────────────┘         └──────────────────────┘
  3: "Your plan, your passwords, one app" (Plan + Pass + Coach mini-cards orbiting)
  4: "Friends keep you honest" (focus room avatars) → [Get started]
```
Each page has its own sky, and the sky cross-fades as you swipe.

### 4.3 Account
```
┌──────────────────────┐
│ ‹                    │
│  Create your account │
│  Sync with your      │
│  FocuzNow extension. │
│                      │
│ [   Sign in with Apple] │  ← system button, black/white
│ [ G  Continue with Google ] │
│ ───────  or  ─────── │
│ ┌ Email ───────────┐ │
│ └──────────────────┘ │
│ ┌ Password ────────┐ │
│ └──────────────────┘ │
│ [   Create account   ]│ ← BeamButton
│ Have an account? Sign in │
└──────────────────────┘
```

### 4.4 Setup (4 steps; progress bar up top)
1. **Your name** (big text field) and **daily goal**, using a Beam-styled dial (30m–8h, snapping to 15m).
2. **Allow Screen Time:** an illustrated card ("FocuzNow only sees what you pick"), then the system prompt.
3. **Pick what distracts you:** `FamilyActivityPicker`. The chosen apps show as an AppStack ("12 apps · 3 categories").
4. **Notifications:** "Get a nudge when it's time to focus," then the system prompt.

The flow ends with **"You're set"**: the Beam fills with a burst and confetti light, then Today.

### 4.5 Today (home)
```
┌──────────────────────┐
│ FocuzNow      Maya ◉ │  ← name + avatar → You
│                      │
│        ▮▮▮▮          │
│       ▮ BEAM ▮       │  ← fills to today/goal
│        ▮▮▮▮          │
│        NOW           │
│        8.2           │  ← Focus Score, Rounded Heavy 72
│   Excellent focus    │
│                      │
│ LAST HOUR SCREEN PICKUPS│
│  ▲0.4    3h 17m  123 │
│ ∿∿∿∿∿∿●- - - - - - - │  ← DayWave, 6A 12P 6P 12A
│                      │
│ UP NEXT              │
│ ◷ 10:00 Bio study  ▸ │
│ ☐ Finish lab report  │
│ ☐ Read ch. 4         │
│                      │
│ [ ● Deep work 18:42 ⌃]│ ← SessionBar when running
│ Today Focus Plan Pass ✦│
└──────────────────────┘
```
- With no session running, a **BeamButton "Start focus"** floats above the tab bar.
- **iPad:** the Beam and score on the left half; wave, up next and friends on the right.

### 4.6 Focus (start a session)
```
┌──────────────────────┐
│ Focus                │
│ ┌ Deep work ┐┌ School ┐┌ + ┐ │ ← preset chips (scroll)
│                      │
│        50:00         │  ← time wheel; drag the ring
│     ◯────────●       │
│                      │
│ BLOCK LIST       ▸   │
│ [IG][TT][YT][+9]     │
│ DIFFICULTY       ▸   │
│ ◇ Normal             │  (Easy / Normal / Locked-in)
│ BREAKS               │
│ 10 min every 50      │
│                      │
│ [   Start session   ]│
└──────────────────────┘
```

### 4.7 Active session (full screen)
```
┌──────────────────────┐
│ ⌄                  ? │
│  (SCENE: Night Lake, │
│   ridges, moon,      │
│   stars twinkle)     │
│                      │
│                      │
│ ✎ Edit               │
│ 💻 Deep work         │
│ Remaining  38:26     │  ← Rounded Heavy
│ ●━━━━━━┿┿┿┿┿┿┿┿┿┿┿   │  ← tick timeline, start → end time
│ 9:00          9:50   │
│ ┌Block list ▸┐┌Difficulty▸┐│
│ │[IG][YT]    ││◇ Normal   ││
│ └────────────┘└──────────┘│
│ [    Take a break    ]│ ← glass capsule
│      End early       │ ← danger text; "Locked-in" hides it
└──────────────────────┘
```
- The scene slowly brightens toward its "dawn" as time runs out.
- Tapping a blocked app shows the Shield (4.15).
- **Break mode:** a calm ring counts down, the scene turns warm, and "Back to focus" appears.

### 4.8 Session complete
```
┌──────────────────────┐
│     ✦  ✦   ✦         │  ← light particles burst
│        ▮▮            │  ← Beam jumps up
│   50 minutes         │
│   of deep work 🎉     │
│  +12 coins  · 🌲 grew │
│  Score 7.4 → 8.2     │
│ [ Done ]  [ Another ]│
└──────────────────────┘
```

### 4.9 Plan
```
┌──────────────────────┐
│ Plan     [Lists|Cal] │
│ M  T  W  T  F  S  S  │  ← week strip, today has a beam dot
│ ─────────────────────│
│ 9  ▌Bio study        │  ← timeline, events as colour bars
│ 10 ▌                 │
│ 11 ▌Lunch            │
│ LISTS                │
│ ▣ School (4)  ▣ Home │
│ ☐ Finish lab report  │
│ ☑ Email Ms. K        │
│                  [+] │ ← floating glass add button
└──────────────────────┘
```
- **iPad:** a sidebar with lists, plus a week grid.

### 4.10 Pass (FocuzPass)
```
Locked:                    Unlocked:
┌──────────────────────┐   ┌──────────────────────┐
│     (dark sky)       │   │ Pass        🔍   +    │
│        🔒            │   │ ▣ All  ★ Fav  ⌸ Vaults│
│     FocuzPass        │   │ [Gi] GitHub          │
│  [ Unlock with Face ID]│ │      maya@…          │
│  Use master password │   │ [Li] Linear          │
└──────────────────────┘   │ [AX] Amex Gold       │
                           └──────────────────────┘
```
- The detail view has a big tile and fields with copy buttons, plus the password with **strength** and a reveal option.
- **iPad:** three columns (vaults | list | item), Clean Desk style.

### 4.11 Coach
```
┌──────────────────────┐
│ ✦ Coach        Flash ▾│
│   (soft violet sky)   │
│ ┌──────────────────┐ │
│ │ How can I help    │ │
│ │ you focus today?  │ │
│ └──────────────────┘ │
│ [Plan my afternoon]  │ ← suggestion chips
│ [Why am I distracted?]│
│           You: …  ▐  │
│ ✦ Here's a plan: …   │
│ ┌ Ask anything… ✦  ↑┐│ ← glass composer
└──────────────────────┘
```

### 4.12 Score / Stats
- A big Score ring.
- A week bar chart with gradient bars.
- Top distractions (AppStack with minutes).
- Streak flame.
- Best hours (a heat strip).

### 4.13 Friends & rooms
- A leaderboard: avatars with rank, minutes and a mini Beam bar.
- **Focus rooms:** a card showing the avatars inside, a live timer and a Join button.

### 4.14 Forest
- Your trees drawn in `Canvas` on a hill under the sky. Each session is a tree, and its height is the session length.

### 4.15 Shield (over blocked apps; the system-limited layout)
```
  (blur)  ⚡ Stay focused
  Instagram is blocked during your FocuzNow session.
  [ Close ]   Ask for 5 minutes
```

### 4.16 Settings & You
- Profile header (avatar, name, Pro badge).
- Groups:
  - **Account:** sync, sign out, delete account (required).
  - **Focus:** default preset, difficulty, scenes.
  - **Pass:** Face ID, AutoFill.
  - **Notifications.**
  - **Appearance:** System / Light / Dark, and the sky follows the time.
  - **Privacy.**

### 4.17 Pro (paywall)
- The Beam in gold, with a few benefit rows.
- Monthly/yearly toggle, then **Continue** through StoreKit.
- "Restore purchases." **No website pricing or links.**

---

## 5. Build notes
- Mock data until Phase 1–5 wire up the backend. Every screen works with `MockData`.
- Onboarding shows once (`@AppStorage("onboarded")`). Settings → "Show onboarding again" brings it back.
- Everything adapts to size class (iPhone, iPad, iPad split views) and Dynamic Type up to XL.
- Light mode: the skies switch to their soft variants and text flips to ink. The session screen stays dark (immersive).
