# FocuzNow iOS: images to generate

For the owner to generate (any image model). **Onboarding needs none of these**, so they don't block
anything. Priority order: **1 Coast → 2 Sessions → 3 Presets → 4 Forest → 5 Shop → 6 Video (optional).**

## How to hand them over
- Put each file in `ios/Art/` with **the exact file name** below (PNG or JPG is fine), then push it
  or drop it in the chat. I'll grade, crop and add them to the app.
- Generate at the **highest resolution** your tool allows, in the **aspect ratio** listed.
- **Keep one chat/session per set** (all coast photos together, all forest pieces together) so the
  style stays consistent. If your tool has a seed or a "style reference", reuse the first good image
  as the reference for the rest of its set.
- If a result has any **text, logo, watermark, person, warped object or weird hands/birds**, reroll
  it. Those are what make images look AI-made.
- Forest pieces: a **transparent background** is best. If your tool can't do that, use a plain
  pure-white background and I'll cut them out.

---

## 1. Coast, by time of day (Today header, profile, About) ✅ done 2026-10-04
In `ios/Art/` (1536 × 1024 JPG). Sharp enough for iPhone; a 2048 px wide version would be crisper on
iPad later.
Shown as a wide card at the top of Today (and a thin strip on iPad), so **keep the lighthouse in the
middle band, with the horizon a little below centre**, and leave calm sky in the top left (the
greeting sits there).
Aspect: **3:2 landscape**.

**`coast-dawn`**
```
Photorealistic photograph of a lone white lighthouse on a dark rocky headland at dawn, the first pale light just above the horizon, calm grey-blue sea, thin mist lying on the water, lighthouse small in the middle of the frame with a lot of quiet sky above, shot on a full-frame camera with a 35mm lens, natural light only, subtle film grain, muted cool colours, deep clean blacks, calm and minimal. No people, no boats, no birds, no text, no logos, no watermark, no HDR look, no lens flare, no oversaturated colours.
```

**`coast-day`**
```
Photorealistic photograph of a lone white lighthouse on a rocky headland under a soft overcast sky in the middle of the day, pale silver light, gentle grey-green sea, lighthouse small in the middle of the frame with a lot of quiet sky above, shot on a full-frame camera with a 35mm lens, natural light only, subtle film grain, muted cool colours, calm and minimal. No people, no boats, no birds, no text, no logos, no watermark, no HDR look, no lens flare, no oversaturated colours.
```

**`coast-dusk`**
```
Photorealistic photograph of a lone white lighthouse on a rocky headland during blue hour just after sunset, a faint warm glow low on the horizon fading into deep blue, the lighthouse lamp just switched on, calm dark sea, lighthouse small in the middle of the frame with a lot of quiet sky above, shot on a full-frame camera with a 35mm lens, natural light only, subtle film grain, muted colours, deep clean blacks, calm and minimal. No people, no boats, no birds, no text, no logos, no watermark, no HDR look, no lens flare, no oversaturated colours.
```

**`coast-night`**
```
Photorealistic photograph of a lone lighthouse on a rocky headland at night, its beam faintly visible sweeping through light sea fog, moonlight on a calm black sea, a few faint stars, lighthouse small in the middle of the frame with a lot of dark sky above, shot on a full-frame camera with a 35mm lens, long exposure, natural light only, subtle film grain, muted cool colours, deep clean blacks, calm and minimal. No people, no boats, no birds, no text, no logos, no watermark, no HDR look, no oversaturated colours.
```

---

## 2. Session backdrops (full screen behind the timer)
The big clock sits in the **middle**, so the middle must be **dark and calm**. Nothing important at
the top or edges (the sides get cropped on tall phones).
Aspect: **9:16 portrait**.

**`session-night-sea`**
```
Photorealistic vertical photograph looking out over a dark night sea from a high cliff, a narrow silver path of moonlight on the water, thin clouds over the moon, the whole frame very dark and calm with the brightest area in the lower third, shot on a full-frame camera, long exposure, subtle film grain, muted cool colours, deep clean blacks, minimal. No people, no boats, no birds, no text, no logos, no watermark, no HDR look.
```

**`session-rain`**
```
Photorealistic vertical close-up photograph of raindrops on a window at night, behind the glass far-away city lights blurred into soft deep blue and amber circles, the frame mostly dark, calm and moody, shallow depth of field, subtle film grain, muted colours, deep clean blacks. No people, no text, no logos, no watermark, no oversaturated colours.
```

