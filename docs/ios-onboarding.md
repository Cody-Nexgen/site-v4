# FocuzNow iOS onboarding (2026-10-04)

The owner's design: one black screen that never navigates, every piece animated, text that blurs
into focus. Replaces the title sequence (backed up in `backups/ios-onboarding-title-sequence-2026-10-04/`).
Code: `ios/App/Onboarding/FocusOnboarding.swift`, with `Design/BeamZ.swift` (the extension's Z mark),
`Design/FocusOrb.swift` + `FocusOrb.metal` (the orb, see `docs/ios-focus-orb.md`), `blurReveal` in `Design/Motion.swift`, and `Color.fzMint` in
`Design/Theme.swift`.

## The flow
1. **Welcome.** Black. The Beam Z (the extension's exact path) traces its outline in mint, fills
   white, then flies up into the header beside "FocuzNow". "Welcome back" and "Sign in to keep your
   focus synced across devices." blur in. A mint glow comes up and the focus line draws left to right;
   its three dots pop as the line reaches them, each with a glass label (Today 4h 18m · Focus goal 5h ·
   Deep work, an illustration). The sign-in buttons rise one by one: **Continue with Apple** (Apple's
   own button, white), **Continue with Google**, **Continue with Email** (dark glass). "Don't have an
   account? Sign up" switches the copy; the Terms and Privacy links are under them.
2. **Signing in.** The line draws itself away (left to right), the dots pop out and everything blurs
   away. Email opens an inline glass form (email, password) under the title, above the keyboard.
3. **Hello.** "Hey, Avan" then "Welcome to FocuzNow" blur in. The name is Apple's first name, or the
   letters at the start of the email (avan.k@… → Avan); "Hey there" otherwise (Google, Apple's private
   relay emails).
4. **The orb.** Your focus orb rises out of a blur. "This is your focus orb." "Answer a few questions
   and watch it grow." A glass **Make it grow** button rises at the bottom.
5. **Questions, in place.** The button opens into a glass panel; the orb moves up and gets smaller.
   Each question (phone time, what pulls you away, hardest time, what for) has icon rows; picking one
   shows that answer's own reply (`Asks.all`) in the panel, the orb pulses and grows brighter, and
   **Next question** moves on.
6. **The year.** The panel tucks away. "This year, you're on track to spend" / **76 days** (counts up;
   phone hours × 365 ÷ 24) / "on your phone." / "We can change that." Then **Let's change that**.
7. **Permissions, in the same panel.** Screen Time (the real prompt) → choose apps (Apple's picker; the
   card then says "6 apps will wait") → notifications (the real prompt). Each one granted grows the orb.
8. **Into the app.** The orb flares, grows into the screen and fades, and Today appears.

## Not real yet
- **Accounts:** the buttons don't create a FocuzNow account yet (Supabase auth isn't wired into the
  iOS app). Apple's sign-in really runs and gives us the name; Google is a placeholder until the
  Google Sign-In SDK is added (then its official button and logo replace the stand-in "G"); email
  only checks the format.
- **The dashboard** from the owner's mockup is next; the onboarding still ends on the current Today.

## Test on the iPhone
1. Pull, `cd ios && xcodegen`, build. Delete the app first, or Settings → Replay the intro.
2. The Z draws, fills, and flies into the header without a jump. The line draws smoothly and each dot
   pops as the line reaches it. The buttons rise one by one.
3. Tap **Continue with Apple** and finish Apple's sheet (or **Continue with Email**: type an email and an
   8+ character password). The line draws away and the screen clears, then "Hey, <your name>".
4. The orb rises; tap **Make it grow**. The panel opens where the button was; answer the four questions.
   Every answer has its own reply and the orb pulses and gets brighter.
5. The days number counts up. **Let's change that**, then allow Screen Time, choose apps, allow
   notifications. The orb flares and Today opens.
6. Try it on an iPhone SE simulator too: nothing should overlap.

## Planned next (2026-10-04, waiting on the owner's images and one answer)
The owner's feedback: the intro Z shouldn't sit in a tile ("it's a splash, not an icon"), and the orb
should form on the pedestal from the dashboard mockup, as a story, in that scene, before the questions.
Images: `orb-stage` (+ optional `orb-stage-lit`), `docs/ios-image-prompts.md` §9.

1. **Splash:** the bare Z on black, no tile and no outline box. It draws as a beam of light (bright head,
   fading mint tail), the fill sweeps in, a soft bloom, then it glides up; the small tile only fades in
   as it lands in the header, where it acts as the logo. The same intro replaces the old lighthouse
   splash for returning users, and the iOS launch screen becomes black (it's the system default now,
   which is white in light mode).
2. **The orb story**, after "Hey, <name> / Welcome to FocuzNow":
   - The scene fades up from black with a slow push-in; the shaft of light from above brightens onto the
     empty pedestal; dust drifts.
   - The pedestal powers on: light traces around its ring (the same move as the Z), the front slits
     blink on.
   - Sparks lift off the ring, spiral up and gather above it; they ignite into a white-hot point, and
     thin arcs jump from the ring up to it.
   - The glass sphere grows out of the point and closes with a ripple of light; the energy inside starts,
     faint; the arcs settle into the small ones at its base.
   - "This is your focus orb." / "It's barely charged. Answer a few questions and it grows." /
     **Make it grow**.
3. **Questions, year, permissions** stay as they are, over the scene: the glass panel opens over the
   ground and nothing moves. Each answer sends a pulse up the arcs into the orb; the orb, the ring and
   the beam get brighter.
4. **Into Today without a cut:** the orb and the pedestal stay put while the dashboard builds around
   them ("Afternoon, <name>", the focus score counting up, Start, the Today card, the tab bar).

Open question for the owner: the orb's look. The mockup's orb is clear glass with swirling ribbons and
star dust inside; the current shader is dark glass with radial lightning. Recommended: match the
mockup, and keep the lightning as the strike when you answer.
