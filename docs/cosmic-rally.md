# Cosmic Rally

Status: Current. Station resume was added 2026-10-02 and is not yet playtested.
Source: `cosmic-rally.html`, `cosmic-rally.css`, `cosmic-rally.js` (scene, flow, audio), `cosmic-rally-logic.js` (math).
Original brief: `FUN-PLAN.md`.

## Concept

A car drives itself through a space course. At each of five stations, a battery needs charging to ten. The child answers "how many more?", then taps **Boost** for a payoff. The child makes meaningful choices (car color, road at the fork, the Boost moment) without needing to steer.

## Flow

```text
choose car → Go (costs a ticket) → drive → station: answer → battery fills → Boost → payoff
   → next station … fork after station 2 (Crystal / Candy, both safe) … → station 5 → trophy → Replay
```

Payoffs in order: moon jump, rainbow tunnel, loop, tunnel, moon jump.

## Rules

Math (`cosmic-rally-logic.js`)
- **CR-1** A course has five problems with distinct starting charges from 0–9. A full battery is never asked.
- **CR-2** A problem is `{ given, answer = 10 − given, slots, equation: given + ? = 10, hint }`. That one object drives the battery, the equation, the answer, and the hint (UX-11).
- **CR-3** A number-pad tap (0–10) submits immediately. There are no Check or Clear buttons.
- **CR-4** A wrong answer stays at the station. After `HINT_AFTER_MISSES` (2) misses, the empty slots are numbered 1…answer.

Flow and input
- **CR-5** Every required choice waits indefinitely. Driving never needs a corrective touch.
- **CR-6** Each control works only in its matching state (`choose`, `answering`, `ready` for Boost, `fork`, `done` for Replay) and never while paused. Taps during `driving`, `filling`, `retry`, and `boosting` are ignored, which prevents double advances.
- **CR-7** All motion runs on a game clock that only advances while unpaused. Pausing, hiding, or sleeping the page freezes everything.
- **CR-8** Replay resets all run state. Listeners and the frame loop are created once.

Tickets
- **CR-9** Go calls `startRun('cosmic-rally')`. Finishing station 5 calls `finishRun`.
- **CR-10** After each station and after the fork choice, the game saves `{ givens, index, route }`. On load, a valid saved run restores the course. Go then continues at station `index`, or at the fork if the road was not yet chosen. Invalid progress is ignored.

Presentation
- **CR-11** Sound, music, and calm-motion toggles are saved per device. Calm mode replaces drives and payoffs with fades. The default follows `prefers-reduced-motion`.

## Testing aids

- `?charges=4,0,9` fixes the first starting charges (a saved run takes priority).
- `?speed=4` runs the game clock up to 8× faster.
- `window.cosmicRally` exposes read-only state for browser checks.
- See [testing.md](testing.md) for the verified checklist.

## Out of scope unless the owner asks

New skills or operations, more courses, steering, timers, scores.
