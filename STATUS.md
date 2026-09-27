# HS Math handoff

## Current state

- Plain HTML, CSS, and JavaScript; no build step or external framework.
- Shared navigation, dark/light themes, and a Reload app button in the home drawer.
- 2025 contains Counting Circles and Simple Math.
- 2026 contains lessons 6.1A (count two groups to make ten) and 6.2A (how many more to ten).
- `lessons.js` is the lesson catalog; `lesson.js` is the shared problem generator and runner; `lesson.html` and `lesson.css` provide the lesson screen.
- Lessons use five fresh questions, gentle retries, optional visual hints after two wrong answers, and an All done finish.
- Lesson 6.2A matches the frame from left to right: given filled spaces on the left, given number on the left, answer box on the right.

- FUN now contains Cosmic Rally: a five-station auto-driving make-ten game with a safe route choice, hints, boosts, music, calm motion, pause, and replay.
- FUN uses the shared child-lock code `1234` and relocks after 15 idle minutes. Game details and ownership are in `FUN-PLAN.md`.

## Goal for future work

Build a small, reusable workflow for turning workbook screenshots into interactive kindergarten math practice. Practice follows a similar exercise in the physical workbook and generates fresh problems targeting the same skill rather than copying the workbook's exact questions.

For each screenshot:

1. Identify the skill and visual structure.
2. Ask focused educator questions where the teaching intent is unclear.
3. Reuse an existing exercise type or add the smallest useful new type.
4. Add the lesson to the 2026 catalog and verify the interaction.

There is no automatic screenshot ingestion pipeline yet. The runner currently supports counting two groups and missing addends to ten. Use more real workbook examples to determine what should become reusable before selecting a larger framework. Keep familiar visuals, minimal reading, and large iPad touch targets.

## Testing approach

Use focused checks proportional to the change. Verify picture/equation/input alignment, correct and incorrect answers, hints, and the five-question finish. Check actual iPad behavior after UI changes. Agent swarms are not part of the default workflow; revisit only if complexity warrants them.

## Deployment

- Vercel production: https://hs-math-delta.vercel.app/
- Connected GitHub repository: `dmiller1006/hs-math`, branch `main`.
- Pushes to `main` deploy through Vercel and also update the existing GitHub Pages site.
- PWA manifest uses relative `start_url: "./"` so both hosts work.
- After changing the manifest, remove and re-add the iPad Home Screen icon from Safari.
- The drawer's Reload app button requests fresh page and asset URLs.

## Next session

Cosmic Rally passed Codex review and deployment verification checks. The browser harness passed 252 checks; two music assertions that rely on scripted clicks were verified separately using real browser taps (startup and restart), alongside music-off and master-mute checks. Math checks covered all ten starting values and 3,000 random generations. The final geometry, Back navigation, drawer layering, and paused-input fixes were checked. Physical iPad playtesting is still outstanding: verify audio/music unlock, silent-switch behavior, Home Screen safe areas, and the FUN gate. Wait for the owner’s playtest feedback, next workbook screenshot, or written brief before expanding scope.
