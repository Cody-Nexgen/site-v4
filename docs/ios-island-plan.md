# FocuzNow iOS: the "Island" plan (UI v4)

Status: **plan, waiting for the owner's go.** Nothing here is built yet.
Replaces the v3 "Lighthouse" direction in `docs/ios-design-spec.md` where the two disagree.

---

## 0. In one paragraph

FocuzNow lives in the **Dynamic Island**. Onboarding is you flicking your answers, your
distracting apps and your first focus session up into the island, and it ends with a **real Live
Activity** running there. After onboarding, the app itself is organized, card-based and full of
real things: **real photographs** (not drawn scenes), **your real app icons** from Screen Time,
**real charts** from your data, and SF Symbols in icon tiles. The island's pill shape is the brand
shape everywhere, and FocuzNow shows up across the Apple ecosystem: Lock Screen, widgets,
StandBy, Control Center, the Action button, Siri and Shortcuts, iOS Focus modes, and the Watch
Smart Stack.

---

## 1. Why this direction

What the owner said about earlier versions, and what this plan does about each:

| Feedback | Answer in this plan |
|---|---|
| v3 onboarding feels traditional (screen → question → Continue) | No Continue buttons between questions. Answering is advancing. Nothing is torn down; things fly into the island. |
| v2 flowed well (the name field, the chips, the conversation) | The v2 name field (inline, round white arrow) and v2 chips (capsules arriving one by one) come back. The island answers like v2's voice did. |
| The Metal lighthouse looks "tinkercad" | No drawn scenes anywhere. The lighthouse/sea becomes **real photography and video loops**. Code only draws light, type, charts and UI. |
| Onboarding has a void of black space | Every zone of the screen has a job (§4.2). |
| After onboarding it shouldn't be a blank canvas; it should feel organized, with images, icons and graphics, Opal-level rich | §3 (visual system) and §5 (every screen, zone by zone). |
| Don't look or work like Opal | No gem/orb, no pastel gradients, no "X years of your life" payoff, no copy of their session layout. Our richness comes from photos, real app icons, charts and the island. |

---

## 2. Rules for every screen

1. **Organized, not a canvas.** Every screen has the same skeleton: a title zone, one hero, up to
   four sections, and one pinned primary action. Nothing floats loose except the onboarding chips.
2. **Three card types, by role** (§3.4). At most one bone card per screen: it marks "the important
   thing".
3. **Real imagery only.** Photographs, real app icons (Screen Time tokens), real data. No drawn
   landscapes, no AI illustrations, no pixel/ASCII art, no bokeh logos.
4. **The pill is the brand shape.** Status, session state and badges use the island's capsule.
5. **Motion has a job.** Things move to where they live (into the island, into a card). Springs
   only, no `TimelineView` frame caps, 60/120 fps. Reduce Motion gets cross-fades.
6. **Readable always.** Dim, never blur, anything someone needs to read. Text over photos sits on a
   gradient scrim.
7. **Both themes.** The app follows Light/Dark/Auto. Photos look the same in both; cards and text
   follow the theme. Onboarding stays dark on purpose (the island is black hardware, so the illusion
   only works on black).
8. **No website prices or purchase links in the app.** Pro is StoreKit only.

---

## 3. Visual system

### 3.1 Colour and type (unchanged tokens, `Design/Theme.swift`)
- Black `#0A0A0B`, ink `#F5F3EE`, light background `#F3F0E9`, **bone** `#ECE8DF` cards with
  `#E1DDD3` tiles and `#111` ink. White buttons with black text in dark mode, ink buttons in light.
- **Satoshi** (Black/Bold/Medium) for headlines and big numbers, tight tracking; SF Pro for body.
- The only saturated colour comes from **real things**: app icons, photos, calendar event colours.
  UI chrome stays black, white and bone.

### 3.2 Photography (the replacement for drawn scenes)
A small, curated library that ships in the app.

| Set | Used for | Count |
|---|---|---|
| **Coast by time of day**: dawn, day, dusk, night (sea, cliffs, a lighthouse in some) | Today header (picked by the clock), Settings profile, About | 4 × 2 = 8 |
| **Session backdrops**: night sea, rain on glass, fog, still lake, library, desk lamp | Session screen, Focus presets | 6 stills + 3 video loops |
| **Preset covers**: desk at night (Deep work), library (School), open book (Reading), track/run (Sprint) | Focus preset cards | 4 |
| **Shop scenes** (bought with coins) | Session backdrops | 6–8 |

