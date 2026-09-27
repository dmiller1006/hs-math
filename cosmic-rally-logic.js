// Cosmic Rally math rules, kept apart from the scene so they can be checked alone.
// One problem object drives the battery picture, the equation, the answer, and the hint.
(root => {
  const TOTAL = 10;
  // Questions start with 0–9 charges; a battery that is already full is never asked.
  const MAX_GIVEN = TOTAL - 1;

  function makeProblem({ previousGiven = null, forcedGiven = null, random = Math.random } = {}) {
    let given;
    if (Number.isInteger(forcedGiven) && forcedGiven >= 0 && forcedGiven <= MAX_GIVEN) {
      given = forcedGiven;
    } else {
      // Every value from 0 to 9 is possible; a fresh run never repeats the last battery.
      const choices = [];
      for (let n = 0; n <= MAX_GIVEN; n++) if (n !== previousGiven) choices.push(n);
      given = choices[Math.floor(random() * choices.length)];
    }
    const answer = TOTAL - given;
    return {
      total: TOTAL,
      given,
      answer,
      // Battery reads left to right: charged slots first, then the empty ones.
      slots: Array.from({ length: TOTAL }, (_, i) => (i < given ? 'charged' : 'empty')),
      // Equation reads in the same order: given + ? = total.
      equation: [
        { kind: 'number', value: given },
        { kind: 'op', value: '+' },
        { kind: 'blank' },
        { kind: 'op', value: '=' },
        { kind: 'number', value: TOTAL }
      ],
      // The hint counts the empty slots, 1 up to the answer.
      hint: Array.from({ length: answer }, (_, i) => ({ slot: given + i, label: i + 1 }))
    };
  }

  // A course is five problems with different starting charges. Forced values (for testing) come first.
  function makeCourse({ count = 5, forced = [], random = Math.random } = {}) {
    const pool = [];
    for (let n = 0; n <= MAX_GIVEN; n++) pool.push(n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const givens = forced.filter(n => Number.isInteger(n) && n >= 0 && n <= MAX_GIVEN).slice(0, count);
    for (const n of pool) if (givens.length < count && !givens.includes(n)) givens.push(n);
    return givens.map(given => makeProblem({ forcedGiven: given }));
  }

  function checkAnswer(problem, value) {
    return Number.isInteger(value) && value === problem.answer;
  }

  const api = { TOTAL, MAX_GIVEN, COURSE_LENGTH: 5, makeProblem, makeCourse, checkAnswer, HINT_AFTER_MISSES: 2 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CosmicRallyLogic = api;
})(this);
