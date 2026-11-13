# FitnessLog

A private-by-default, local-first fitness journal for iPhone and desktop browsers.

## Purpose
FitnessLog supports flexible workout logging without forcing a prescribed workout mode. Exercises can be recorded by name alone, with optional sets, repetitions, weights, per-set RPE, and notes. Intensity and fatigue are recorded at the workout level. Cardio and sauna entries can be attached to a session. Workouts can be edited later.

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

Run the dependency-free progression regression tests with `npm test` (Node 20+). No build step or external packages are needed.

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
- On first launch after this update, a built-in starter catalog adds the owner's 106 supplied exercise entries as 105 distinct saved exercises. Close-grip bench press appeared under both Chest and Triceps and is stored only once, with Chest as its single assigned muscle group.
- Starter catalog groups: Chest, Shoulders, Back, Biceps, Triceps, Quadriceps, Hamstrings and Glutes, Core and Mobility, and Cardio and Conditioning. Built-in categories are editable descriptions, not a rigid training program. Cardio and mobility activities are not assigned muscle-set volume unless given a primary muscle.
- Exercise library has collapsible categories and a quick search by exercise name or muscle, while the existing live exercise search and the ability to enter unlimited new exercises remain unchanged.
- Starter entries are installed only once per device, avoid exact-name duplicates, and preserve existing exercise IDs, historical data and user-entered muscle/target information. The catalog does not create workout sessions. An intentionally removed starter entry is not recreated on every subsequent app launch.
- Jogging, Sprinting, First-step acceleration drills, Disc golf and Kayaking also appear in the dedicated Cardio activity selector, alongside the existing cardio options.

- Automatically open the first optional set after adding an exercise
- When adding a new exercise, collapse earlier exercise cards so only the newest entry remains expanded
- Each new set starts with empty stored fields. If the corresponding set in the last completed exercise session has recorded weight, reps, or RPE, those values appear only as faded placeholders; they are never counted as new performance.
- A compact Previous performance row with a visible chevron stays closed until tapped, then reveals the previous completed workout's sets and notes; tap again to hide them
- Live exercise lookup searches saved exercise names by partial matches (including middle words), capitalization-insensitive matching, and likely spelling corrections
- Selecting an existing suggestion uses its permanent exercise ID; similar names require confirmation before a separate record is created
- Minimal one-row rest timer above the exercise sets: enter a duration in minutes (for example, 3 or 1.5), tap Start, and see the countdown with a Stop/Reset control. The timer does not record rest periods and can beep only while the web app is active.
- Rest countdowns and per-exercise preferences use localStorage, not workout records; timer values are not recorded in history or exports
- The timer uses the actual end timestamp, so it resumes showing the correct time after switching apps or locking the device. Web audio and notifications are not guaranteed while the page is suspended or closed.
- Each expanded exercise card prioritizes the rest timer, previous-performance toggle, set inputs and Add Set; an optional More disclosure contains the exercise name, technique, exercise notes, muscle group and Remove Exercise action
- Every saved exercise has at most one assigned muscle group, editable under More. The group is stored against the permanent exercise ID and determines its weekly set attribution. Secondary muscle tags have been retired
- Progress now has Exercises, Muscles, and Photos sections. Exercises starts with a clear strength-trend status and a short optional next-session suggestion; detailed comparisons and recorded sessions are collapsed by default. Muscles shows weekly working-set counts by primary muscle, excluding sets explicitly marked as warm-ups. No weight-times-repetitions volume load is calculated
- Optional exercise progression targets (working sets, reps, weight increment and RPE ceiling) can be edited in More or Progress. Targets are suggestions, never auto-entered workout results
- Warm-up sets can be marked in More, without adding controls to the main set-logging table. Marked warm-ups are excluded from strength trends, target assessments and weekly muscle counts; older unmarked sets retain their original meaning
- Record optional weight, repetitions, and per-set RPE (1–10); workout intensity and fatigue apply only to the overall session
- Create sets independently per exercise; quick exercise-only logging is valid
- Standard sets are the active format; other technique formats are deferred until designed
- Cardio and sauna activity entries
- Session and exercise notes, subjective session effort/fatigue
- Auto-save to IndexedDB
- Export date-filtered CSV and JSON; printable PDF report via browser print-to-PDF
- PWA install support and offline shell cache