- **Grade:** one consistent look. Slightly cooler, about 20% less saturation, blacks pulled to brand
  black at the bottom edge so photos melt into the page.
- **Format:** HEIC in the asset catalog, 1290 px wide, about 200–400 KB each. Video loops: 6–10 s
  seamless HEVC, about 2–4 MB each, played muted with `AVPlayerLooper`.
- **Licensing:** Unsplash/Pexels photos are fine for headers and backdrops. **Shop scenes must be
  photos FocuzNow owns or licenses for resale-type use** (stock with an extended licence). Unsplash's
  licence doesn't allow selling a photo as a product, and selling scenes for coins is close enough to
  avoid.
- The owner picks the photos (a shortlist of about 3 per slot is prepared for review).
- Photos can be swapped by name, so they can be upgraded later without code changes.

### 3.3 Icons and graphics
- **SF Symbols**, semibold, always inside an **icon tile**:
  - On bone: 30 pt ink square, bone glyph (the website's feature-panel style).
  - On black/surface: 30 pt square at 6% ink, ink glyph.
  - Big tiles (onboarding, empty states): 56 pt, same rules.
- **Real app icons** from Screen Time (`Label(applicationToken)`), wherever we talk about blocked
  apps: Today, Focus, Session, Stats, onboarding. They're the most colourful thing in the app, and
  they're *your* apps.
- **Charts** with **Swift Charts** (built in, no dependency): the day's focus line, week bars, a
  month heatmap, top-distraction bars with app icons.
- **Rings and tracks:** goal ring and session progress, drawn as thin ink arcs with a bright head.
- **Pills:** status capsules shaped like the island:
  - `● Focusing · 18:42`
  - `Break · 4:10`
  - `🔒 6 locked`
  - `Ready · 0 of 2h`
- **Badges (achievements):** bone discs with an embossed SF Symbol and a thin ring, earned for
  streaks, first session, 10 hours, and so on. They're shown in Stats and on the share card.

### 3.4 Card types
| Card | Look | Role |
|---|---|---|
| **Photo card** | Full-bleed photo, bottom scrim, white text, 24 pt corners | Heroes: Today header, presets, session complete, share card |
| **Bone card** | `#ECE8DF`, 24 pt corners, bone tiles inside | The one key block on a screen (Up next, the plan, Pro perks) |
| **Surface card** | Graphite (dark) / white (light), hairline border, 20 pt corners | Everything else: lists, stats, settings groups |

### 3.5 Layout grid
- iPhone: 20 pt side margins, 8 pt rhythm, 28 pt between sections, `SectionLabel` caps headers.
- iPad: content max width 980, two columns on Today and Stats, the sidebar from `sidebarAdaptable`.

---

## 4. Onboarding: "Drop it in the island"

### 4.1 How the island trick works
- iOS hides an app's own Live Activity from the Dynamic Island while the app is open. So in the app
  we draw **our own black pill exactly over the camera cutout** (`IslandStage`). On a black screen
  it is indistinguishable from the real island.
- When the user leaves the app, the **real Live Activity** appears in the same spot: a seamless
  hand-off.
- Island geometry: phones with a top safe-area inset ≥ 54 pt have an island. The pill is about
  126 × 37 pt, about 11–14 pt from the top, and a 1–2 pt miss is invisible on black.
- **No island** (iPhone SE, notch phones, iPad): the same pill sits as a floating glass capsule at
  the top and still catches things. The ending shows the Lock Screen version instead.

Island states (springs tuned to feel like the real one, about 0.5 s with bounce 0.3):

| State | Size | Used when |
|---|---|---|
| Resting | 126 × 37 | Idle |
| Catching | Widens to about 200 × 40, soft pulse | A chip is being dragged |
| Swallow | Squash 1.08 × 0.92, spring back, haptic | A chip lands |
| Compact | Resting plus leading/trailing content | A running summary: "5h", a glyph, "School" |
| Expanded | Screen width − 24 × about 150, 44 pt corners | Replies, the countdown |

### 4.2 Screen zones (no void)
```
┌──────────────────────┐
│      ( island )      │  island: catches things, speaks the replies
│     ╱   light   ╲    │  light: falls from the island, brighter with every answer
│    ╱               ╲ │
│  What pulls you      │  question: Satoshi 34, left-aligned
│  away the most?      │
│                      │
│    ↑  flick up  ↑    │  runway: the throw distance is what makes the catch feel good
│ [▶ Short videos]     │
│ [◎ Social] [🎮 Games]│  chips: v2 capsules with an icon tile, drifting slightly
│                      │
│   (Lock Screen card) │  end only: the Lock Screen Live Activity rises here
└──────────────────────┘
```
- **Light:** a soft cone from the island down (a SwiftUI shader or gradient with grain). It's the
  lighthouse beam without drawing a lighthouse, and it's visible progress without a progress bar.
- **Chips:** icon tile plus label, glass capsules, slight idle drift (±2 pt, slow).
  - Drag up past the light, or within 80 pt of the island, and the chip flies in. Anything else
    springs back.
  - Tap also flies it in (for speed and VoiceOver: "Add to FocuzNow").

### 4.3 Storyboard
1. **Noise (about 1.5 s).** The screen is stacked with notification-shaped cards using generic glyphs:
   "47 unread", "Live now", "You might like…", "Just one more episode?". The island wakes and the
   light sweeps down, the noise slides off the bottom, and "Everything else can wait." rises. Below
   it, small: "I already have an account". There's no button: after a beat the first question rises.
2. **Name.** "First, what should I call you?" with the v2 inline field and round white arrow, keyboard
   up. Submit and **the name flies into the island**, which swallows it and expands: "Nice to meet
   you, Maya. Four quick ones." The island's compact leading side shows the initial in a bone circle.
3. **Phone time.** Chips: Under 2h · 2–4h · 4–6h · 6–8h · 8h+. Flick one up and the island expands with
   **that answer's reply** (`Asks.all`: "That's a part-time job."). Compact trailing: "5h".
4. **What pulls you.** Six chips with icon tiles. Reply per answer. Compact leading: the glyph.
5. **When it's hardest.** Four chips (sunrise, backpack, sunset, moon). Reply per answer.
6. **What for.** Five chips. Reply per answer. Compact shows "School".
   - A reply stays in the expanded island **until you touch the next chip**. Nothing disappears on a
     timer.
   - The next question and its chips rise while the reply is still showing, like v2's voice.
7. **Lock them away.** "To lock apps away, I need Screen Time."
   - **Allow** opens the system prompt, then the FamilyActivityPicker.
   - Your **real app icons** land in the runway as chips. Flick each one up (or tap **All in**), and
     each one gulps with a haptic while the island counts "1 locked… 4 locked".
   - "Not now" skips this. The island says "You can pick them any time."
8. **Notifications.** "Want a tap when time's up?" **Allow** opens the system prompt; **Not now**
   skips.
9. **First focus.** Chips: 10 min · 25 min · Later.
   - Flick 10 min up: the island expands into a live countdown, a **real Live Activity starts**, and
     the Lock Screen card rises into the bottom zone. "Swipe up. It's right there."
   - Onboarding progress is saved, so leaving the app is safe. Coming back resumes at step 10 with
     "Nice. That's your island."
   - **Later:** the island shows a preview of the countdown, then goes on.
10. **Save it.** "Keep this on all your devices." Sign in with Apple, Continue with Google, Continue
    with email (the existing `AccountButtons`).
11. **In.** The island collapses to resting, the light fades up to white, and Today fades in
    underneath.

Copy rules: the island speaks in first person ("I need Screen Time"). Questions are short. The v3
replies in `Asks.all` are reused, but **"days a year" maths stays a one-line aside, never a
payoff**, and the "What it adds up to" row is removed.

### 4.4 Developer mode (the owner's ask)
- Settings → **Developer** → **Developer mode** toggle (`@AppStorage("devMode")`).
- With it on, **Replay the intro** opens a popup: **Island** (default) · **In your words (A)** ·
  **Assemble (C)**. With it off, Replay always plays Island.
- All three share the same answers (`Asks`), `AccountButtons` and permission steps, so only the
  presentation differs.
- Decision pending (§9): keep C, or drop it, since Island is the stronger version of the same idea.

---

## 5. The app after onboarding

Tabs stay: **Today · Focus · Plan · Pass · Coach**. The "You" pages (Stats, Friends, Forest, Shop,
Customize, Settings) stay in the avatar sheet on iPhone and the sidebar on iPad. The Metal
`LighthouseView` is retired from every screen and replaced by photo cards (it can stay in the code
until the photos land).

### 5.1 Today
```
┌────────────────────────────┐
│ [PHOTO: coast, time of day]│  photo card, 300 pt, parallax + stretch on pull
│  Evening, Maya        (M)  │  greeting in Satoshi 22, bone avatar
│  ● Ready · 1h 14 of 2h     │  island-shaped status pill (mirrors the session state)
├────────────────────────────┤
│ FOCUS SCORE                │
│ 8.2  Sharp        ◯ 62%    │  Satoshi 84 counting up + the goal ring
│ ▁▂▃▅▇▅▃ (focus today)      │  Swift Charts line, today only
├────────────────────────────┤
│ ┌ bone: Up next ─────────┐ │  bone card: next event, next to-do,
│ │ [⏰ Bio 10:00][☑ Lab]  │ │  locked apps (real icons), screen time
│ │ [🔒 ◉◉◉◉ 6][📱 3h 17]  │ │
│ └────────────────────────┘ │
│ LAST HOUR  PICKUPS  COINS  │  surface card, stat trio
│ Ava and Kai are focusing ● │  surface card, avatars
│ [ ▶ Start 50 min focus   ] │  pinned white button
└────────────────────────────┘
```
- **Start focus** opens Focus.
- While a session runs, the pill becomes `● Focusing · 18:42` and tapping it opens the session.
- **Empty states:** no events → "Nothing scheduled" tile with an Add button; no apps picked → "Pick
  what to lock" tile with real-icon placeholders.

### 5.2 Focus (setup)
- **Preset carousel:** photo cards (Deep work, School, Reading, Sprint, plus your own), 160 × 200,
  snapping horizontally. The selected one gets a white ring and a haptic.
- **Time ring:** an ink arc with Satoshi digits; drag to set; ticks at 5 min.
- **Locked while you focus:** a surface card with your real app icons and an Edit button
  (FamilyActivityPicker).
- **Difficulty:** segmented control (Easy · Normal · Locked in) with a one-line explanation under it.
- **Breaks:** a toggle plus a length stepper.
- **Backdrop:** thumbnails of the session photos and videos you own.
- **Hold to start** (`HoldButton`). When it fires, **the preset card shrinks and flies up into the
  island** (the in-app `IslandStage`), then the session screen opens. It's the same gesture language
  as onboarding.

### 5.3 Session
- Full-bleed **photo or video loop** backdrop with a bottom scrim.
- Small caps session name, **Satoshi 96 clock**, and a thin progress track with a glowing head.
- An island-style pill at the top: `🔒 6 locked`. Tap it to see the icons.
- Cards (glass on iOS 26): the blocked apps (real icons), next break.
- **Hold for a break**, End early.
- Leaving the app shows the **real Live Activity** (§6.1).

### 5.4 Session complete
- A **photo share card**: your session photo, minutes in Satoshi 58, the date, the score before →
  after, coins earned, and a badge if one was earned. It's rendered with `ImageRenderer` for the
  share sheet, with no links in it.
- Buttons: Share · Another · Done.

### 5.5 Plan
- A **week strip** at the top (pills for days, today filled).
- A **timeline** for the day: event cards with their colour bar, time and place, and focus blocks shown
  as island pills on the timeline.
- **Lists** below: grouped surface cards (School, Home…) with checkboxes that spring.
- An Add button (glass circle).
- Empty day: icon tile "Nothing planned" and an Add event button.

### 5.6 Pass (FocuzPass)
- Locked state: a photo card ("Your passwords") with Face ID unlock.
- Unlocked: a search field, then items as letter tiles (no favicon fetching: fetching icons would leak
  which sites you have), grouped A–Z; detail sheets keep their existing design.
- AutoFill setup card with step icons (Settings → Passwords → AutoFill).

### 5.7 Coach
- Header: the lamp glow (light only, no drawing) with "Coach" in Satoshi.
- **Suggestion cards** with icon tiles: "Plan my week", "Why do I scroll at night?", "Make a study plan".
- Chat bubbles: yours in ink, the coach's on surface. Markdown and math are native (§11 of
  `docs/focuznow-ios-plan.md`).
