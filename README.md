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

## Cloudflare Workers deployment
The repository includes a `wrangler.jsonc` file configuring the existing Worker named `fitnesslog` and serving the repository's static application assets. No framework or build step is needed.

In **Cloudflare > Workers & Pages > fitnesslog > Settings > Builds**, connect **Sttaggs/FitnessLog**, choose the production branch **main**, leave the build command blank, and use the deploy command `npx wrangler deploy`. Check the Builds/Deployments history for the commit SHA after merges; a GitHub commit alone does not prove deployment. This setup targets the existing `fitnesslog.masqas00.workers.dev` Worker, not a separate Pages site.

If automatic deployment is absent, confirm the Git integration is connected to this Worker and the correct repository/branch. If a build fails, open its build log. If the deployed commit matches GitHub but the app appears outdated, refresh or reopen the installed PWA to update its service worker.

## Data and privacy
Data is saved **only in the browser on the current device**, not in GitHub or Cloudflare. The GitHub repository is public; never commit workout records or progress photos to source control. Clearing browser data or uninstalling the app may remove records. Use the full JSON backup from Settings/History regularly. Data does **not** automatically sync between devices.

## Initial features
- Home, History, Progress, and Library tabs
- History defaults to a detailed workout list with intensity, fatigue, logged repetitions, logged sets, and a Review/Edit action
- Calendar view shows workout names by day and highlights completed workout days green; select a date to review its entries
- Export tools are collapsible and placed below workout history
- Delete a workout from the bottom of its editor, with confirmation
- Create, resume, edit, and delete workout sessions
- Add exercises in one step; new names are automatically saved and linked to their previous and future workout records
- Automatically open the first optional set after adding an exercise
- When adding a new exercise, collapse earlier exercise cards so only the newest entry remains expanded
- Each new set starts with empty stored fields. If the corresponding set in the last completed exercise session has recorded weight, reps, or RPE, those values appear only as faded placeholders; they are never counted as new performance.
- A compact Previous performance row with a visible chevron stays closed until tapped, then reveals the previous completed workout's sets and notes; tap again to hide them
- Live exercise lookup searches saved exercise names by partial matches (including middle words), capitalization-insensitive matching, and likely spelling corrections
- Selecting an existing suggestion uses its permanent exercise ID; similar names require confirmation before a separate record is created
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
