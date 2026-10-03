# Child experience principles

Status: Current. These principles were collected from the owner's briefs and decisions; they apply to every page a child uses.

The player is a kindergarten child who reads very little and has little video-game experience. They play on an iPad, often alone. Every rule below exists so the child can succeed without help and never feels punished.

## Interaction

- **UX-1** Every control is a single tap. No dragging, multi-touch, tilting, rapid tapping, or precise timing.
- **UX-2** Primary game controls are at least 64 CSS pixels, and nearby targets are clearly separated. Practice buttons should be as large as the layout allows.
- **UX-3** Nothing is timed. Choices wait indefinitely. A duration may describe a game; it never counts down.
- **UX-4** Repeat taps during feedback or transitions are ignored. A double tap must never answer twice or skip ahead.
- **UX-5** `touch-action: manipulation` on interactive elements, and the page blocks double-tap and pinch zoom.
- **UX-6** Pages fit iPad portrait and landscape, including Home Screen safe areas, without horizontal scrolling.

## Feedback and mistakes

- **UX-7** A wrong answer keeps the child on the same problem with gentle words ("Try again"). There are no lives, lost progress, crashes, or "you lose".
- **UX-8** After two wrong tries, offer a concrete visual hint, such as counting the empty slots one by one.
- **UX-9** A correct answer gets a short celebration (sound and confetti), then advances automatically after about two seconds.
- **UX-10** The math picture and the equation read in the same left-to-right order. For example, 4 filled slots then 6 empty ones is written `4 + ? = 10`.
- **UX-11** One problem object drives the picture, the equation, the expected answer, and the hint, so they cannot disagree.

## Presentation

- **UX-12** Minimal text. Instructions are short and use pictures where possible. The game must stay understandable with sound off.
- **UX-13** Respect `prefers-reduced-motion`. Games also offer a calm-motion toggle where motion is heavy.
- **UX-14** Sound effects are short and optional. Music has its own toggle, and the master mute also silences music.
- **UX-15** Pause when the page is hidden or the iPad sleeps. Resume without skipping questions or jumping animations forward.
- **UX-16** Always offer an obvious way back to the menu (top-left).

## Motivation

- **UX-17** No streaks, expiring rewards, leaderboards, or loss-framed messages.
- **UX-18** Rewards come from finishing practice (see [star-tickets.md](star-tickets.md)), never from speed.
- **UX-19** Difficulty grows only when the owner asks. Do not add unrequested levels, operations, or number ranges.

## Review checklist

Use this when reviewing any child-facing change:

- [ ] Can it be done with single taps on big targets?
- [ ] Does a wrong answer stay put and stay kind? Does a hint appear after two misses?
- [ ] Do the picture, equation, and answer agree? Do they read left to right?
- [ ] Can a double tap skip, double-award, or double-charge anything?
- [ ] Does it work in portrait and landscape, with sound off and with reduced motion?
- [ ] Does it pause on background, and resume cleanly?