- The model picker is a pill at the top.

### 5.8 Stats
- **Week bars** (focus minutes per day), with today highlighted.
- **Month heatmap:** a calendar grid in ink shades (like a contribution graph, in our colours).
- **Top distractions:** real app icons with bars and minutes. The real Screen Time numbers come
  from a **DeviceActivityReport extension** (`com.focuznow.app.FocusReport`, already in the plan's
  bundle IDs); that's Apple's privacy-safe way to show them.
- **Badges** row (§3.3).
- Streak, best day, total hours in a stat trio.

### 5.9 You, Settings, About, Guest pass, Pro, Shop, Forest, Customize
- **You:** profile photo card (coast photo, avatar, name, streak pill) and a grid of bone tiles
  (Stats, Friends, Forest, Shop, Customize, Guest pass).
- **Settings:** grouped surface cards with icon tiles.
  - Groups: Notifications, Appearance (Auto/Light/Dark tiles), About, **Developer** (§4.4), Account.
  - The profile card uses a photo instead of the Metal lighthouse.
- **About:** photo hero, feature rows with icon tiles rising on scroll, and the signed bone card.
- **Guest pass:** the ticket keeps `tilt3D`, with the photo inside instead of the lighthouse render.
- **Pro:** perk rows with icon tiles, plan cards (selected = bone), Hold to go Pro, StoreKit only.
- **Shop:** scenes are **photo/video backdrops** bought with coins, shown as photo cards with a coin
  pill.
