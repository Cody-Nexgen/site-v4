# Lit by the orb: the look under the orb (iOS, 2026-10-05)

The owner, after the orb stage and the frame rate were right: "the orb and the fps now great, just
everything below is meh and everything else". Their AI's read of FocuzNow next to Opal: polished
and unique, but the large white button and the conventional cards pull it toward a standard iOS app.
So the screens get their own art direction, taken from the stage itself (not from Opal: the owner
rejected anything Opal-like).

**Canvas (mockups, private to the owner):** https://claude.ai/artifact/FTicDpTsUGPFSHEw74RSZi —
Today, Focus, a session on the orb world, Plan, and the pieces. Built in Plus Jakarta Sans and
JetBrains Mono as stand-ins; the app uses Satoshi and SF Mono.

## The rules
1. **Everything is lit by the orb.** Below the stage it's the same night. Surfaces catch the orb's
   mint light on their top edges, and the light is fainter further from the orb (`light:` on a plate).
2. **Machined, not material.** Plates are dark anodised metal: near-black, a little lighter at the
   top, a rim of light along the top edge. No grey iOS cards, no glass over the moving scene.
3. **Light lives in grooves.** State is a thin lit line cut into the metal, like the ring on the
   pedestal's top: progress, the picked option, the start button's ring, someone focusing now. Mint
   is only ever light, never paint.
4. **Engraved labels.** Small monospaced capitals, spaced out, like the markings on an instrument
   ("FOCUS SCORE", "NEXT 10 AM"). Big numbers are Satoshi Black, lit from above (white to mint-grey).
5. **The main action is the pedestal's ring.** A dark machined capsule with a lit ring cut into it,
   light pooling on the ground under it; pressed, the ring runs hot. Holding (to start a session, for
   a break) will trace the ring from the bottom both ways, like the pedestal powering on.
6. **Nothing that costs a pass per frame**: gradients and strokes only (no blur, shadow, mask or
   glass), so it all scrolls over the stage at 60 fps.

## The pieces (`ios/App/Design/LitKit.swift`)
| piece | what |
|---|---|
| `Engraved("Today")` | the instrument label (SF Mono, capitals, tracking 22% of the size) |
| `.fzPlate(light:)` | the machined plate with the rim light |
| `.fzSunk(cornerRadius:)` | something cut into the metal: a segmented track, a switch |
| `GrooveLine(vertical:)` | a cut between two parts of a plate |
| `LitGroove(progress:)` | progress as light in a groove, with a hot head |
| `FZRingButtonStyle()` | the main action |
| `.fzLiveRing()` | a lit ring round someone focusing now |
| `.fzLitFromAbove` | the big-number gradient |
| colours | `fzNightInk` (bone text), `fzHot` (hottest light), `fzPlateTop/Bottom`, `fzGrooveFloor`, `fzRim` |

## Where it is
- **Today, under the orb (done 2026-10-05, the owner still needs to build it):** the score as a
  readout with today's goal as a lit groove; **Start** as the ring button; one plate for today cut into
  four readouts (Next, To do, Locked, Screen time); friends focusing with lit rings; the day as a line
  of light with fog under it and a beam at now (`DayWave` is plain shapes now, no Swift Charts).
  Backup: `backups/ios-lit-today-2026-10-05/`.
- **Waiting for the owner's go-ahead on the canvas:** Focus (presets as a cut segmented track, the
  length as a machined dial with a lit arc, settings on one plate, hold-to-start tracing the ring),
  the session on the orb world instead of the lighthouse (the orb charging as the session runs), Plan
  (a day strip, an hour rail with a "now" line of light, to-dos with orb checks), then You, Pass,
  Stats, Friends, Forest, Shop, Customize and the popups.
