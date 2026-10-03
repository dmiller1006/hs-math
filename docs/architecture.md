# Architecture

Status: Current as of 2026-10-02 (commit `32a847b` plus resume/credit changes)

## Purpose

hs-math is a small static website of math practice and games for one kindergarten child, used mostly on an iPad from a Home Screen icon. A parent maintains it with AI agents. Simplicity is a feature. The site should stay understandable to an agent reading a few files.

## Constraints

- **ARCH-1** Plain HTML, CSS, and JavaScript. No build step, package manager, framework, bundler, or backend.
- **ARCH-2** Every page works when served as static files from the repo root.
- **ARCH-3** All state is per-device browser storage. There are no accounts and no sync.
- **ARCH-4** Sounds are generated with the Web Audio API. There are no audio files.
- **ARCH-5** New features get their own files with a clear prefix (`cosmic-rally-*`, `creature-island-*`). Avoid refactoring existing pages just to share small pieces of code.
- **ARCH-6** Game and lesson rules live in DOM-free logic files or functions, so they can be checked on their own.

## Map

```text
index.html            Home: 2025 / 2026 / FUN tabs, drawer, ticket jar
├─ 2025  counting-circles.html, simple-math.html     self-contained pages (inline JS/CSS)
├─ 2026  lesson.html?lesson=<id>                     lesson.js runner + lessons.js catalog
└─ FUN   cosmic-rally.html, creature-island.html     gated games, each with *-logic.js

Shared scripts (loaded per page as needed)
  theme.js      dark/light before first paint (dark is default)
  site.js/.css  header, drawer, tabs, Lock FUN, Reload app, home ticket UI
  lessons.js    lesson catalog (window.mathLessons)
  fun-gate.js   window.FunGate: parent code gate
  tickets.js    window.StarTickets: star-ticket jar
```

| Page | theme | site | lessons | fun-gate | tickets | own files |
| --- | --- | --- | --- | --- | --- | --- |
| index.html | ✓ | ✓ | ✓ | ✓ | ✓ | |
| counting-circles.html, simple-math.html | ✓ | ✓ | | | ✓ | inline |
| lesson.html | ✓ | ✓ | ✓ | | ✓ | lesson.js, lesson.css |
| cosmic-rally.html | ✓ | | | ✓ | ✓ | cosmic-rally{,-logic}.js, .css |
| creature-island.html | ✓ | | | ✓ | ✓ | creature-island{,-logic,-test}.js, .css |

Games do not load `site.js`. They draw their own top bar with a Menu link back to `index.html#fun`.

## Page loading and Reload app

Each page's `<head>` has a small inline script that `document.write`s its CSS and JS tags. When the URL has `?_refresh=<digits>`, every asset URL gets `?v=<digits>`. The drawer's **Reload app** button sets a new `_refresh` value. `site.js` copies it onto same-origin links, so the next pages also load fresh. This exists because iPad Safari in Home Screen mode has no hard reload.

- **ARCH-7** A new page must use the same loader pattern, or Reload app will not refresh its assets.
- **ARCH-8** Shared scripts are `defer`red. Inline page scripts run before them, so code that needs `window.StarTickets` or `window.FunGate` must wait for `DOMContentLoaded` or call them lazily.

## Storage keys

All keys are prefixed. `?test` in the URL switches tickets to separate `-test` keys and clears them on load.

| Key | Storage | Owner | Contents |
| --- | --- | --- | --- |
| `hs-math-theme` | local | theme.js / site.js | `light` or `dark` |
| `hs-math-tickets` | local | tickets.js | `{ balance, awarded[], runs{}, sets{} }`; see [star-tickets.md](star-tickets.md) |
| `hs-math-fun-unlock` | session | fun-gate.js | last-activity timestamp of a valid unlock |
| `hs-math-last-tab` | session | fun-gate.js | `2025` or `2026`; where Cancel returns |
| `hs-math-free-play` | session | tickets.js / fun-gate.js | `1` while grown-up Free play is on |
| `cosmic-rally-sound`, `-music`, `-calm` | local | cosmic-rally.js | `on` / `off` |
| `creature-island-sound` | local | creature-island.js | `on` / `off` |
| `creature-island-level` | local | creature-island.js | highest unlocked level |

- **ARCH-9** Wrap every storage read and write in `try/catch`, and treat bad or missing data as a fresh start. Private browsing and cleared site data must not break a page.
- **ARCH-10** Add new keys to this table.

## Hosting and PWA

- Pushing to `main` deploys to Vercel (https://hs-math-delta.vercel.app/) and GitHub Pages (https://dmiller1006.github.io/hs-math/).
- `manifest.json` uses `"display": "standalone"` and a relative `"start_url": "./"`, so the Home Screen icon works on both hosts. The meta tag `apple-mobile-web-app-capable` alone does not give fullscreen on modern iPadOS.
- After any manifest change, delete and re-add the Home Screen icon.
- There is no service worker, so the site needs a network connection.

## Non-goals

Accounts, sync, analytics, a backend, a framework or build migration, offline support, and multiple child profiles. Each would need an owner decision first.
