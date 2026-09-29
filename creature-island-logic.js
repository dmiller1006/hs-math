// Creature Island logic: clearing layout, walkable grid, routes, movement, and picnic quest state.
// No DOM access here, so every rule can be checked on its own.
(function (root) {
  'use strict';

  // World units: the island clearing is drawn in a 1000 × 700 SVG viewBox.
  const WORLD = { w: 1000, h: 700 };
  const CELL = 20;
  const COLS = WORLD.w / CELL;
  const ROWS = WORLD.h / CELL;
  const PLAYER_R = 16;
  const SHORE_MARGIN = 24;

  const ISLAND = { x: 505, y: 372, rx: 440, ry: 290 };
  const shoreScale = t => 1 + .045 * Math.sin(3 * t + 2.2) + .03 * Math.sin(5 * t + .4) + .018 * Math.sin(8 * t + 1.1);
  const baseRadius = t => Math.hypot(ISLAND.rx * Math.cos(t), ISLAND.ry * Math.sin(t));

  // A point on the shoreline, pulled inland by `inset` world units.
  function shorePoint(t, inset = 0) {
    const r = shoreScale(t) - inset / baseRadius(t);
    return { x: ISLAND.x + ISLAND.rx * r * Math.cos(t), y: ISLAND.y + ISLAND.ry * r * Math.sin(t) };
  }
  function onIsland(p, inset = 0) {
    const nx = (p.x - ISLAND.x) / ISLAND.rx, ny = (p.y - ISLAND.y) / ISLAND.ry;
    const t = Math.atan2(ny, nx);
    return Math.hypot(nx, ny) < shoreScale(t) - inset / baseRadius(t);
  }

  // Everything the character can bump into. `r` is the solid footprint at ground level.
  const PONDS = [{ x: 505, y: 338, rx: 112, ry: 54 }];
  const TREES = [
    { id: 'tree-1', x: 300, y: 214, r: 26, size: 1 },
    { id: 'tree-2', x: 738, y: 176, r: 26, size: 1.1 },
    { id: 'tree-3', x: 150, y: 470, r: 24, size: .9 },
    { id: 'tree-4', x: 842, y: 512, r: 24, size: .95 },
    { id: 'tree-5', x: 408, y: 118, r: 22, size: .85 }
  ];
  const ROCKS = [
    { id: 'rock-1', x: 262, y: 372, r: 30, size: 1.1 },
    { id: 'rock-2', x: 706, y: 334, r: 26, size: 1 },
    { id: 'rock-3', x: 432, y: 470, r: 20, size: .75 }
  ];
  // Berry bushes in the order levels add them: level N uses the first N + 2 (up to ten).
  const ALL_PLANTS = [
    { id: 'plant-a', x: 172, y: 300, r: 18 },
    { id: 'plant-b', x: 560, y: 152, r: 18 },
    { id: 'plant-c', x: 858, y: 330, r: 18 },
    { id: 'plant-d', x: 262, y: 580, r: 18 },
    { id: 'plant-e', x: 628, y: 250, r: 18 },
    { id: 'plant-f', x: 356, y: 420, r: 18 },
    { id: 'plant-g', x: 780, y: 410, r: 18 },
    { id: 'plant-h', x: 440, y: 600, r: 18 },
    { id: 'plant-i', x: 596, y: 450, r: 18 },
    { id: 'plant-j', x: 470, y: 228, r: 18 }
  ];
  const MIN_BERRIES = 3;
  const MAX_BERRIES = ALL_PLANTS.length;
  const berriesForLevel = level => Math.min(MAX_BERRIES, MIN_BERRIES + Math.max(1, Math.floor(level) || 1) - 1);
  const PLANTS = [];
  const BASKET = { id: 'basket', x: 604, y: 572, r: 18 };
  const PICNIC = { id: 'picnic', x: 560, y: 588 };
  const START = { x: 356, y: 560 };
  const CREATURE_HOME = { x: 712, y: 556 };
  const SIT_SPOT = { x: 540, y: 600 };

  // Tap targets: `hx, hy` is the visual centre and `hit` the forgiving tap radius.
  // `reach` is how close the character's feet must be to interact.
  const plantTarget = p => ({ id: p.id, kind: 'plant', x: p.x, y: p.y, hx: p.x, hy: p.y - 22, hit: 62, reach: 60 });
  const TARGETS = [];
  const FIXED_TARGETS = [
    { id: 'picnic', kind: 'picnic', x: PICNIC.x, y: PICNIC.y, hx: 574, hy: 580, hit: 66, reach: 76 },
    { id: 'creature', kind: 'creature', x: CREATURE_HOME.x, y: CREATURE_HOME.y, hx: CREATURE_HOME.x, hy: CREATURE_HOME.y - 30, hit: 58, reach: 70 },
    ...TREES.map(t => ({ id: t.id, kind: 'tree', x: t.x, y: t.y, hx: t.x, hy: t.y - 70 * t.size, hit: 52 * t.size, reach: t.r + 44 })),
    ...ROCKS.map(r => ({ id: r.id, kind: 'rock', x: r.x, y: r.y, hx: r.x, hy: r.y - 14, hit: Math.max(40, r.r + 16), reach: r.r + 44 }))
  ];
  const SOLIDS = [];

  // `slack` shrinks every solid, for checks that tolerate a little visual overlap.
  function isClear(p, slack = 0) {
    if (!onIsland(p, SHORE_MARGIN - slack)) return false;
    for (const w of PONDS) {
      const nx = (p.x - w.x) / (w.rx + PLAYER_R - slack), ny = (p.y - w.y) / (w.ry + PLAYER_R - slack);
      if (nx * nx + ny * ny < 1) return false;
    }
    for (const s of SOLIDS) if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + PLAYER_R - slack) return false;
    return true;
  }

  // ---------- Walkable grid ----------
  const centerOf = i => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });
  const cellOf = p => {
    const c = Math.floor(p.x / CELL), r = Math.floor(p.y / CELL);
    return c < 0 || r < 0 || c >= COLS || r >= ROWS ? -1 : r * COLS + c;
  };
  const walkable = new Uint8Array(COLS * ROWS);

  // Choose the active bushes for a berry count and rebuild solids, tap targets, and the walkable grid.
  // The shared arrays are refilled in place so every reader sees the current level.
  function configure(berries) {
    const count = Math.max(1, Math.min(MAX_BERRIES, berries));
    PLANTS.length = 0; PLANTS.push(...ALL_PLANTS.slice(0, count));
    SOLIDS.length = 0; SOLIDS.push(...TREES, ...ROCKS, ...PLANTS, BASKET);
    TARGETS.length = 0; TARGETS.push(...PLANTS.map(plantTarget), ...FIXED_TARGETS);
    for (let i = 0; i < walkable.length; i++) walkable[i] = isClear(centerOf(i)) ? 1 : 0;
    return count;
  }
  configure(MIN_BERRIES);

  const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

  // Shortest grid distances from one cell. Diagonals never squeeze between two blocked cells.
  function distancesFrom(start) {
    const dist = new Float64Array(COLS * ROWS).fill(Infinity);
    const prev = new Int32Array(COLS * ROWS).fill(-1);
    const done = new Uint8Array(COLS * ROWS);
    dist[start] = 0;
    const heap = [[0, start]];
    const push = item => {
      heap.push(item);
      for (let k = heap.length - 1; k > 0;) {
        const parent = (k - 1) >> 1;
        if (heap[parent][0] <= heap[k][0]) break;
        [heap[parent], heap[k]] = [heap[k], heap[parent]]; k = parent;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let k = 0; ;) {
          const a = 2 * k + 1, b = a + 1;
          let m = k;
          if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
          if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
        }
      }
      return top;
    };
    while (heap.length) {
      const [d, i] = pop();
      if (done[i]) continue;
      done[i] = 1;
      const c = i % COLS, r = Math.floor(i / COLS);
      for (const [dc, dr, cost] of STEPS) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const j = nr * COLS + nc;
        if (!walkable[j]) continue;
        if (dc && dr && (!walkable[r * COLS + nc] || !walkable[nr * COLS + c])) continue;
        const nd = d + cost;
        if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push([nd, j]); }
      }
    }
    return { dist, prev };
  }

  function nearestWalkable(p, accept = () => true) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < walkable.length; i++) {
      if (!walkable[i] || !accept(i)) continue;
      const c = centerOf(i), d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }
  const startCell = p => { const i = cellOf(p); return i >= 0 && walkable[i] ? i : nearestWalkable(p); };

  function lineClear(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
    for (let k = 1; k < n; k++) if (!isClear({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n })) return false;
    return true;
  }
  // Pull the grid route tight wherever a straight line stays clear.
  function tighten(points) {
    if (points.length <= 2) return points;
    const out = [points[0]];
    for (let i = 0; i < points.length - 1;) {
      let j = points.length - 1;
      while (j > i + 1 && !lineClear(points[i], points[j])) j--;
      out.push(points[j]);
      i = j;
    }
    return out;
  }
  function routeTo(from, grid, start, goal, end) {
    const cells = [];
    for (let i = goal; i !== -1 && i !== start; i = grid.prev[i]) cells.push(i);
    const points = [{ x: from.x, y: from.y }, ...cells.reverse().map(centerOf)];
    if (end && (points.length === 1 || lineClear(points[points.length - 1], end))) points.push(end);
    return tighten(points.filter((p, k) => k === 0 || Math.hypot(p.x - points[k - 1].x, p.y - points[k - 1].y) > .5));
  }

  const finish = (points, adjusted) => ({ points, end: points[points.length - 1], adjusted });

  // Walk toward a tapped point. Water, rocks, and open sea choose the closest reachable ground instead.
  function planToPoint(from, target) {
    const start = startCell(from);
    const grid = distancesFrom(start);
    const tapped = cellOf(target);
    if (tapped >= 0 && isFinite(grid.dist[tapped]) && isClear(target)) {
      return finish(routeTo(from, grid, start, tapped, { x: target.x, y: target.y }), false);
    }
    const goal = nearestWalkable(target, i => isFinite(grid.dist[i]));
    return finish(routeTo(from, grid, start, goal, null), true);
  }

  // Walk within reach of a target, arriving from whichever side is quickest.
  function planToObject(from, target) {
    const reach = target.reach - 4;
    if (Math.hypot(from.x - target.x, from.y - target.y) <= reach) return finish([{ x: from.x, y: from.y }], false);
    const start = startCell(from);
    const grid = distancesFrom(start);
    let goal = -1, best = Infinity;
    for (let i = 0; i < walkable.length; i++) {
      if (!isFinite(grid.dist[i])) continue;
      const c = centerOf(i), d = Math.hypot(c.x - target.x, c.y - target.y);
      if (d > reach) continue;
      const score = grid.dist[i] + d / CELL * .15;
      if (score < best) { best = score; goal = i; }
    }
    if (goal < 0) goal = nearestWalkable(target, i => isFinite(grid.dist[i]));
    return finish(routeTo(from, grid, start, goal, null), false);
  }

  // ---------- Movement ----------
  function createMover(pos) { return { x: pos.x, y: pos.y, points: [], next: 0, moving: false, heading: 1 }; }
  function setRoute(mover, points) {
    mover.points = points; mover.next = 1;
    mover.moving = points.length > 1;
  }
  function stop(mover) { mover.points = []; mover.next = 0; mover.moving = false; }
  // Advance along the route by `dist` world units. Returns true on the step that arrives.
  function advance(mover, dist) {
    if (!mover.moving) return false;
    while (dist > 0 && mover.next < mover.points.length) {
      const p = mover.points[mover.next];
      const dx = p.x - mover.x, dy = p.y - mover.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > .5) mover.heading = dx > 0 ? 1 : -1;
      if (d <= dist) { mover.x = p.x; mover.y = p.y; dist -= d; mover.next++; }
      else { mover.x += dx / d * dist; mover.y += dy / d * dist; dist = 0; }
    }
    if (mover.next >= mover.points.length) { mover.moving = false; return true; }
    return false;
  }

  // ---------- Picnic quest: the single source for berries, basket slots, and completion ----------
  function createQuest(plantIds = PLANTS.map(p => p.id), need = plantIds.length) {
    return { need, plants: plantIds.slice(), picked: [], completed: false };
  }
  function pick(quest, plantId) {
    if (!quest.plants.includes(plantId)) return 'none';
    if (quest.picked.includes(plantId)) return 'empty';
    quest.picked.push(plantId);
    return 'picked';
  }
  // Early delivery keeps every berry; completion happens exactly once.
  function deliver(quest) {
    if (quest.completed) return 'done';
    if (quest.picked.length < quest.need) return 'partial';
    quest.completed = true;
    return 'complete';
  }
  const basketSlots = quest => Array.from({ length: quest.need }, (_, i) => i < quest.picked.length);
  const hasBerry = (quest, plantId) => quest.plants.includes(plantId) && !quest.picked.includes(plantId);

  root.CreatureIslandLogic = {
    WORLD, CELL, COLS, ROWS, PLAYER_R, ISLAND, PONDS, TREES, ROCKS, PLANTS, ALL_PLANTS, BASKET,
    MIN_BERRIES, MAX_BERRIES, berriesForLevel, configure, plantTarget, PICNIC, START, CREATURE_HOME, SIT_SPOT, TARGETS,
    shorePoint, onIsland, isClear, lineClear, walkable, cellOf, centerOf, distancesFrom, startCell,
    planToPoint, planToObject, createMover, setRoute, stop, advance,
    createQuest, pick, deliver, basketSlots, hasBerry
  };
})(typeof window !== 'undefined' ? window : globalThis);
