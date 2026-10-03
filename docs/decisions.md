# Decision log

Owner decisions and lasting technical choices. Add new entries at the bottom; never rewrite old ones. To reverse a decision, add a new entry that supersedes it.

Format: **D-n · date · title** — decision. *Why.* Supersedes / affects.

---

**D-1 · 2025 · Static site, no build** — Plain HTML/CSS/JS served from the repo root; no framework, package manager, or backend. *A parent and AI agents maintain it; anyone should be able to read and fix it quickly.* Affects ARCH-1.

**D-2 · 2026-09-27 · FUN gate is a convenience lock** — Shared code `1234` in one constant, session unlock, 15-minute idle relock, no accounts or recovery. *It only needs to slow a kindergartner down, not secure anything.* Affects GATE-1..7.

**D-3 · 2026-09-27 · Cosmic Rally as the first FUN game** — An auto-driving make-ten game with five stations, a safe fork, and Boost payoffs. No steering or timers. *The child has little video-game experience and needs meaningful choices without motor skill demands.*

**D-4 · 2026-09-27 · Creature Island levels and tickets** — Level N needs N + 2 berries (max 10); one ticket per level or course; an unfinished run resumes free; Start over within a level is free; Free play needs the FUN code. *Approved after the first playable slice.* Affects TIX-5..10, CI-11.

**D-5 · 2026-09-29 · 2025 exercises earn tickets** — Five solved problems in a 2025 exercise earn one ticket, like a finished lesson set. *The owner wants all regular practice to count.* Supersedes the earlier "2025 does not earn" default in EXPLORER-PLAN.md. Affects TIX-2.

**D-6 · 2026-10-02 · No tickets for guessing** — A problem earns credit only within 3 wrong tries; a lesson set needs all five within the limit. *Once tickets bought games, tapping every number until one worked became the fastest way to earn.* Partly supersedes the brief's "retries do not reduce the reward" (hints still never do). Pending owner confirmation of the limit. Affects TIX-3.

**D-7 · 2026-10-02 · Resume means continue** — An unfinished run saves its position: Cosmic Rally station and road, Creature Island picked berries. *Previously a free "resume" restarted from the beginning, so a child could play forever by never finishing.* Affects TIX-6, CR-10, CI-12.

**D-8 · 2026-10-02 · Design docs in docs/** — Stable design lives in `docs/` with numbered rules; STATUS.md stays the session handoff; plan files are kept as history. *So agent workflows can plan and review against cited rules.*
