# The focus orb (iOS, 2026-10-04)

Your focus orb: a dark glass sphere holding live electricity. It's the hero of the onboarding ("This is
your focus orb. Answer a few questions and watch it grow.") and will sit on the dashboard.

Code: `ios/App/Design/OrbShared.h` (the orb itself, `fzOrb`, shared by everything below and the
browser preview), `FocusOrb.metal` + `FocusOrb.swift` (a SwiftUI colour effect: Coach, and the stage
when Metal can't start) and `StageView.metal` (on Today and in the onboarding the orb draws in the
stage's single Metal pass). Use it as `FocusOrb(energy:size:)`. The v1 Canvas orb is backed up in
`backups/ios-focus-orb-v1-2026-10-04/`.

## Colour (2026-10-05, more on 2026-10-06)
The orb is a glass ball, and glass splits light: the more charged it is, the further its light splits
round the colour wheel (mint, aqua, blue, violet, pink, gold; `fzPrism`, `fzPrismWheel` and `fzSpread`
in the PRISM block of `OrbShared.h`, before ORB). Dim, it's mint as before. Charged (the owner's
"actually multicoloured"): the plasma is in clouds of different colours drifting round the wheel
(squared so they stay saturated where they meet), each tendril glows its own colour round a white-hot
core (golden-ratio steps round the wheel, so neighbours never match), the rim and halo are a rainbow,
the lightning down into the ring and the ring itself take the colours, the light it throws on the world
is a different colour on each side, and the green world seen through its glass greys out. The previews
include the PRISM block before ORB and WORLD.

## What's in it
- **Tendrils** (up to 8): lightning that leaves a white-hot core, bends and kinks as it goes, forks part
  way out, and lights a bright spot where it strikes the inside of the glass. Each one flickers, now and
  then flares (a strike), and swings nearer (brighter, thicker) or further away.
- **Veins:** thin jagged lines crackling over the shell in patches that drift and turn.
- **Plasma haze:** a slow teal smoke turning inside, which gives the sphere depth.
- **Glass:** a see-through body (about 40% in the middle, solid at the rim; the stage puts the world
  behind it, upside down, like a crystal ball), a rim that catches the light, a crescent of light on
  the top left, a soft bounce at the bottom, and a mint glow around it.

## On the stage
`OrbStage` (`ios/App/Design/OrbStage.swift`) floats the orb over the pedestal photo, bobbing 3 pt, with
2–4 lightning arcs from its underside down into the pedestal's ring (re-struck 13 times a second, a fork
now and then, a glow where each touches the ring), the ring and slits lit, a light shaft and dust. A
strike (each answer) flashes the ring and flares all four arcs. `OrbStageLayout` places it all from the
screen width and the top safe area only, using the pedestal measured in the photo's pixels, so the
onboarding and Today put the orb in exactly the same spot.

## The world around it
`OrbWorld.metal` (`orbWorld` on the stage photo, `rockLight` on each rock):
- **Its light on the scene:** brighter near the orb, strongest on the pedestal's top, weak on its sides
  (they face you), a contact shadow at its foot, the ring's light spreading over the metal, the orb
  mirrored in the brushed top, fog drifting on the ground that glows where the light reaches it. It
  flickers with the lightning and flashes on every strike or touch.
- **Awake (0–1):** asleep the world is darker and colourless with thicker fog; it wakes as you charge
  the orb (`OrbStageState.awake`).
- **Depth:** a depth map made from the photo's geometry (ground by height, the pedestal as near as its
  foot); the photo shifts by depth with the camera (the phone's tilt, `StageTilt`, plus a slow drift),
  so the near ground slides against the far rocks. The pedestal's lights, the orb, the rocks and the
  dust move with their own depths.
- **Rocks:** six cut from `orb-rocks.png`, rising one after another with `lift`, bobbing and swaying,
  two out of focus in front, one pebble circling the orb (behind it, then in front). Each is darkened
  to the ground's tone and gets a mint rim on the edge facing the orb.
- **Touch:** a finger on the orb bends the lightning inside to it (`FocusOrb(touch:)`); off the orb,
  lightning leaves the glass and reaches for it (`drawReach`).

## Energy (0–1)
| energy | looks like |
|---|---|
| 0.12 (start of onboarding) | 2–3 faint tendrils, dim core, quiet glass |
| 0.5 | 5–6 tendrils, forks and strikes, veins showing |
| 1 (end of onboarding) | all 8, bright core, glowing rim and a strong halo |

Change `energy` inside `withAnimation` and it glides there. Reduce Motion freezes it on a still frame.

## Notes
- **Fast maths (fixed 2026-10-05):** Metal compiles with fast maths, where `atan2(0, 0)` is NaN (GLSL
  gives 0, so the browser preview looked fine). With no finger down, the touch angle was atan2(0, 0),
  and one NaN times 0 is still NaN: the whole inside of the orb drew nothing on the iPhone (it looked
  black, with only the world-through-the-glass showing). `orbAngle` returns 0 for no vector. Anything
  new in the shared part: guard `atan2`, `normalize`, `pow` of a negative and divisions by zero.
- `size` is the layout size; the sphere is about 84% of it and the glow spills past it, so the drawing is
  1.5× bigger and centred (it doesn't push anything around).
- `FocusOrb.prepare()` compiles the shader early (the onboarding calls it on appear), so the first frame
  doesn't stutter.
- Time is passed as seconds since the view appeared, wrapped every 20 minutes, because the shader uses
  32-bit floats. The pattern jumps once at the wrap; nobody stares that long.
- It draws at most 60 times a second and holds still when `paused` (the stage passes it on).
- Cost: it runs per pixel on the GPU. If it ever stutters or warms an older phone (iPhone XS/XR are the
  oldest on iOS 18), lower the tendril count (the loop's `8`) or the haze octaves first.

## Checking it without a Mac
The whole stage (photos, world shader, rocks, lights, orb, the wide shot at any point of the camera's
move) renders in a browser: `node ios/Tools/stage-preview/shot.mjs ios/Tools/stage-preview/example-shots.json <out dir>`.
Its layout numbers are copied from `OrbStageLayout` and `FloatingRock`: change them in both places.

Just the orb:
The parts of `OrbShared.h` between `BEGIN SHARED ORB/WORLD/STAGE` and `END SHARED ORB/WORLD/STAGE` only use code
Metal and GLSL both accept, so they can be rendered in a browser:

```
node ios/Tools/render-orb.mjs '[[0.12,3],[0.5,8],[1,14]]' 420 <out dir>
```

Each `[energy, seconds]` pair becomes a PNG. It uses the global Playwright and the pre-installed Chromium.
When editing the shared part: no `fmod`/`mod`, no `saturate`, matching argument types (`float3(t)` in
`mix`, not a bare `t`), no program-scope constants (use `#define`), and no GLSL keywords as names
(`out`, `in`, `sample`, `smooth`, `flat`, and `half`, a type in Metal).

## Test on the iPhone
1. Pull, `cd ios && xcodegen`, build. Settings → Replay the intro (or delete the app).
2. Sign in. After "Hey, <name>" the orb rises out of a blur: dark glass, a couple of faint tendrils
   flickering from the core.
3. Each answer and permission makes it pulse and charge up: more tendrils, brighter strikes. At the end
   it's fully lit, then flares and fades into Today.
4. It should run smoothly the whole time (no stutter when it first appears). If it doesn't, or the
   colours look washed out compared with the preview, say so: those are the two things the browser
   check can't show.
