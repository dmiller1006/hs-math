(() => {
  'use strict';
  const L = window.CreatureIslandLogic;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const app = $('app');
  const stage = $('stage');
  const params = new URLSearchParams(location.search);
  // Testing aid: ?test=1 drives the clock by hand and runs the built-in checks.
  const TEST = params.has('test');

  const WALK_SPEED = 250;       // world units per second
  const FOLLOW_GAP = 72;        // how far the companion trails behind
  const IDLE_HINT_MS = 9000;
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp01 = u => Math.max(0, Math.min(1, u));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let calm = motionQuery.matches;
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', e => { calm = e.matches; });

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    if (attrs) for (const key in attrs) node.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(node);
    return node;
  }
  const at = (node, x, y, extra = '') => node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})${extra}`);
  // Seeded so scenery sits in the same place every visit.
  function seeded(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function berry(parent, x, y, scale = 1) {
    return el('use', { href: '#berry', x: x - 16 * scale, y: y - 20 * scale, width: 32 * scale, height: 36 * scale }, parent);
  }

  // ---------- Sound: short optional effects, no music ----------
  let audio = null, noiseBuffer = null;
  let soundOn = true;
  try { soundOn = localStorage.getItem('creature-island-sound') !== 'off'; } catch (_) {}
  function audioContext() {
    if (TEST || !soundOn) return null;
    if (!audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      try { audio = new Context(); } catch (_) { return null; }
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }
  function tone(freq, dur, { type = 'sine', gain = .1, delay = 0, to = 0 } = {}) {
    const a = audioContext();
    if (!a || paused) return;
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator(), amp = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    amp.gain.setValueAtTime(.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + .015);
    amp.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    osc.connect(amp).connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + .05);
  }
  function hiss(dur, { gain = .06, freq = 1200, q = .7, delay = 0 } = {}) {
    const a = audioContext();
    if (!a || paused) return;
    if (!noiseBuffer) {
      noiseBuffer = a.createBuffer(1, a.sampleRate * .6, a.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = a.currentTime + delay;
    const src = a.createBufferSource(), filter = a.createBiquadFilter(), amp = a.createGain();
    src.buffer = noiseBuffer; filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
    amp.gain.setValueAtTime(.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + .03);
    amp.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    src.connect(filter).connect(amp).connect(a.destination);
    src.start(t0); src.stop(t0 + dur + .05);
  }
  const PENTATONIC = [1047, 1175, 1319, 1568, 1760];
  const sfx = {
    tap: () => tone(760, .07, { type: 'triangle', gain: .045 }),
    soft: () => tone(360, .16, { gain: .05, to: 280 }),
    pick: () => { tone(880, .1, { type: 'triangle', gain: .1 }); tone(1320, .18, { type: 'triangle', gain: .09, delay: .08 }); },
    empty: () => hiss(.2, { gain: .04, freq: 900 }),
    rustle: () => hiss(.4, { gain: .06, freq: 2000, q: .5 }),
    tok: () => tone(190, .1, { type: 'triangle', gain: .08, to: 140 }),
    chirp: () => { tone(900, .1, { gain: .07, to: 1400 }); tone(1150, .09, { gain: .05, delay: .12, to: 1650 }); },
    partial: () => { tone(523, .16, { type: 'triangle', gain: .08 }); tone(440, .24, { type: 'triangle', gain: .07, delay: .15 }); },
    flower: () => tone(PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)], .14, { gain: .022 }),
    splash: () => hiss(.35, { gain: .05, freq: 650, q: .5 }),
    complete: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .24, { type: 'triangle', gain: .09, delay: i * .11 })),
    bird: () => { const b = 1900 + Math.random() * 500; tone(b, .07, { gain: .018, to: b * 1.3 }); tone(b * 1.08, .07, { gain: .015, delay: .11, to: b * 1.4 }); }
  };

  // ---------- Game clock: advances only while unpaused, so nothing jumps after a pause ----------
  let clock = 0, lastFrame = null, paused = false, tasks = [];
  let loopsStarted = 0, tapsHandled = 0;
  const after = (ms, fn) => tasks.push({ at: clock + ms, fn });

  // ---------- Static scenery ----------
  const layers = { sea: $('layer-sea'), ground: $('layer-ground'), marks: $('layer-marks'), sprites: $('layer-sprites'), fx: $('layer-fx'), bubble: $('layer-bubble') };
  function shorePath(inset) {
    const n = 140;
    let d = '';
    for (let k = 0; k < n; k++) {
      const p = L.shorePoint(k / n * Math.PI * 2, inset);
      d += (k ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    }
    return d + 'Z';
  }
  const random = seeded(7);
  function nearAnything(p, gap) {
    const everything = [...L.ALL_PLANTS.map(L.plantTarget), ...L.TARGETS.filter(t => t.kind !== 'plant')];
    if (everything.some(t => t.kind !== 'creature' && Math.hypot(p.x - t.x, p.y - t.y) < gap + (t.kind === 'tree' ? 22 : 0))) return true;
    if (dist(p, L.CREATURE_HOME) < gap || dist(p, L.START) < 30) return true;
    if (Math.abs(p.x - L.PICNIC.x) < 96 && Math.abs(p.y - L.PICNIC.y) < 58) return true;
    return L.PONDS.some(w => Math.hypot((p.x - w.x) / (w.rx + 26), (p.y - w.y) / (w.ry + 22)) < 1);
  }
  function scatter(count, inset, gap, tries = 3000) {
    const out = [];
    for (let k = 0; k < tries && out.length < count; k++) {
      const p = { x: 60 + random() * 880, y: 60 + random() * 600 };
      if (!L.onIsland(p, inset) || nearAnything(p, gap) || out.some(q => dist(p, q) < gap * .9)) continue;
      out.push(p);
    }
    return out;
  }

  function buildScenery() {
    for (let k = 0; k < 46; k++) {
      const x = -600 + random() * 2200, y = -500 + random() * 1700;
      if (L.onIsland({ x, y }, -40)) continue;
      el('path', { class: 'glint', d: `M${x.toFixed(0)} ${y.toFixed(0)}q10 -6 20 0`, stroke: '#e6fbff', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', style: `animation-delay:${(-random() * 4.8).toFixed(2)}s` }, layers.sea);
    }
    el('path', { d: shorePath(-34), fill: '#7fdcec', opacity: .7 }, layers.sea);
    el('path', { d: shorePath(-16), fill: '#b3eef2' }, layers.sea);
    el('path', { class: 'foam', d: shorePath(-5), fill: 'none', stroke: '#fff', 'stroke-width': 7, 'stroke-linejoin': 'round', opacity: .85 }, layers.sea);

    const g = layers.ground;
    el('path', { d: shorePath(0), fill: '#f6dea0' }, g);
    el('path', { d: shorePath(10), fill: '#f9e7b6' }, g);
    el('path', { d: shorePath(34), fill: '#5fae3f' }, g);
    el('path', { d: shorePath(38), fill: 'url(#grass-fill)' }, g);
    for (const p of scatter(10, 90, 70)) el('ellipse', { cx: p.x, cy: p.y, rx: 38 + random() * 30, ry: 16 + random() * 10, fill: random() < .5 ? '#8fdc62' : '#72c34c', opacity: .55 }, g);
    // A worn path from the picnic toward the pond.
    el('path', { d: 'M388 574 C430 548 470 540 520 560', stroke: '#c9d98a', 'stroke-width': 26, fill: 'none', 'stroke-linecap': 'round', opacity: .5 }, g);

    for (const w of L.PONDS) {
      el('ellipse', { cx: w.x, cy: w.y + 4, rx: w.rx + 12, ry: w.ry + 10, fill: '#d9c98c' }, g);
      el('ellipse', { cx: w.x, cy: w.y, rx: w.rx, ry: w.ry, fill: 'url(#pond-fill)' }, g);
      el('ellipse', { cx: w.x - 30, cy: w.y - 18, rx: w.rx * .45, ry: 7, fill: '#d8f7ff', opacity: .5 }, g);
      for (const [dx, dy, r] of [[-60, 14, 14], [48, -8, 12], [70, 22, 10]]) {
        const pad = el('g', { class: 'lily', style: `animation-delay:${(-random() * 7).toFixed(1)}s` }, g);
        el('path', { d: `M${w.x + dx} ${w.y + dy} m${r} 0 a${r} ${r * .6} 0 1 1 -${r * .4} -${r * .5} z`, fill: '#4caf50' }, pad);
        if (r > 12) el('circle', { cx: w.x + dx - 2, cy: w.y + dy - 2, r: 4, fill: '#ffc0d9' }, pad);
      }
    }
    pond.fish = el('g', { opacity: 0 }, g);
    el('path', { d: 'M-12 0 C-6 -8 8 -8 12 0 C8 8 -6 8 -12 0Z M-12 0 L-20 -7 L-20 7Z', fill: '#ff9f43' }, pond.fish);
    el('circle', { cx: 6, cy: -2, r: 1.8, fill: '#223' }, pond.fish);

    // Picnic blanket; the feast appears on it once the basket is full.
    const blanket = el('g', { transform: `translate(${L.PICNIC.x} ${L.PICNIC.y}) rotate(-6)` }, g);
    picnic.glow = el('ellipse', { cx: 0, cy: 0, rx: 104, ry: 56, fill: 'url(#cue-glow)', opacity: 0 }, blanket);
    el('rect', { x: -78, y: -36, width: 156, height: 72, rx: 10, fill: '#0002', transform: 'translate(4 5)' }, blanket);
    el('rect', { x: -78, y: -36, width: 156, height: 72, rx: 10, fill: 'url(#gingham)', stroke: '#f17b7b', 'stroke-width': 3 }, blanket);
    picnic.feast = el('g', { opacity: 0 }, blanket);
    el('ellipse', { cx: -30, cy: 4, rx: 30, ry: 13, fill: '#fff', stroke: '#dfe6f0', 'stroke-width': 3 }, picnic.feast);
    picnic.feastBerries = [berry(picnic.feast, -46, 0, .8), berry(picnic.feast, -30, -2, .8), berry(picnic.feast, -14, 0, .8)];

    for (const p of scatter(34, 56, 40)) {
      const tuft = el('path', { class: 'tuft', d: `M${p.x - 7} ${p.y} q2 -12 -3 -18 q7 6 7 18 q1 -14 7 -20 q-2 12 1 20 q3 -9 9 -12 q-5 6 -5 12z`, fill: random() < .5 ? '#4f9e35' : '#5bb03d', style: `animation-delay:${(-random() * 3).toFixed(1)}s` }, g);
      tuft.dataset.x = p.x;
    }
    const petals = ['#ff8fb1', '#ffd43b', '#ffffff', '#b197fc', '#ff922b'];
    for (const p of scatter(18, 60, 46)) {
      const node = el('g', null, layers.marks);
      const inner = el('g', null, node);
      el('path', { d: 'M0 0 q-2 -8 0 -14', stroke: '#3f8f32', 'stroke-width': 3, fill: 'none' }, inner);
      const head = el('g', { transform: 'translate(0 -16)' }, inner);
      const color = petals[flowers.length % petals.length];
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; el('circle', { cx: (Math.cos(a) * 6).toFixed(1), cy: (Math.sin(a) * 6).toFixed(1), r: 5, fill: color }, head); }
      el('circle', { r: 3.6, fill: color === '#ffd43b' ? '#ff922b' : '#ffd43b' }, head);
      at(node, p.x, p.y);
      flowers.push({ x: p.x, y: p.y, node: inner, head, bounceAt: -1e9, near: false });
    }
    for (let k = 0; k < 2; k++) {
      clouds.push({ node: el('ellipse', { rx: 170, ry: 70, fill: '#0b3d2e', opacity: .05 }, layers.fx), x: 150 + k * 560, y: 220 + k * 250, speed: 9 + k * 4 });
    }
  }
  const pond = { fish: null, jumpAt: 0, nextJump: 5000 };
  const picnic = { glow: null, feast: null, feastBerries: [] };
  const flowers = [], clouds = [], butterflies = [];

  // ---------- Sprites (depth-sorted by their feet) ----------
  const sprites = [];
  const addSprite = (node, y) => { sprites.push({ node, y }); return node; };
  const nodes = { trees: {}, rocks: {}, plants: {} };

  function buildTree(t) {
    const s = t.size;
    const node = el('g', null, layers.sprites);
    at(node, t.x, t.y);
    el('ellipse', { cx: 8, cy: 4, rx: 52 * s, ry: 17 * s, fill: '#1f5d2433' }, node);
    el('path', { d: `M${-11 * s} 0 C${-8 * s} ${-24 * s} ${-9 * s} ${-44 * s} ${-6 * s} ${-60 * s} L${6 * s} ${-60 * s} C${9 * s} ${-44 * s} ${8 * s} ${-24 * s} ${11 * s} 0Z`, fill: '#94602f' }, node);
    const canopy = el('g', { class: 'canopy', style: `animation-delay:${(-random() * 5).toFixed(1)}s` }, node);
    const blobs = [[0, -92, 46, '#3a933b'], [-34, -72, 34, '#44a342'], [33, -74, 34, '#3f9c3e'], [-14, -108, 32, '#52b44c'], [18, -104, 30, '#4cad47'], [-8, -80, 30, '#4fb04a']];
    for (const [x, y, r, fill] of blobs) el('circle', { cx: x * s, cy: y * s, r: r * s, fill }, canopy);
    for (const [x, y, r] of [[-20, -112, 9], [10, -116, 6], [-38, -82, 6]]) el('circle', { cx: x * s, cy: y * s, r: r * s, fill: '#7fd26a', opacity: .8 }, canopy);
    nodes.trees[t.id] = canopy;
    addSprite(node, () => t.y);
  }
  function buildRock(r) {
    const s = r.size;
    const node = el('g', null, layers.sprites);
    at(node, r.x, r.y);
    el('ellipse', { cx: 6, cy: 3, rx: 40 * s, ry: 12 * s, fill: '#1f3d2433' }, node);
    const body = el('g', { class: 'rock-body' }, node);
    el('path', { d: `M${-38 * s} 2 C${-42 * s} ${-26 * s} ${-18 * s} ${-44 * s} ${4 * s} ${-42 * s} C${30 * s} ${-40 * s} ${42 * s} ${-18 * s} ${38 * s} 2Z`, fill: '#9aa3b5' }, body);
    el('path', { d: `M${-28 * s} ${-18 * s} C${-22 * s} ${-36 * s} ${6 * s} ${-42 * s} ${22 * s} ${-30 * s} C${6 * s} ${-32 * s} ${-12 * s} ${-26 * s} ${-28 * s} ${-18 * s}Z`, fill: '#c5cbd8' }, body);
    el('ellipse', { cx: 18 * s, cy: -6 * s, rx: 12 * s, ry: 5 * s, fill: '#7cc05a', opacity: .9 }, body);
    nodes.rocks[r.id] = body;
    addSprite(node, () => r.y);
  }
  function buildPlant(p) {
    const node = el('g', null, layers.sprites);
    at(node, p.x, p.y);
    el('ellipse', { cx: 4, cy: 2, rx: 32, ry: 9, fill: '#1f5d2433' }, node);
    const leaves = el('g', { class: 'plant-leaves' }, node);
    for (const [x, y, rx, ry, rot, fill] of [[-16, -12, 16, 10, -30, '#2f8a3e'], [16, -12, 16, 10, 30, '#2f8a3e'], [-10, -24, 14, 9, -60, '#3c9d48'], [10, -24, 14, 9, 60, '#3c9d48'], [0, -10, 22, 12, 0, '#44a851'], [0, -30, 12, 8, 90, '#52b85c']]) {
      el('ellipse', { cx: x, cy: y, rx, ry, fill, transform: `rotate(${rot} ${x} ${y})` }, leaves);
    }
    const cue = el('circle', { class: 'plant-cue', cx: 0, cy: -34, r: 30, fill: 'url(#cue-glow)' }, node);
    const fruit = el('g', { class: 'plant-berry' }, node);
    berry(fruit, 0, -36, 1.35);
    nodes.plants[p.id] = { node, leaves, cue, fruit };
    addSprite(node, () => p.y);
  }
  function buildBasket() {
    const b = L.BASKET;
    const node = el('g', null, layers.sprites);
    at(node, b.x, b.y);
    el('ellipse', { cx: 3, cy: 2, rx: 28, ry: 7, fill: '#0002' }, node);
    el('path', { d: 'M-18 -22 C-18 -48 18 -48 18 -22', fill: 'none', stroke: '#9a5b24', 'stroke-width': 5, 'stroke-linecap': 'round' }, node);
    picnic.basketBerries = [berry(node, -10, -26, .7), berry(node, 0, -30, .7), berry(node, 10, -26, .7)];
    el('path', { d: 'M-26 -24 H26 L20 -2 C19 1 17 2 14 2 H-14 C-17 2 -19 1 -20 -2Z', fill: '#d48b3f' }, node);
    el('path', { d: 'M-23 -16 H23 M-21 -8 H21', stroke: '#a8652a', 'stroke-width': 3 }, node);
    addSprite(node, () => b.y);
  }

  const player = { mover: L.createMover(L.START), phase: 0, stepDist: 0, node: null, parts: {} };
  function buildPlayer() {
    const node = el('g', null, layers.sprites);
    el('ellipse', { cx: 0, cy: 0, rx: 18, ry: 6, fill: '#1f3d2440' }, node);
    const bob = el('g', null, node);
    const flip = el('g', null, bob);
    const leg = x => {
      const g = el('g', null, flip);
      el('rect', { x: -3.5, y: 0, width: 7, height: 16, rx: 3.5, fill: '#2f4d8f' }, g);
      el('ellipse', { cx: 1.5, cy: 16, rx: 5.5, ry: 3.5, fill: '#5a3a22' }, g);
      g.dataset.x = x;
      return g;
    };
    const legBack = leg(-5), legFront = leg(5);
    el('rect', { x: -19, y: -44, width: 11, height: 20, rx: 4, fill: '#f59f00' }, flip);
    const armBack = el('rect', { x: -3, y: 0, width: 6, height: 15, rx: 3, fill: '#e9b48a' }, flip);
    el('path', { d: 'M-12 -40 C-12 -44 12 -44 12 -40 L13 -20 C13 -17 11 -16 8 -16 H-8 C-11 -16 -13 -17 -13 -20Z', fill: '#ff6b6b' }, flip);
    el('rect', { x: -12, y: -22, width: 24, height: 7, rx: 3, fill: '#3b5bdb' }, flip);
    const armFront = el('rect', { x: -3, y: 0, width: 6, height: 15, rx: 3, fill: '#f7c89b' }, flip);
    el('circle', { cx: 0, cy: -56, r: 16, fill: '#f7c89b' }, flip);
    el('path', { d: 'M-15 -58 C-16 -70 12 -72 15 -60 C8 -64 -6 -64 -15 -58Z', fill: '#6b4226' }, flip);
    el('circle', { cx: 8, cy: -57, r: 2.4, fill: '#2a2a3a' }, flip);
    el('circle', { cx: -1, cy: -57, r: 2.4, fill: '#2a2a3a' }, flip);
    el('ellipse', { cx: 10, cy: -51, rx: 3.5, ry: 2.2, fill: '#ff9aa8', opacity: .8 }, flip);
    el('path', { d: 'M2 -50 q4 3 8 0', stroke: '#8a3b2a', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, flip);
    el('ellipse', { cx: 0, cy: -67, rx: 24, ry: 6.5, fill: '#ffd43b' }, flip);
    el('path', { d: 'M-13 -67 C-13 -80 13 -80 13 -67Z', fill: '#ffe066' }, flip);
    el('rect', { x: -13, y: -71, width: 26, height: 4, fill: '#f76707' }, flip);
    player.node = node;
    player.parts = { bob, flip, legBack, legFront, armBack, armFront };
    addSprite(node, () => player.mover.y);
  }

  const creature = { x: 0, y: 0, facing: -1, mode: 'home', hop: 0, hopAt: -1e9, hopCount: 1, blinkAt: 0, cheerAt: -1e9, mover: null, trail: [], modeAt: 0, look: { x: 0, y: 0 }, node: null, parts: {} };
  function buildCreature() {
    const node = el('g', null, layers.sprites);
    el('ellipse', { cx: 0, cy: 0, rx: 28, ry: 7, fill: '#1f3d2440' }, node);
    const hop = el('g', null, node);
    const flip = el('g', null, hop);
    const squash = el('g', null, flip);
    el('path', { d: 'M-26 -22 C-44 -24 -48 -44 -36 -48 C-30 -50 -28 -42 -34 -40 C-38 -34 -32 -30 -24 -30Z', fill: '#4fb9a3' }, squash);
    const feet = el('g', null, squash);
    el('ellipse', { cx: -12, cy: -4, rx: 10, ry: 5.5, fill: '#43a38f' }, feet);
    el('ellipse', { cx: 13, cy: -4, rx: 10, ry: 5.5, fill: '#43a38f' }, feet);
    el('path', { d: 'M-26 -46 L-30 -70 L-10 -56Z', fill: '#6fd3bd' }, squash);
    el('path', { d: 'M-24 -50 L-26 -64 L-14 -56Z', fill: '#ffb3c7' }, squash);
    el('path', { d: 'M14 -58 L30 -76 L28 -50Z', fill: '#6fd3bd' }, squash);
    el('path', { d: 'M18 -58 L27 -70 L26 -54Z', fill: '#ffb3c7' }, squash);
    el('ellipse', { cx: 0, cy: -32, rx: 32, ry: 28, fill: '#6fd3bd' }, squash);
    el('ellipse', { cx: 3, cy: -24, rx: 19, ry: 15, fill: '#dffcf3' }, squash);
    el('path', { d: 'M0 -58 C-1 -64 0 -68 2 -72', stroke: '#3c8f3a', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, squash);
    el('path', { d: 'M2 -72 C10 -80 20 -76 20 -72 C14 -68 8 -68 2 -72Z', fill: '#5cc052' }, squash);
    el('path', { d: 'M1 -68 C-6 -76 -14 -72 -14 -68 C-9 -65 -4 -65 1 -68Z', fill: '#52b44c' }, squash);
    const eyes = el('g', null, squash);
    const pupils = [];
    for (const x of [-9, 13]) {
      el('circle', { cx: x, cy: -38, r: 9.5, fill: '#fff' }, eyes);
      const pupil = el('g', null, eyes);
      el('circle', { cx: x, cy: -38, r: 5, fill: '#1e2a3a' }, pupil);
      el('circle', { cx: x + 1.8, cy: -40, r: 1.8, fill: '#fff' }, pupil);
      pupils.push(pupil);
    }
    el('ellipse', { cx: -16, cy: -26, rx: 5, ry: 3, fill: '#ff9ab5', opacity: .8 }, squash);
    el('ellipse', { cx: 22, cy: -26, rx: 5, ry: 3, fill: '#ff9ab5', opacity: .8 }, squash);
    const smile = el('path', { d: 'M-2 -28 q4 4 8 0', stroke: '#1e2a3a', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, squash);
    const grin = el('path', { d: 'M-4 -29 q6 9 12 0Z', fill: '#c2255c', opacity: 0 }, squash);
    creature.node = node;
    creature.parts = { hop, flip, squash, feet, eyes, pupils, smile, grin };
    addSprite(node, () => creature.y);
  }

  // Thought bubble: the berries wanted, and a basket with one slot per berry. Both use rows of five.
  const bubble = { node: null, show: 0, until: 0, slots: [], heart: null, want: null, w: 260, h: 90 };
  function buildBubble() {
    bubble.node = el('g', { opacity: 0 }, layers.bubble);
    bubble.inner = el('g', null, bubble.node);
    bubble.frame = el('g', null, bubble.inner);
    bubble.want = el('g', null, bubble.inner);
    bubble.heart = el('path', { d: 'M0 16 C-30 -4 -26 -30 -8 -30 C-2 -30 0 -24 0 -22 C0 -24 2 -30 8 -30 C26 -30 30 -4 0 16Z', fill: '#ff5c8a', opacity: 0 }, bubble.inner);
  }
  function setBubbleNeed(need) {
    const S = 30, cols = Math.min(5, need), rows = Math.ceil(need / 5), gridW = cols * S;
    const side = gridW / 2 + 34, w = 2 * side + gridW + 40, h = rows * S + 52;
    bubble.w = w; bubble.h = h;
    bubble.frame.replaceChildren(); bubble.want.replaceChildren(); bubble.slots = [];
    el('circle', { cx: -8, cy: h / 2 + 30, r: 6, fill: '#fff' }, bubble.frame);
    el('circle', { cx: -2, cy: h / 2 + 14, r: 9, fill: '#fff' }, bubble.frame);
    el('rect', { x: -w / 2, y: -h / 2 + 4, width: w, height: h, rx: Math.min(h / 2, 42), fill: '#1e3a5a22' }, bubble.frame);
    el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: Math.min(h / 2, 42), fill: '#fff' }, bubble.frame);
    for (let x = -w / 2 + 50; x <= w / 2 - 40; x += 54) el('circle', { cx: x, cy: -h / 2 + 4, r: 26, fill: '#fff' }, bubble.frame);
    const y0 = -(rows - 1) * S / 2 - 8;
    const spot = (cx, i) => ({ x: cx - gridW / 2 + S / 2 + (i % 5) * S, y: y0 + Math.floor(i / 5) * S });
    for (let i = 0; i < need; i++) { const p = spot(-side, i); berry(bubble.want, p.x, p.y, .9); }
    el('path', { d: 'M-12 0 H8 M0 -8 L10 0 L0 8', stroke: '#8aa0b8', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, bubble.want);
    const top = y0 + (rows - 1) * S + 14;
    el('path', { d: `M${side - gridW / 2 - 10} ${top} H${side + gridW / 2 + 10} L${side + gridW / 2 + 4} ${top + 22} C${side + gridW / 2 + 3} ${top + 25} ${side + gridW / 2} ${top + 26} ${side + gridW / 2 - 3} ${top + 26} H${side - gridW / 2 + 3} C${side - gridW / 2} ${top + 26} ${side - gridW / 2 - 3} ${top + 25} ${side - gridW / 2 - 4} ${top + 22}Z`, fill: '#d48b3f' }, bubble.want);
    el('path', { d: `M${side - gridW / 2 - 6} ${top + 9} H${side + gridW / 2 + 6} M${side - gridW / 2 - 3} ${top + 17} H${side + gridW / 2 + 3}`, stroke: '#a8652a', 'stroke-width': 2.5 }, bubble.want);
    for (let i = 0; i < need; i++) {
      const p = spot(side, i), slot = el('g', null, bubble.want);
      el('circle', { cx: p.x, cy: p.y, r: 10, fill: '#fff', stroke: '#c9a27a', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }, slot);
      bubble.slots.push({ berry: berry(slot, p.x, p.y, .85) });
    }
  }

  function buildButterflies() {
    for (const [cx, cy, color, seed] of [[240, 520, '#ffb3d1', 0], [760, 250, '#ffe066', 2], [620, 440, '#b197fc', 4]]) {
      const node = el('g', null, layers.fx);
      const wings = el('g', null, node);
      el('ellipse', { cx: -6, cy: -3, rx: 7, ry: 9, fill: color }, wings);
      el('ellipse', { cx: 6, cy: -3, rx: 7, ry: 9, fill: color }, wings);
      el('ellipse', { cx: -5, cy: 6, rx: 5, ry: 5, fill: color, opacity: .8 }, wings);
      el('ellipse', { cx: 5, cy: 6, rx: 5, ry: 5, fill: color, opacity: .8 }, wings);
      el('rect', { x: -1.2, y: -8, width: 2.4, height: 16, rx: 1.2, fill: '#3a2f2a' }, node);
      butterflies.push({ node, wings, cx, cy, seed });
    }
  }

  // ---------- Effects ----------
  let particles = [];
  const marker = { node: null, ring: null, at: -1e9, gold: false };
  function buildMarker() {
    marker.node = el('g', { opacity: 0 }, layers.marks);
    marker.ring = el('ellipse', { rx: 22, ry: 10, fill: 'none', stroke: '#fff', 'stroke-width': 5 }, marker.node);
    marker.dot = el('ellipse', { rx: 6, ry: 3, fill: '#fff' }, marker.node);
  }
  function showMarker(p, gold, size = 22) {
    marker.x = p.x; marker.y = p.y; marker.at = clock; marker.gold = gold; marker.size = size;
    const color = gold ? '#ffe066' : '#ffffff';
    marker.ring.setAttribute('stroke', color);
    marker.dot.setAttribute('fill', color);
  }
  const SHAPES = {
    sparkle: parent => el('path', { d: 'M0 -9 L2.5 -2.5 L9 0 L2.5 2.5 L0 9 L-2.5 2.5 L-9 0 L-2.5 -2.5Z', fill: '#fff7b0' }, parent),
    heart: parent => el('path', { d: 'M0 8 C-15 -2 -13 -15 -4 -15 C-1 -15 0 -12 0 -11 C0 -12 1 -15 4 -15 C13 -15 15 -2 0 8Z', fill: '#ff5c8a' }, parent),
    leaf: parent => el('ellipse', { rx: 6, ry: 3.5, fill: '#4fae45' }, parent),
    confetti: parent => el('rect', { x: -4, y: -2.5, width: 8, height: 5, rx: 1, fill: ['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#b197fc'][Math.floor(Math.random() * 5)] }, parent),
    dust: parent => el('ellipse', { rx: 7, ry: 4, fill: '#e9ddb0' }, parent),
    ripple: parent => el('ellipse', { rx: 10, ry: 5, fill: 'none', stroke: '#e6fbff', 'stroke-width': 3 }, parent),
    berry: parent => berry(el('g', null, parent), 0, 0, 1.35).parentNode
  };
  function spawn(kind, x, y, o = {}) {
    const parent = kind === 'dust' || kind === 'ripple' ? layers.marks : layers.fx;
    const node = SHAPES[kind](el('g', null, parent)).parentNode;
    const p = { kind, node, x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, life: o.life || 800, age: 0, spin: o.spin || 0, rot: o.rot || 0, scale: o.scale || 1, grow: o.grow || 0, to: o.to || null, from: { x, y } };
    particles.push(p);
    updateParticle(p, 0);
    return p;
  }
  function burst(kind, x, y, count, speed, o = {}) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, v = speed * (.5 + Math.random() * .7);
      spawn(kind, x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.lift || 0), g: o.g || 0, life: (o.life || 800) * (.7 + Math.random() * .5), spin: (Math.random() - .5) * 8, scale: o.scale || 1 });
    }
  }
  function updateParticle(p, dt) {
    p.age += dt;
    const u = clamp01(p.age / p.life), s = dt / 1000;
    if (p.to) {
      // Picked berries arc up over the explorer's head.
      const q = u * u * (3 - 2 * u);
      p.x = lerp(p.from.x, p.to.x, q); p.y = lerp(p.from.y, p.to.y, q) - Math.sin(u * Math.PI) * 60;
    } else {
      p.vy += p.g * s; p.x += p.vx * s; p.y += p.vy * s; p.rot += p.spin * s * 60;
    }
    const scale = p.kind === 'ripple' || p.kind === 'dust' ? p.scale * (1 + u * (p.kind === 'ripple' ? 3 : 1.5)) :
      p.kind === 'sparkle' ? p.scale * Math.sin(u * Math.PI) : p.kind === 'berry' ? p.scale * (u < .75 ? 1 : 1 - (u - .75) * 3.2) : p.scale;
    at(p.node, p.x, p.y, ` rotate(${p.rot.toFixed(0)}) scale(${Math.max(0, scale).toFixed(2)})`);
    p.node.setAttribute('opacity', (p.kind === 'berry' ? 1 : 1 - Math.max(0, u - .6) / .4).toFixed(2));
  }
  function clearParticles() { particles.forEach(p => p.node.remove()); particles = []; }

  // ---------- Game state ----------
  let quest = L.createQuest();
  let pending = null;           // the object the explorer is walking toward, if any
  let lastInput = 0, completions = 0, nextBird = 0;
  let complete = false;

  function renderBasket(pop = -1) {
    const slots = L.basketSlots(quest);
    const wrap = $('meter-slots');
    if (wrap.children.length !== slots.length) {
      wrap.style.setProperty('--cols', Math.min(5, slots.length));
      wrap.classList.toggle('two-rows', slots.length > 5);
      wrap.replaceChildren(...slots.map(() => {
        const slot = document.createElement('span');
        slot.className = 'meter-slot';
        slot.innerHTML = '<svg viewBox="-16 -20 32 36" aria-hidden="true"><use href="#berry" x="-16" y="-20" width="32" height="36"/></svg>';
        return slot;
      }));
    }
    [...wrap.children].forEach((slot, i) => {
      slot.classList.toggle('full', slots[i]);
      slot.classList.toggle('pop', i === pop);
      if (i === pop) { slot.classList.remove('pop'); void slot.offsetWidth; slot.classList.add('pop'); }
      slot.classList.remove('wanted');
    });
    $('basket-meter').setAttribute('aria-label', `Basket: ${quest.picked.length} of ${quest.need} berries`);
    bubble.slots.forEach((s, i) => s.berry.setAttribute('opacity', slots[i] ? 1 : 0));
    for (const plant of L.PLANTS) {
      const has = L.hasBerry(quest, plant.id);
      nodes.plants[plant.id].fruit.style.display = has ? '' : 'none';
      nodes.plants[plant.id].cue.style.display = has ? '' : 'none';
    }
    picnic.basketBerries.forEach(b => b.setAttribute('opacity', quest.completed ? 1 : 0));
  }
  function wantEmptySlots() {
    [...$('meter-slots').children].forEach((slot, i) => {
      if (slot.classList.contains('full')) return;
      slot.classList.remove('wanted'); void slot.offsetWidth; slot.classList.add('wanted');
    });
  }

  function showBubble(ms, heart = false) {
    bubble.until = clock + ms;
    bubble.heart.setAttribute('opacity', heart ? 1 : 0);
    bubble.want.setAttribute('opacity', heart ? 0 : 1);
  }

  function setMode(mode) { creature.mode = mode; creature.modeAt = clock; }
  function hopCreature(count = 1) { creature.hopAt = clock; creature.hopCount = count; }

  function reset(forLevel = level) {
    level = forLevel;
    tasks = [];
    clearParticles();
    const need = L.configure(L.berriesForLevel(level));
    for (const plant of L.ALL_PLANTS) nodes.plants[plant.id].node.style.display = L.PLANTS.includes(plant) ? '' : 'none';
    spriteOrder = '';
    quest = L.createQuest(L.PLANTS.map(p => p.id), need);
    setBubbleNeed(need);
    $('level-num').textContent = level;
    $('level-badge').setAttribute('aria-label', `Level ${level}`);
    pending = null;
    complete = false;
    L.stop(player.mover);
    player.mover.x = L.START.x; player.mover.y = L.START.y; player.mover.heading = 1;
    player.phase = 0; player.stepDist = 0;
    Object.assign(creature, { x: L.CREATURE_HOME.x, y: L.CREATURE_HOME.y, facing: -1, hopAt: -1e9, cheerAt: -1e9, mover: null, trail: [] });
    setMode('home');
    bubble.until = 0; bubble.show = 0;
    marker.at = -1e9;
    picnic.feast.setAttribute('opacity', 0);
    for (const f of flowers) { f.bounceAt = -1e9; f.near = false; }
    for (const node of layers.sprites.querySelectorAll('.rustle, .wobble, .shake')) node.classList.remove('rustle', 'wobble', 'shake');
    $('next-float').hidden = true;
    renderBasket();
    lastInput = clock;
    pond.nextJump = clock + 5000;
    nextBird = clock + 6000;
  }
  const introBubble = () => after(700, () => { hopCreature(1); sfx.chirp(); showBubble(6500); });

  // ---------- Input ----------
  function toWorld(clientX, clientY) {
    const pt = stage.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const p = pt.matrixTransform(stage.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }
  function targetAt(p) {
    let best = null, bestScore = Infinity;
    for (const t of liveTargets()) {
      const d = Math.min(Math.hypot(p.x - t.hx, p.y - t.hy), Math.hypot(p.x - t.x, p.y - t.y) + 8);
      const score = d / t.hit;
      if (score <= 1 && score < bestScore) { best = t; bestScore = score; }
    }
    return best;
  }
  // The creature's target moves with it once it is a companion.
  function liveTargets() {
    return L.TARGETS.map(t => t.kind === 'creature' ? { ...t, x: creature.x, y: creature.y, hx: creature.x, hy: creature.y - 30 } : t);
  }

  function handleTap(p) {
    if (paused || phase === 'card') return;
    tapsHandled++;
    lastInput = clock;
    const target = targetAt(p);
    if (target) {
      const plan = L.planToObject(player.mover, target);
      L.setRoute(player.mover, plan.points);
      pending = target;
      showMarker({ x: target.x, y: target.y }, true, target.kind === 'tree' ? 34 : 30);
      sfx.tap();
      if (!player.mover.moving) arrive();
      return;
    }
    const plan = L.planToPoint(player.mover, p);
    L.setRoute(player.mover, plan.points);
    pending = null;
    showMarker(plan.end, false);
    if (plan.adjusted) {
      const wet = !L.onIsland(p, 0) || L.PONDS.some(w => Math.hypot((p.x - w.x) / w.rx, (p.y - w.y) / w.ry) < 1);
      if (wet) {
        spawn('ripple', p.x, p.y, { life: 900 });
        spawn('ripple', p.x, p.y, { life: 900, scale: .5 });
        if (L.PONDS.some(w => Math.hypot((p.x - w.x) / w.rx, (p.y - w.y) / w.ry) < 1)) pond.nextJump = Math.min(pond.nextJump, clock + 450);
        sfx.splash();
      } else {
        burst('dust', p.x, p.y, 4, 30, { life: 500 });
        sfx.soft();
      }
    } else sfx.tap();
    if (!player.mover.moving) arrive();
  }
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary) return;
    event.preventDefault();
    audioContext();
    handleTap(toWorld(event.clientX, event.clientY));
  });
  // Some iPadOS versions only unlock audio on the end of a touch.
  stage.addEventListener('pointerup', () => audioContext());

  // ---------- Interactions on arrival ----------
  function arrive() {
    const target = pending;
    pending = null;
    if (!target) { if (!calm) burst('dust', player.mover.x, player.mover.y, 3, 24, { life: 420 }); return; }
    const live = target.kind === 'creature' ? { ...target, x: creature.x, y: creature.y } : target;
    // Only interact when the explorer is really there.
    // A companion may have taken a step meanwhile, so it gets a little extra slack.
    const slack = target.kind === 'creature' && creature.mode !== 'home' ? 50 : 2;
    if (Math.hypot(player.mover.x - live.x, player.mover.y - live.y) > target.reach + slack) return;
    if (live.x !== player.mover.x) player.mover.heading = live.x > player.mover.x ? 1 : -1;
    interact[target.kind](target);
  }
  const interact = {
    plant(target) {
      const plant = nodes.plants[target.id];
      const result = L.pick(quest, target.id);
      if (result === 'picked') {
        spawn('berry', target.x, target.y - 36, { to: { x: player.mover.x, y: player.mover.y - 96 }, life: 700 });
        burst('sparkle', target.x, target.y - 36, calm ? 3 : 8, 90, { life: 700 });
        restartClass(plant.leaves, 'shake', 500);
        renderBasket(quest.picked.length - 1);
        sfx.pick();
        hopCreature(1);
        if (quest.picked.length === quest.need) after(600, () => { sfx.chirp(); showBubble(4000); });
      } else {
        restartClass(plant.leaves, 'shake', 500);
        burst('leaf', target.x, target.y - 20, 3, 50, { g: 120, life: 700 });
        sfx.empty();
      }
    },
    picnic() {
      const result = L.deliver(quest);
      if (result === 'complete') return celebrate();
      if (result === 'partial') {
        // Keep every berry; show what is still missing.
        wantEmptySlots();
        showBubble(4500);
        sfx.partial();
        creature.facing = player.mover.x > creature.x ? 1 : -1;
        for (const plant of L.PLANTS) if (L.hasBerry(quest, plant.id)) burst('sparkle', plant.x, plant.y - 36, calm ? 2 : 6, 80, { life: 900 });
        return;
      }
      hopCreature(1);
      burst('heart', L.PICNIC.x, L.PICNIC.y - 30, calm ? 1 : 3, 50, { lift: 60, life: 900 });
      sfx.chirp();
    },
    creature() {
      hopCreature(2);
      sfx.chirp();
      if (quest.completed) { showBubble(2200, true); burst('heart', creature.x, creature.y - 70, calm ? 1 : 4, 60, { lift: 70, life: 1000 }); }
      else showBubble(4500);
    },
    tree(target) {
      restartClass(nodes.trees[target.id], 'rustle', 600);
      const tree = L.TREES.find(t => t.id === target.id);
      for (let k = 0; k < (calm ? 2 : 5); k++) spawn('leaf', tree.x + (Math.random() - .5) * 70 * tree.size, tree.y - 70 * tree.size + Math.random() * 30, { vx: (Math.random() - .5) * 40, vy: -20, g: 90, spin: (Math.random() - .5) * 6, life: 1400 });
      sfx.rustle();
    },
    rock(target) {
      restartClass(nodes.rocks[target.id], 'wobble', 450);
      burst('dust', target.x, target.y, 3, 30, { life: 500 });
      sfx.tok();
    }
  };
  function restartClass(node, name, ms) {
    node.classList.remove(name); void node.getBoundingClientRect(); node.classList.add(name);
    after(ms, () => node.classList.remove(name));
  }

  function celebrate() {
    if (complete) return;
    complete = true;
    completions++;
    renderBasket();
    picnic.feast.setAttribute('opacity', 1);
    sfx.complete();
    setMode('celebrate');
    hopCreature(3);
    showBubble(2600, true);
    burst('heart', creature.x, creature.y - 60, calm ? 2 : 6, 80, { lift: 60, life: 1200 });
    if (!calm) burst('confetti', L.PICNIC.x, L.PICNIC.y - 60, 40, 260, { lift: 160, g: 380, life: 1600 });
    else burst('sparkle', L.PICNIC.x, L.PICNIC.y - 30, 6, 60, { life: 1000 });
    finishLevel();
    after(1700, () => {
      // Walk to the blanket and sit for the picnic.
      creature.mover = L.createMover(creature);
      L.setRoute(creature.mover, L.planToPoint(creature, L.SIT_SPOT).points);
      setMode('to-picnic');
    });
  }

  // ---------- Frame update ----------
  function tick(dt) {
    clock += dt;
    if (tasks.length) {
      const due = tasks.filter(t => t.at <= clock);
      tasks = tasks.filter(t => t.at > clock);
      due.forEach(t => t.fn());
    }
    const s = dt / 1000;
    const m = player.mover;
    const wasMoving = m.moving;
    const beforeX = m.x, beforeY = m.y;
    if (L.advance(m, WALK_SPEED * s) && wasMoving) arrive();
    const moved = Math.hypot(m.x - beforeX, m.y - beforeY);
    player.phase += moved * .075;
    player.stepDist += moved;
    if (moved > 0 && player.stepDist > 46) { player.stepDist = 0; if (!calm) spawn('dust', m.x - m.heading * 6, m.y, { life: 380, scale: .6 }); }
    if (creature.mode === 'follow' && moved > 0) {
      const last = creature.trail[creature.trail.length - 1];
      if (!last || Math.hypot(last.x - m.x, last.y - m.y) > 6) creature.trail.push({ x: m.x, y: m.y });
    }
    updateCreature(dt);
    updateWorld(dt);
    particles = particles.filter(p => {
      updateParticle(p, dt);
      if (p.age < p.life) return true;
      p.node.remove();
      return false;
    });
    render();
  }

  function updateCreature(dt) {
    const s = dt / 1000;
    const c = creature;
    if (c.mode === 'to-picnic') {
      const before = c.x;
      const done = L.advance(c.mover, WALK_SPEED * .8 * s);
      c.x = c.mover.x; c.y = c.mover.y;
      if (Math.abs(c.x - before) > .1) c.facing = c.x > before ? 1 : -1;
      if (done || !c.mover.moving) {
        setMode('sit');
        c.facing = 1;
        burst('sparkle', c.x, c.y - 40, calm ? 2 : 5, 60, { life: 800 });
        after(2600, startFollowing);
      }
    } else if (c.mode === 'follow') {
      // Follow the explorer's own footsteps, so the companion never cuts through rocks or water.
      let remaining = 0, prev = c;
      for (const p of c.trail) { remaining += dist(prev, p); prev = p; }
      remaining += dist(prev, player.mover);
      let step = remaining > FOLLOW_GAP ? WALK_SPEED * (remaining > 220 ? 1.35 : 1.02) * s : 0;
      step = Math.min(step, remaining - FOLLOW_GAP);
      const before = c.x;
      while (step > 0 && c.trail.length) {
        const p = c.trail[0], d = dist(c, p);
        if (d <= step) { c.x = p.x; c.y = p.y; step -= d; c.trail.shift(); }
        else { c.x += (p.x - c.x) / d * step; c.y += (p.y - c.y) / d * step; step = 0; }
      }
      const walking = Math.abs(c.x - before) > .05 || step > 0;
      c.walking = walking;
      if (Math.abs(c.x - before) > .3) c.facing = c.x > before ? 1 : -1;
      else if (!walking && Math.abs(player.mover.x - c.x) > 12) c.facing = player.mover.x > c.x ? 1 : -1;
    } else if (c.mode === 'home') {
      const dx = player.mover.x - c.x;
      if (Math.abs(dx) > 14) c.facing = dx > 0 ? 1 : -1;
      if (dist(c, player.mover) < 130 && clock - c.cheerAt > 6000) { c.cheerAt = clock; hopCreature(1); sfx.chirp(); }
    }
  }
  function startFollowing() {
    if (creature.mode !== 'sit') return;
    const plan = L.planToPoint(creature, player.mover);
    creature.trail = plan.points.slice(1);
    setMode('follow');
    hopCreature(2);
    sfx.chirp();
  }

  function updateWorld(dt) {
    // Flowers bob and chime as the explorer passes.
    let chimed = false;
    for (const f of flowers) {
      const near = Math.hypot(player.mover.x - f.x, player.mover.y - f.y) < 46 || (creature.mode === 'follow' && Math.hypot(creature.x - f.x, creature.y - f.y) < 40);
      if (near && !f.near && clock - f.bounceAt > 900) {
        f.bounceAt = clock;
        if (!chimed) { sfx.flower(); chimed = true; }
        if (!calm) spawn('sparkle', f.x, f.y - 22, { vy: -30, life: 600, scale: .7 });
      }
      f.near = near;
    }
    // A fish hops in the pond now and then.
    if (clock >= pond.nextJump) {
      pond.jumpAt = clock;
      pond.nextJump = clock + 7000 + Math.random() * 6000;
      const w = L.PONDS[0];
      pond.from = { x: w.x - 40 + Math.random() * 30, y: w.y + 6 };
      pond.to = { x: pond.from.x + 50, y: pond.from.y - 4 };
      spawn('ripple', pond.from.x, pond.from.y, { life: 800 });
      after(640, () => spawn('ripple', pond.to.x, pond.to.y, { life: 800 }));
    }
    for (const cl of clouds) { cl.x += cl.speed * (calm ? .3 : 1) * dt / 1000; if (cl.x > 1300) cl.x = -300; }
    if (clock >= nextBird) { nextBird = clock + 9000 + Math.random() * 9000; sfx.bird(); }
    // Idle nudge: the nearest berry sparkles and the creature repeats its wish.
    if (phase === 'play' && !quest.completed && !player.mover.moving && clock - lastInput > IDLE_HINT_MS) {
      lastInput = clock;
      const left = L.PLANTS.filter(p => L.hasBerry(quest, p.id)).sort((a, b) => dist(a, player.mover) - dist(b, player.mover));
      if (left.length) burst('sparkle', left[0].x, left[0].y - 36, calm ? 3 : 10, 100, { life: 1000 });
      else picnicPulse = clock;
      showBubble(4000);
    }
  }
  let picnicPulse = -1e9;

  function render() {
    const t = clock / 1000;
    const m = player.mover;
    // Explorer: legs and arms swing with distance walked, a small bounce while moving.
    const P = player.parts;
    const swing = m.moving ? Math.sin(player.phase) : 0;
    at(player.node, m.x, m.y);
    at(P.bob, 0, m.moving && !calm ? -Math.abs(Math.cos(player.phase)) * 3 : Math.sin(t * 2.2) * .8);
    P.flip.setAttribute('transform', `scale(${m.heading} 1)`);
    P.legBack.setAttribute('transform', `translate(-5 -18) rotate(${(swing * 26).toFixed(1)})`);
    P.legFront.setAttribute('transform', `translate(5 -18) rotate(${(-swing * 26).toFixed(1)})`);
    P.armBack.setAttribute('transform', `translate(-11 -38) rotate(${(-swing * 30 + 8).toFixed(1)})`);
    P.armFront.setAttribute('transform', `translate(11 -38) rotate(${(swing * 30 - 8).toFixed(1)})`);

    // Creature: hops, blinks, and keeps its eyes on the explorer.
    const c = creature, C = c.parts;
    const hopMs = 420;
    const hopT = (clock - c.hopAt) / hopMs;
    let hop = hopT >= 0 && hopT < c.hopCount ? Math.sin((hopT % 1) * Math.PI) * (calm ? 8 : 26) : 0;
    if (c.mode === 'celebrate' && hopT >= c.hopCount) hopCreature(calm ? 1 : 3);
    const walking = c.mode === 'to-picnic' || (c.mode === 'follow' && c.walking);
    if (walking && !calm) hop = Math.max(hop, Math.abs(Math.sin(clock / 130)) * 7);
    at(c.node, c.x, c.y);
    at(C.hop, 0, -hop);
    C.flip.setAttribute('transform', `scale(${c.facing} 1)`);
    const sitting = c.mode === 'sit';
    const breathe = calm ? 1 : 1 + Math.sin(t * 2.4) * .025;
    C.squash.setAttribute('transform', sitting ? `translate(0 4) scale(1.06 ${(.86 + (calm ? 0 : Math.abs(Math.sin(t * 5)) * .04)).toFixed(3)})` : `scale(${(2 - breathe).toFixed(3)} ${breathe.toFixed(3)})`);
    const blink = (clock % 3400) < 130;
    C.eyes.setAttribute('transform', blink ? 'translate(0 -38) scale(1 .1) translate(0 38)' : '');
    const lx = player.mover.x - c.x, ly = (player.mover.y - 40) - (c.y - 40), ll = Math.hypot(lx, ly) || 1;
    const px = (lx / ll) * 3.5 * c.facing, py = (ly / ll) * 2.5;
    C.pupils.forEach(p => at(p, px, py));
    const happy = quest.completed || clock - c.hopAt < hopMs * c.hopCount;
    C.grin.setAttribute('opacity', happy ? 1 : 0);
    C.smile.setAttribute('opacity', happy ? 0 : 1);

    // Thought bubble follows the creature.
    const want = clock < bubble.until && c.mode !== 'to-picnic';
    bubble.show = lerp(bubble.show, want ? 1 : 0, calm ? 1 : .22);
    if (bubble.show < .01) bubble.show = 0;
    const bx = Math.min(1000 - bubble.w / 2 - 16, Math.max(bubble.w / 2 + 16, c.x - 10)), by = Math.max(bubble.h / 2 + 20, c.y - 124 - bubble.h / 2);
    at(bubble.node, bx, by, ` scale(${(.6 + bubble.show * .4).toFixed(3)})`);
    bubble.node.setAttribute('opacity', bubble.show.toFixed(2));

    // Destination marker: a quick pop, then fade.
    const mu = (clock - marker.at) / 700;
    if (mu >= 0 && mu < 1) {
      marker.node.setAttribute('opacity', (1 - mu).toFixed(2));
      const r = marker.size * (calm ? 1 : .6 + Math.min(1, mu * 3) * .5);
      at(marker.node, marker.x, marker.y);
      marker.ring.setAttribute('rx', r.toFixed(1)); marker.ring.setAttribute('ry', (r * .45).toFixed(1));
    } else marker.node.setAttribute('opacity', 0);

    // Picnic blanket glows once the basket is full and waiting to be delivered.
    const ready = !quest.completed && quest.picked.length === quest.need;
    const glow = ready ? .55 + Math.sin(t * 4) * .35 : clock - picnicPulse < 1500 ? .6 : 0;
    picnic.glow.setAttribute('opacity', glow.toFixed(2));

    // Flowers.
    for (const f of flowers) {
      const u = (clock - f.bounceAt) / 700;
      if (u >= 0 && u < 1) {
        const k = Math.sin(u * Math.PI * 3) * (1 - u);
        f.node.setAttribute('transform', calm ? `scale(${(1 + .15 * (1 - u)).toFixed(3)})` : `rotate(${(k * 16).toFixed(1)}) scale(${(1 + .25 * Math.sin(u * Math.PI)).toFixed(3)})`);
        f.head.setAttribute('transform', `translate(0 -16) rotate(${(u * (calm ? 0 : 144)).toFixed(0)})`);
      } else if (f.node.hasAttribute('transform')) { f.node.removeAttribute('transform'); f.head.setAttribute('transform', 'translate(0 -16)'); }
    }
    // Butterflies loop lazily over the clearing.
    for (const b of butterflies) {
      const k = t * (calm ? .15 : .35) + b.seed;
      at(b.node, b.cx + Math.sin(k * 1.3) * 90, b.cy + Math.sin(k * 2.1) * 40 - 60 + Math.sin(k * 5) * 6);
      b.wings.setAttribute('transform', `scale(${(calm ? .8 : .25 + Math.abs(Math.sin(t * 11 + b.seed)) * .75).toFixed(2)} 1)`);
    }
    for (const cl of clouds) { cl.node.setAttribute('cx', cl.x.toFixed(1)); cl.node.setAttribute('cy', cl.y); }
    // Fish arc.
    const fu = (clock - pond.jumpAt) / 640;
    if (fu >= 0 && fu < 1 && pond.from) {
      at(pond.fish, lerp(pond.from.x, pond.to.x, fu), lerp(pond.from.y, pond.to.y, fu) - Math.sin(fu * Math.PI) * 34, ` rotate(${(-50 + fu * 100).toFixed(0)})`);
      pond.fish.setAttribute('opacity', 1);
    } else pond.fish.setAttribute('opacity', 0);

    sortSprites();
  }
  let spriteOrder = '';
  function sortSprites() {
    const sorted = sprites.map((s, i) => ({ s, i, y: s.y() })).sort((a, b) => a.y - b.y || a.i - b.i);
    const order = sorted.map(e => e.i).join(',');
    if (order === spriteOrder) return;
    spriteOrder = order;
    sorted.forEach(e => layers.sprites.appendChild(e.s.node));
  }

  function advanceFrame(now) {
    if (lastFrame === null || paused) { lastFrame = now; return; }
    const dt = Math.min(50, Math.max(0, now - lastFrame));
    lastFrame = now;
    tick(dt);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!TEST) advanceFrame(now);
  }

  // ---------- Controls and lifecycle ----------
  function setPaused(value) {
    if (paused === value) return;
    paused = value;
    lastFrame = null;
    app.classList.toggle('is-paused', paused);
    $('pause-screen').hidden = !paused;
    if (paused) $('resume').focus({ preventScroll: true });
  }
  function renderSound() {
    const b = $('sound');
    b.setAttribute('aria-pressed', String(soundOn));
    b.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
    b.firstElementChild.textContent = soundOn ? '🔊' : '🔇';
  }
  $('sound').addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('creature-island-sound', soundOn ? 'on' : 'off'); } catch (_) {}
    renderSound();
    if (soundOn) sfx.tap();
  });
  $('pause').addEventListener('click', () => setPaused(true));
  $('resume').addEventListener('click', () => { audioContext(); setPaused(false); });
  // ---------- Levels and star tickets ----------
  // Level N needs N + 2 berries. Starting a level spends one ticket; an unfinished level resumes free.
  const tickets = window.StarTickets;
  const LEVEL_KEY = TEST ? 'creature-island-level-test' : 'creature-island-level';
  const loadLevel = () => { try { return Math.max(1, Math.floor(Number(localStorage.getItem(LEVEL_KEY))) || 1); } catch (_) { return 1; } };
  const saveLevel = n => { try { localStorage.setItem(LEVEL_KEY, String(n)); } catch (_) {} };
  if (TEST) { try { localStorage.removeItem(LEVEL_KEY); } catch (_) {} }
  let level = loadLevel(), phase = 'card';
  function renderCard() {
    const need = L.berriesForLevel(level);
    $('card-level').textContent = level;
    const grid = $('card-berries');
    grid.style.setProperty('--cols', Math.min(5, need));
    grid.setAttribute('aria-label', `${need} berries`);
    grid.replaceChildren(...Array.from({ length: need }, () => {
      const b = document.createElement('span');
      b.innerHTML = '<svg viewBox="-16 -20 32 36" aria-hidden="true"><use href="#berry" x="-16" y="-20" width="32" height="36"/></svg>';
      return b;
    }));
    const count = tickets ? tickets.balance() : 0;
    document.querySelectorAll('[data-ticket-count]').forEach(n => { n.textContent = count; });
    const free = tickets && tickets.isFreePlay();
    $('free-tag').hidden = !free;
    $('play-cost').hidden = !tickets || !tickets.wouldCharge('creature-island', { level });
  }
  function openCard(forLevel) {
    reset(forLevel);
    phase = 'card';
    renderCard();
    $('level-card').hidden = false;
    $('restart-level').hidden = true;
  }
  function playLevel() {
    if (phase !== 'card' || paused) return;
    audioContext();
    if (tickets && !tickets.startRun('creature-island', { level })) { tickets.showEmpty({ onFreePlay: renderCard }); return; }
    phase = 'play';
    $('level-card').hidden = true;
    $('restart-level').hidden = false;
    lastInput = clock;
    introBubble();
  }
  function finishLevel() {
    phase = 'done';
    if (tickets) tickets.finishRun('creature-island');
    saveLevel(Math.max(loadLevel(), level + 1));
    $('restart-level').hidden = true;
    after(1400, () => { $('next-float').hidden = false; });
  }
  $('play').addEventListener('click', playLevel);
  $('next-float').addEventListener('click', () => { if (!paused) openCard(level + 1); });
  // Retrying an unfinished level is free: the run stays open.
  $('restart-level').addEventListener('click', () => {
    if (phase !== 'play') return;
    setPaused(false);
    reset(level);
    lastInput = clock;
    introBubble();
  });
  if (tickets) tickets.onChange(() => { if (phase === 'card') renderCard(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('pagehide', () => setPaused(true));

  // Tall screens trim the side sea so the island fills the width; the sea keeps drawing past the edges.
  function fitView() {
    const box = $('scene').getBoundingClientRect();
    stage.setAttribute('viewBox', box.width / Math.max(1, box.height) < L.WORLD.w / L.WORLD.h ? '36 0 928 700' : '0 0 1000 700');
  }
  window.addEventListener('resize', fitView);

  fitView();
  buildScenery();
  L.TREES.forEach(buildTree);
  L.ROCKS.forEach(buildRock);
  L.ALL_PLANTS.forEach(buildPlant);
  buildBasket();
  buildPlayer();
  buildCreature();
  buildBubble();
  buildButterflies();
  buildMarker();
  renderSound();
  openCard(level);
  render();

  // FUN gate: checked before anything playable shows, and again on Back, wake, or 15 idle minutes.
  const gate = window.FunGate;
  function requireUnlock() {
    if (TEST || !gate || gate.isUnlocked()) { document.documentElement.classList.add('fun-open'); return; }
    document.documentElement.classList.remove('fun-open');
    setPaused(true);
    gate.prompt({
      onUnlock: () => { gateWatch.refresh(); document.documentElement.classList.add('fun-open'); if (phase === 'card') renderCard(); },
      onCancel: () => location.replace('index.html#' + gate.previousTab())
    });
  }
  const gateWatch = gate && !TEST ? gate.watch(requireUnlock) : { refresh() {} };
  window.addEventListener('pageshow', requireUnlock);
  requireUnlock();
  loopsStarted++;
  requestAnimationFrame(frame);

  if (TEST) {
    window.CreatureIslandTest = {
      L, stage, get clock() { return clock; }, get quest() { return quest; }, get pending() { return pending; },
      get paused() { return paused; }, get phase() { return phase; }, get level() { return level; }, openCard, playLevel,
      play(n) { reset(n); phase = 'play'; $('level-card').hidden = true; }, get completions() { return completions; }, get tapsHandled() { return tapsHandled; },
      get loopsStarted() { return loopsStarted; }, get particles() { return particles.length; }, get tasks() { return tasks.length; },
      player, creature, bubble, sprites, flowers, nodes, marker,
      tap: handleTap, reset, setPaused, toWorld, targetAt, layers,
      step(ms, dt = 16) { for (let k = 0; k < ms; k += dt) if (!paused) tick(dt); },
      frame: advanceFrame
    };
    const script = document.createElement('script');
    script.src = 'creature-island-test.js';
    document.body.appendChild(script);
  }
})();