**`session-fog`**
```
Photorealistic vertical photograph of dense morning fog drifting through a tall pine forest, soft grey light, trees fading into the mist, very calm and minimal, almost monochrome, subtle film grain. No people, no animals, no path, no text, no logos, no watermark, no HDR look.
```

**`session-lake`**
```
Photorealistic vertical photograph of a perfectly still mountain lake at blue hour, dark mountain silhouettes and their mirror reflection, a faint glow above the ridge line, the frame mostly deep blue and black, calm and minimal, shot on a full-frame camera, subtle film grain, muted cool colours. No people, no boats, no birds, no text, no logos, no watermark, no HDR look.
```

**`session-library`**
```
Photorealistic vertical photograph of an empty old library reading room at night, rows of dark wooden tables with glowing green banker's lamps fading into the distance, tall bookshelves in shadow, warm pools of light in a mostly dark room, calm and quiet, shot on a full-frame camera with a 35mm lens, subtle film grain, muted colours. No people, no readable text on books or signs, no logos, no watermark.
```

**`session-desk`**
```
Photorealistic vertical photograph of a simple wooden desk beside a dark window at night, one warm desk lamp lighting an open blank notebook and a pencil, the rest of the room in deep shadow, calm, minimal and cosy, shot on a full-frame camera with a 50mm lens, subtle film grain, muted warm colours, deep clean blacks. No people, no screens, no writing on the notebook, no text, no logos, no watermark.
```

---

## 3. Focus preset covers (cards in the Focus carousel)
Aspect: **4:5 portrait**. Subject in the centre; the preset name sits on the bottom.

**`preset-deep-work`**
```
Photorealistic photograph of a closed silver laptop and a cup of black coffee on a clean dark wooden desk at night, lit by one soft lamp from the side, the rest of the frame in deep shadow, calm and minimal, shot on a full-frame camera with a 50mm lens, subtle film grain, muted colours. No people, no visible screen, no text, no logos, no brand marks, no watermark.
```

**`preset-school`**
```
Photorealistic photograph of a neat stack of plain textbooks with blank covers, an open notebook and a pencil on a library table, soft daylight from a tall window, calm and focused, shot on a full-frame camera with a 35mm lens, subtle film grain, muted warm colours. No people, no readable text, no logos, no watermark.
```

**`preset-reading`**
```
Photorealistic close-up photograph of an open paperback book lying on a soft wool blanket beside a window, gentle morning light falling across the pages, cosy and calm, shallow depth of field so the pages are soft, subtle film grain, muted warm colours. No people, no readable text on the pages, no logos, no watermark.
```

**`preset-sprint`**
```
Photorealistic low-angle photograph of an empty running track at dawn, white lane lines leading toward a soft glowing horizon, calm and fresh, shot on a full-frame camera with a 24mm lens, subtle film grain, muted cool colours with a hint of warm light. No people, no numbers on the lanes, no text, no logos, no watermark.
```

---

## 4. The forest (cartoony, fixed scene, tappable trees)
The forest is a **framed storybook scene you don't pan or rotate**. It starts **full** (bushes,
flowers, rocks, critters), and every finished session plants a tree in a free spot, so it gets
lusher over time. Tap a tree and it bounces and shows which session grew it. Tap a critter and it
does a little move.
To avoid looking like the "Forest" app: **flat 2D storybook side view**, no isometric grass tile,
no low-poly 3D.

**Style anchor** (already included in every prompt below):
*flat 2D storybook cartoon illustration, soft rounded shapes, subtle darker outlines, gentle cel
shading with one light source from the upper left, a limited palette of fresh greens, creams, soft
browns and muted sky blues, clean vector-like edges, no texture noise.*

### 4a. Backgrounds (the scene without trees)
Aspect: **9:16 portrait**. The bottom 60% is a gently rising meadow with **open grass** where trees
will be placed; the top is sky and far hills.

**`forest-bg-day`**
```
Flat 2D storybook cartoon illustration of an empty peaceful meadow valley seen from the front, soft rolling green hills in the distance, a clear pale blue sky with two or three rounded clouds, the bottom sixty percent of the image is open gently rising grass with a small winding stream on one side and nothing else on it, soft rounded shapes, subtle darker outlines, gentle cel shading with light from the upper left, limited palette of fresh greens, creams, soft browns and muted sky blues, clean vector-like edges, no texture noise. No trees in the meadow, no people, no animals, no buildings, no text, no logos, no watermark.
```

