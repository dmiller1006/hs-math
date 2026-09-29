// Creature Island self-checks. Loaded only by creature-island.html?test=1; results go to #test-results and the page title.
(() => {
  const T = window.CreatureIslandTest, L = T.L;
  const lines = [];
  let failed = 0, passed = 0;
  const check = (name, ok, detail = '') => {
    lines.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    ok ? passed++ : failed++;
  };
  const P = () => T.player.mover;
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const walk = (max = 20000) => { let t = 0; while (P().moving && t < max) { T.step(16); t += 16; } T.step(48); return t; };
  const target = id => L.TARGETS.find(t => t.id === id);
  const tapTarget = id => { const t = target(id); T.tap({ x: t.hx, y: t.hy }); };
  const fullSlots = () => document.querySelectorAll('#meter-slots .meter-slot.full').length;
  const fruitShown = id => T.nodes.plants[id].fruit.style.display !== 'none';
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const randomClear = () => { for (;;) { const p = { x: rand() * 1000, y: rand() * 700 }; if (L.isClear(p)) return p; } };
  // Every point along a route keeps the explorer out of water and solids (6 units of drawing slack).
  const routeClear = points => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], n = Math.max(1, Math.ceil(d(a, b) / 3));
      for (let k = 0; k <= n; k++) if (!L.isClear({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n }, 6)) return false;
    }
    return true;
  };
  const screenOf = p => { const pt = T.stage.createSVGPoint(); pt.x = p.x; pt.y = p.y; return pt.matrixTransform(T.stage.getScreenCTM()); };
  const pointerTap = p => {
    const s = screenOf(p);
    T.stage.dispatchEvent(new PointerEvent('pointerdown', { clientX: s.x, clientY: s.y, isPrimary: true, bubbles: true, cancelable: true, pointerType: 'touch' }));
  };

  try {
    // ---------- Layout ----------
    const walkable = [...L.walkable].filter(Boolean).length;
    const grid = L.distancesFrom(L.startCell(L.START));
    const reached = [...grid.dist].filter(isFinite).length;
    check('every walkable cell is reachable from the start', reached === walkable, `${reached}/${walkable} cells`);
    check('start, creature home, and sit spot are clear', [L.START, L.CREATURE_HOME, L.SIT_SPOT].every(p => L.isClear(p)));
    for (const t of L.TARGETS.filter(t => ['plant', 'picnic', 'creature'].includes(t.kind))) {
      const plan = L.planToObject(L.START, t);
      check(`${t.id} can be reached from the start`, d(plan.end, t) <= t.reach && routeClear(plan.points), `ends ${d(plan.end, t).toFixed(0)} from it`);
    }
    const scale = T.stage.getScreenCTM().a;
    let hitsOk = true, sizeNote = [];
    for (const t of L.TARGETS) {
      if (T.targetAt({ x: t.hx, y: t.hy })?.id !== t.id) { hitsOk = false; sizeNote.push(`${t.id} centre`); }
      if (['plant', 'picnic', 'creature'].includes(t.kind)) {
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2, p = { x: t.hx + Math.cos(a) * t.hit * .7, y: t.hy + Math.sin(a) * t.hit * .7 };
          if (T.targetAt(p)?.id !== t.id) { hitsOk = false; sizeNote.push(`${t.id} edge ${k}`); }
        }
      }
    }
    check('each tap target owns its centre, and quest targets own 70% of their radius', hitsOk, sizeNote.join(', '));
    const smallest = Math.min(...L.TARGETS.filter(t => ['plant', 'picnic', 'creature'].includes(t.kind)).map(t => t.hit * 2 * scale));
    check('quest tap targets are at least 64 CSS px across at this size', smallest >= 64, `${innerWidth}×${innerHeight}, smallest ${smallest.toFixed(0)} px`);
    const bar = document.querySelector('.island-bar').getBoundingClientRect();
    const controls = [...document.querySelectorAll('.island-bar a, .island-bar button:not([hidden])')].map(n => n.getBoundingClientRect());
    check('top bar controls fit without horizontal scroll', document.documentElement.scrollWidth <= innerWidth && controls.every(r => r.right <= bar.right + .5 && r.height >= 56 && r.width >= 52));
    const visible = L.TARGETS.every(t => { const s = screenOf({ x: t.hx, y: t.hy }); return s.x > 0 && s.x < innerWidth && s.y > bar.bottom && s.y < innerHeight; });
    check('every tap target is on screen below the bar', visible);

    // ---------- Routing ----------
    let bad = 0;
    for (let k = 0; k < 400; k++) {
      const a = randomClear(), b = { x: rand() * 1100 - 50, y: rand() * 800 - 50 };
      const plan = L.planToPoint(a, b);
      if (!routeClear(plan.points) || !L.isClear(plan.end) || (!plan.adjusted && d(plan.end, b) > .5)) bad++;
    }
    check('400 random routes stay clear and end where planned', bad === 0, `${bad} bad`);

    T.play(1);
    const ground = { x: 300, y: 580 };
    check('ground probe is clear', L.isClear(ground));
    T.tap(ground);
    check('a ground tap shows the marker immediately', T.marker.at === T.clock);
    walk();
    check('ground tap walks exactly to the tapped point', d(P(), ground) < .5, `${d(P(), ground).toFixed(2)} away`);

    const pondCentre = L.PONDS[0];
    T.tap(pondCentre);
    const pondPlanEnd = walk() && { x: P().x, y: P().y };
    check('a pond tap stops on dry ground at the water’s edge', L.isClear(P()) && d(P(), pondCentre) < 140 && !P().moving && !T.pending);
    T.tap({ x: -120, y: 360 });
    walk();
    check('a sea tap walks to the nearest shore', L.isClear(P()) && P().x < 140);
    T.tap({ x: 2200, y: 2400 });
    walk();
    check('a far-off tap (letterbox) still lands on the island', L.isClear(P()));
    tapTarget('tree-1');
    walk();
    const tree = L.TREES[0];
    check('a tree tap walks beside the tree, not into it', d(P(), tree) <= target('tree-1').reach && d(P(), tree) >= tree.r + L.PLAYER_R - .5);

    const hops = [];
    for (let k = 0; k < 12; k++) { const p = randomClear(); hops.push(p); T.tap(p); T.step(32); }
    walk();
    check('rapid destination changes end at the last tap only', d(P(), hops[hops.length - 1]) < .5 && !T.pending);

    // ---------- Quest ----------
    T.play(1);
    tapTarget('plant-a');
    check('an object tap marks the object and sets it pending', T.pending?.id === 'plant-a' && T.marker.at === T.clock);
    walk();
    check('walking to a plant collects exactly one berry on arrival', T.quest.picked.join() === 'plant-a' && fullSlots() === 1 && !fruitShown('plant-a'));
    check('the explorer is within reach when it collects', d(P(), L.PLANTS[0]) <= target('plant-a').reach);
    tapTarget('plant-a'); walk();
    tapTarget('plant-a'); walk();
    check('a picked plant never gives a second berry', T.quest.picked.length === 1 && fullSlots() === 1);

    tapTarget('plant-c');
    T.step(500);
    T.tap({ x: 330, y: 610 });
    walk();
    T.step(3000);
    check('cancelling an approach never collects from a distance', T.quest.picked.length === 1 && fruitShown('plant-c'));
    tapTarget('plant-c');
    T.step(300);
    tapTarget('plant-b');
    walk();
    check('switching objects mid-walk only collects the new one', T.quest.picked.join() === 'plant-a,plant-b' && fruitShown('plant-c'));

    // Walk past plant C on the way somewhere else: no pickup without a request.
    const pastC = { x: 870, y: 410 };
    check('probe beyond plant C is clear', L.isClear(pastC));
    T.tap(pastC); walk();
    check('walking past a plant does not collect it', T.quest.picked.length === 2 && fruitShown('plant-c'));

    tapTarget('picnic'); walk();
    check('early delivery keeps the berries and shows empty slots', T.quest.picked.length === 2 && !T.quest.completed && fullSlots() === 2 && document.querySelectorAll('.meter-slot.wanted').length === 1);
    T.step(300);
    check('early delivery brings up the creature’s wish bubble', T.bubble.show > .5);
    check('no completion before three berries', T.completions === 0);

    tapTarget('plant-c'); walk();
    check('third berry fills the third slot', T.quest.picked.length === 3 && fullSlots() === 3);
    tapTarget('picnic'); walk();
    check('delivering three berries completes the picnic', T.quest.completed && T.completions === 1 && T.phase === 'done');
    tapTarget('picnic'); walk();
    tapTarget('picnic'); walk();
    check('completion happens only once', T.completions === 1);

    T.step(6500);
    check('the creature sits, then becomes a companion', T.creature.mode === 'follow');
    check('a Next level button appears after the picnic', !document.getElementById('next-float').hidden);
    let followClear = true, farthest = 0;
    const far = { x: 190, y: 190 };
    T.tap(far);
    for (let t = 0; t < 9000; t += 16) {
      T.step(16);
      if (!L.isClear(T.creature, 8)) followClear = false;
    }
    farthest = d(T.creature, P());
    check('the companion follows without crossing water or solids', followClear);
    check('the companion catches up and waits nearby', farthest < 110 && farthest > 40, `${farthest.toFixed(0)} away`);
    const tapsBefore = T.tapsHandled;
    T.tap({ x: T.creature.x, y: T.creature.y - 30 });
    check('tapping the companion targets it', T.pending?.id === 'creature');
    walk();
    check('a companion tap resolves and clears the pending target', !T.pending && T.tapsHandled === tapsBefore + 1);

    // ---------- Pause and background ----------
    T.tap({ x: 820, y: 600 });
    T.step(200);
    T.setPaused(true);
    const frozen = { x: P().x, y: P().y }, clockFrozen = T.clock;
    T.frame(10000); T.frame(11000); T.frame(15000);
    const tapsPaused = T.tapsHandled;
    T.tap({ x: 300, y: 600 });
    check('pause freezes movement and the game clock', d(P(), frozen) === 0 && T.clock === clockFrozen);
    check('taps are ignored while paused', T.tapsHandled === tapsPaused);
    T.setPaused(false);
    T.frame(60000); T.frame(60016);
    check('resume continues without teleporting', d(P(), frozen) <= 250 * .016 + .01, `${d(P(), frozen).toFixed(2)} units`);

    T.play(1);
    tapTarget('plant-b');
    T.step(200);
    const hiddenDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
    check('backgrounding pauses the game', T.paused && !document.getElementById('pause-screen').hidden && !!hiddenDesc);
    for (let t = 0; t < 30; t++) T.frame(100000 + t * 1000);
    check('a queued interaction does not complete while hidden', T.quest.picked.length === 0 && T.pending?.id === 'plant-b');
    T.setPaused(false);
    walk();
    check('after resuming, the walk finishes and then collects', T.quest.picked.join() === 'plant-b');

    // ---------- Replay ----------
    const spriteCount = T.layers.sprites.childElementCount;
    T.play(1);
    check('replay resets berries, basket, and progress', T.quest.picked.length === 0 && !T.quest.completed && fullSlots() === 0 && L.PLANTS.every(p => fruitShown(p.id)));
    check('replay resets the explorer and creature', d(P(), L.START) === 0 && !P().moving && T.creature.mode === 'home' && d(T.creature, L.CREATURE_HOME) === 0 && !T.pending);
    check('replay clears effects without duplicating scenery', T.particles === 0 && T.layers.sprites.childElementCount === spriteCount && T.layers.fx.childElementCount === 5 && T.layers.marks.childElementCount === T.flowers.length + 1 && document.getElementById('next-float').hidden);
    const before = T.tapsHandled;
    pointerTap({ x: 330, y: 600 });
    check('one real pointer tap is handled exactly once after replay', T.tapsHandled === before + 1 && T.loopsStarted === 1);
    walk();
    check('pointer taps map screen to world coordinates', d(P(), { x: 330, y: 600 }) < 2, `${d(P(), { x: 330, y: 600 }).toFixed(2)} away`);
    for (const id of ['plant-a', 'plant-b', 'plant-c', 'picnic']) { tapTarget(id); walk(); }
    check('a second run completes cleanly, once', T.quest.completed && T.completions === 2);

    // ---------- Levels ----------
    const S = window.StarTickets, G = window.FunGate;
    const $ = id => document.getElementById(id);
    const click = id => $(id).click();
    const shown = id => !$(id).hidden;
    const finishLevel = () => { for (const p of [...L.PLANTS]) { tapTarget(p.id); walk(); } tapTarget('picnic'); walk(); };
    check('level berries: 1→3, 2→4, 8→10, 20→10', [1, 2, 8, 20].map(L.berriesForLevel).join() === '3,4,10,10');
    T.play(8);
    check('level 8 shows ten bushes', L.PLANTS.length === 10 && L.ALL_PLANTS.every(p => T.nodes.plants[p.id].node.style.display === ''));
    let ownAll = true, reachAll = true;
    for (const t of L.TARGETS) if (T.targetAt({ x: t.hx, y: t.hy })?.id !== t.id) { ownAll = false; lines.push(`     overlap: ${t.id}`); }
    for (const t of L.TARGETS.filter(t => t.kind === 'plant')) {
      const plan = L.planToObject(L.START, t);
      if (d(plan.end, t) > t.reach || !routeClear(plan.points)) { reachAll = false; lines.push(`     unreachable: ${t.id}`); }
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2, p = { x: t.hx + Math.cos(a) * t.hit * .7, y: t.hy + Math.sin(a) * t.hit * .7 };
        if (T.targetAt(p)?.id !== t.id) { ownAll = false; lines.push(`     ${t.id} edge ${k} → ${T.targetAt(p)?.id}`); break; }
      }
    }
    check('with ten bushes, every target owns its centre and bushes own 70% of their radius', ownAll);
    check('with ten bushes, every bush is reachable', reachAll);
    const walkableTen = [...L.walkable].filter(Boolean).length;
    const reachedTen = [...L.distancesFrom(L.startCell(L.START)).dist].filter(isFinite).length;
    const gridTen = L.distancesFrom(L.startCell(L.START));
    const stranded = [...L.walkable].map((w, i) => w && !isFinite(gridTen.dist[i]) ? L.centerOf(i) : null).filter(Boolean);
    check('with ten bushes, every walkable cell is still reachable', reachedTen === walkableTen, `${reachedTen}/${walkableTen} ${stranded.map(p => `(${p.x},${p.y})`).join(' ')}`);
    let badTen = 0;
    for (let k = 0; k < 200; k++) { const plan = L.planToPoint(randomClear(), randomClear()); if (!routeClear(plan.points)) badTen++; }
    check('with ten bushes, 200 random routes stay clear', badTen === 0, `${badTen} bad`);
    check('ten berries show as two rows of five', $('meter-slots').children.length === 10 && $('meter-slots').classList.contains('two-rows') && T.bubble.slots.length === 10);
    const bar8 = document.querySelector('.island-bar').getBoundingClientRect();
    check('the top bar still fits at ten berries', document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.island-bar > *')].every(n => n.getBoundingClientRect().right <= bar8.right + .5 && n.getBoundingClientRect().bottom <= bar8.bottom + .5));
    check('the ten-berry wish bubble fits inside the scene', T.bubble.w + 32 <= 1000);
    T.play(2);
    check('level 2 has four bushes, four slots, and a Level 2 badge', L.PLANTS.length === 4 && $('meter-slots').children.length === 4 && $('level-num').textContent === '2' && T.nodes.plants['plant-e'].node.style.display === 'none');
    for (const id of ['plant-a', 'plant-b', 'plant-c']) { tapTarget(id); walk(); }
    tapTarget('picnic'); walk();
    check('three berries are not enough on level 2', !T.quest.completed && T.quest.picked.length === 3);
    tapTarget('plant-d'); walk(); tapTarget('picnic'); walk();
    check('four berries complete level 2', T.quest.completed);

    // ---------- Star tickets ----------
    localStorage.removeItem('creature-island-level-test');
    check('the test jar starts empty', S.balance() === 0);
    T.openCard(1);
    check('the level card shows the level, its berries, and the ticket cost', shown('level-card') && $('card-level').textContent === '1' && $('card-berries').children.length === 3 && shown('play-cost'));
    T.tap({ x: 330, y: 600 });
    check('taps on the island wait while the level card is up', !P().moving);
    click('play');
    check('with no tickets, Play shows the empty jar and does not start', S.isShowingEmpty() && T.phase === 'card');
    document.querySelector('.ticket-back').click();
    check('Back closes the empty jar', !S.isShowingEmpty());
    check('a finished set earns one ticket', S.award('set-1') === true && S.balance() === 1);
    check('the same set never pays twice', S.award('set-1') === false && S.balance() === 1);
    click('play');
    check('Play spends one ticket and starts the level', T.phase === 'play' && S.balance() === 0 && S.activeRun('creature-island')?.level === 1 && !shown('level-card'));
    T.openCard(1);
    check('an unfinished level resumes free (as after a reload)', !shown('play-cost'));
    click('play');
    check('resuming does not spend a ticket', T.phase === 'play' && S.balance() === 0);
    tapTarget('plant-a'); walk();
    click('restart-level');
    check('Start over retries the level free', T.quest.picked.length === 0 && T.phase === 'play' && S.balance() === 0);
    finishLevel();
    check('finishing a level closes its run and unlocks the next', T.phase === 'done' && !S.activeRun('creature-island') && localStorage.getItem('creature-island-level-test') === '2');
    T.step(1500);
    click('next-float');
    check('Next level opens the level 2 card with its cost', T.phase === 'card' && T.level === 2 && $('card-berries').children.length === 4 && shown('play-cost'));
    click('play');
    check('no tickets for level 2 shows the empty jar', S.isShowingEmpty());
    document.querySelector('.ticket-free').click();
    const keys = [...document.querySelectorAll('.fun-gate-keys button')];
    ['9', '9', '9', '9'].forEach(k => keys.find(b => b.textContent === k).click());
    check('a wrong code does not turn on Free play', !S.isFreePlay() && !!document.querySelector('.fun-gate'));
    ['1', '2', '3', '4'].forEach(k => keys.find(b => b.textContent === k).click());
    check('the FUN code turns on Free play and closes the jar', S.isFreePlay() && !S.isShowingEmpty() && shown('free-tag') && !shown('play-cost'));
    click('play');
    check('Free play starts a level without spending', T.phase === 'play' && S.balance() === 0 && S.activeRun('creature-island')?.free === true);
    G.lock();
    check('locking FUN ends Free play', !S.isFreePlay());
    S.award('set-2'); S.award('set-3');
    check('tickets add up', S.balance() === 2);
    S.finishRun('creature-island');
    check('starting a run twice costs one ticket', !!S.startRun('cosmic-rally') && S.balance() === 1 && !!S.startRun('cosmic-rally') && S.balance() === 1);
    S.finishRun('cosmic-rally');
    check('after a finished run, the next one costs again', !!S.startRun('cosmic-rally') && S.balance() === 0 && S.startRun('creature-island', { level: 5 }) === null);
  } catch (error) {
    check('test run threw', false, error && error.stack || String(error));
  }

  const out = document.getElementById('test-results');
  out.hidden = false;
  out.textContent = `${failed ? 'FAIL' : 'PASS'} ${passed} passed, ${failed} failed\n` + lines.join('\n');
  document.title = failed ? `FAIL ${failed}` : `PASS ${passed}`;
})();
