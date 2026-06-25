# Claude-Code-
Claude Code Repository For Git Hub

## Beyond Green — Operating & Reporting System (BG-ORS)

An operations dashboard and reporting tool for **Beyond Green Group**, a green/cleantech
operations company. BG-ORS tracks sites/assets (solar, wind, recycling, EV charging,
battery storage), daily operations logs, and maintenance tasks/issues — then derives
KPIs, charts, and exportable reports from that data.

**Tech: zero-dependency vanilla JS.** No build step, no npm install, no external network
requests. Everything is plain HTML/CSS/JS that runs straight from the filesystem.

### Features

- **Dashboard** — KPI cards (active sites, 30-day total output, open tasks, average
  uptime %), a hand-drawn canvas line chart of output over time, a canvas bar chart of
  output by site, and a recent-activity feed.
- **Sites** — table of assets with add / edit / delete via a modal form, status badges,
  and validation. Deleting a site cascades to its operations logs and tasks.
- **Operations** — filterable log (by site and date range) with an add/edit modal and a
  computed uptime % per row.
- **Tasks** — filterable by status and site, with priority badges, one-click status
  advance (Open → In Progress → Done → Open), edit, and delete.
- **Reports** — pick a date range and optional site, generate a summary (total output,
  avg daily output, total downtime, uptime %, task-completion stats), render charts,
  **export to CSV** (a real downloadable file via `Blob`), and print a clean report
  via `window.print()` with dedicated print styles.
- **Sample data** — realistic demo data is seeded on first run (7 sites, ~78 days of
  operations logs, a dozen tasks). A **Reset demo data** control lives in the footer.

All state persists to `localStorage`, so your changes survive page reloads.

### How to run

No installation or build step is required.

**Option A — open the file directly**

Open `index.html` in any modern browser (double-click it, or `File → Open`).

**Option B — serve locally**

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000> in your browser.

### Data model

All collections are stored in `localStorage` under the key `bgors.data.v1`.

1. **Sites / Assets** — `id`, `name`, `type` (Solar Farm | Wind | Recycling Plant |
   EV Charging | Battery Storage), `location`, `capacity` (number) + `capacityUnit`,
   `status` (Active | Maintenance | Offline), `commissionedDate`.
2. **Operations Log** — `id`, `siteId`, `date`, `output` (number, e.g. kWh or units),
   `downtimeHours` (number), `notes`.
3. **Tasks / Issues** — `id`, `siteId`, `title`, `priority` (Low | Medium | High |
   Critical), `status` (Open | In Progress | Done), `assignee`, `dueDate`.

Reports and dashboard KPIs are derived from these three collections — nothing else is
stored.

### Project structure

```
index.html                 App shell, navigation, modal + toast containers
assets/css/styles.css      Green-themed, responsive, print styles
assets/js/store.js         CRUD, IDs, localStorage, pub/sub emitter (window.BGORS.store)
assets/js/seed.js          Sample data generator (window.BGORS.seed)
assets/js/charts.js        Canvas line + bar chart helpers (window.BGORS.charts)
assets/js/reports.js       Aggregations + CSV export (window.BGORS.reports)
assets/js/app.js           Router, views, modal handling, event wiring
```

Scripts are loaded as classic `<script>` tags (no ES modules, so it works over
`file://`) and attach to a single global namespace, `window.BGORS`. Views are
hash-routed: `#/dashboard`, `#/sites`, `#/operations`, `#/tasks`, `#/reports`.
