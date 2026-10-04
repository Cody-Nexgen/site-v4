# The focus orb (iOS, 2026-10-04)

Your focus orb: a dark glass sphere holding live electricity. It's the hero of the onboarding ("This is
your focus orb. Answer a few questions and watch it grow.") and will sit on the dashboard.

Code: `ios/App/Design/FocusOrb.swift` (the SwiftUI view) and `ios/App/Design/FocusOrb.metal` (the
shader, a SwiftUI colour effect). Use it as `FocusOrb(energy:size:)`. The v1 Canvas orb is backed up in
`backups/ios-focus-orb-v1-2026-10-04/`.

## What's in it
- **Tendrils** (up to 8): lightning that leaves a white-hot core, bends and kinks as it goes, forks part
  way out, and lights a bright spot where it strikes the inside of the glass. Each one flickers, now and
  then flares (a strike), and swings nearer (brighter, thicker) or further away.
- **Veins:** thin jagged lines crackling over the shell in patches that drift and turn.
- **Plasma haze:** a slow teal smoke turning inside, which gives the sphere depth.
- **Glass:** dark body, a rim that catches the light, a crescent of light on the top left, a soft bounce
  at the bottom, and a mint glow around it.

## On the stage
`OrbStage` (`ios/App/Design/OrbStage.swift`) floats the orb over the pedestal photo, bobbing 3 pt, with
2–4 lightning arcs from its underside down into the pedestal's ring (re-struck 13 times a second, a fork
now and then, a glow where each touches the ring), the ring and slits lit, a light shaft and dust. A
strike (each answer) flashes the ring and flares all four arcs. `OrbStageLayout` places it all from the
screen width and the top safe area only, using the pedestal measured in the photo's pixels, so the
onboarding and Today put the orb in exactly the same spot.

## Energy (0–1)
| energy | looks like |
|---|---|
| 0.12 (start of onboarding) | 2–3 faint tendrils, dim core, quiet glass |
| 0.5 | 5–6 tendrils, forks and strikes, veins showing |
| 1 (end of onboarding) | all 8, bright core, glowing rim and a strong halo |

Change `energy` inside `withAnimation` and it glides there. Reduce Motion freezes it on a still frame.

## Notes
- `size` is the layout size; the sphere is about 84% of it and the glow spills past it, so the drawing is
  1.5× bigger and centred (it doesn't push anything around).
- `FocusOrb.prepare()` compiles the shader early (the onboarding calls it on appear), so the first frame
  doesn't stutter.
- Time is passed as seconds since the view appeared, wrapped every 20 minutes, because the shader uses
  32-bit floats. The pattern jumps once at the wrap; nobody stares that long.
- Cost: it runs per pixel on the GPU. If it ever stutters or warms an older phone (iPhone XS/XR are the
  oldest on iOS 18), lower the tendril count (the loop's `8`) or the haze octaves first.

## Checking it without a Mac
The part of the shader between `BEGIN SHARED` and `END SHARED` only uses code Metal and GLSL both
accept, so it can be rendered in a browser:

```
node ios/Tools/render-orb.mjs '[[0.12,3],[0.5,8],[1,14]]' 420 <out dir>
```

Each `[energy, seconds]` pair becomes a PNG. It uses the global Playwright and the pre-installed Chromium.
When editing the shared part: no `fmod`/`mod`, no `saturate`, matching argument types (`float3(t)` in
`mix`, not a bare `t`), no program-scope constants (use `#define`), and no GLSL keywords as names
(`out`, `in`, `sample`, `smooth`, `flat`).

## Test on the iPhone
1. Pull, `cd ios && xcodegen`, build. Settings → Replay the intro (or delete the app).
2. Sign in. After "Hey, <name>" the orb rises out of a blur: dark glass, a couple of faint tendrils
   flickering from the core.
3. Each answer and permission makes it pulse and charge up: more tendrils, brighter strikes. At the end
   it's fully lit, then flares and fades into Today.
4. It should run smoothly the whole time (no stutter when it first appears). If it doesn't, or the
   colours look washed out compared with the preview, say so: those are the two things the browser
   check can't show.
