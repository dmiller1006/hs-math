# Tap-to-explore game: Claude brief

## Direction and ownership

The owner selected tapping and exploring for a completely different game from Cosmic Rally. Codex remains orchestrator and reviewer; Claude is the builder. Working concept: **Creature Island**, a small, friendly top-down adventure. The title, island theme, and first quest below are prototype defaults, not requirements to expand into a large game.

The owner also wants regular math practice to earn tickets for FUN games. Capture that goal here; implement it only after the exploration prototype has been reviewed. This brief does not authorize a commit, push, or deployment.

Read AGENTS.md and STATUS.md, then inspect the working tree. Preserve existing work. Leave PRESCHOOL-APP-PLAN.md untouched and out of commits. Do not change Cosmic Rally or the existing practice exercises during this prototype.

## First playable slice

Build one attractive island clearing that fits on screen, with a player character, a friendly creature, a few trees and rocks, three berry plants, and a picnic basket. Use a top-down or slightly angled view with clear walkable ground.

The child taps to walk and explore. Flowers react as the character passes, a creature turns toward the character, and collectible plants have a gentle visual cue. The scene should have personality even before the quest is complete.

The first tiny quest is a picnic:

1. A creature shows a picture of three berries and an empty three-slot basket.
2. Tap a berry plant. The character walks to it and automatically collects one berry on arrival.
3. The basket indicator fills left to right, one visible berry per collected plant. Each plant yields only one berry.
4. Tap the picnic spot to walk over and deliver the collected berries. If fewer than three are collected, show the remaining empty slots and keep the berries; do not penalize or reset.
5. With all three berries, the creature celebrates, sits down for the picnic, and becomes a following companion. The child can continue exploring or tap Replay.

The objects and quantities provide light counting practice. No equation popups are needed in this first slice. The more general math connection will be the practice-earned tickets.

## Touch behavior

- Tap walkable ground to move there. Show a brief destination marker immediately.
- Tap a creature or object to walk within reach and then interact automatically. No second precision tap is required.
- A new destination replaces the previous one. Cancel any pending interaction with the previous destination; do not collect something the character never reached.
- Route around trees and rocks. Use a small walkable grid and simple pathfinding if useful. The character must not cross water or solid objects.
- A tap on inaccessible terrain should select a nearby reachable location or show a gentle visual response; it must not strand the character or queue an impossible route.
- Make tappable objects forgiving (roughly 64 CSS pixels or more at the displayed scale). Ensure nearby objects have distinct targets.
- No joystick, simultaneous touches, dragging, manual jumping, combat, lives, or timed tasks.
- Keep important objects visible and separated in both iPad orientations. Landscape can be the primary composition, but portrait must remain playable without hidden controls or horizontal page scrolling.

## Presentation and lifecycle

Use a recognizable animated character, layered scenery, a few responsive environmental details, and short optional sound effects. Prefer a coherent, finished clearing over many empty screens. Give the child immediate feedback on a tap and a clear arrival/interaction response. Avoid text-dependent quest instructions.

Provide Menu, Pause/Resume, sound toggle, and Replay. Respect reduced motion, pause on backgrounding, and resume without teleporting or completing queued interactions while hidden. Replay resets collectibles, quest progress, movement, companion, and effects without duplicate listeners or loops. Avoid mandatory music in this first prototype.

## Technical scope

Create separate game files with the `creature-island` prefix. Keep static hosting and the existing PWA compatible. DOM controls plus Canvas/SVG are sufficient for this slice. Do not introduce a framework migration, backend, account system, map editor, general quest engine, multiple islands, or inventory-management UI.

Keep movement/path selection, quest state, and rendering separate enough to check independently. Use a single quest state as the source for visible berries, basket slots, and completion. Use a frame clock that pauses cleanly.

Serve this prototype directly for review. Home/FUN integration and the shared gate come after the playtest; do not publish an ungated prototype.

## Acceptance checks and handoff

- Ground taps, object taps, obstacle routing, invalid destinations, and rapid destination changes behave predictably.
- Collecting twice from one plant never gives a second berry. Canceling an approach never collects from a distance.
- The basket exactly matches collected berries; early delivery preserves progress; completion happens once.
- Pause/backgrounding freezes movement and interaction. Replay produces a clean new picnic.
- iPad portrait and landscape keep the quest and controls usable. Verify browser touch-sized layouts; clearly distinguish these from a physical iPad test.
- Existing practice pages and Cosmic Rally remain unchanged.

Report changed files, checks actually run, local preview instructions, and limitations. Then stop for Codex review and a child/iPad playtest before adding further areas or ticket integration.

## Later stage: practice-earned tickets

Goal approved in principle; these are proposed defaults to confirm after the prototype:

- Completing a set of five practice questions earns one star ticket. Hints and retries do not reduce the reward; repeated completion events or reloads must not award duplicate tickets for the same set.
- Existing five-question lessons already provide a completion boundary. The older endless exercises need an explicit five-question set before they can earn tickets reliably.
- One ticket opens one full adventure run, including retries. Resume the same unfinished run without charging again; exact replay/charging behavior must be agreed before implementation.
- Save the balance and active run locally on that device. No cross-device sync in the initial version.
- Parent Free Play remains available behind the shared child-lock code `1234`. Tickets do not replace the parent gate.
- Show the balance as a simple star-ticket jar. Avoid penalties for wrong answers, expiring tickets, streak pressure, or repeated payment during a run.

Implement ticket accounting once for the FUN area after its rules are agreed, rather than separately in each game. Do not add it during the first playable slice.

## Owner decisions (2026-09-27)

Implemented after the owner approved the first slice; committed and deployed in `3525c24` and `32a847b`.

- Levels: Creature Island level N needs N + 2 berries (capped at ten, shown in rows of five). A Level badge sits in the top bar; progress is saved per device.
- Earning: finishing a five-question 2026 lesson earns one star ticket, once per set. Since `32a847b`, five solved problems in a 2025 exercise also earn one. A problem only counts if solved within three wrong tries.
- Spending: one ticket starts one Creature Island level or one Cosmic Rally course. An unfinished level/course resumes free where it left off (including after reload); Start over within a level is free.
- One shared jar (`tickets.js`, localStorage). Grown-up Free play needs the FUN code, lasts until FUN locks or expires. The FUN gate still guards both games.
- Creature Island is now listed in FUN and gated like Cosmic Rally.
