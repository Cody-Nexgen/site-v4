# Dashboard — UI kit

Full-tab dashboard for `focuznow.app/dash`. 240px sidebar + main column with a sticky top bar.

## Components
- `Sidebar.jsx` — left nav with section eyebrow + user footer.
- `SessionPanel.jsx` — large current-session card with countdown ring.
- `StatTiles.jsx` — 4-up stat row (today, week, streak, blocked).
- `TodoList.jsx` — checklist card with inline add.
- `HabitsCard.jsx` — weekly habit grid (7 cells + streak count).
- `BlocksCard.jsx` — table of blocked sites.
- `DashboardApp.jsx` — composes everything; runs a live countdown.

Open `index.html` to use it. Sidebar nav switching is wired for visual state only (data-driven sub-views can be added later).