- **Forest:** decision pending (§9). The SceneKit forest may read as "drawn"; the alternative is a
  photo-based grove or a badge wall.
- **Customize:** backdrop picker (photos/videos), timer style, home sections.

---

## 6. FocuzNow across the Apple ecosystem

### 6.1 Live Activity (the island)
- `FocusActivityAttributes` lives in `FocuzNowKit` (shared by app and widget extension).
  - Static: session name, symbol.
  - State: phase (focusing / break / done), end date, locked count, label.
- `ActivityConfiguration` is added to the existing widget bundle (`Extensions/Widgets`):
  - **Compact:** leading is the session glyph; trailing is the countdown, `Text(timerInterval:)`,
    which counts with no updates.
  - **Minimal:** a progress ring.
  - **Expanded:** the session name, a big Satoshi countdown, `🔒 6 locked`, and **End** and
    **+5 min** buttons (`LiveActivityIntent`, iOS 17+).
  - **Lock Screen:** a black card with a bone progress track, the countdown, and the locked count.
- Starts when a session starts (from the app, onboarding, a widget, a control, Siri). Ends when the
  session ends, and shows "Done · 50 min" for a few minutes.
- `NSSupportsLiveActivities: YES` in `project.yml`. Satoshi is added to the widget target.
- Free extras where the OS supports them: iPhone Live Activities also show in the **Apple Watch
  Smart Stack**, in **CarPlay** (iOS 26) and in the **Mac menu bar** (macOS 26). No extra code; check
  how they look.
