# Testing

Status: Current

There is no test framework or CI. Checks should match the size of the change. Say exactly which checks ran, and keep browser-viewport checks separate from tests on a real iPad.

## Levels

| Level | What | When |
| --- | --- | --- |
| 1. Syntax | `node --check <file>.js` for every changed JS file | Always |
| 2. Logic | Load a DOM-free logic file in Node and assert rules: `cosmic-rally-logic.js` (it exports via `module.exports`), `creature-island-logic.js`, `tickets.js` (with stub `localStorage`/`sessionStorage`/`location`) | Rule changes |
| 3. Browser | Serve the repo root (for example `python3 -m http.server`), open pages, use `?test`, `?test=1`, `?charges=`, `?speed=` | UI or flow changes |
| 4. iPad | Real device from the Home Screen icon | Before calling child-facing work done |

## Per-area checklists

Lessons ([practice.md](practice.md))
- Picture, equation, and blanks line up left to right
- Correct and wrong answers; Help appears after two misses; counting works
- The five-question finish; the ticket appears once; the miss limit withholds the ticket

Tickets ([star-tickets.md](star-tickets.md))
- A double tap at the finish awards once
- An empty jar shows the card
- Free play needs the code and ends on Lock FUN
- Reload mid-run resumes without charging; finishing closes the run

Cosmic Rally ([cosmic-rally.md](cosmic-rally.md))
- Starting charges 0 and 9; answers 10 and 1
- A forced full battery is rejected
- Rapid taps advance once
- Fork waits; replay is clean (`window.cosmicRally.pending`)
- Reload at station 3 continues at station 3 with the same batteries and road

Creature Island ([creature-island.md](creature-island.md))
- `?test=1` self-test passes
- Reload mid-level keeps the basket

FUN gate ([fun-gate.md](fun-gate.md))
- Wrong code, Cancel, direct URLs, Back, reload
- 15-minute expiry
- Drawer closes before the keypad shows

## iPad-only checks

Audio unlock on first tap, the silent switch, music toggles, Home Screen safe areas and fullscreen, portrait and landscape, touch target comfort.

## Notes

- Browser autoplay rules can fail scripted audio checks. Confirm audio with real taps.
- `?test` uses separate ticket keys and clears them on load. Never test against the child's real jar.
