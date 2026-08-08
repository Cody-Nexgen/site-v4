# AI Coach — Explore Tab Infographic Prompts

These are artist/AI-image-generator prompts for the placeholder infographic slots shown in the
AI Coach sidebar's **Explore** tab (`AiCoachPage.tsx` → `EXPLORE_CAPABILITIES`). Each card currently
renders a dashed gradient placeholder labeled with the filename below; once generated, drop the
image into `src/src/assets/ai-coach/` (create the folder if missing) and swap the placeholder
`<div>` for an `<img src="...">` pointing at that filename.

General style guidelines for all four images (keep consistent across the set):

- **Canvas / aspect ratio:** 1600×900 px (16:9), exported as PNG with transparent or `#111113` background.
- **Visual language:** Flat, modern SaaS "infographic" style — soft geometric shapes, thin 1–1.5px
  strokes, subtle drop shadows, rounded corners (12–16px radius). No photorealism, no text-heavy
  screenshots — think Linear/Notion/ChatGPT marketing illustration style.
- **Color palette:** Dark background `#111113`–`#161618`, primary accent gradient violet→fuchsia
  (`#8b5cf6` → `#d946ef`), secondary accents emerald `#34d399` (success/positive) and amber `#fbbf24`
  (attention), text/icons in off-white `#f5f5f5` and neutral gray `#9ca3af`. Avoid pure black/white.
- **Composition:** Centered focal illustration with 80–120px safe margin on all sides so it isn't
  cropped inside the 16:9 card slot; leave the bottom ~15% calmer/less busy since UI card copy sits
  directly below the image.
- **Branding:** No FocuzNow wordmark needed inside the image itself (the card title/description
  already renders below it) — keep it purely iconographic/illustrative.

---

## 1. `auto-schedule-infographic.png`

**Concept:** "Auto-schedule your day" — the coach turning a goal + task list + calendar into a
finished timeline.

**Prompt:**
> A flat, modern dark-mode SaaS infographic, 1600x900px, 16:9. Background `#111113`. Center-left
> shows a small stack of three rounded cards (a goal card with a target icon, a to-do list card
> with checkboxes, a calendar card with a grid) connected by a thin dashed violet line flowing
> toward the right. On the right side, the same three inputs merge into one clean vertical daily
> timeline made of 4–5 rounded pill-shaped time blocks of varying widths (deep work, break, meeting,
> deep work, wrap-up), each in a soft violet-to-fuchsia gradient (`#8b5cf6` to `#d946ef`) with a tiny
> white icon (brain, coffee cup, people, brain, checkmark). A subtle glowing spark/sparkle icon sits
> at the midpoint of the connecting line to suggest "AI-generated." Soft ambient glow behind the
label timeline, thin 1px `#2a2a2a` card borders, rounded 14px corners, subtle drop shadows.
> Minimal, uncluttered, professional productivity-app illustration style — no text/words in the
> image, icons only.

---

## 2. `site-blocking-infographic.png`

**Concept:** "One-tap focus lockdown" — distracting sites being blocked / a nuclear lockdown shield.

**Prompt:**
> A flat, modern dark-mode SaaS infographic, 1600x900px, 16:9. Background `#111113`. Center
> composition: a large rounded hexagonal shield shape in a violet-to-fuchsia gradient
> (`#8b5cf6` → `#d946ef`) sits in the middle, glowing softly. Around the shield, 4–5 small rounded
> browser-tab icon chips (plain colored rectangles with a tiny circular "favicon" dot, no real logos
> or text) are scattered at the edges, each with a thin red-to-transparent gradient "blocked" ring
> and a small lock icon overlay, as if being pulled toward / stopped by the shield. Faint concentric
> ripple rings emanate from the shield suggesting an active "lockdown" radius. A subtle amber
> `#fbbf24` countdown-ring accent wraps part of the shield's edge to suggest a timer. Soft ambient
> violet glow, thin 1px borders, rounded corners, subtle shadows. No text/words, icons and shapes
> only, calm bottom third of the frame.

---

## 3. `habit-pomodoro-infographic.png`

**Concept:** "Habit & Pomodoro coaching" — streaks + focus/break timer cycle.

**Prompt:**
> A flat, modern dark-mode SaaS infographic, 1600x900px, 16:9. Background `#111113`. Left half:
> a horizontal row of 7 small rounded squares representing a weekly habit streak, most filled with
> a warm emerald-to-amber gradient (`#34d399` → `#fbbf24`) and a tiny flame icon on the most recent
> one, one or two squares left as empty outlines (unchecked days). Right half: a circular pomodoro
> timer dial (thin ring, 270-degree arc filled in violet-to-fuchsia gradient) with a small tomato/
> clock hybrid icon in the center and two tiny labeled segments implied by color only — a longer
> violet arc (focus) and a shorter emerald arc (break) — connected by a soft looping arrow to show
> the repeating cycle. A thin dashed connector line links the streak row and the timer dial to show
> they work together. Soft ambient glow, thin 1px `#2a2a2a` strokes, rounded 14px corners, subtle
> shadows, minimal and uncluttered. No text/words, icons and shapes only.

---

## 4. `analytics-infographic.png`

**Concept:** "Screen-time insights" — opt-in analytics turning into a personalized suggestion.

**Prompt:**
> A flat, modern dark-mode SaaS infographic, 1600x900px, 16:9. Background `#111113`. Center-left:
> a rounded bar-chart card showing 7 vertical bars of varying height in a cool neutral gray
> (`#9ca3af`), with one bar highlighted in violet-to-fuchsia gradient (`#8b5cf6` → `#d946ef`) to draw
> the eye, plus a small shield-with-checkmark icon in the corner of the card to represent "opt-in /
> privacy approved." A thin dashed line flows from the chart card toward the right into a small
> rounded speech-bubble / lightbulb hybrid icon glowing softly in amber (`#fbbf24`), representing the
> personalized suggestion the coach generates. Add 2–3 small floating dot particles along the
> connecting line to suggest data flowing into an insight. Soft ambient glow, thin 1px `#2a2a2a`
> borders, rounded 14px corners, subtle drop shadows, minimal and calm composition. No text/words,
> icons and shapes only.

---

### Implementation notes

- All four prompts intentionally avoid embedded text so the images stay legible at the small
  ~260px sidebar card width and don't need localization.
- If regenerating with a different aspect ratio, keep 16:9 to match the `aspect-[16/9]` placeholder
  container in `AiCoachPage.tsx` (`EXPLORE_CAPABILITIES` render block) so no cropping/letterboxing
  is introduced.
- Suggested file size target: keep each PNG under ~400KB (or convert to WebP) since these load
  inside a scrollable sidebar panel that may render all four at once.
