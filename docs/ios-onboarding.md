# FocuzNow iOS onboarding (2026-10-04)

The owner's design: one screen that never navigates, every piece animated, text that blurs into focus.
Then the focus orb forms on its pedestal, in a real scene, and the onboarding hands over to Today on
that same scene without a cut. Replaces the title sequence (backed up in
`backups/ios-onboarding-title-sequence-2026-10-04/`); the version before the pedestal is in
`backups/ios-orb-stage-2026-10-04/`.

Code: `ios/App/Onboarding/FocusOnboarding.swift`, with `Design/BeamZ.swift` (the extension's Z: the bare
splash drawing and the logo), `Design/OrbStage.swift` + `OrbStageParts.swift` + `OrbWorld.metal` (the
orb's world: the photos, its light on them, fog, parallax, floating rocks, the camera flying in, the
scattered lights, lightning), `Design/FocusOrb.swift` + `FocusOrb.metal` (the orb, see
`docs/ios-focus-orb.md`), `blurReveal` in `Design/Motion.swift`, and `Color.fzMint` in `Design/Theme.swift`.
The images are in `App/Assets.xcassets` (sources in `ios/Art/`: `orb-stage.jpg`, `orb-stage-wide.jpg`,
`orb-rocks.png`, cut into `OrbRock0`–`OrbRock5`).

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
5. **The story (about 13 s).** The greeting fades and a wide shot comes up out of the dark: a vast,
   cold, colourless landscape, the pedestal tiny in the distance, the camera drifting in very slowly.
   Little lights flicker all across the ground. **"Your focus is everywhere."** **"Scattered across a
   hundred things."** **"Let's bring it back."**: the lights rise and stream to the pedestal, trailing
   light, and the camera flies in after them, low over the ground: everything grows by its own
   distance (`wideFly`), so the near ground rushes past with motion blur while the far rocks barely
   move, until the pedestal fills the screen and the close photo takes over from it. The lights catch into a
   white-hot point, the pedestal's ring powers on round both sides, lightning jumps up and the orb
   forms around the light, floating, with lightning down into the ring. Its light falls on the
   brushed metal (the orb shows in it) and the ground; fog drifts and glows; the whole scene moves in
   depth with the phone's tilt. The orb's glass is see-through: the world shows in it upside down,
   like a crystal ball. The sky carries on above the photo, so the top of the screen is never just
   black. (The pedestal's front slits stay dark: lit, they looked like a pause button.) **"This is your focus orb." / "Touch it."** (a ring keeps pulsing off
   it). Touch it and, like a plasma globe, the lightning inside bends to your finger, the world
   flashes and the phone crackles; drag off it and lightning reaches out after your finger. Then
   "It's barely charged. Answer a few questions and it grows." and **Make it grow** (they come anyway
   after a few seconds if you don't touch it).
6. **Questions, in place.** The button opens into a glass panel over the ground; nothing behind it
   moves. Each question has icon rows; picking one shows that answer's own reply (`Asks.all`), and a
   strike comes down: the ring flashes, the lightning flares, the orb charges up, and the world wakes
   a little more: its light reaches further, the fog thins, and another rock lifts off the ground and
   floats near the orb (a pebble starts circling it near the end).
7. **The year.** The panel tucks away. Under the pedestal: "This year, you're on track to spend" /
   **76 days** (counts up; phone hours × 365 ÷ 24) / "on your phone." While it counts, the world goes
   cold: the orb dims, the light shrinks, the rocks sink. **"We can change that."**: it all surges
   back, brighter. Then **Let's change that**.
8. **Permissions, in the same panel.** Screen Time (the real prompt) → choose apps (Apple's picker) →
   notifications (the real prompt). Each one granted sends another strike.
9. **Into Today.** One last strike, the orb settles to today's charge, the words fade, and Today
   cross-fades in on the same stage (same `OrbStageLayout`, same clock), so the orb and the pedestal
   don't move while the header, the score, Start and the Today card rise around them.

Returning users get the same bare-Z splash (about 2 s) over Today instead of the old lighthouse.

## Today (the owner's dashboard mockup)
`ios/App/Screens/TodayView.swift`: the Z logo and "FocuzNow", Coach (the sparkles; a sheet on iPhone),
your photo (opens the You tab), "Afternoon, <name>" and a line that follows the score ("Your focus is
building."), the orb on its pedestal as charged as your focus score, then a glass card on the ground:
**FOCUS SCORE 82 Charged** (the 0–10 score × 10; words from `Theme.orbWord`), streak and time today on
the right, and a mint bar to today's goal ("45m to today's goal" / "Goal done. The orb is showing
off."). Then **Start 45m focus** (or **Back to your session**) and a Today card: the next event and
to-do (open Plan), apps blocked (opens Focus), screen time today (opens Stats). Friends focusing now
and the day wave stay below it if they're on in Customize. Its world follows the score: a low score is
a cold, foggy, still world, a high one is lit with rocks floating round the orb. Touch the orb there
too. Scroll up and the scene drifts away at half speed (its camera tilts a little, so near things move
more than far ones) while the cards slide over it; pull down and the page comes down together while
the camera drops and the sky opens up above the photo (`SkyAbove` + `NightSky`: stars, no black, no
zoom). Today is a night scene, so it stays dark in light mode too.

All buttons have a glow under them (`FZKit.swift`, `.fzBottomGlow`, colour `Color.fzGlow`: mint, the
orb's light; one line to change it). Popups are `FZPopup`s: Liquid Glass over a coloured glow, an icon,
a title, a line or two and a button (`PopupCenter.show`).

## The block screen
When a blocked app opens, the shield (`Extensions/FocusShield`) is as plain as Apple allows (a
background, an icon, a title, a subtitle and buttons; no fonts or layout, and it's always portrait like
the app behind it): pure black, the bare Beam Z in bone, a line that changes every minute ("Not now,
YouTube.", "YouTube can wait.", "Nice try."), when it opens again while a session runs ("It's back at
3:45 PM. Future you says thanks.": the app saves the session's end in the App Group,
`BlockList.sessionEndKey`), and one bone **Back to focus** button. No "5 more minutes" button: the
way out is the emergency pass in the You tab (`docs/ios-account.md`).

## Not real yet
- **Accounts:** the buttons don't create a FocuzNow account yet (Supabase auth isn't wired into the
  iOS app). Apple's sign-in really runs and gives us the name; Google is a placeholder until the Google
  Sign-In SDK is added; email only checks the format.
- **Data:** Today shows the app's sample data (score 8.2, the sample plan) until the backend phases.
- **The photos** in the app are the chat copies (compressed). Copying originals over the files in
  `App/Assets.xcassets` changes nothing else as long as the framing is the same. A different photo
  needs the pedestal measured again (`OrbStageLayout`'s pixel numbers, and the wide shot's).
- The iPhone tab bar is Today, Focus, Plan, Pass, You. Coach opens from the sparkles on Today and from
  You (on iPad it keeps its tab).

## Test on the iPhone
1. Pull, `cd ios && xcodegen`, build. Delete the app first, or You → Developer mode → Replay the intro.
2. **Splash:** no white flash, no box: a beam of light draws the Z, it fills, glows once, and flies into
   the header, where its tile fades in.
3. Sign in (Apple, or email + an 8+ character password). "Hey, <your name>".
4. **The story:** the wide shot, the scattered lights, the three lines, the lights streaming in and
   the camera flying after them (no jump when the wide shot turns into the close one), the ring
   powering on, the orb forming. Tilt the phone: the ground should slide against the far rocks.
   Touch the orb: the lightning should bend to your finger and the phone should crackle.
5. **Make it grow**, answer the four questions: each answer flashes the ring and the orb gets brighter.
6. The days number, **Let's change that**, the permissions, then Today: the orb and pedestal shouldn't
   jump at the hand-off; everything else rises around them.
7. Close and reopen the app: the bare-Z splash, then Today.
8. Try an iPhone SE simulator too: the questions panel can cover the bottom of the pedestal, but the
   orb and the ring should stay clear.
