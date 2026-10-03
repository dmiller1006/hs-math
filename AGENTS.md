# hs-math

Interactive math practice and games for a kindergarten child (iPad-optimized).

## Architecture
- Plain HTML, CSS, and JavaScript. No build step, package manager, framework, or backend.
- `index.html` — home with three tabs: 2025 (practice corner), 2026 (lessons), FUN (gated games)
- Shared shell: `site.js` / `site.css` (header, drawer, tabs, Reload app), `theme.js` (dark/light)
- Pages load their CSS/JS through a small `document.write` loader so Reload app can cache-bust every asset
- Sound effects use Web Audio API (no external files)
- `STATUS.md` is the current handoff; read it before starting work
- `docs/` holds the design docs with numbered rules (start at `docs/README.md`). Update the matching doc when a rule, storage key, or file boundary changes; record intentional behavior changes in `docs/decisions.md`

## Content
- 2025: `counting-circles.html` (tap circles to match 10–30), `simple-math.html` (single-digit add/subtract). Self-contained pages; endless problems.
- 2026: `lessons.js` (catalog) + `lesson.js` (shared runner) + `lesson.html`/`lesson.css`. Five-question sets built from workbook screenshots.
- FUN: `cosmic-rally.*` (make-ten driving game) and `creature-island.*` (tap-to-explore berry picnic). Each has a separate `*-logic.js` for rules that can be checked alone.
- `fun-gate.js` — shared parent code gate for FUN (convenience lock, not security)
- `tickets.js` — star-ticket jar shared by every page (earn in practice, spend in FUN)

## Star tickets (rules live only in tickets.js)
- Five credited 2025 problems, or one finished 2026 lesson set, earns one ticket. Each set id pays once.
- A problem earns credit only if solved within `MAX_MISSES_FOR_CREDIT` (3) wrong tries. A lesson set needs every question within that limit.
- One ticket starts one Cosmic Rally course or one Creature Island level. An unfinished run resumes free where it left off (`saveProgress`).
- Grown-up Free play needs the FUN code and ends when FUN locks.
- Stored in localStorage per device; no sync.

## iPad / PWA notes
- `apple-mobile-web-app-capable` meta tag alone does NOT work on modern iPadOS
- Must include `manifest.json` with `"display": "standalone"` for fullscreen home-screen launch; `start_url` is relative (`./`) so both hosts work
- After any manifest changes, user must delete and re-add the home screen icon
- `touch-action: manipulation` on interactive elements to prevent double-tap zoom
- `user-scalable=no` in viewport meta (Safari may still ignore this)

## Conventions
- Large touch targets (64 CSS px for primary game controls), minimal reading, no timers or penalties
- Gentle retries, visual hints after two misses, confetti + sound on correct
- Back-to-menu link at top-left of each page
- New work starts from a written brief based on `docs/templates/feature-brief.md`
- `PRESCHOOL-APP-PLAN.md` is for a separate future app; leave it out of hs-math commits

## Testing
- `node --check` on changed JS
- Creature Island self-test: open `creature-island.html?test=1` (results in `#test-results` and the page title)
- Cosmic Rally aids: `?charges=4,0,9` fixes starting charges, `?speed=4` speeds the clock
- `?test` on any page uses a separate test ticket jar
- Physical iPad testing is still required for audio, safe areas, and Home Screen launch

## Deploy
Push to `main`. Vercel (https://hs-math-delta.vercel.app/) and GitHub Pages (https://dmiller1006.github.io/hs-math/) both deploy from root.
