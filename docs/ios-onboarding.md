# FocuzNow iOS onboarding (2026-10-04)

The owner's design: one screen that never navigates, every piece animated, text that blurs into focus.
Then the focus orb forms on its pedestal, in a real scene, and the onboarding hands over to Today on
that same scene without a cut. Replaces the title sequence (backed up in
`backups/ios-onboarding-title-sequence-2026-10-04/`); the version before the pedestal is in
`backups/ios-orb-stage-2026-10-04/`.

Code: `ios/App/Onboarding/FocusOnboarding.swift`, with `Design/BeamZ.swift` (the extension's Z: the bare
splash drawing and the logo), `Design/OrbStage.swift` (the pedestal scene, its light, the ring, sparks,
lightning and the floating orb), `Design/FocusOrb.swift` + `FocusOrb.metal` (the orb, see
`docs/ios-focus-orb.md`), `blurReveal` in `Design/Motion.swift`, and `Color.fzMint` in `Design/Theme.swift`.
The scene photo is `App/Assets.xcassets/OrbStage.imageset` (source: `ios/Art/orb-stage.jpg`).

## The flow
1. **Splash.** Black (the iOS launch screen is black now too, so no white flash in light mode). The
   bare Beam Z, no tile and no box, draws itself as a beam of light: a bright head with a fading mint
   tail runs round the outline, then the fill sweeps in with a band of light, one soft glow, and it
   flies up into the header beside "FocuzNow". Only there, as the logo, does its dark tile fade in.
2. **Welcome.** "Welcome back" and "Sign in to keep your focus synced across devices." blur in. A mint
   glow comes up and the focus line draws left to right; its three dots pop as the line reaches them,
   each with a glass label. The sign-in buttons rise one by one: **Continue with Apple** (Apple's own
   button), **Continue with Google**, **Continue with Email**. "Don't have an account? Sign up" switches
   the copy; Terms and Privacy are under them.
3. **Signing in.** The line draws itself away and everything blurs out. Email opens an inline glass form.
4. **Hello.** "Hey, Avan" then "Welcome to FocuzNow" blur in. The name is Apple's first name, or the
   letters at the start of the email (avan.k@… → Avan); "Hey there" otherwise.
5. **The orb forms (about 6 s).** The scene fades up from black with a slow push-in: an empty pedestal
   on dark ground, fog, rocks far off. The shaft of light from above brightens onto it; dust drifts in
   it. The pedestal powers on: light runs round its ring from the front, both ways (the same move as the
   Z), and the two slits on its front light up. Sparks lift off the ring and spiral up; they catch into
   a white-hot point, lightning jumps up to it from the ring, and the orb forms around it, a ring of
   light running across the glass as it closes. It floats, bobbing a little, with lightning arcing down
   into the ring. "This is your focus orb." / "It's barely charged. Answer a few questions and it
   grows." A glass **Make it grow** button rises.
6. **Questions, in place.** The button opens into a glass panel over the ground; nothing behind it
   moves. Each question has icon rows; picking one shows that answer's own reply (`Asks.all`), and a
   strike comes down: the ring flashes, all the lightning flares, the orb charges up (more lightning
   inside, brighter, more arcs to the ring).
7. **The year.** The panel tucks away. Under the pedestal: "This year, you're on track to spend" /
   **76 days** (counts up; phone hours × 365 ÷ 24) / "on your phone." / "We can change that." Then
   **Let's change that**.
8. **Permissions, in the same panel.** Screen Time (the real prompt) → choose apps (Apple's picker) →
   notifications (the real prompt). Each one granted sends another strike.
9. **Into Today.** One last strike, the orb settles to today's charge, the words fade, and Today
   cross-fades in on the same stage (same `OrbStageLayout`, same clock), so the orb and the pedestal
   don't move while the header, the score, Start and the Today card rise around them.

Returning users get the same bare-Z splash (about 2 s) over Today instead of the old lighthouse.

## Today (the owner's dashboard mockup)
`ios/App/Screens/TodayView.swift`: the Z logo and "FocuzNow", your avatar (opens You), "Afternoon,
<name>" and a line that follows the score ("Your focus is building."), the orb on its pedestal as
charged as your focus score, **FOCUS SCORE 82 Charged** (the 0–10 score × 10; words from
`Theme.orbWord`), "1h 14m today · 6-day streak", **Start 45m focus** (or **Back to your session**), and a
Today card: the next event and to-do (open Plan), apps blocked (opens Focus), screen time today (opens
Stats). Friends focusing now and the day wave stay below it if they're on in Customize. Today is a
night scene, so it stays dark in light mode too.

## Not real yet
- **Accounts:** the buttons don't create a FocuzNow account yet (Supabase auth isn't wired into the
  iOS app). Apple's sign-in really runs and gives us the name; Google is a placeholder until the Google
  Sign-In SDK is added; email only checks the format.
- **Data:** Today shows the app's sample data (score 8.2, the sample plan) until the backend phases.
- **The photo** in the app is the chat copy (a compressed webp). Drop the original file in as
  `ios/Art/orb-stage.jpg` and copy it over `App/Assets.xcassets/OrbStage.imageset/orb-stage.jpg`; same
  framing, so nothing else changes. A different photo needs the pedestal measured again
  (`OrbStageLayout`'s pixel numbers).
- The tab bar keeps Coach where the mockup says More.

## Test on the iPhone
1. Pull, `cd ios && xcodegen`, build. Delete the app first, or Settings → Replay the intro.
2. **Splash:** no white flash, no box: a beam of light draws the Z, it fills, glows once, and flies into
   the header, where its tile fades in.
3. Sign in (Apple, or email + an 8+ character password). "Hey, <your name>".
4. **The story:** the scene comes up, the light falls on the empty pedestal, the ring lights up from the
   front round both sides and the slits come on, sparks spiral up, a white point, lightning, and the
   orb forms floating over the ring with lightning down into it. It should look like your mockup, and
   the ring glow should sit exactly in the pedestal's groove.
5. **Make it grow**, answer the four questions: each answer flashes the ring and the orb gets brighter.
6. The days number, **Let's change that**, the permissions, then Today: the orb and pedestal shouldn't
   jump at the hand-off; everything else rises around them.
7. Close and reopen the app: the bare-Z splash, then Today.
8. Try an iPhone SE simulator too: the questions panel can cover the bottom of the pedestal, but the
   orb and the ring should stay clear.
