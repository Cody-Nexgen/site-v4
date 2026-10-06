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

## The owner's third round (2026-10-06)
"For the focus one I meant something similar to Opal" (their screenshot: a 3D timer device with a
display, quick lengths, a ruler, Start), "the orb just feels green with some purple tint, not actually
multicoloured", and "the button outlines ain't the best, everything else is good". So:
- **The timer is a device** (`TimerDevice`, `FocusTimer.metal`, DEVICE block in `OrbShared.h`): a
  chunky machined block with its bottom side showing, bevels that catch the light (moving with the
  phone's tilt), and a recessed smoked-glass display with glowing segment digits like an old
  vacuum-fluorescent clock (not Opal's LCD): each digit a different colour of the wheel, the unlit
  segments faintly there, a fine mesh over them, a reflection across the glass. The length is set on a
  **ruler** you slide sideways (`TimeRuler`), with the presets as pills above it. The session counts
  down on the same device (its colon blinks). `node ios/Tools/render-device.mjs` renders it.
- **The colour wheel** replaced the five cool colours: mint, aqua, blue, violet, pink, gold
  (`fzPrism`, `fzPrismWheel`). The charged orb's plasma is in clouds of different colours, its
  tendrils are spaced round the wheel (golden-ratio steps, so neighbours never match), and the green
  world in its glass greys out so the orb's colours lead. A dim orb is still mint.
- **Buttons have no outline**: dark glass with three pools of colour glowing up inside it from the
  bottom, a sheen on top, light on the ground under it (`FZLightButtonStyle`, `LitGlass`); holding
  fills it with a pill of the whole wheel (`LightHoldButton`).

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
6. **The main action is glass lit from inside** (no outline): dark glass, pools of the wheel's colours
   glowing up from its bottom, light on the ground under it; pressed, the light swells.
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
| `FZLightButtonStyle()`, `LightHoldButton`, `LitGlass` | the main action, its hold version, the glass itself |
| `.fzLiveRing()` | the prism round someone focusing now |
| `DimensionalNumber` | a number with depth |
| `TimerDevice(minutes:seconds:running:)`, `TimeRuler(minutes:)` | the timer device and the ruler (`FocusTimer.metal`, `fzDevice` in the DEVICE block; `node ios/Tools/render-device.mjs`) |
| `.fzLitFromAbove`, `.fzPrismLine`, `.fzPrismRing` | gradients |
| colours | the wheel: `fzWheelMint`, `fzAqua`, `fzPeri` (blue), `fzViolet`, `fzRose` (pink), `fzGold`; `fzMint` (the brand's), `fzNightInk`, `fzHot`, `fzPlateTop/Bottom`, `fzGrooveFloor` |

## Where it is
- **Today, under the orb (done 2026-10-05, the owner still needs to build it):** the score as a number
  with depth and today's goal as the prism in a groove; **Start** as the ring button; one plate for
  today cut into four readouts (Next, To do, Locked, Screen time); friends focusing with prism rings;
  the day as a line of the prism with coloured fog under it and a beam at now (`DayWave` is plain
  shapes now, no Swift Charts). Backups: `backups/ios-lit-today-2026-10-05/`, then
  `backups/ios-prism-2026-10-05/` (before the prism, the plain labels and the 3D timer).
- **Focus (done 2026-10-06, the owner still needs to build it):** the timer device, preset pills, the
  ruler, one plate (locked apps, how strict as a cut track with a lit glass piece, breaks, the
  background) and the lit hold-to-start, on the night. Backup: `backups/ios-device-2026-10-06/`.
- **Already in the app too:** the multicoloured orb (Today, the onboarding, Coach), the session counting
  down on the timer device with a lit hold-for-a-break, and no grey capitals in You, the tickets or the
  session screen.
- **Next (the owner said everything else on the canvas is good):** the session on the orb world instead of the lighthouse (the orb charging as the session runs), Plan
  (a day strip, an hour rail with a "now" line of light, to-dos with orb checks), then You, Pass,
  Stats, Friends, Forest, Shop, Customize and the popups.
