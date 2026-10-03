# Practice: 2025 exercises and 2026 lessons

Status: Current
Source: `counting-circles.html`, `simple-math.html` (2025); `lessons.js`, `lesson.js`, `lesson.html`, `lesson.css` (2026).

## 2025 practice corner

Two older pages, each fully self-contained (inline HTML, CSS, JS). They are endless: a new problem appears two seconds after each correct answer. Each has Check and Clear buttons and a running score.

| Page | Skill | Settings |
| --- | --- | --- |
| `counting-circles.html` | Tap circles to color exactly N (10–20, or 10–30) | Up to 30; "in order" tapping |
| `simple-math.html` | Single-digit addition and subtraction | Mode: addition / subtraction / all; Easy / Medium / Hard |

- **PR-1** Both earn tickets through `StarTickets.practiceSet(activity)`, passing the number of wrong tries for the current problem (TIX-2, TIX-3).
- **PR-2** Leave these pages self-contained. Change them only for a specific request; they are not the model for new work.

## 2026 lessons

Lessons follow exercises in the child's physical workbook. They practice the same skill with fresh numbers rather than copying the workbook's questions.

### Catalog and runner

- `lessons.js` defines `window.mathLessons`: `{ id, title, description, skill }`. The home cards, drawer links, and runner all read this list.
- `lesson.html?lesson=<id>` loads the lesson. `lesson.js` looks up the `skill` definition and runs a set.

### Set rules

- **LES-1** A set is five questions. The `given` values are one endpoint (0 or 10, at random) plus four distinct values from 1–9, shuffled.
- **LES-2** The picture is a ten-frame. The equation is `[a] + [b] = 10`, in the same left-to-right order as the frame (UX-10).
- **LES-3** The number pad is 0–10. The child picks a blank, taps numbers, then taps Check. Clear empties the blanks.
- **LES-4** A wrong Check shows "Try again". After the second miss a Help button appears. Help makes frame cells tappable for counting, with running counts.
- **LES-5** A correct answer locks input, celebrates, and advances after two seconds. After question five, the finish screen shows the ticket result and an **Again** button that starts a fresh set.

### Skills

| Skill | Blanks | Tappable in hint | Example |
| --- | --- | --- | --- |
| `count-groups` | both (`given`, `10 − given`) | all cells | ●●●■■■■■■■ → `3 + 7 = 10` |
| `missing-addend` | second only | empty cells | ●●●○○○○○○○ → `3 + ? = 10` |

### Adding a lesson from a workbook screenshot

1. Identify the skill and visual structure. Ask the owner focused questions where the teaching intent is unclear.
2. If an existing skill fits, add a catalog entry to `lessons.js` and you're done.
3. Otherwise add the smallest new skill definition to `lesson.js`. Add only the new picture and answer shape it needs. Keep one problem object as the source for the picture, equation, answer, and hint (UX-11).
4. Verify alignment, correct and wrong answers, the hint, and the five-question finish ([testing.md](testing.md)).

- **LES-6** Grow the runner only from real workbook examples. Don't build a general lesson framework ahead of need.

## Open questions

- Should 2025 exercises move to five-question sets like lessons, which would make the ticket rule uniform?
