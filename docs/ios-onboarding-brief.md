# Brief: FocuzNow iOS onboarding, fresh take

Paste this into a new chat. Read `AGENTS.md` first for the project rules.

## What FocuzNow is
A focus app: app blocking (Screen Time), focus sessions, plans/to-dos, a password manager
(FocuzPass), an AI coach. Native SwiftUI iPhone/iPad app in `ios/` (iOS 18+, Liquid Glass on 26).
The owner builds it on their Mac and tests on an iPhone. The cloud box can't compile SwiftUI, so
Xcode errors come back from the owner.

## Brand
The website, focuznow.com, is pure black and white and modern: black background, bone `#ECE8DF`
cards, white buttons with black text, Satoshi headlines, a lighthouse hero with the line
"Everything else can wait." The app should feel like the same product. Code: `website/components/landing/`.

## The problem
The onboarding has to *flow*: it shouldn't feel like a traditional onboarding (screen → question →
Continue → next screen). The owner wants Opal-level craft (every element animated, momentum, it
feels alive) **without looking or working like Opal**, and with an idea that's actually good.

## History (what was tried and how the owner reacted)
- v1: colourful gradients, a "beam" mark. Too pink and colourful, looked AI-made.
- v2 "Into focus" (`backups/ios-app-v2-2026-10-03/`): a blurry intro you tap into focus, then a
  **chat-like conversation** where lines appear and older ones blur away, then a payoff screen. The
  owner felt it **flowed well**. Problems: too close to Opal (the payoff "X days back", "have we met
  before?", the session layout); the bokeh dots forming a Z were weird; intro text too blurry to
  read; animations choppy (TimelineView capped at 20 fps); every answer got the same reply.
- Mockup directions "Instrument" (Braun device), "Paper" (journal), "Arcade" (game): off-brand.
- Dithered/ASCII pixel lighthouse: looks weird on a phone.
- v3 "Lighthouse" (current code, `docs/ios-design-spec.md`): a lighthouse rendered in Metal, one
  question per screen with a bone reply card and Continue, hold-to-commit. The owner said the
  lighthouse doesn't look real ("tinkercad") and the **onboarding feels traditional, doesn't flow**.

## Must-haves
- A different, specific reply for every answer (the v3 copy in `Asks.all` in
  `ios/App/Onboarding/OnboardingFlow.swift` can be reused).
- Text that's always readable, smooth motion (60/120 fps), both light and dark where it applies.
- It covers: name, a few questions, account (Apple/Google/email), Screen Time permission, picking
  apps (FamilyActivityPicker), notifications.
- No website pricing or purchase links in the app.

## Ask
Before writing code: explain *why* v2 flowed and v3 doesn't. Then propose 2–3 genuinely
different onboarding concepts with a short storyboard each (what moves, what carries you from
one step to the next), recommend one, and wait for the owner to pick.