## Exercise catalog

The initial built-in catalog comes from the owner's supplied list and is imported directly into this device's IndexedDB. No workout or exercise data is transmitted to GitHub or Cloudflare. The install is non-destructive: existing saved exercises with matching normalized names retain their IDs, history and individually configured preferences. Previously blank primary-muscle labels may be initialized from the supplied categories on the first install; populated labels are preserved. The same name in multiple sections is represented once, not as two disconnected histories.

The update to single-muscle tracking removes discontinued secondary muscle tags from existing library records on device startup and from restored backups. Exercise IDs, primary muscle assignments, progression targets, workout history, and custom exercise creation remain intact.

The catalog is a starting point, not a restriction: you can continue creating custom exercises by typing new names during a workout or in the Library. The Library displays the catalog in collapsed, searchable categories rather than one long list. Restoring an older backup later replaces the saved library according to the backup's contents; the starter import does not automatically re-add intentionally deleted items at every page load.

## Progress page

Progress is divided into **Exercises**, **Muscles** and **Photos** to avoid stacking unrelated reports. Exercise Analytics is the default and sorts recently used exercises first.

**Progression analysis:** Epley estimated 1RM uses weight and 1–10 repetitions from individual recorded, non-warm-up sets, with a single repetition treated as the actual lifted load. RPE is *not* included in the formula. The app chooses the highest eligible estimate per completed session; incomplete sets are omitted individually. Estimates are approximations, especially for sets performed far from failure, and should not be treated as verified maximal strength.

The progression label compares the **median of the latest three eligible sessions** against the preceding three. Greater than +3% is displayed as **Progressing**, below −3% as **Possible regression**, and values in between as **Holding steady**. Before six eligible sessions the status is **Building baseline**, with a factual latest-versus-previous comparison once available. The ±3% threshold is a pragmatic product heuristic, not a universal physiological significance test. A single low result is not called regression.

**Next-session suggestion:** Each exercise may optionally have working-set, repetition, and weight-increment targets, plus an RPE ceiling. When the most recent completed session has exactly the target number of measured working sets at the same weight and all target repetitions are achieved, the app may suggest a load increase. Missing data, mixed weights, RPE above a configured ceiling, or an observed RPE of 10 prevent an unqualified increase. Shortfalls yield a **Build repetitions** recommendation. Users always decide the actual load; nothing is filled in automatically. Without targets, no prescription is inferred.

**Other comparisons**, inside a collapsed disclosure, show the highest repetitions recorded at a fixed weight or the highest load performed for at least a selected number of repetitions. **Recorded sessions** is also collapsed by default and shows the underlying sets. RPE is only compared when both weight and reps match; it is not averaged across dissimilar performances. There is no volume-load metric.

In **Muscles**, only sets with recorded repetitions above zero and one assigned muscle group count toward weekly totals. Each qualifying set is counted once. Marked warm-ups are excluded; older unmarked sets are treated as working sets. Exercise-library tag changes reclassify linked history. The workout overview remains collapsed.

Progress Photos are dated Front/Side/Back photos saved as compressed JPEGs in a separate local IndexedDB store. The Progress page provides a collapsed add-photo form, a saved-photo gallery, and same-view side-by-side or adjustable overlay comparisons. All photos remain local to the current device unless the user deliberately exports them. Standard workout CSV, JSON, and PDF exports do **not** include photos. Settings has a separate explicit **Download backup including photos** action; photo backups can be large and must be protected like personal files. Restoring an older workout-only backup does not erase photos. Uninstalling the app or clearing website storage can permanently erase locally stored photos.

## Roadmap
- Structured superset groups and advanced nested techniques
- Per-set exercise UI refinements and inline timers
- Dedicated body-measurement module and more advanced progress-photo alignment tools
- Optional deeper trends and tracking rotation
- Media-inclusive backup with integrity verification
- Expanded mobile-device accessibility audit and backup-integrity testing

See the app for its current functionality. Do not assume planned features are already implemented.
