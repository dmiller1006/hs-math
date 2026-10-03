# hs-math design docs

These docs describe how hs-math is meant to work: its rules, the data it saves, its boundaries, and the decisions behind them. They are written for both people and AI agents. An agent should be able to plan a change from these docs without reading every file first, then verify the details in code.

## How to use these docs

1. Start with [architecture.md](architecture.md) for the whole-system picture.
2. Open the doc for the system you are changing (table below).
3. Check [decisions.md](decisions.md) before changing any rule a decision covers. Owner decisions are not open to agent reinterpretation.
4. Write new work as a brief from [templates/feature-brief.md](templates/feature-brief.md).
5. When your change alters a rule, a storage key, or a file boundary, update the matching doc in the same change.

| Doc | Read it when you are… |
| --- | --- |
| [architecture.md](architecture.md) | Adding a page, a shared script, or a storage key; changing loading, hosting, or the PWA |
| [child-experience.md](child-experience.md) | Designing or reviewing anything a child touches |
| [star-tickets.md](star-tickets.md) | Changing how tickets are earned, spent, saved, or shown |
| [fun-gate.md](fun-gate.md) | Changing the parent code, unlock lifetime, or what is gated |
| [practice.md](practice.md) | Changing 2025 exercises or 2026 lessons, or turning a workbook screenshot into a lesson |
| [cosmic-rally.md](cosmic-rally.md) | Changing the make-ten driving game |
| [creature-island.md](creature-island.md) | Changing the tap-to-explore berry game |
| [testing.md](testing.md) | Verifying any change |
| [decisions.md](decisions.md) | Checking why something is the way it is |

## Conventions in these docs

- **Rules are numbered** (for example `TIX-3`) so briefs, reviews, and commits can cite them. Never renumber; retire a rule by striking it through and pointing to the decision that replaced it.
- **"Must" means a tested or reviewable invariant.** "Should" means a default you can change with a reason.
- **Each doc lists its source files.** If a doc and the code disagree, the code is what ships; fix whichever is wrong, and record a decision if the behavior changed on purpose.
- **Status line** at the top of each doc: `Current` (matches code), `Draft` (proposed), or `Stale` (known to be out of date; say what).
- **No secrets beyond the FUN code,** which is a deliberate, documented convenience value.

## Related files outside docs/

- `STATUS.md` is the session handoff: what changed recently and what to do next. These docs are the stable design; STATUS is the changing state.
- `CLAUDE.md` / `AGENTS.md` are the short agent entry points. They should stay identical and link here.
- `FUN-PLAN.md` and `EXPLORER-PLAN.md` are the original build briefs for the two games. They are history; the game docs here are the maintained design.
- `PRESCHOOL-APP-PLAN.md` plans a separate future app. It is not part of hs-math.
