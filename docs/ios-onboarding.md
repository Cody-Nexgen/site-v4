# FocuzNow iOS onboarding (2026-10-04)

The owner's design: one black screen that never navigates, every piece animated, text that blurs
into focus. Replaces the title sequence (backed up in `backups/ios-onboarding-title-sequence-2026-10-04/`).
Code: `ios/App/Onboarding/FocusOnboarding.swift`, with `Design/BeamZ.swift` (the extension's Z mark),
`Design/FocusOrb.swift` (the orb), `blurReveal` in `Design/Motion.swift`, and `Color.fzMint` in
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
- **The orb** is a first version drawn in code (glass sphere, turning electric filaments, a breathing
  core). The detailed electric orb and the dashboard from the owner's mockup are next.

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