- Later: **push-to-start** for scheduled blocks ("3:30 PM · School starts"). It needs APNs from the
  server.

### 6.2 Widgets (home screen, Lock Screen, StandBy)
- Small: the focus score, a goal ring, and a Start button (an interactive widget, App Intent).
- Medium: the score, the next event, and a Start button.
- Lock Screen: a circular goal ring; a rectangular widget with the next block.
- StandBy uses the small and medium ones automatically; check the night (red) mode.

### 6.3 Control Center and the Action button
- An iOS 18 **ControlWidget**: "Start focus" (a toggle while a session runs).
- The same control can be put on the **Action button** and the Lock Screen bottom corners.

### 6.4 Siri, Shortcuts, Spotlight
- **App Intents:** Start focus (preset, minutes), End focus, Take a break, Add to-do, Open FocuzPass.
- `AppShortcutsProvider` phrases ("Start a focus in FocuzNow") so they show in Spotlight and Siri with
  no setup.

### 6.5 iOS Focus modes
- A **Focus filter** (`SetFocusFilterIntent`): when the iOS "Work" or "Study" Focus turns on,
  FocuzNow can start a session or switch on a block list. It's set up in Settings → Focus → Work →
  Add filter.

### 6.6 The shield (blocked-app screen)
- The `FocusShield` extension's `ShieldConfiguration`:
  - A black background and the Z icon.
  - Title "Everything else can wait."
  - Subtitle: the session name and time left.
  - One button: "Back to focus".
