# Lit by the orb: the look under the orb (iOS, 2026-10-05)

The owner, after the orb stage and the frame rate were right: "the orb and the fps now great, just
everything below is meh and everything else". Their AI's read of FocuzNow next to Opal: polished
and unique, but the large white button and the conventional cards pull it toward a standard iOS app.
So the screens get their own art direction, taken from the stage itself (not from Opal: the owner
rejected anything Opal-like).

**Canvas (mockups, private to the owner):** https://claude.ai/artifact/FTicDpTsUGPFSHEw74RSZi —
Today, Focus (with the real dial render), a session on the orb world, Plan, and the pieces. Built in
Plus Jakarta Sans as a stand-in; the app uses Satoshi.

## The owner's second round (2026-10-05)
"Not colorful enough, ours is just straight green": the light is now **split into a prism** (the orb
is a glass ball, and glass splits light). "Why do AI models love gray mono text": **no monospaced or
grey spaced-out capital labels anywhere**. "The focus timer kinda 3D": **a 3D glass-ring dial** and
**numbers with depth**.

## The rules
1. **Everything is lit by the orb, through its glass.** Its light splits into the prism: mint, aqua,
   periwinkle, violet, rose (`fzPrism` in `OrbShared.h`, `Color.fzPrism` in Swift). The orb itself
   splits further the more charged it is (`fzSpread`: mint while dim, the whole prism charged): the
   plasma, the lightning's glow, the rim and the halo take the colours, the lightning down into the
   ring takes one each, the pedestal's ring takes them round it, and the ground is lit a different
   colour on each side of the orb.
2. **Machined, not material.** Plates are dark metal, the prism along their top edge (aqua light on
   the left, violet on the right). No grey iOS cards, no glass over the moving scene.
3. **Light lives in grooves.** Progress, the picked option, the start button's ring, someone focusing:
   lines of the prism cut into the metal. The colours are light, not paint.
4. **Labels are Satoshi, sentence case.** `LitCaption` (13 pt bold) coloured by what it is (Next aqua,
   To do rose, Locked violet, Screen time periwinkle, focusing mint), bone otherwise; `LitHeading`
   (20 pt) for sections; `SectionLabel` app-wide is the same now. Never grey monospaced capitals (the
   one exception: passwords in Pass, which need monospaced characters).
5. **Depth.** Big numbers (`DimensionalNumber`: the score, the timer, the session clock) have a face
   lit from above and an edge going down into the dark, catching violet at its foot. The focus timer is
   a real 3D object (`FocusDial`): a glass tube bent into a ring on a machined plate, tilted back like
   the pedestal, filling with crackling light through the prism as you drag; the minute marks it has
   passed light up, its light falls on the metal, and tilting the phone moves the light on the glass.
6. **The main action is the pedestal's ring**: a dark capsule with a ring of the prism cut into it,
   aqua and violet light pooling under it; pressed, it runs hot.
7. **Nothing that costs a pass per frame** over the stage: gradients and strokes only. The dial is one
   small shader, drawn only while Focus is on screen.

## The pieces (`ios/App/Design/LitKit.swift`, `FocusDial.swift`)
| piece | what |
|---|---|
| `LitCaption`, `LitHeading` | labels and section titles (Satoshi) |
| `.fzPlate(light:)` | the machined plate with the prism along its top edge |
| `.fzSunk(cornerRadius:)` | something cut into the metal: a segmented track, a switch |
| `GrooveLine(vertical:)` | a cut between two parts of a plate |
| `LitGroove(progress:)` | progress as the prism in a groove, with a hot head |
| `FZRingButtonStyle()` | the main action |
| `.fzLiveRing()` | the prism round someone focusing now |
| `DimensionalNumber` | a number with depth |
| `FocusDial(minutes:)` | the 3D timer (`FocusDial.metal`, `fzDial` in OrbShared.h's DIAL block); `node ios/Tools/render-dial.mjs` renders it in a browser |
| `.fzLitFromAbove`, `.fzPrismLine`, `.fzPrismRing` | gradients |
| colours | `fzMint`, `fzAqua`, `fzPeri`, `fzViolet`, `fzRose`; `fzNightInk`, `fzHot`, `fzPlateTop/Bottom`, `fzGrooveFloor` |

## Where it is
- **Today, under the orb (done 2026-10-05, the owner still needs to build it):** the score as a number
  with depth and today's goal as the prism in a groove; **Start** as the ring button; one plate for
  today cut into four readouts (Next, To do, Locked, Screen time); friends focusing with prism rings;
  the day as a line of the prism with coloured fog under it and a beam at now (`DayWave` is plain
  shapes now, no Swift Charts). Backups: `backups/ios-lit-today-2026-10-05/`, then
  `backups/ios-prism-2026-10-05/` (before the prism, the plain labels and the 3D timer).
- **Already in the app too:** the orb's prism (Today, the onboarding, Coach), the 3D dial on Focus
  (the rest of Focus is still the old look), the session clock with depth, and no grey capitals in
  You, the tickets or the session screen.
- **Waiting for the owner's go-ahead on the canvas:** the rest of Focus around the dial (presets as a
  cut segmented track, settings on one plate, hold-to-start tracing the ring),
  the session on the orb world instead of the lighthouse (the orb charging as the session runs), Plan
  (a day strip, an hour rail with a "now" line of light, to-dos with orb checks), then You, Pass,
  Stats, Friends, Forest, Shop, Customize and the popups.
