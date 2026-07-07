# Feature Spec: Forest

**Product:** Focuznow (browser extension)
**Feature type:** New standalone tool, alongside Habits and Scratches
**Status:** Ready for build

---

## 1. Concept

Forest is a visual reward system that turns focused behavior into a growing 3D forest. Unlike simple timer-based forest apps, growth is tied to *actual clean focus behavior* across the whole Focuznow suite — not just elapsed time.

---

## 2. Core Loop

| Trigger | Effect |
|---|---|
| Completed Pomodoro / Deep Work session | Plants a new tree on the grid |
| "Clean time" accumulates (no visits to blocked sites, no YouTube Shorts/Reels, no TikTok) | Existing trees grow larger over time |
| Slip-up (blocked site visited, Shorts/Reels/TikTok opened) | **No punishment.** Forest is never destroyed. Growth rate simply slows for a period following the slip-up. |

Design intent: reward-only reinforcement. No death/loss mechanics — slip-ups reduce growth *rate*, they never destroy progress. This avoids the rage-quit failure mode common to punishment-based focus apps.

---

## 3. Data Model (draft)

```
Tree
  - id
  - planted_at (timestamp)
  - grid_position (x, y)
  - growth_stage (0-N, e.g. seed → sprout → sapling → mature)
  - total_clean_minutes_accumulated
  - species (optional, cosmetic variety)

ForestState
  - clean_time_multiplier (current growth speed, default 1.0x)
  - last_slip_at (timestamp, used to decay/recover multiplier)
  - trees[]

Session (existing Pomodoro/Deep Work data)
  - on completion → triggers plant_tree()

SlipEvent
  - triggered by: blocklist violation, Shorts/Reels/TikTok detected
  - on trigger → reduce clean_time_multiplier for a cooldown window, then recover
```

**Open question for build:** exact growth curve (linear vs. stepped stages), exact multiplier penalty/recovery formula, and grid size limits are left to implementation — no hard requirement was set, so use sensible defaults and make them easy to tune.

---

## 4. Visual / UX

- **View:** 3D isometric grid, similar to the tilted "3D mode" view in Google Maps / Apple Arcade-style casual games.
- **Interaction:** user can pan/rotate around the grid; grid cells are clickable/selectable to place a newly-planted tree.
- **Scope note:** visual/3D implementation is being handled separately (not part of this spec) — this doc covers the *logic and data* side only. Build the grid/render layer to consume `ForestState` and expose a `plant_tree(position)` hook.

---

## 5. Integration Points

- **Pomodoro / Deep Work timer** → on session complete, call `plant_tree()`
- **Blocklist** → on blocked-site visit, call `register_slip()`
- **YouTube Shorts blocking** → on Shorts/Reels/TikTok detection, call `register_slip()`
- **Statistics** → optional: surface forest stats (tree count, total clean minutes) alongside existing per-site stats

---



## 6. Open Questions for Whoever Builds This

1. Growth curve: how many stages per tree, and how much clean time per stage?
2. Multiplier penalty: how much does one slip-up slow growth, and how long until it recovers?
3. Grid size: fixed grid, or does it expand as the forest grows?
4. Tier placement: Free or Pro feature?