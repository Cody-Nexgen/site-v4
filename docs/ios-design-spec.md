# FocuzNow iOS: design spec ("Into focus")

v2, 2026-10-03. It replaces the v1 "Beam/skies" spec, which the owner found too colourful and too "AI".
- Built in `ios/App/`.
- Tech plan: `docs/focuznow-ios-plan.md`.

## 1. The story
**FocuzNow = coming into focus.**
- When you're pulled in ten directions, everything is **out of focus**: soft bokeh lights drifting apart, blurry words.
- When you focus, the lights **sharpen and gather** into one line of light: the **Beam Z**.

This is our own metaphor (optics), not Opal's (geology: a rock becoming a gem). It runs through the whole app:
- **Onboarding** opens out of focus and sharpens with each tap.
- **Today's hero** is your Focus Score made visible: scattered at 2.0, a crisp glowing Z at 9.5.
- **Thinking** in the coach is the lights gathering.
- **Finishing a session** gathers them into the Z.

## 2. Restraint (the rule that stops it looking "AI")
- **Black and white.** Dark is pure black; light is warm off-white `#F6F5F2`. Text is ink, at 100/70/42% opacity.
- **One light.** A single accent the person picks in Customize:
  - **Warm** `#FFD49A` (default), Ice `#A8D8FF`, Mint `#9FF0CF`, Rose `#FFB3C1`.
  - Use it for **one thing per screen**: the glow, a highlighted number (*"23 days"*), the progress fill.
- **No gradients on controls.**
  - The primary button is a solid white capsule (ink in light mode) with a soft glow of the light underneath.
  - Secondary buttons are glass.
- **The background** is one soft, slowly breathing radial glow of the light at the top of the screen. That's it.
- **Glass only floats:** tab bar, top buttons, the session bar, answer pills, the composer.

## 3. Motion language
- **Blur-rise:** things arrive out of focus, 26pt low, transparent, then rise, sharpen and fade in (`.blurRise`, `.riseIn(delay:)`). Staggered 60–150 ms in lists.
- **Gather:** `FocusField` is animatable. `withAnimation { focus = 1 }` plays the lights gathering into the Z.
- **Conversation:** new lines blur-rise. Older lines dim and blur more the further back they are.
- **Numbers** roll (`.numericText`), and the session clock counts down.
- **Haptics:** a light tap per onboarding beat, selection ticks on choices, success on finishing.
- **Reduce Motion:** everything appears sharp and still.

## 4. Screens

### Onboarding (`OnboardingFlow.swift`)
```
1. LENS                         2. TALK                          3. PAYOFF
┌──────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
│  ◌    ◯      ◌   ◯   │        │          Z           │        │          Z           │
│     ◯    ◌      ◯    │        │ Hey. I'm FocuzNow.   │ (blur) │ Maya,                │
│  Everything's blurry │        │ I'll ask a few…      │ (dim)  │ FocuzNow can give you│
│  when ten things are │        │ What should I call   │        │ back 23 days this yr │
│  pulling at you.     │        │ you?                 │        │ ⌛ 30% less screen…  │
│   ◯     ◌    ◯       │        │ Maya ←accent         │        │ ◎ Deeper focus…      │
│      TAP TO FOCUS    │        │ [Under 2h][2–4h]…    │        │ [   Let's do it   ]  │
└──────────────────────┘        └──────────────────────┘        └──────────────────────┘
```
1. **Lens:** 3 taps. The text sharpens with each tap, the lights gather, the Z ignites, then "FocuzNow · Your time, in focus." appears.
2. **Talk:**
   - The questions: name (inline field) → phone time (5 pills) → what pulls you → what you want time for.
   - Each answer gets a reaction ("Okay… we should talk.").
   - Then "Building your setup…" with a progress fill.
3. **Payoff:** "{name}, FocuzNow can give you back **N days** this year". N = hours × 30% × 365 / 24, and it counts up. Three benefits rise in, built from the answers.
4. **Account:** "Quick check, have we met before?" → Continue with Apple (white system button), Google (glass), email (expands inline).
5. **Screen Time → apps** (Apple's picker) **→ notifications**, each said as two conversational lines with a white primary button and a quiet "Not now".
6. **Finale:** the Z grows large and bright. "You're in focus, {name}." → Start.

### Today
- Header: "Evening, Maya" plus an avatar (which opens You).
- **Hero:** a `FocusField` gathered to *score / 10* (it animates in on appear), with `NOW` and the score in 72pt rounded beneath, then the score word and "**1h 14m** of 2h today · 6-day streak".
- Below that: the stats trio, the day wave (optional), up next (event + to-dos), and friends focusing now (optional).
- A white "Start focus" button floats at the bottom.

### Session (`ActiveSessionView.swift`)
- **Background:** *your photo* (Customize, stays on the device) or a drawn scene.
  - It fills the screen and **blurs progressively** into black from about 40% down: the same image, blurred, masked by a gradient, under a black gradient.
- **Panel:**
  - the Edit session pill;
  - the title;
  - the **clock in the chosen style** (big / minimal / ring);
  - **one progress track** (6pt, accent fill, a glowing head; no tick lines under it);
  - start/end times;
  - cards: Block list | **Breaks (tap to edit the length)**;
  - Take a break (white) and Leave early (red text). Locked in hides both.
- **Edit session:** +5/10/15/30 min.
- **Break:** an accent ring countdown and "Back to focus".
- **Complete:** the lights gather into the Z, then "50 minutes" and chips rise in.

### Coach (`CoachView.swift`)
- **Top bar:** ≡ (library) · "Coach **Flash** ⌄" (model sheet) · ✎ (new chat).
- **Empty:** a small Z plus "Ready when you are, Maya", and suggestion chips rising in.
- **Thread:** your messages in soft bubbles; coach replies sit on the page (no bubble), and everything blur-rises. Thinking shows the lights gathering plus a shimmering "Thinking".
- **Library:** slides from the left, with New chat, search, and recent chats (title + relative time) plus your profile.
- **Model sheet:** cards (Flash: fast; Pro: thinks deeper, with a PRO badge) and a checkmark.

### Forest (`ForestView.swift`, SceneKit)
- A floating low-poly island: grass top, earthy cone underneath, rocks, a pond.
- Three tree kinds (pine, round, birch), sized by session length and spread on a spiral.
- A warm sun with soft shadows over a dusk sky. It turns slowly and bobs, and you can drag to rotate.

### Customize (`CustomizeView.swift`), new
- **Session background:** your photo (PhotosPicker) or one of the scenes.
- **Clock style:** a live preview over your background.
- **Your light:** 4 swatches; the whole app re-tints live.
- **Home:** show the day wave / friends; a quote during sessions.

### Settings
Only account things:
- profile and Pro;
- notifications;
- theme;
- sign out and delete account;
- replay the intro.

Focus defaults live in Focus; Face ID lives in Pass; looks live in Customize.

Focus rooms are removed (dropped from the product earlier).

## 5. Art still to come (code can't fake these)
1. **A 3D Beam Z**, made in Spline (its official SwiftUI package) or Blender, to replace the drawn Z in the hero and the finale.
2. **A curated photo pack** for session backgrounds (free-license photos are allowed in apps).
3. Sound: a soft chime on finish (optional).
