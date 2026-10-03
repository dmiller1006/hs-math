# FUN gate

Status: Current
Source: `fun-gate.js`; integration in `site.js`, `cosmic-rally.js`, `creature-island.js`, `tickets.js`.

## Purpose

A parent convenience lock that keeps the child from opening games without a grown-up. It is not security. The code ships in page source, and anyone reading it can get in. That is accepted (D-2).

## Rules

- **GATE-1** One shared four-digit code lives in `FUN_PASSCODE` in `fun-gate.js`. Every gate uses it. Changing it means editing that constant and deploying. Never show the code in child-facing UI.
- **GATE-2** An unlock lasts for the current tab session (`sessionStorage`). It ends after 15 minutes without a tap or key press, measured in wall-clock time, so a sleeping iPad counts as idle.
- **GATE-3** The unlock is checked before any playable content shows. This applies to the FUN tab, direct game URLs, reload, Back (bfcache `pageshow`), wake (`visibilitychange`), and a 20-second interval. Games pause while locked.
- **GATE-4** Cancel returns to the last non-FUN home tab (2025 if unknown). From a game URL it goes to `index.html#<tab>`.
- **GATE-5** **Lock FUN** (FUN tab and drawer) locks immediately. Locking also ends grown-up Free play.
- **GATE-6** A wrong code clears the entry, shakes the card, and lets the user try again. There is no lockout.
- **GATE-7** Activity refreshes the unlock at most every 5 seconds.

## API (`window.FunGate`)

`isUnlocked()`, `unlock(code)`, `lock()`, `prompt({ onUnlock, onCancel })`, `isPrompting()`, `dismiss()`, `watch(onExpire) → { refresh() }`, `rememberTab(tab)`, `previousTab()`, `IDLE_LIMIT_MS`.

## Open questions

- The code is still `1234`, which a child could guess. Pick a less obvious code? (Owner decision; GATE-1 makes the change one line.)
