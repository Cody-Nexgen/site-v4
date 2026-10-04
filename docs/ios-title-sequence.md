# FocuzNow iOS onboarding: the title sequence (2026-10-04)

Replaces the Island onboarding (backed up in `backups/ios-onboarding-island-2026-10-04/`). The idea
came from a fresh chat (brief: `docs/ios-onboarding-brief.md`); the owner picked it.

## The idea
The onboarding is a film's opening titles. It opens on **AGAIN**, with little words ("scroll",
"watch", "check", "refresh", "swipe", "open") looping through it: the things that keep getting
another turn. It ends on **TEN MINUTES. YOUR CALL.** In between, your name becomes the opening
credit, every answer becomes a title with its own reply, and a small cut-paper figure moves through
the credits. You tap through it like a story.

## Look
- **Type** (all built into iOS, no files to add): Futura Condensed ExtraBold for the titles, Bodoni 72
  Book Italic for the narrator's lines, Bodoni 72 Smallcaps for "FocuzNow presents", SF for buttons and
  small text so it stays easy to read.
- **Paper:** ivory with fine grain and a soft vignette in Light Mode; deep ink with ivory type in Dark
  Mode. The "When does it usually happen?" answer re-lights the paper: brisk morning, warm afternoon,
  dusky evening, deep-blue night. It goes back to plain for the setup.
- **The figure:** a Saul Bass style cutout drawn in code (stand, walk, sit). A generated cutout can
  replace it later with the same poses.
- **Answers:** printed-ticket capsules with an icon each. **Buttons:** ink pills.

## Beats
| Beat | What happens | You |
|---|---|---|
| Opening | AGAIN fills the frame; small words cross it on lanes and turn paper-coloured where they cross the letters. "Some things keep getting another turn." | Tap |
| Name | AG and AIN part; the name field sits in the gap. "Your turn. What's your name?" | Type, arrow |
| Credit | AGAIN flies off; your name is the opening credit under "FocuzNow presents". The figure steps out from behind its first letter. "A little more say in what happens next." | Tap |
| Phone time | Your name moves up to a header. The answer becomes a supporting credit ("with 4 TO 6 HOURS") and its reply. | Pick, tap |
| Distraction | "What keeps stealing the scene?" The answers come in from every side. The pick takes the screen, then your name moves in beside it at the same size. | Pick, tap |
| Hardest time | The paper re-lights for that time of day; the figure walks over to the word. | Pick, tap |
| What matters | The goal is the largest title, with your name above it: AVAN / MAKING THINGS. | Pick, tap |
| Screen Time | Titles move to the margin (your name runs up the left edge). "Let's make a little space around that." | Enable app blocking (real prompt) or Not now |
| Apps | "Choose what can wait." EVERYTHING / ELSE close like a curtain behind Apple's picker; CAN WAIT. lands after. | Choose apps (real picker), tap |
| Notifications | SESSION COMPLETE. "Want a reminder when you're done?" | Turn on (real prompt) or Not now |
| Account | "Your setup, saved." | Apple, Google, email, or Not now |
| Ending | TEN MINUTES. YOUR CALL. The figure sits on the rule under it. | Start 10 minutes, Block (your hardest time) daily, or Explore first |

"Start 10 minutes" starts a real session (locks the picked apps, starts the Live Activity) and opens
Today with it running. "Have an account? Sign in" on the name beat goes to Account, then Screen Time,
apps and notifications, then the ending.

## Files
- `ios/App/Onboarding/TitleSequenceOnboarding.swift`: the flow.
- `ios/App/Design/Reel.swift`: fonts, paper, palette and light, the figure, the looping words, chips
  and buttons.
- `ios/App/Onboarding/OnboardingFlow.swift`: the router, `Asks` (questions and every reply),
  `AccountButtons` (now follows Light/Dark), `GoalDial`.

## Test on the iPhone
1. Pull, `cd ios && xcodegen`, build. Delete the app first (or Settings → Replay the intro).
2. Opening: AGAIN is big and sharp; the little words move smoothly and flip colour where they cross
   the letters. Tap anywhere.
3. The letters part, the keyboard comes up, and the field is in the gap. Type a name, tap the arrow.
4. Your name is the title, the figure walks out from behind its first letter. Tap.
5. Each question: pick an answer, see its own reply, tap. On "What keeps stealing the scene?" the
   answers slide in from all sides and your name joins the word. On the time question the paper
   changes colour.
6. Screen Time and apps: the real popup, then the curtain closes, Apple's picker opens, and CAN WAIT.
   lands after Done.
7. Notifications, account, then TEN MINUTES. YOUR CALL. with the figure sitting under it. Start 10
   minutes: Today opens with the session running; swipe home to see the Live Activity.
8. Do it once in Dark Mode, and once on an iPhone SE simulator to check nothing overlaps.
