# FUN area: Cosmic Rally implementation brief

Status: Claude built the complete five-station course and FUN gate. Codex remains the orchestrator and reviewer. The owner authorized deployment after verification; physical iPad playtesting remains outstanding. Future changes still require a written brief.

## Product goal

Add a passcode-gated FUN destination alongside 2025 and 2026. Offer visually exciting math play for a kindergarten child who has little video-game experience and uses an iPad. The child should make meaningful choices without needing steering accuracy, reaction speed, dragging precision, or simultaneous inputs.

Keep the existing screenshot-to-lesson workflow and practice lessons intact. FUN is a separate mode, not a replacement for them.

## Selected game: Cosmic Rally

An automatically driven car travels through a silly space course. Math powers a booster, builds a ramp, and opens a tunnel. The child chooses the car and route, then taps large controls to trigger the resulting spectacle.

Build one complete, roughly 3–5 minute course with five math encounters. Duration is descriptive, never a countdown. Use one imaginative setting with a few memorable effects, rather than many unfinished worlds.

1. Choose between three car colors and tap Go.
2. The car drives automatically through a short animated stretch.
3. It arrives at an interactive part of the world, such as a booster station. Movement settles before the child answers.
4. A visible ten-slot battery already has four charges. The equation reads `4 + ? = 10`, matching the picture's left-to-right order. The child chooses how many more charges it needs.
5. On success, charges visibly fill the empty slots. A large Boost button lets the child launch a short, satisfying sequence: a loop, a moon jump, or a rainbow tunnel.
6. Repeat with varied values and scenery actions. Finish after five encounters with a trophy, Replay, and Back to FUN.

Use five distinct starting charges per run, from 0–9 only; never ask an already-full battery. Zero starting charges is allowed. A number-pad tap submits the answer immediately; there are no Check or Clear buttons. Ignore repeat taps during feedback and transitions.

Start with the current make-ten skill. Varied arithmetic or new skills can follow once the owner approves the initial play loop. Do not introduce multiplication, negative numbers, reading-heavy instructions, or unrequested difficulty increases.

At a route fork, both routes are safe. A large left or right choice changes the scenery; there is no late choice or wrong lane. Route selection waits indefinitely. A wrong math answer keeps the child at the activity and gently offers another try. After two attempts, show a concrete visual hint. Do not remove progress, crash the car, or label the child as losing.

## Controls and presentation

- No tilt steering, joystick, required dragging, rapid tapping, or timed answers.
- Large single-tap targets; use at least 64 CSS pixels for primary game controls, with generous spacing.
- Keep the child in control of the big payoff through a Boost/Launch button, car choice, and occasional route choice.
- Integrate the math objects into the scene. Avoid a conventional worksheet modal placed over a continuously running race.
- Keep counts visually stable while answering; pause distracting motion around the math area.
- Minimal text, familiar quantities, clear selected answers, and an obvious way back.
- Use short optional sound effects, background music with its own toggle, a master mute that also silences music, and reduced-motion support. The game must remain understandable with sound off.
- Pause on backgrounding, navigation away, or a pause action; resume without advancing questions or accumulating animation time.
- Fit iPad portrait and landscape layouts, including safe areas in Home Screen mode.

## FUN gate

- Show FUN in both the home tabs and hamburger menu.
- Require a four-digit parent passcode before displaying playable content.
- Treat this as a parent convenience gate on a static site, not account authentication or protection of sensitive information.
- Shared code: **1234**, selected by the owner. Keep it in one clearly named configuration constant, used by every gate. The same code works on all devices; changing it means changing that constant and deploying.
- No account, first-run setup, recovery flow, or per-device code storage. Do not display the code in the child-facing interface.
- Unlock lifetime: current tab session, with an explicit Lock FUN action and relocking after 15 minutes of inactivity. Use session storage and wall-clock time; recheck on resume. A refresh may preserve a still-valid unlock. An expired unlock must require the code even if the browser restores a session.
- Gate direct game URLs as well as the FUN tab. Cancel returns to the previous home tab (2025 if there is no previous tab). Check the gate before showing playable content on reload, Back, or PWA launch.

## Implementation boundaries for Claude

Read AGENTS.md and STATUS.md and inspect the working tree before editing. Preserve unrelated changes, including the pre-existing untracked AGENTS.md. Do not commit or push unless explicitly instructed.

Keep the static deployment model. Plain JavaScript is sufficient for the first prototype. Use DOM controls for math, navigation, and accessibility; canvas or SVG may render the game scene if useful. Avoid adding a package manager, large game engine, backend, accounts, or build pipeline for this prototype.

Give the game its own files and lifecycle. Reuse the site's theme, navigation conventions, and reload behavior. Keep problem generation and answer validation separate from scene animation. Use one problem object as the source for the picture, equation, expected answer, and hint. Avoid copying the entire lesson runner or extensively refactoring existing exercises just to share small pieces of logic.

## Implemented scope and ownership

- `cosmic-rally.html`, `cosmic-rally.css`, and `cosmic-rally.js`: game scene, controls, five-station course, safe Crystal/Candy fork after station two, trophy, and replay.
- `cosmic-rally-logic.js`: make-ten problem generation and answer validation.
- `fun-gate.js`: shared child lock, session lifetime, expiry, and cancel behavior.
- Home integration is in `index.html`, `site.js`, and `site.css`.
- Payoffs are moon jump, rainbow tunnel, loop, tunnel, moon jump. All movement uses a pausable game clock; calm mode uses fades.
- Local testing aids: `?charges=4,0,9` fixes initial charges and `?speed=4` accelerates the game clock.
- Codex reviews integration and verification; the owner checks real iPad playability, audio/music, silent-switch behavior, Home Screen safe areas, and the child lock.
- `PRESCHOOL-APP-PLAN.md` is unrelated owner work. Leave it untouched and out of this deployment.

## Acceptance checks

- Every generated math problem agrees with its objects, input positions, expected answer, and hint; cover starting charges 0 and 9 as well as ordinary values, answers 10 and 1, and rejection of a forced full-battery question.
- Wrong answers do not advance; hints work; correct answers advance once even after rapid double taps.
- Five encounters lead to one finish screen; Replay starts a clean run with no duplicate timers, sound, or event listeners.
- Automatic driving never requires a corrective touch; every required choice waits for the child.
- Lock, unlock, wrong code, direct URLs, reload, Back, and background/resume follow the agreed gate behavior.
- Portrait and landscape remain usable on iPad; controls fit without overlap, page zoom, or accidental scrolling during play.
- Existing 2025/2026 navigation, lessons, themes, PWA launch, and Reload app still work.

Use focused logic checks and a browser walkthrough, followed by actual iPad play. A swarm of agents is not needed for this first game. One builder and one reviewer are enough.

## Verification record (2026-09-27)

Codex reran the browser harness: 252 checks passed. Two music checks using scripted clicks failed under browser autoplay restrictions; both passed in a separate test with real browser taps. Music-off and master mute also passed. Logic checks passed for every starting charge 0–9 and 3,000 random generations; JavaScript syntax and diff checks passed. The four final fixes were checked through the harness and direct browser inspection: tunnel/loop spacing, Back closing the gate, drawer closing before the gate, and paused keyboard inputs. Six iPad viewport sizes were exercised; this is not a physical iPad test.
