# FitnessLog

A private-by-default, local-first fitness journal for iPhone and desktop browsers.

## Purpose
FitnessLog supports flexible workout logging without forcing a prescribed workout mode. Exercises can be recorded by name alone, with optional sets, repetitions, weights, effort, fatigue, and notes. Cardio and sauna entries can be attached to a session. Workouts can be edited later.

## Stack
- HTML, CSS, and vanilla JavaScript (no build step)
- IndexedDB for workout data; localStorage for lightweight preferences
- Progressive Web App with a service worker for offline use
- Static hosting on Cloudflare Workers Static Assets or Cloudflare Pages
- No backend, accounts, analytics trackers, or AI API

## Run locally
Serve the directory over HTTP (service workers and JavaScript modules are not supported reliably from `file://`):

```sh
python3 -m http.server 8000
```

Visit http://localhost:8000.

## Cloudflare
Configure a Cloudflare Workers project with Static Assets sourced from this repository (the repository root is the asset directory). No build command or output compilation is necessary. Alternatively, deploy as a Cloudflare Pages static site with no build step and root output.

## Data and privacy
Data is saved **only in the browser on the current device**, not in GitHub or Cloudflare. The GitHub repository is public; never commit workout records or progress photos to source control. Clearing browser data or uninstalling the app may remove records. Use the full JSON backup from Settings/History regularly. Data does **not** automatically sync between devices.

## Initial features
- Home, History, Progress, and Library tabs
- Create, resume, edit, and delete workout sessions
- Add exercises in one step; new names are automatically saved and linked to their previous and future workout records
- Automatically open the first optional set after adding an exercise
- Record optional weight, repetitions, and per-set RPE (1–10); workout intensity and fatigue apply only to the overall session
- Create sets independently per exercise; quick exercise-only logging is valid
- Standard sets are the active format; other technique formats are deferred until designed
- Cardio and sauna activity entries
- Session and exercise notes, subjective session effort/fatigue
- Auto-save to IndexedDB
- Export date-filtered CSV and JSON; printable PDF report via browser print-to-PDF
- PWA install support and offline shell cache

## Roadmap
- Structured superset groups and advanced nested techniques
- Per-set exercise UI refinements and inline timers
- Dedicated body-measurement and private progress-photo comparison module
- Charts, training rotation, and expanded analytics
- Media-inclusive backup with integrity verification
- Automated tests and accessibility audit

See the app for its current functionality. Do not assume planned features are already implemented.
