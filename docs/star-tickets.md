# Star tickets

Status: Current as of 2026-10-02. The credit rule and run resume are implemented but not yet playtested.
Source: `tickets.js` (all rules), plus call sites in `lesson.js`, `simple-math.html`, `counting-circles.html`, `cosmic-rally.js`, `creature-island.js`, `site.js`.

## Purpose

Practice earns star tickets, and tickets buy FUN game runs. The goal is regular practice with a reward the child understands. It must not punish mistakes or teach guessing.

## Rules

Earning
- **TIX-1** Finishing a five-question 2026 lesson set earns one ticket.
- **TIX-2** In 2025 exercises (endless), every five credited problems earn one ticket. Progress toward the next ticket is saved per activity and survives reloads.
- **TIX-3** A problem earns credit only if it was solved within `MAX_MISSES_FOR_CREDIT` (3) wrong tries. A lesson set earns only if all five questions are within the limit. Hints never cost credit. An uncredited problem still counts as solved on screen. (See D-6.)
- **TIX-4** Each set has a unique id, and an id pays out at most once, even after repeated finish events or reloads. The last 200 paid ids are remembered.

Spending
- **TIX-5** Starting a new run costs one ticket. A run is one Cosmic Rally course or one Creature Island level.
- **TIX-6** An unfinished run resumes free, continuing where it left off. Games record their position with `saveProgress`. Finishing a run (`finishRun`) closes it, so the next run costs a ticket.
- **TIX-7** Creature Island's "Start over" within a level is free and keeps the run open (owner decision, D-4).
- **TIX-8** With no tickets, the game shows the "Out of tickets" card, which links to practice and offers grown-up Free play. It never charges into a negative balance.

Free play
- **TIX-9** Grown-up Free play always asks for the FUN code, even inside an unlocked FUN area, because the child may be holding the iPad.
- **TIX-10** Free play runs do not spend tickets. Free play ends when FUN locks, expires, or a grown-up turns it off.

Limits
- **TIX-11** The balance is clamped to 0–99. One jar per device; there is no sync.

## Data

`localStorage['hs-math-tickets']`:

```json
{
  "balance": 3,
  "awarded": ["lesson-6.2A-…", "simple-math-…"],
  "runs": {
    "cosmic-rally": { "free": false, "started": 1790000000000,
                      "progress": { "givens": [4,0,9,2,7], "index": 3, "route": "candy" } },
    "creature-island": { "level": 2, "free": false, "started": 1790000000000,
                         "progress": { "picked": ["plant-a", "plant-c"] } }
  },
  "sets": { "simple-math": { "id": "simple-math-…", "solved": 3 } }
}
```

- A run matches on its `info` fields (for Creature Island, `{ level }`). If the stored run doesn't match, starting charges again.
- `progress` belongs to the game. tickets.js stores it without checking it. Each game validates it before use and falls back to a fresh run.

## API (`window.StarTickets`)

| Call | Effect |
| --- | --- |
| `balance()` | Current balance |
| `award(setId)` | +1 if this id has not paid before; returns whether it paid |
| `earnsCredit(misses)` | Whether a problem with this many wrong tries earns credit |
| `practiceSet(activity)` | `{ count(), recordCorrect(misses) }` for endless exercises; `recordCorrect` returns true when it paid a ticket |
| `startRun(game, info)` | Resume a matching run or spend one ticket; returns the run or `null` if empty |
| `saveProgress(game, progress)` | Save the open run's position (no-op if no run) |
| `activeRun(game)` / `finishRun(game)` | Read or close the open run |
| `wouldCharge(game, info)` | Whether starting now would cost a ticket (to show or hide the cost) |
| `isFreePlay()`, `setFreePlay(on)`, `requestFreePlay(cb)` | Free play state |
| `onChange(fn)` | Re-render on any jar change, including from other tabs |
| `showEmpty({ onFreePlay, onClose })` | Shared "Out of tickets" card |

## Edge cases

- A double tap on the final answer awards once (TIX-4). Answer locks also prevent a second finish event.
- If the page reloads mid-set, 2025 progress is restored. A lesson set in progress restarts with a new id, and the unfinished set never paid.
- A reload mid-run resumes at the saved point. Cosmic Rally replays the current station from its arrival; Creature Island restores the basket.
- Clearing site data resets the jar to zero. This is accepted (ARCH-3).

## Known gaps and open questions

- TIX-7 lets a child replay one Creature Island level without finishing it. It's accepted for now.
- 2025 problems are easier than 2026 lesson sets, yet each ticket costs five problems either way. Should the exchange rates differ?
- A child cannot see why an uncredited problem didn't move "3 of 5". Is a visual cue needed?