**`forest-bg-night`**
```
Flat 2D storybook cartoon illustration of the same empty peaceful meadow valley at night, seen from the front, soft rolling hills in deep blue, a calm navy sky with a round cream moon and a few small stars, the bottom sixty percent of the image is open gently rising grass in dark blue-green with a small winding stream reflecting the moon, nothing else on it, soft rounded shapes, subtle darker outlines, gentle cel shading lit by moonlight from the upper left, limited palette of navy, teal, deep greens and cream, clean vector-like edges, no texture noise. No trees in the meadow, no people, no animals, no buildings, no text, no logos, no watermark.
```

### 4b. Trees (one sprite each; size in the app comes from session length)
Aspect: **1:1**. One tree, **whole tree visible, standing on a tiny patch of grass, centred, base
at the bottom centre**, transparent or pure-white background.

| File | Tree | When you get it |
|---|---|---|
| `tree-sapling` | a tiny sapling with two leaves | sessions under 20 min |
| `tree-oak` | round leafy oak | 20–44 min |
| `tree-pine` | tall pine | 45–89 min |
| `tree-big` | big ancient spreading tree | 90 min or more |
| `tree-birch` | white-trunk birch | variety |
| `tree-cherry` | pink cherry blossom | streak milestones (rare) |
| `tree-maple` | orange autumn maple | Shop (coins) |

Prompt (swap the bracketed part for each tree):
```
Flat 2D storybook cartoon illustration of a single [round leafy oak tree], the whole tree visible from the front, standing on a tiny rounded patch of grass, centred with its base at the bottom centre of the image, soft rounded shapes, subtle darker outlines, gentle cel shading with light from the upper left, limited palette of fresh greens, creams and soft browns, clean vector-like edges, no texture noise, isolated on a plain pure white background with nothing else in the frame. No shadow on the background, no ground beyond the small grass patch, no text, no logos, no watermark.
```
Fill-ins:
- `tree-sapling`: `tiny young sapling with a thin stem and two small round leaves`
- `tree-oak`: `round leafy oak tree with a full fluffy crown`
- `tree-pine`: `tall slim pine tree with layered rounded branches`
- `tree-big`: `big ancient tree with a thick twisting trunk and a huge wide crown`
- `tree-birch`: `slender birch tree with a white trunk with dark marks and light green leaves`
- `tree-cherry`: `cherry blossom tree covered in soft pink flowers, a few petals floating`
- `tree-maple`: `maple tree with a full crown of orange and red autumn leaves`

### 4c. Decorations and critters (fill the scene from day one)
Same prompt as the trees, with these fill-ins (aspect **1:1**, same background rules):
- `deco-bush-1`: `small round green bush`
- `deco-bush-2`: `wide low bush with a few tiny white flowers`
- `deco-flowers`: `small patch of wildflowers in cream, yellow and soft blue`
- `deco-mushrooms`: `cluster of three small red-capped mushrooms with white dots`
- `deco-rock`: `smooth grey boulder with a little moss on top`
- `deco-stump`: `old tree stump with a small sprout growing from it`
- `deco-log`: `fallen log with moss and a tiny mushroom`
- `critter-fox`: `small friendly orange fox sitting, looking to the side` (no grass patch)
- `critter-bird`: `small round blue bird perched, wings folded` (no grass patch)
- `critter-rabbit`: `small cream rabbit sitting with ears up` (no grass patch)

For critters, replace "standing on a tiny rounded patch of grass" with "sitting, with no ground".

---

## 5. Shop scenes (session backdrops you buy with coins)
Same rules as section 2: **9:16 portrait, dark calm middle**. Use the same photo wording as the
session backdrops ("Photorealistic vertical photograph of …, the frame mostly dark and calm,
subtle film grain, muted colours, deep clean blacks. No people, no text, no logos, no watermark,
no HDR look.") with these subjects:
- `shop-aurora`: green northern lights over a dark still fjord
- `shop-desert`: desert dunes under a clear starry night, a faint Milky Way
- `shop-snow-cabin`: a warm window glow from a small cabin in falling snow at night
- `shop-blossom`: a cherry tree in blossom under a streetlamp on a quiet night street
- `shop-beach`: a moonlit tropical beach with slow waves and a palm silhouette
- `shop-rooftop`: a city rooftop at dusk with distant soft lights, no readable signs

Because you generate these yourself, they're yours to sell in the Shop (check your image tool's
terms say you own the output; paid plans of the big ones do).

---

## 6. Video loops (optional, only if your tool makes video)
For the session screen. **6–8 seconds, completely static camera, seamless loop, no camera movement,
9:16 portrait**, same look as the matching still:
- `loop-night-sea`: slow moonlit waves on a dark sea
- `loop-rain`: raindrops slowly running down a window with blurred city lights
- `loop-fog`: fog drifting slowly between pine trees

