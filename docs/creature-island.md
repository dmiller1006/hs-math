# Creature Island

Status: Current. Berry resume was added 2026-10-02 and is not yet playtested.
Source: `creature-island.html`, `creature-island.css`, `creature-island.js` (render, input, flow), `creature-island-logic.js` (map, paths, quest), `creature-island-test.js` (self-test).
Original brief and owner decisions: `EXPLORER-PLAN.md`.

## Concept

A top-down island clearing. The child taps to walk, picks berries from bushes, and delivers them to a friendly creature's picnic. Completing the picnic makes the creature a following companion and unlocks the next level. The counting is light and built into the play. There are no equations.

## Flow

```text
level card (shows N berries) → Play (costs a ticket) → tap to explore and pick → deliver at picnic
   → celebrate → Next level card …
```

Level N needs `N + 2` berries, capped at 10 (`berriesForLevel`). Berries show in rows of five.

## Rules

Movement (`creature-island-logic.js`)
- **CI-1** The world is 1000×700 units on a 20-unit walkable grid. Routes avoid water, trees, rocks, bushes, and the basket. Diagonals never squeeze between blocked cells.
- **CI-2** Tapping ground walks there. A tap on water or a solid walks to the nearest reachable ground instead, so the character never gets stuck.
- **CI-3** Tapping an object walks within reach and interacts on arrival. No second tap is needed. Targets are forgiving (about 64 CSS px or more).
- **CI-4** A new tap replaces the current destination and cancels any pending interaction. Nothing is collected from a distance.

Quest (`createQuest` / `pick` / `deliver`)
- **CI-5** The quest `{ need, plants, picked[], completed }` is the single source for visible berries, basket slots, and completion.
- **CI-6** Each bush gives one berry. Picking it again gives nothing.
- **CI-7** Delivering early keeps every berry and shows the missing slots. There is no penalty or reset.
- **CI-8** Completion happens exactly once per level.

Lifecycle
- **CI-9** Pause, hiding the page, and sleep freeze movement and interactions. Resume does not teleport or complete queued interactions.
- **CI-10** Start over resets the level with no duplicate listeners or loops.

Levels and tickets
- **CI-11** Play calls `startRun('creature-island', { level })`. Completing calls `finishRun` and saves the next level as unlocked.
- **CI-12** Each pick saves `{ picked }`. Resuming the same level restores the basket. Start over is free and clears saved berries (TIX-7).

## Testing

Open `creature-island.html?test=1`. The self-test drives the game through `window.CreatureIslandTest` and reports in `#test-results` and the page title. It uses test storage keys and skips the gate. See [testing.md](testing.md).

## Out of scope unless the owner asks

More islands or areas, a general quest engine, inventory UI, combat, timers, a joystick, mandatory music.