- No photos are possible there; Apple only allows an icon, text and colours.

---

## 7. Build phases (each ends with steps for the owner)

The cloud box can't compile SwiftUI. Every Swift file gets `swiftc -parse` here, and the owner
builds on the Mac and sends back Xcode errors.

| # | What | Main files | Owner checks |
|---|---|---|---|
| 1 | **Live Activity + session hand-off** | `FocuzNowKit/.../FocusActivity.swift`, `Extensions/Widgets/FocusLiveActivity.swift`, intents, `project.yml`, `AppModel.startSession/endSession` | Start a session from Focus. Swipe home and see the island countdown. Long-press for End and +5. Lock the phone and see the Lock Screen card. (Works in the iPhone 16 Pro Simulator too.) |
| 2 | **In-app island** | `Design/IslandStage.swift` (geometry, states, catch physics), `Design/LightCone.swift` | A debug screen in Developer mode: drag chips into the island and see each state. Check alignment on a real island phone and the fallback on an SE/notch simulator. |
| 3 | **Onboarding "Drop it in the island"** + dev-mode popup | `Onboarding/IslandOnboarding.swift`, `Onboarding/Asks.swift` (shared), `Onboarding/OnboardingFlow.swift` (router), Settings → Developer | Fresh install, the full flow. Then Settings → Developer mode on → Replay the intro → the popup. |
| 4 | **Visual system** | `Design/Photos.swift` (named photo sets, time-of-day picker, video loop view), `Design/Cards.swift` (photo/bone/surface cards, icon tiles, status pill), the asset catalog | A gallery screen in Developer mode showing every card, pill, tile and photo in light and dark. |
| 5 | **Today, Focus, Session, Complete** | `Screens/TodayView.swift`, `FocusSetupView.swift`, `ActiveSessionView.swift`, the complete view | The full loop: Today → Focus → hold → island → session → complete → share. |
| 6 | **Stats + Screen Time report** | `Screens/StatsView`, a new `Extensions/FocusReport` target | Real top apps and minutes, week bars, heatmap. |
| 7 | **Plan, Pass, Coach, You pages** | The respective screens | Each screen's empty and full states. |
| 8 | **Widgets, Control, Siri, Focus filter, shield** | `Extensions/Widgets`, `App/Intents/`, `Extensions/FocusShield` | Add each widget, the Control Center control, and the Action button; say "Start a focus in FocuzNow"; set a Work Focus filter; open a blocked app. |

Phases 1–3 are the onboarding the owner asked for. Phase 4 needs the photo shortlist approved first.

---

## 8. Risks and honest limits

- **The real island can't receive drags.** The drag happens in our in-app pill; the hand-off to the
  real Live Activity happens when you leave the app. That's the design, not a workaround.
- **Real app icons inside the real island/Lock Screen may not render.** Screen Time tokens in a
  widget extension are unreliable. In the app they definitely show; in the Live Activity it's
  "🔒 6 locked" with a glyph.
- **Live Activities can be turned off** in Settings (`areActivitiesEnabled`). The session still runs
  in the app, and the onboarding says so plainly instead of pretending.
- **iOS may ask once on the Lock Screen** whether to keep showing FocuzNow's Live Activities.
- **Photos add size:** about 8 MB for stills plus about 10 MB for three loops. Videos could become
  on-demand resources later if that matters.
- **The noise intro could feel stressful** if it lasts too long. It's capped at about 1.5 s and
  skipped on replays.
- **Opal check before shipping:** compare screens side by side and change anything that matches
  their layout.

---

## 9. Decisions for the owner

1. **Onboarding options in Developer mode:** Island (default) + A + C, or Island + A only?
   (Recommendation: drop C. Island is the stronger version of the same "things fly into place"
   idea.)
2. **Start a real 10-minute session at the end of onboarding?** (Recommendation: yes, with "Later"
   always there.)
3. **Photos:** approve the shortlist, and is there a budget for licensed shop scenes, or should the
   shop launch with free-licence backdrops only?
4. **Forest:** keep the SceneKit forest, or replace it with a photo grove or a badge wall?
5. **Phase order:** 1 → 2 → 3 (onboarding first), or 1 → 4 → 5 (the main app first)?