---

## 7. Zee, the guide (cutout puppet)
Zee is built from **separate pieces** that code moves (float, fly, tilt, wave, point). The **face and
the chest "Z" are drawn in code**, so the art must leave the face screen and chest panel **blank**.
Make it our own design: don't copy any existing robot.

Steps:
1. Generate the **reference** (7a) until you love it. Everything else copies it.
2. Attach the reference as an image input and generate **each part** (7b), or one **parts sheet**
   (7c). I'll cut them out and line up the pivots (neck, shoulders).

Aspect **1:1**, highest resolution (2048 px if you can), **pure white background** (or transparent).

**`zee-reference`** (7a)
```
3D character render of a small, friendly floating robot, front view, centered, full body visible. A rounded glossy white head shaped like a soft rounded rectangle, with a large black glass screen as its face; the screen is completely blank, with no eyes, no mouth and no reflections of a face. Small round headphone-like ear pieces on both sides of the head, each with a thin glowing light-blue ring. A smaller egg-shaped glossy white body with a small blank dark glass panel in the middle of the chest. Two short rounded arms hanging at its sides, slightly apart from the body, with simple round hands and no fingers. No legs: the body tapers into a small silver hover nozzle at the bottom. Glossy white plastic with soft silver metal accents and subtle reflections. Soft studio lighting from the upper left with a gentle rim light, clean and premium like a high-end designer toy. Plain pure white background, no shadow on the ground. No text, no logos, no face on the screen, no antenna, no extra limbs.
```

**Parts** (7b): attach `zee-reference` to each prompt.
- **`zee-head`**
  ```
  Only the head of the robot in the attached image, exactly the same design, size, materials and lighting, front view, centered: the rounded head with both headphone ear pieces and their glowing light-blue rings, the face screen completely blank black glass, cut off cleanly at the bottom of the head with no neck. Plain pure white background, nothing else in the frame. No text, no face on the screen.
  ```
- **`zee-body`**
  ```
  Only the body of the robot in the attached image, exactly the same design, size, materials and lighting, front view, centered: the egg-shaped body with a short silver neck stub on top, the blank dark glass chest panel, and the silver hover nozzle at the bottom. No head and no arms; the sides where the arms attach are smooth and rounded. Plain pure white background, nothing else in the frame. No text, no logo on the chest.
  ```
- **`zee-arm-left`** (the arm on the **left side of the picture**)
  ```
  Only the arm on the left side of the picture of the robot in the attached image, exactly the same design, size, materials and lighting: one short rounded arm hanging straight down, with a rounded shoulder joint at the top and a simple round hand at the bottom, no fingers. Centered, plain pure white background, nothing else in the frame.
  ```
- **`zee-arm-right`**: the same prompt, with "the arm on the right side of the picture".

**`zee-parts`** (7c, instead of 7b if your tool handles it)
```
Character parts sheet of the robot in the attached image, exactly the same design, materials and lighting: the head (with the ear pieces, face screen completely blank), the body (with the neck stub and hover nozzle, no arms, blank chest panel), the left arm and the right arm, laid out separately with clear space between them, all front view at the same scale. Plain pure white background. No text, no labels, no face on the screen.
```

## 8. Zee's world (optional backdrop plates)
The mockup draws this world in code (stars, haze, a planet horizon, dust). A generated plate would
look richer behind the code layers. Aspect **9:16**. Keep the **top 70% dark and empty** (Zee and the
words live there) and the horizon in the **bottom quarter**.

**`world-night`**
```
Cinematic photograph from high orbit at night looking down at the curved horizon of a dark blue planet, the horizon low in the bottom quarter of the frame, a thin glowing light-blue line of atmosphere along the curve, the planet surface below almost black with faint cloud texture, a deep black sky above full of tiny faint stars, a very subtle blue haze, lots of empty dark space in the top two thirds, shot on a full-frame camera, subtle film grain, deep clean blacks, calm and minimal. No sun, no moon, no spacecraft, no text, no logos, no watermark, no lens flare.
```

**`world-sunrise`**: attach `world-night` and ask for
```
The exact same shot and framing as the attached image, a moment later: the sun is just rising over the curved horizon slightly left of center, a small bright warm-white star of light on the horizon line, the atmosphere glowing brighter along the curve, soft light spreading into the dark sky, everything else unchanged. No lens flare streaks, no text, no watermark.
```
