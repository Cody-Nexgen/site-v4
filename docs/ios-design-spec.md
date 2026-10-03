# FocuzNow iOS: design spec v3 ("Lighthouse")

v3 (2026-10-03) replaces v2 "Into focus". The owner's feedback on v2: it was too close to Opal, the
dots-into-a-Z intro was weird and hard to read, animations were choppy (~15 fps), and every
onboarding answer got the same reply. The website (focuznow.com) is pure black and white with a
lighthouse, and the app has to feel like the same product. The v2 code is backed up in
`backups/ios-app-v2-2026-10-03/` (RESTORE.md).

## 1. The story

FocuzNow is a lighthouse. Everything else is dark sea and noise; the lamp is your attention.
- The lamp is **as bright as your focus**: dim at a low score, the full beam at a high one.
- Starting something important is **lighting the lamp** (hold to commit).
- A session is the lamp staying on; it grows brighter as the session goes on.
- "Everything else can wait." is the line, everywhere.

## 2. Brand (from the website)

- Colours: black `#0A0A0B`, text `#F5F3EE`, **bone** `#ECE8DF` cards with `#E1DDD3` tiles and
  `#111` ink (the website's feature card), white buttons with black text, 16pt corners.
  Light mode: bone-white `#F3F0E9` background, ink buttons. The lighthouse stays a night scene in both.
- Type: **Satoshi** (Black/Bold/Medium) for headlines and numbers, tight tracking (-3%); system for
  body. Satoshi files go in `ios/App/Fonts` (see README); until then a heavy system face is used.
- The lamp colour is the only "colour" (Customize → Lamp: bone, warm, white, ice).
- No gradients on controls, no rainbow, no pixel/ASCII art on the phone.

## 3. The lighthouse (`Design/Lighthouse.metal`, `Design/LighthouseView.swift`)

A real-time render, not a drawing: a moonlit round tower with black bands, gallery and railing, a
glass lantern room and dome; a beam that sweeps in 3D (foreshortened, flashes when it faces you)
through sea fog and low cloud; a rocky headland with foam; a perspective ocean with mirror
reflections and a glitter path; stars; film grain and vignette.
- Drawn by an `MTKView` at 60 fps with a 1.5x internal scale (cheap on battery), paused when the
  app isn't active, frozen with Reduce Motion.
- `LighthouseScene` sets framing and brightness (`.hero`, `.header`, `.session`). Changes to
  power, exposure and framing **glide** (~0.35 s), so one lighthouse can move from full screen to a
  header like a camera move.
- Honest limit: code can't look like a photo. For photoreal, a real night-lighthouse photo or video
  loop can replace the backdrop later, with only the beam and water animated on top.

## 4. Motion language (`Design/Motion.swift`)

- **Rise**: things arrive 18pt low and settle with a spring; at most a 4pt blur, so text is always
  readable. `riseIn(delay:)` staggers a screen's parts.
- **Hold to commit** (`HoldButton`): the fill sweeps across, haptic ticks speed up, success haptic
  when full; letting go drains it. Used for: lighting the lamp in onboarding, starting a session,
  taking a break, going Pro.
- **3D tilt** (`tilt3D`): drag to tilt with a moving sheen; springs back (guest pass).
- **Write-on** (`writeOn`): a signature reveals left to right like a pen (About).
- **Scroll rise** (`scrollRise`): rows rise in as they scroll into view (About).
- **Parallax**: lighthouse headers stretch on pull-down and drift slower than the page (Today, About).
- Smooth by default: no `TimelineView` frame caps anywhere (that was the v2 choppiness).

## 5. Screens

### Splash (`SplashView.swift`), every launch once you're set up
Black → the scene fades up → the lamp switches on (haptic) → "FocuzNow" + "Everything else can wait."
rise → the camera flies into the lamp (scale 7x around the lamp, exposure white-out) and the app
appears out of the light.

### Onboarding (`Onboarding/OnboardingFlow.swift`)
One lighthouse for the whole flow.
1. **Intro**: full-screen lighthouse, the lamp switches on. "Everything else can wait.", subtitle,
   Get started / I already have an account.
2. **Questions**: the lighthouse rises into a header. Name, then four questions (phone time, what
   pulls you, hardest time, what you want time for). Pick an answer: the others step aside, and a
   **reply written for that exact answer** rises in on a bone card (`Asks.all`, 20+ replies).
   Every answer lights the lamp a bit more; the progress bar fills.
3. **Your plan**: full-screen again. A bone card: daily focus goal (from phone time), what's
   blocked (from what pulls you), your focus block (from hardest time), days a year it adds up to.
   **Hold to light the lamp**: the beam brightens while you hold, flashes when it fires.
4. **Save your plan** (Apple, Google, email) → **Screen Time** (a bone card of the system prompt,
   privacy line) → **Pick apps** (FamilyActivityPicker) → **Notifications** (a bone notification
   preview).
5. **All set**: the beam spins up, "You're all set, Maya." → Enter: flash and fly into the app.

### Today (`Screens/TodayView.swift`)
Lighthouse header (brightness = focus score, parallax), greeting + avatar on it. Focus score in
Satoshi 84 counting up, word, minutes/goal/streak, goal track. Bone **Up next** card with four tiles
(next event, next to-do, blocked, screen time). Stats card (last hour, pickups, coins, the day
wave). Friends focusing now. White "Start focus" button.

### Focus (`Screens/FocusSetupView.swift`)
Presets, the time ring (ink arc, Satoshi clock), Screen Time prompt, block list, difficulty,
breaks, background. **Hold to start**.

### Session (`Screens/ActiveSessionView.swift`)
Full-screen lighthouse (or your photo / a scene), lamp brightening with progress. Small-caps session
name, Satoshi clock (96pt), thin white progress with a glowing head, start/end times, block list and
breaks cards, **Hold for a break** (shorter hold on Easy), End early. Break: white ring countdown.

### Session complete
The lamp flashes, minutes count up in Satoshi 58, "The lamp stayed on the whole time", a bone log
card (focused, score before → after, coins, tree), Share / Another / Done.

### You (sheet), Settings, About, Guest pass, Pro
- **You**: avatar, bone tiles (Stats, Friends, Forest, Shop, Customize, Guest pass), Settings, About.
- **Settings**: a lighthouse profile card (brightness = score) with Go Pro, grouped rows with
  icon squares, an appearance picker (Auto/Light/Dark tiles), About, guest pass, replay intro, account.
- **About**: parallax lighthouse, why FocuzNow exists, feature rows that rise and bounce their icons
  as they scroll in, a bone card signed "The FocuzNow team" that writes itself.
- **Guest pass**: a ticket with the lighthouse inside, perforation, pass number, "From" in a
  handwriting face; flips up on arrival, floats, tilts in 3D when dragged; Send shares a code (no
  website links in the app).
- **Pro**: the lamp brightens as the sheet opens; bone perk icons, plan cards (selected = bone),
  hold to go Pro. Never mentions website pricing.

### Plan, Pass, Coach, Stats, Friends, Shop, Forest, Customize
Same tokens (titles in Satoshi). Coach's lamp glow replaces the dots. Customize adds the
Lighthouse background tile and the Lamp colour.
