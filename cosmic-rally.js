(() => {
  const Logic = window.CosmicRallyLogic;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const app = $('app');
  const params = new URLSearchParams(location.search);
  // Testing aids: ?charges=4,0,9 fixes the first starting charges; ?speed=4 runs the game clock faster.
  const forcedCharges = (params.get('charges') || '').split(',').filter(Boolean).map(Number);
  const clockSpeed = Math.min(8, Math.max(1, Number(params.get('speed')) || 1));

  // Scene geometry, in SVG viewBox units (1000 × 560).
  const ROAD_Y = 470;
  const CAR_BASE_Y = ROAD_Y + 12;
  const CAR_REST_X = 180;
  const DRIVE_DIST = 1800;
  const DRIVE_MS = 4200;
  const FORK_DIST = 1400;
  const FORK_MS = 3400;
  const CALM_DRIVE_MS = 900;
  const CALM_PAYOFF_MS = 1400;
  const STATION_OFFSET = 600;
  // Course: five stations, each ending in its own payoff, with a road fork after the second.
  const PAYOFFS = ['moon', 'tunnel', 'loop', 'tunnel', 'moon'];
  const FORK_AFTER = 2;
  const MOON_X = 520;
  const MOON_HIDDEN_Y = 780;
  const MOON_UP_Y = 200;
  // Battery: ten slots in two groups of five, read left to right.
  const CELL_W = 46, CELL_H = 70, CELL_GAP = 6, MID_GAP = 18, BAT_PAD = 14, BAT_Y = 120;
  const cellX = i => BAT_PAD + i * (CELL_W + CELL_GAP) + (i >= 5 ? MID_GAP - CELL_GAP : 0);
  const BAT_W = cellX(9) + CELL_W + BAT_PAD;

  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp01 = u => Math.max(0, Math.min(1, u));
  const easeInOut = u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = u => 1 - Math.pow(1 - u, 3);
  const easeIn = u => u * u;
  const smooth = u => { u = clamp01(u); return u * u * (3 - 2 * u); };
  const span = (t, a, b) => clamp01((t - a) / (b - a));

  // Accelerate, cruise, then coast to a stop. Closed form so structures can be placed exactly.
  function cruise(t, { a0, a1, d0, d1, v }) {
    if (t <= a0) return 0;
    if (t <= a1) { const s = t - a0; return .5 * v * s * s / (a1 - a0); }
    let x = .5 * v * (a1 - a0);
    if (t <= d0) return x + v * (t - a1);
    x += v * (d0 - a1);
    const s = Math.min(t, d1) - d0, length = d1 - d0;
    return x + v * (s - s * s / (2 * length));
  }

  // Each payoff is a pure function of time since the Boost tap: camera offset, car pose, flame.
  const MOON_JUMP = { power: 700, launch: 1700, land: 3300, end: 4400 };
  const MOON_CAM = { a0: 700, a1: 1500, d0: 3300, d1: 4400, v: .9 };
  const JUMP_H = 235, WEDGE_H = 40, WEDGE_LEN = 150;
  function moonCarX(t) {
    const J = MOON_JUMP;
    if (t <= J.power) return CAR_REST_X;
    if (t <= J.launch) return lerp(CAR_REST_X, 430, easeIn(span(t, J.power, J.launch)));
    if (t <= J.land) return lerp(430, 560, span(t, J.launch, J.land));
    return lerp(560, 620, easeOut(span(t, J.land, J.end)));
  }
  const TUNNEL_CAM = { a0: 600, a1: 1300, d0: 2800, d1: 3800, v: 1.1 };
  function tunnelCarX(t) {
    if (t <= 600) return CAR_REST_X;
    if (t <= 1300) return lerp(CAR_REST_X, 460, easeIn(span(t, 600, 1300)));
    if (t <= 2800) return lerp(460, 520, span(t, 1300, 2800));
    return lerp(520, 610, easeOut(span(t, 2800, 3800)));
  }
  const LOOP = { power: 600, enter: 1800, exit: 3400, end: 4400, r: 150, ahead: 1140, pan: 580, exitPan: 460, roll: 620 };
  // After the loop the car keeps its speed, then eases to a stop.
  const loopExit = u => LOOP.roll * (1.9 * u - .9 * u * u);
  function loopCam(t) {
    if (t <= LOOP.enter) return LOOP.pan * easeInOut(span(t, LOOP.power, LOOP.enter));
    if (t <= LOOP.exit) return LOOP.pan;
    return LOOP.pan + LOOP.exitPan * smooth(span(t, LOOP.exit, LOOP.end));
  }
  const PAYOFF = {
    moon: { duration: MOON_JUMP.end, power: MOON_JUMP.power, cam: t => cruise(t, MOON_CAM) },
    tunnel: { duration: TUNNEL_CAM.d1, power: TUNNEL_CAM.a0, cam: t => cruise(t, TUNNEL_CAM) },
    loop: { duration: LOOP.end, power: LOOP.power, cam: loopCam }
  };

  // Road themes; the fork switches from moon to crystal or candy.
  const THEMES = {
    moon: { hill: '#433b72', road: '#2e2a52', dash: '#b8b1e6', groundTop: '#8d86b5', groundBottom: '#58507f', crater: '#4c4574' },
    crystal: { hill: '#1f5f73', road: '#173847', dash: '#bff6ff', groundTop: '#5fb7c9', groundBottom: '#2d6f86', crater: '#3d8aa0' },
    candy: { hill: '#8a3f7c', road: '#4a2447', dash: '#ffe0f0', groundTop: '#f5a3c7', groundBottom: '#b0578a', crater: '#e27fae' }
  };
  const THEME_VARS = { hill: '--hill', road: '--road', dash: '--dash', groundTop: '--ground-top', groundBottom: '--ground-bottom', crater: '--crater' };
  const mixHex = (a, b, u) => '#' + [1, 3, 5].map(i => Math.round(lerp(parseInt(a.substr(i, 2), 16), parseInt(b.substr(i, 2), 16), u)).toString(16).padStart(2, '0')).join('');
  function applyTheme(from, to = from, u = 1) {
    const stage = $('stage');
    for (const [key, name] of Object.entries(THEME_VARS)) stage.style.setProperty(name, mixHex(from[key], to[key], u));
  }

  // ---------- Game clock: advances only while unpaused, so nothing jumps after a pause. ----------
  let clock = 0, lastFrame = null, paused = false, timeline = null, tasks = [], particles = [];
  function after(ms, fn) { tasks.push({ at: clock + ms, fn }); }
  function play(duration, update, done) { timeline = { start: clock, duration, update, done }; update(0); }
  function frame(now) {
    requestAnimationFrame(frame);
    if (lastFrame === null || paused) { lastFrame = now; return; }
    const dt = Math.min(50, Math.max(0, now - lastFrame)) * clockSpeed;
    lastFrame = now;
    clock += dt;
    if (timeline) {
      const current = timeline;
      const t = Math.min(clock - current.start, current.duration);
      current.update(t);
      if (t >= current.duration && timeline === current) { timeline = null; if (current.done) current.done(); }
    }
    if (tasks.length) {
      const due = tasks.filter(task => task.at <= clock);
      tasks = tasks.filter(task => task.at > clock);
      due.forEach(task => task.fn());
    }
    updateParticles(dt);
    musicTick();
  }

  // ---------- Preferences ----------
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  };
  let muted = store.get('cosmic-rally-sound') === 'off';
  const savedCalm = store.get('cosmic-rally-calm');
  let calm = savedCalm === null ? matchMedia('(prefers-reduced-motion: reduce)').matches : savedCalm === 'on';

  // ---------- Sound: short Web Audio effects; the game reads fine with them off. ----------
  let audioContext = null, master = null;
  function audio() {
    if (muted) return null;
    if (!audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      audioContext = new Context();
      master = audioContext.createGain();
      master.gain.value = .55;
      master.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended' && !paused) audioContext.resume();
    return audioContext;
  }
  function tone(freq, duration, { type = 'sine', gain = .2, delay = 0, to = null } = {}) {
    const ctx = audio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    amp.gain.setValueAtTime(.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + .015);
    amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + duration + .05);
  }
  function noise(duration, { gain = .2, delay = 0, from = 400, to = 3000, kind = 'bandpass' } = {}) {
    const ctx = audio();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    source.buffer = buffer;
    filter.type = kind;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    amp.gain.setValueAtTime(.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + duration * .3);
    amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(filter).connect(amp).connect(master);
    source.start(start);
  }
  const sfx = {
    tap: () => tone(660, .07, { type: 'triangle', gain: .12 }),
    pick: () => { tone(520, .08, { type: 'triangle', gain: .14 }); tone(780, .1, { type: 'triangle', gain: .12, delay: .07 }); },
    vroom: () => { tone(80, 1.1, { type: 'sawtooth', gain: .08, to: 190 }); tone(120, .9, { type: 'square', gain: .03, to: 260, delay: .1 }); },
    arrive: () => { tone(440, .12, { gain: .12 }); tone(660, .16, { gain: .12, delay: .1 }); },
    retry: () => { tone(392, .16, { gain: .12 }); tone(330, .22, { gain: .1, delay: .15 }); },
    correct: () => [523, 659, 784].forEach((f, i) => tone(f, .18, { type: 'triangle', gain: .16, delay: i * .09 })),
    charge: k => tone(560 + k * 70, .09, { type: 'square', gain: .05 }),
    full: () => tone(1046, .3, { type: 'triangle', gain: .12 }),
    boost: () => { noise(1.6, { gain: .22, from: 300, to: 3200 }); tone(110, 1.2, { type: 'sawtooth', gain: .07, to: 520 }); },
    land: () => { noise(.3, { gain: .3, from: 500, to: 120, kind: 'lowpass' }); tone(90, .25, { gain: .2, to: 50 }); },
    loop: () => { tone(330, .7, { type: 'triangle', gain: .12, to: 990 }); tone(990, .7, { type: 'triangle', gain: .1, to: 330, delay: .75 }); },
    rainbow: () => [523, 587, 659, 784, 880, 1046, 1175].forEach((f, i) => tone(f, .14, { type: 'sine', gain: .1, delay: i * .1 })),
    fanfare: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i === 3 ? .45 : .16, { type: 'triangle', gain: .15, delay: i * .12 }))
  };

  // ---------- Background music: a soft C–Am–F–G loop scheduled just ahead on the audio clock. ----------
  let musicOn = store.get('cosmic-rally-music') !== 'off';
  let musicBus = null, musicStep = 0, musicNext = 0, musicLevel = 1;
  const MUSIC_STEP = 60 / 112 / 2;
  const CHORDS = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]];
  const ARP = [1, 2, 3, 2, 1, 2, 3, 2];
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function musicNote(freq, start, duration, type, gain) {
    const osc = audioContext.createOscillator(), amp = audioContext.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + .02);
    amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(amp).connect(musicBus);
    osc.start(start);
    osc.stop(start + duration + .05);
  }
  function musicTick() {
    if (!musicOn || muted || paused || !audioContext || audioContext.state !== 'running') return;
    if (!musicBus) {
      musicBus = audioContext.createGain();
      musicBus.gain.value = musicLevel;
      musicBus.connect(master);
      musicNext = 0;
    }
    const now = audioContext.currentTime;
    if (musicNext < now) musicNext = now + .05;
    while (musicNext < now + .25) {
      const beat = musicStep % 8, chord = CHORDS[Math.floor(musicStep / 8) % CHORDS.length];
      if (beat === 0 || beat === 4) musicNote(midi(chord[0]), musicNext, .45, 'triangle', .09);
      musicNote(midi(chord[ARP[beat]] + (beat === 6 ? 12 : 0)), musicNext, .24, 'sine', .04);
      if (beat === 7 && musicStep % 16 === 15) musicNote(midi(chord[3] + 24), musicNext, .3, 'triangle', .025);
      musicStep++;
      musicNext += MUSIC_STEP;
    }
  }
  function setMusicLevel(level) {
    musicLevel = level;
    if (musicBus) musicBus.gain.setTargetAtTime(level, audioContext.currentTime, .15);
  }
  function stopMusic() {
    if (!musicBus) return;
    const bus = musicBus;
    musicBus = null;
    bus.gain.setTargetAtTime(0, audioContext.currentTime, .05);
    setTimeout(() => bus.disconnect(), 400);
  }


  // ---------- Scene building ----------
  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (parent) parent.append(node);
    return node;
  };
  const svgText = (text, attrs, parent) => { const node = el('text', attrs, parent); node.textContent = text; return node; };
  // Seeded random keeps the backdrop identical on every run.
  let seed = 7;
  const seeded = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  const layers = { stars: $('layer-stars'), mid: $('layer-mid'), hills: $('layer-hills'), world: $('layer-world') };
  const fxBack = $('fx-back'), fxFront = $('fx-front');
  const car = $('car'), carBody = $('car-body'), flame = $('car-flame'), moon = $('moon');
  const wheels = [$('wheel-back'), $('wheel-front')];
  const STAR_TILE = 2000, HILL_TILE = 1400, MID_TILE = 3000, ROAD_SPAN = 60000;
  let legsLayer = null;

  function tile(layer, id, width, copies) {
    const group = el('g', { id }, layer);
    copies.forEach(k => el('use', { href: `#${id}`, transform: `translate(${k * width} 0)` }, layer));
    return group;
  }
  function buildBackdrop() {
    const stars = tile(layers.stars, 'star-tile', STAR_TILE, [-1, 1, 2]);
    for (let i = 0; i < 170; i++) {
      el('circle', { cx: (seeded() * STAR_TILE).toFixed(1), cy: (seeded() * 1140 - 700).toFixed(1), r: (seeded() * 1.8 + .6).toFixed(1), fill: '#fff', opacity: (seeded() * .6 + .35).toFixed(2) }, stars);
    }
    const mid = tile(layers.mid, 'mid-tile', MID_TILE, [-1, 1, 2]);
    const ringed = el('g', { transform: 'translate(760 64) rotate(-18)' }, mid);
    el('circle', { r: 30, fill: '#f59ad7' }, ringed);
    el('ellipse', { rx: 56, ry: 11, fill: 'none', stroke: '#ffe0f3', 'stroke-width': 6 }, ringed);
    el('circle', { cx: 1500, cy: 175, r: 17, fill: '#ff8a5c' }, mid);
    el('circle', { cx: 1495, cy: 170, r: 6, fill: '#ffb38f' }, mid);
    const comet = el('g', { transform: 'translate(1250 44) rotate(-12)' }, mid);
    el('path', { d: 'M0 0 L-90 -8 L-90 8Z', fill: '#9ef0ff', opacity: .45 }, comet);
    el('circle', { r: 9, fill: '#e8fbff' }, comet);
    const ice = el('g', { transform: 'translate(2350 300)' }, mid);
    el('circle', { r: 16, fill: '#9ad0ff' }, ice);
    el('circle', { cx: -5, cy: -4, r: 5, fill: '#d6ecff' }, ice);

    let d = `M0 ${ROAD_Y + 10} L0 440`;
    for (let x = 0; x <= HILL_TILE; x += 70) d += ` Q${x + 35} ${400 + seeded() * 40} ${x + 70} ${430 + seeded() * 25}`;
    d += ` L${HILL_TILE + 70} ${ROAD_Y + 10}Z`;
    el('path', { d, class: 'hill' }, tile(layers.hills, 'hill-tile', HILL_TILE, [-1, 1, 2]));

    const w = layers.world;
    el('rect', { class: 'road', x: -2000, y: ROAD_Y, width: ROAD_SPAN, height: 60 }, w);
    el('line', { class: 'road-dash', x1: -2000, y1: ROAD_Y + 28, x2: ROAD_SPAN, y2: ROAD_Y + 28, 'stroke-width': 5, 'stroke-dasharray': '38 34', opacity: .7 }, w);
    el('rect', { x: -2000, y: ROAD_Y + 56, width: ROAD_SPAN, height: 700, fill: 'url(#ground-fill)' }, w);
    for (let x = -600; x < ROAD_SPAN; x += 160 + seeded() * 180) {
      el('ellipse', { class: 'crater', cx: x.toFixed(0), cy: (ROAD_Y + 80 + seeded() * 50).toFixed(0), rx: (18 + seeded() * 26).toFixed(0), ry: (6 + seeded() * 5).toFixed(0) }, w);
    }
    legsLayer = el('g', { id: 'legs' }, w);
  }

  // Roadside decorations follow the current road theme.
  function prop(kind, x, g) {
    if (kind === 'moon-sign') {
      el('line', { x1: x, y1: ROAD_Y, x2: x, y2: ROAD_Y - 70, stroke: '#8f98d6', 'stroke-width': 5 }, g);
      el('circle', { cx: x, cy: ROAD_Y - 92, r: 26, fill: '#ffd84d', stroke: '#fff3b0', 'stroke-width': 4 }, g);
      el('path', { d: `M${x + 4} ${ROAD_Y - 112} l-14 22 h10 l-6 18 16 -24 h-10z`, fill: '#3d2c00' }, g);
    } else if (kind === 'moon-cones') {
      [0, 36].forEach(dx => {
        el('path', { d: `M${x + dx - 13} ${ROAD_Y + 4} L${x + dx} ${ROAD_Y - 36} L${x + dx + 13} ${ROAD_Y + 4}Z`, fill: '#ff9a3d' }, g);
        el('rect', { x: x + dx - 8, y: ROAD_Y - 20, width: 16, height: 6, fill: '#fff' }, g);
      });
    } else if (kind === 'moon-rocks') {
      el('ellipse', { cx: x, cy: ROAD_Y - 6, rx: 34, ry: 22, fill: '#7a72a8' }, g);
      el('ellipse', { cx: x + 30, cy: ROAD_Y - 2, rx: 18, ry: 12, fill: '#6a6296' }, g);
    } else if (kind === 'crystal') {
      [[0, 70, '#9ef0ff'], [-24, 44, '#5fd3ec'], [26, 52, '#c9f7ff']].forEach(([dx, h, fill]) => {
        el('path', { d: `M${x + dx - 13} ${ROAD_Y + 2} L${x + dx - 9} ${ROAD_Y - h + 12} L${x + dx} ${ROAD_Y - h} L${x + dx + 9} ${ROAD_Y - h + 12} L${x + dx + 13} ${ROAD_Y + 2}Z`, fill, stroke: '#fff', 'stroke-width': 2, opacity: .92 }, g);
      });
    } else if (kind === 'candy') {
      el('line', { x1: x, y1: ROAD_Y, x2: x, y2: ROAD_Y - 80, stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
      el('circle', { cx: x, cy: ROAD_Y - 104, r: 30, fill: '#ff6fb1', stroke: '#fff', 'stroke-width': 4 }, g);
      el('path', { d: `M${x} ${ROAD_Y - 104} m-18 0 a18 18 0 0 1 36 0 a12 12 0 0 1 -24 0 a6 6 0 0 1 12 0`, fill: 'none', stroke: '#ffe066', 'stroke-width': 5 }, g);
    }
  }
  const PROPS = { moon: ['moon-sign', 'moon-cones', 'moon-rocks'], crystal: ['crystal', 'crystal'], candy: ['candy', 'moon-cones'] };
  function addProps(g, from, to) {
    const kinds = PROPS[route];
    let k = 0;
    for (let x = from; x < to; x += 330) prop(kinds[k++ % kinds.length], x, g);
  }

  // A leg is one stretch of road: its props, the station and battery, and the payoff structure.
  let legs = [];
  function newLegGroup() {
    const g = el('g', { class: 'leg' }, legsLayer);
    legs.push(g);
    // Old stretches are far behind the car; keep only the last three.
    while (legs.length > 3) legs.shift().remove();
    return g;
  }
  function buildLeg(index, base) {
    const g = newLegGroup();
    const arrival = base + DRIVE_DIST, stationX = arrival + STATION_OFFSET, batX = stationX - BAT_W / 2;
    const kind = PAYOFFS[index];
    if (index === 0) {
      for (let row = 0; row < 4; row++) for (let col = 0; col < 2; col++) {
        el('rect', { x: base + 290 + col * 14, y: ROAD_Y + row * 14, width: 14, height: 14, fill: (row + col) % 2 ? '#1b1d33' : '#fff' }, g);
      }
      el('line', { x1: base + 318, y1: ROAD_Y, x2: base + 318, y2: ROAD_Y - 110, stroke: '#c8cde8', 'stroke-width': 5 }, g);
      el('path', { d: `M${base + 318} ${ROAD_Y - 110} l52 14 -52 16z`, fill: '#ffd84d' }, g);
      addProps(g, base + 520, arrival + 60);
    } else {
      addProps(g, base + 760, arrival + 60);
    }
    const payoffLayer = el('g', { class: `payoff payoff-${kind}` }, g);
    if (kind === 'moon') {
      const lip = arrival + cruise(MOON_JUMP.launch, MOON_CAM) + moonCarX(MOON_JUMP.launch);
      el('path', { d: `M${lip - WEDGE_LEN} ${ROAD_Y + 2} L${lip} ${ROAD_Y - WEDGE_H + 14} L${lip} ${ROAD_Y + 2}Z`, fill: '#ff5e7a', stroke: '#ffd0da', 'stroke-width': 4, 'stroke-linejoin': 'round' }, payoffLayer);
      for (let k = 0; k < 3; k++) el('path', { d: `M${lip - 118 + k * 34} ${ROAD_Y - 6} l12 -8 -12 -8`, fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round' }, payoffLayer);
    } else if (kind === 'tunnel') {
      const first = arrival + cruise(1300, TUNNEL_CAM) + tunnelCarX(1300) + 240;
      const colors = ['#ff5e7a', '#ff9a3d', '#ffd84d', '#7ee07a', '#5fb2ff', '#b58cff'];
      for (let k = 0; k < 9; k++) {
        const cx = first + k * 190;
        colors.forEach((color, c) => {
          const r = 190 - c * 9;
          el('path', { d: `M${cx - r} ${ROAD_Y + 4} A${r} ${r} 0 0 1 ${cx + r} ${ROAD_Y + 4}`, fill: 'none', stroke: color, 'stroke-width': 9, opacity: .9 }, payoffLayer);
        });
      }
    } else {
      const cx = arrival + LOOP.ahead, cy = CAR_BASE_Y - LOOP.r;
      el('rect', { x: cx - 70, y: cy + 20, width: 14, height: CAR_BASE_Y - cy - 20, fill: '#6b73aa' }, payoffLayer);
      el('rect', { x: cx + 56, y: cy + 20, width: 14, height: CAR_BASE_Y - cy - 20, fill: '#6b73aa' }, payoffLayer);
      el('circle', { cx, cy, r: LOOP.r + 9, fill: 'none', stroke: '#9ef0ff', 'stroke-width': 18 }, payoffLayer);
      el('circle', { cx, cy, r: LOOP.r + 9, fill: 'none', stroke: '#1b2a5c', 'stroke-width': 6, 'stroke-dasharray': '18 22' }, payoffLayer);
    }
    const frameBottom = BAT_Y + CELL_H + BAT_PAD * 2;
    [batX + 60, batX + BAT_W - 86].forEach(x => {
      el('rect', { class: 'station-frame', x, y: frameBottom - 6, width: 26, height: ROAD_Y - frameBottom + 6, rx: 6 }, g);
      el('circle', { class: 'station-light', cx: x + 13, cy: frameBottom + 30, r: 7 }, g);
    });
    const batteryGroup = el('g', { class: 'battery', transform: `translate(${batX} ${BAT_Y})` }, g);
    const leg = { index, base, arrival, batX, kind, battery: batteryGroup, hint: null, group: g };
    buildBattery(leg, course[index]);
    if (index === PAYOFFS.length - 1) {
      const finishX = arrival + PAYOFF[kind].cam(PAYOFF[kind].duration) + 620;
      [finishX - 120, finishX + 120].forEach(x => el('rect', { x: x - 8, y: ROAD_Y - 200, width: 16, height: 200, fill: '#c8cde8' }, g));
      for (let col = 0; col < 16; col++) for (let row = 0; row < 2; row++) {
        el('rect', { x: finishX - 128 + col * 16, y: ROAD_Y - 232 + row * 16, width: 16, height: 16, fill: (row + col) % 2 ? '#1b1d33' : '#fff' }, g);
      }
    }
    return leg;
  }
  function buildForkSign(base) {
    const g = newLegGroup();
    const x = base + FORK_DIST + 640;
    addProps(g, base + 760, base + FORK_DIST + 60);
    el('rect', { x: x - 7, y: ROAD_Y - 230, width: 14, height: 232, rx: 5, fill: '#c8cde8' }, g);
    const board = (route, y, fill, emoji) => {
      const b = el('g', { class: 'fork-board', 'data-route': route }, g);
      el('path', { d: `M${x - 86} ${y - 34} H${x + 70} L${x + 108} ${y} L${x + 70} ${y + 34} H${x - 86}Z`, fill, stroke: '#fff', 'stroke-width': 4, 'stroke-linejoin': 'round' }, b);
      svgText(emoji, { x: x + 4, y: y + 2, 'font-size': 40, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, b);
      return b;
    };
    board('crystal', ROAD_Y - 190, '#3fa7c4', '💎');
    board('candy', ROAD_Y - 105, '#e0609f', '🍭');
    return g;
  }

  function buildBattery(leg, problem) {
    const battery = leg.battery;
    battery.replaceChildren();
    el('rect', { class: 'station-battery-body', x: 0, y: 0, width: BAT_W, height: CELL_H + BAT_PAD * 2, rx: 18 }, battery);
    el('rect', { class: 'battery-nub', x: BAT_W + 1, y: BAT_PAD + 16, width: 18, height: CELL_H - 32, rx: 5 }, battery);
    problem.slots.forEach((slotState, i) => {
      const cell = el('g', { class: 'cell', 'data-slot': i, 'data-state': slotState }, battery);
      paintCell(cell, slotState === 'charged');
    });
    leg.hint = el('g', { class: 'hint' }, battery);
  }
  function paintCell(cell, charged) {
    const i = Number(cell.dataset.slot);
    cell.replaceChildren();
    cell.dataset.state = charged ? 'charged' : 'empty';
    el('rect', { class: charged ? 'cell-charged' : 'cell-empty', x: cellX(i), y: BAT_PAD, width: CELL_W, height: CELL_H, rx: 9 }, cell);
    if (charged) {
      const cx = cellX(i) + CELL_W / 2, cy = BAT_PAD + CELL_H / 2;
      el('path', { class: 'cell-bolt', d: `M${cx + 4} ${cy - 22} l-15 25 h11 l-6 19 17 -27 h-11z` }, cell);
    }
  }

  // ---------- Scene state setters ----------
  let camera = 0;
  function setCamera(x) {
    camera = x;
    layers.world.setAttribute('transform', `translate(${-x} 0)`);
    layers.hills.setAttribute('transform', `translate(${-((x * .55) % HILL_TILE)} 0)`);
    layers.mid.setAttribute('transform', `translate(${-((x * .3) % MID_TILE)} 0)`);
    layers.stars.setAttribute('transform', `translate(${-((x * .06) % STAR_TILE)} 0)`);
  }
  let carX = CAR_REST_X;
  function setCar(x, up = 0, rotate = 0, sx = 1, sy = 1, shake = 0) {
    carX = x;
    car.setAttribute('transform', `translate(${x} ${CAR_BASE_Y - up}) rotate(${rotate}) scale(${sx} ${sy})`);
    carBody.setAttribute('transform', shake ? `translate(${shake} ${-Math.abs(shake) / 2})` : '');
    const deg = (((camera + x) / 22) * 180 / Math.PI) % 360;
    wheels[0].setAttribute('transform', `translate(-52 -16) rotate(${deg})`);
    wheels[1].setAttribute('transform', `translate(56 -16) rotate(${deg})`);
  }
  function setFlame(power) {
    flame.setAttribute('opacity', power.toFixed(2));
    flame.setAttribute('transform', `translate(-86 0) scale(${.4 + power * .7} 1) translate(86 0)`);
  }
  let moonY = MOON_HIDDEN_Y;
  function setMoon(y, opacity = 1) {
    moonY = y;
    moon.setAttribute('transform', `translate(${MOON_X} ${y})`);
    moon.setAttribute('opacity', opacity);
  }

  // ---------- Particles (sparks, dust, speed lines, stars) all run on the game clock. ----------
  function spawn(layer, shape, { x, y, vx = 0, vy = 0, gravity = 0, life = 800, spin = 0, fade = true }) {
    const node = shape();
    layer.append(node);
    particles.push({ node, x, y, vx, vy, gravity, life, age: 0, spin, angle: 0, fade });
  }
  function updateParticles(dt) {
    if (!particles.length) return;
    particles = particles.filter(p => {
      p.age += dt;
      if (p.age >= p.life) { p.node.remove(); return false; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.angle += p.spin * dt;
      p.node.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`);
      if (p.fade) p.node.setAttribute('opacity', (1 - p.age / p.life).toFixed(2));
      return true;
    });
  }
  const starShape = color => () => el('path', { d: 'M0 -12l3.5 7.5 8.5 1-6.2 5.6 1.7 8.4L0 16.2l-7.5 4.3 1.7-8.4L-12 6.5l8.5-1z', fill: color });
  const dotShape = (r, color) => () => el('circle', { r, fill: color });
  const lineShape = () => el('rect', { x: -40, y: -1.5, width: 80, height: 3, rx: 1.5, fill: '#dfe6ff' });
  const RAINBOW = ['#ff5e7a', '#ff9a3d', '#ffd84d', '#7ee07a', '#5fb2ff', '#b58cff'];
  function clearParticles() { particles.forEach(p => p.node.remove()); particles = []; }
  function speedLine() { spawn(fxBack, lineShape, { x: 1100, y: 40 + Math.random() * 380, vx: -2.2, life: 700 }); }

  // ---------- Game flow ----------
  let state = 'choose', carColor = null, course = [], index = 0, leg = null, route = 'moon';
  let problem = null, selected = null, misses = 0, hintShown = false;
  const panels = ['choose', 'drive', 'fork', 'math', 'boost', 'done'];
  function setState(next) { state = next; app.dataset.state = next; }
  function showPanel(name) { panels.forEach(p => { $(`panel-${p}`).hidden = p !== name; }); }
  function say(text, tone = '') {
    const bubble = $('bubble');
    bubble.hidden = !text;
    bubble.textContent = text || '';
    bubble.className = `bubble${tone ? ' ' + tone : ''}`;
  }
  function driveNote(text) { $('panel-drive').querySelector('.drive-note').innerHTML = text; }
  function renderProgress() {
    const total = PAYOFFS.length;
    $('progress').replaceChildren(...PAYOFFS.map((_, i) => {
      const dot = document.createElement('span');
      dot.className = i < index ? 'done' : i === index && state !== 'done' ? 'current' : '';
      return dot;
    }));
    $('progress').setAttribute('aria-label', state === 'done' ? `All ${total} stations done` : `Station ${index + 1} of ${total}`);
  }

  function chooseCar(button) {
    if (paused || state !== 'choose') return;
    carColor = button.dataset.color;
    document.querySelectorAll('.car-choice').forEach(b => b.setAttribute('aria-checked', String(b === button)));
    car.style.setProperty('--car', carColor);
    $('go').hidden = false;
    sfx.pick();
    if (!calm) play(360, t => setCar(CAR_REST_X, Math.sin(Math.PI * t / 360) * 26), () => setCar(CAR_REST_X));
  }
  // One star ticket buys one course; an unfinished course (even after a reload) resumes free.
  const tickets = window.StarTickets;
  function renderGoCost() { $('go-cost').hidden = !tickets || !tickets.wouldCharge('cosmic-rally'); }
  function go() {
    if (paused || state !== 'choose' || !carColor) return;
    if (tickets && !tickets.startRun('cosmic-rally')) { tickets.showEmpty({ onFreePlay: renderGoCost }); return; }
    renderGoCost();
    sfx.vroom();
    driveTo(DRIVE_DIST, DRIVE_MS, null, arriveAtStation);
  }

  // Drive the road automatically. The car eases back to its resting spot while the camera is moving.
  function driveTo(distance, duration, themeFrom, arrive) {
    setState('driving');
    showPanel('drive');
    driveNote('Vroom! <span aria-hidden="true">🚗💨</span>');
    say('');
    const base = camera, startX = carX, startMoon = moonY, themeTo = THEMES[route];
    const settle = () => {
      setCamera(base + distance); setCar(CAR_REST_X); setMoon(MOON_HIDDEN_Y);
      if (themeFrom) applyTheme(themeTo);
    };
    if (calm) {
      const curtain = $('curtain');
      play(CALM_DRIVE_MS, t => {
        if (t >= 350 && camera !== base + distance) settle();
        curtain.style.opacity = t < 350 ? t / 350 : Math.max(0, 1 - (t - 550) / 350);
      }, () => { curtain.style.opacity = 0; settle(); arrive(); });
      return;
    }
    play(duration, t => {
      const u = t / duration;
      setCamera(base + distance * easeInOut(u));
      const speed = Math.sin(Math.PI * u);
      const x = lerp(startX, CAR_REST_X, smooth((u - .2) / .55));
      setCar(x, Math.abs(Math.sin(t / 70)) * 3 * speed, -1.5 * speed);
      if (startMoon !== MOON_HIDDEN_Y) setMoon(lerp(startMoon, MOON_HIDDEN_Y, easeIn(clamp01(u * 2.2))));
      if (themeFrom) applyTheme(themeFrom, themeTo, smooth(u * 1.8));
      if (speed > .5 && Math.random() < .25) {
        spawn(fxBack, dotShape(4 + Math.random() * 4, '#b8b1e6'), { x: x - 80, y: CAR_BASE_Y - 8, vx: -.12 - Math.random() * .1, vy: -.03, life: 500 });
      }
    }, () => { settle(); arrive(); });
  }

  function startLeg(themeFrom = null) {
    leg = buildLeg(index, camera);
    renderProgress();
    driveTo(DRIVE_DIST, DRIVE_MS, themeFrom, arriveAtStation);
  }
  function arriveAtStation() {
    problem = course[index];
    renderMath();
    setState('answering');
    showPanel('math');
    say('⚡ How many more?');
    sfx.arrive();
  }

  function renderMath() {
    selected = null; misses = 0; hintShown = false;
    const parts = problem.equation.map((part, i) => {
      const node = document.createElement('span');
      if (part.kind === 'blank') {
        node.className = 'eq-blank'; node.id = 'blank'; node.textContent = '?';
        node.setAttribute('aria-label', 'Answer, empty');
      } else if (part.kind === 'op') {
        node.className = 'eq-op'; node.textContent = part.value;
      } else {
        // The first number is the given charges and shares their yellow.
        node.className = i === 0 ? 'eq-num eq-given' : 'eq-num';
        node.textContent = part.value;
      }
      return node;
    });
    $('equation').replaceChildren(...parts);
    updatePad();
  }
  function updatePad() {
    document.querySelectorAll('#pad button').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.value) === selected));
      if (selected === null) b.classList.remove('wrong', 'right');
    });
    const blank = $('blank');
    if (!blank) return;
    blank.textContent = selected === null ? '?' : selected;
    blank.classList.toggle('filled', selected !== null);
    blank.setAttribute('aria-label', selected === null ? 'Answer, empty' : `Answer, ${selected}`);
  }
  // One tap answers: the number goes into the box and is checked right away.
  function pick(value) {
    if (paused || state !== 'answering') return;
    selected = value;
    updatePad();
    const button = $('pad').children[value];
    if (Logic.checkAnswer(problem, value)) {
      setState('filling');
      button.classList.add('right');
      $('blank').classList.add('correct');
      say('Yes! ⚡', 'good');
      sfx.correct();
      fillBattery();
      return;
    }
    // Wrong: keep the child here, show the pick briefly, then let them try again.
    misses++;
    setState('retry');
    button.classList.add('wrong');
    say('Try again!', 'retry');
    sfx.retry();
    after(800, () => {
      if (state !== 'retry') return;
      selected = null;
      updatePad();
      setState('answering');
      if (misses >= Logic.HINT_AFTER_MISSES) showHint();
      else say('⚡ How many more?');
    });
  }
  function showHint() {
    if (!hintShown) {
      hintShown = true;
      problem.hint.forEach(({ slot, label }) => {
        const x = cellX(slot);
        el('rect', { class: 'cell-hint', x: x - 3, y: BAT_PAD - 3, width: CELL_W + 6, height: CELL_H + 6, rx: 11 }, leg.hint);
        svgText(label, { class: 'hint-label', x: x + CELL_W / 2, y: BAT_PAD + CELL_H / 2, 'data-hint': label }, leg.hint);
      });
    }
    say(problem.answer === 0 ? 'No empty spaces!' : 'Count the empty spaces', 'retry');
  }
  function fillBattery() {
    leg.hint.replaceChildren();
    const empties = [...leg.battery.querySelectorAll('.cell[data-state="empty"]')];
    const step = calm ? 0 : 280;
    empties.forEach((cell, k) => after(200 + k * step, () => {
      paintCell(cell, true);
      sfx.charge(k);
      if (!calm) {
        const cx = leg.batX - camera + cellX(Number(cell.dataset.slot)) + CELL_W / 2;
        for (let s = 0; s < 4; s++) spawn(fxFront, dotShape(4, '#fff3b0'), { x: cx, y: BAT_Y + BAT_PAD + CELL_H / 2, vx: (Math.random() - .5) * .3, vy: -.15 - Math.random() * .15, gravity: .0006, life: 500 });
      }
    }));
    after(200 + empties.length * step + 400, () => {
      sfx.full();
      setState('ready');
      showPanel('boost');
      say('Full! Tap Boost!', 'good');
      $('boost').classList.toggle('pulse', !calm);
    });
  }

  // ---------- Payoffs ----------
  function boost() {
    if (paused || state !== 'ready') return;
    setState('boosting');
    $('boost').classList.remove('pulse');
    showPanel('drive');
    driveNote('Whoosh! <span aria-hidden="true">🚀</span>');
    say('');
    sfx.boost();
    setMusicLevel(.35);
    const payoff = PAYOFF[leg.kind], arrival = leg.arrival;
    const endCamera = arrival + payoff.cam(payoff.duration);
    const endX = { moon: moonCarX(MOON_JUMP.end), tunnel: tunnelCarX(TUNNEL_CAM.d1), loop: arrival + LOOP.ahead - endCamera + loopExit(1) }[leg.kind];
    const done = () => { setFlame(0); setMusicLevel(1); stationDone(); };
    if (calm) {
      // Calm motion: glow, fade out, and fade in past the structure.
      const curtain = $('curtain');
      play(CALM_PAYOFF_MS, t => {
        setFlame(clamp01(t / 400) * .8);
        if (leg.kind === 'moon') setMoon(MOON_UP_Y, clamp01((t - 850) / 400));
        curtain.style.opacity = t < 500 ? 0 : t < 850 ? (t - 500) / 350 : Math.max(0, 1 - (t - 850) / 350);
        if (t >= 850 && camera !== endCamera) { setCamera(endCamera); setCar(endX); }
      }, () => { curtain.style.opacity = 0; setCamera(endCamera); setCar(endX); done(); });
      return;
    }
    // Sparks travel from the battery down to the car while it powers up.
    for (let k = 0; k < 10; k++) after(k * 55, () => {
      const sx = leg.batX - camera + cellX(k) + CELL_W / 2, sy = BAT_Y + BAT_PAD + CELL_H / 2;
      const tx = CAR_REST_X, ty = CAR_BASE_Y - 60;
      spawn(fxFront, starShape('#ffd84d'), { x: sx, y: sy, vx: (tx - sx) / 450, vy: (ty - sy) / 450, life: 450, spin: .4 });
    });
    const powerUp = t => (t < payoff.power ? Math.sin(t * .09) * 3 * (t / payoff.power) : 0);
    if (leg.kind === 'moon') {
      after(MOON_JUMP.land, landBurst);
      play(payoff.duration, t => {
        setCamera(arrival + payoff.cam(t));
        const x = moonCarX(t), J = MOON_JUMP;
        let up = 0, rotate = 0, sx = 1, sy = 1;
        if (t < J.launch) {
          const lip = arrival + cruise(J.launch, MOON_CAM) + moonCarX(J.launch);
          const climb = clamp01((camera + x - (lip - WEDGE_LEN)) / WEDGE_LEN);
          up = climb * WEDGE_H; rotate = climb > 0 && climb < 1 ? -15 : 0;
        } else if (t < J.land) {
          const u = span(t, J.launch, J.land);
          up = WEDGE_H * (1 - u) + JUMP_H * 4 * u * (1 - u);
          rotate = lerp(-15, 12, u);
        } else {
          const squash = Math.sin(Math.PI * span(t, J.land, J.land + 260)) * .12;
          sx = 1 + squash; sy = 1 - squash;
        }
        setCar(x, up, rotate, sx, sy, powerUp(t));
        setFlame(t < J.power ? t / J.power : t < J.land ? .85 + Math.sin(t / 30) * .15 : Math.max(0, 1 - (t - J.land) / 400));
        setMoon(lerp(MOON_HIDDEN_Y, MOON_UP_Y, easeOut(span(t, 400, 2300))));
        if (t > 900 && t < 3600 && Math.random() < .5) speedLine();
        if (t > J.power && t < J.land && Math.random() < .6) {
          spawn(fxBack, starShape(Math.random() < .5 ? '#ffd84d' : '#ff9ad5'), { x: x - 110, y: CAR_BASE_Y - up - 34, vx: -.25, vy: (Math.random() - .5) * .1, life: 600, spin: .3 });
        }
      }, () => after(300, done));
    } else if (leg.kind === 'tunnel') {
      after(1350, sfx.rainbow);
      play(payoff.duration, t => {
        setCamera(arrival + payoff.cam(t));
        const x = tunnelCarX(t);
        setCar(x, Math.abs(Math.sin(t / 60)) * 2, t > 600 && t < 2800 ? -2 : 0, 1, 1, powerUp(t));
        setFlame(t < 600 ? t / 600 : t < 2800 ? .85 + Math.sin(t / 30) * .15 : Math.max(0, 1 - (t - 2800) / 500));
        if (t > 700 && t < 3000 && Math.random() < .5) speedLine();
        if (t > 1300 && t < 2900) {
          for (let k = 0; k < 2; k++) {
            spawn(fxBack, starShape(RAINBOW[Math.floor(Math.random() * RAINBOW.length)]), { x: x - 100, y: CAR_BASE_Y - 30 - Math.random() * 60, vx: -.3 - Math.random() * .2, vy: (Math.random() - .5) * .15, life: 700, spin: .4 });
          }
        }
      }, () => { after(200, () => { rainbowBurst(); after(700, done); }); });
    } else {
      after(LOOP.enter, sfx.loop);
      play(payoff.duration, t => {
        setCamera(arrival + payoff.cam(t));
        const center = arrival + LOOP.ahead - camera;
        let x, up = 0, rotate = 0;
        if (t < LOOP.enter) x = lerp(CAR_REST_X, center, easeIn(span(t, LOOP.power, LOOP.enter)));
        else if (t < LOOP.exit) {
          const phi = 2 * Math.PI * span(t, LOOP.enter, LOOP.exit);
          x = center + LOOP.r * Math.sin(phi);
          up = LOOP.r - LOOP.r * Math.cos(phi);
          rotate = -phi * 180 / Math.PI;
        } else x = center + loopExit(span(t, LOOP.exit, LOOP.end));
        setCar(x, up, rotate, 1, 1, powerUp(t));
        setFlame(t < LOOP.power ? t / LOOP.power : t < LOOP.exit ? .85 + Math.sin(t / 30) * .15 : Math.max(0, 1 - (t - LOOP.exit) / 400));
        if (t > LOOP.power && t < LOOP.exit && Math.random() < .5) {
          const dir = -rotate * Math.PI / 180;
          spawn(fxBack, starShape(Math.random() < .5 ? '#9ef0ff' : '#ffd84d'), { x: x - 90 * Math.cos(dir), y: CAR_BASE_Y - up - 34 + 90 * Math.sin(dir), life: 600, spin: .3 });
        }
      }, () => after(300, done));
    }
  }
  function landBurst() {
    sfx.land();
    for (let k = 0; k < 14; k++) {
      spawn(fxBack, dotShape(6 + Math.random() * 6, '#b8b1e6'), { x: carX + (Math.random() - .5) * 120, y: CAR_BASE_Y - 4, vx: (Math.random() - .5) * .5, vy: -.1 - Math.random() * .2, gravity: .0008, life: 700 });
    }
    starBurst(['#ffd84d', '#9ef0ff']);
  }
  function rainbowBurst() { starBurst(RAINBOW); }
  function starBurst(colors) {
    for (let k = 0; k < 12; k++) {
      const angle = (k / 12) * Math.PI * 2;
      spawn(fxFront, starShape(colors[k % colors.length]), { x: carX, y: CAR_BASE_Y - 60, vx: Math.cos(angle) * .35, vy: Math.sin(angle) * .35 - .1, gravity: .0005, life: 900, spin: .5 });
    }
  }

  // After each payoff: next station, the road fork, or the finish.
  function stationDone() {
    index++;
    renderProgress();
    if (index >= PAYOFFS.length) { finish(); return; }
    if (index === FORK_AFTER && route === 'moon') { goToFork(); return; }
    startLeg();
  }
  function goToFork() {
    buildForkSign(camera);
    driveTo(FORK_DIST, FORK_MS, null, () => {
      setState('fork');
      showPanel('fork');
      say('Pick a road!');
      sfx.arrive();
    });
  }
  // Both roads are safe; the choice only changes the scenery, and it waits as long as needed.
  function chooseRoute(choice) {
    if (paused || state !== 'fork') return;
    const from = THEMES[route];
    route = choice;
    document.querySelectorAll('.fork-board').forEach(board => board.setAttribute('opacity', board.dataset.route === choice ? 1 : .35));
    sfx.pick();
    sfx.vroom();
    startLeg(from);
  }

  function finish() {
    if (tickets) tickets.finishRun('cosmic-rally');
    setState('done');
    renderProgress();
    showPanel('done');
    say('You did it! 🏆', 'good');
    sfx.fanfare();
    const trophy = $('trophy');
    trophy.hidden = false;
    if (calm) { trophy.style.transform = 'translateX(-50%)'; return; }
    play(700, t => {
      const u = t / 700, s = u < .7 ? easeOut(u / .7) * 1.15 : lerp(1.15, 1, (u - .7) / .3);
      trophy.style.transform = `translateX(-50%) scale(${s.toFixed(3)})`;
    });
    for (let k = 0; k < 36; k++) after(k * 40, () => {
      const colors = ['#ffd84d', '#9ef0ff', '#ff9ad5', '#9ece6a'];
      spawn(fxFront, starShape(colors[k % 4]), { x: Math.random() * 1000, y: -40, vx: (Math.random() - .5) * .08, vy: .15 + Math.random() * .12, life: 3200, spin: (Math.random() - .5) * .6, fade: false });
    });
  }

  // Replay resets every piece of run state; listeners and the frame loop are created only once.
  function resetRun() {
    timeline = null;
    tasks = [];
    clearParticles();
    fxBack.replaceChildren(); fxFront.replaceChildren();
    legs.forEach(g => g.remove());
    legs = [];
    route = 'moon';
    applyTheme(THEMES.moon);
    setCamera(0);
    setFlame(0);
    setMoon(MOON_HIDDEN_Y);
    setCar(CAR_REST_X);
    $('curtain').style.opacity = 0;
    $('trophy').hidden = true;
    $('trophy').style.transform = '';
    course = Logic.makeCourse({ count: PAYOFFS.length, forced: forcedCharges });
    index = 0;
    problem = null; selected = null; misses = 0; hintShown = false;
    $('equation').replaceChildren();
    say('');
    setMusicLevel(1);
    setState('choose');
    leg = buildLeg(0, 0);
    renderProgress();
    showPanel('choose');
    $('go').hidden = !carColor;
    renderGoCost();
  }
  function replay() {
    if (paused || state !== 'done') return;
    resetRun();
  }

  // ---------- Pause, sound, motion ----------
  function setPaused(value) {
    if (paused === value) return;
    paused = value;
    lastFrame = null;
    app.classList.toggle('paused', paused);
    $('pause-screen').hidden = !paused;
    if (audioContext) {
      if (paused) audioContext.suspend();
      else if (!muted) audioContext.resume();
    }
    if (paused) $('resume').focus({ preventScroll: true });
  }
  function updateToolButtons() {
    $('sound').setAttribute('aria-pressed', String(!muted));
    $('sound').setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
    $('sound').firstElementChild.textContent = muted ? '🔇' : '🔊';
    $('music').setAttribute('aria-pressed', String(musicOn));
    $('music').setAttribute('aria-label', musicOn ? 'Music on' : 'Music off');
    $('calm').setAttribute('aria-pressed', String(calm));
    $('calm').setAttribute('aria-label', calm ? 'Calm motion on' : 'Calm motion off');
    app.classList.toggle('calm', calm);
  }

  // ---------- Setup (runs once) ----------
  buildBackdrop();
  document.querySelectorAll('.car-choice').forEach(button => {
    const mini = document.createElementNS(NS, 'svg');
    mini.setAttribute('viewBox', '-100 -132 200 140');
    mini.setAttribute('aria-hidden', 'true');
    mini.style.setProperty('--car', button.dataset.color);
    el('use', { href: '#car-body' }, mini);
    button.append(mini);
    button.addEventListener('click', () => chooseCar(button));
  });
  for (let n = 0; n <= Logic.TOTAL; n++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.value = n;
    button.textContent = n;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => pick(n));
    $('pad').append(button);
  }
  document.querySelectorAll('.route-button').forEach(button => button.addEventListener('click', () => chooseRoute(button.dataset.route)));
  $('go').addEventListener('click', go);
  $('boost').addEventListener('click', boost);
  $('replay').addEventListener('click', replay);
  $('pause').addEventListener('click', () => setPaused(true));
  $('resume').addEventListener('click', () => setPaused(false));
  $('sound').addEventListener('click', () => {
    muted = !muted;
    store.set('cosmic-rally-sound', muted ? 'off' : 'on');
    if (audioContext) { if (muted) audioContext.suspend(); else if (!paused) audioContext.resume(); }
    updateToolButtons();
    sfx.tap();
  });
  $('music').addEventListener('click', () => {
    musicOn = !musicOn;
    store.set('cosmic-rally-music', musicOn ? 'on' : 'off');
    if (musicOn) audio(); else stopMusic();
    updateToolButtons();
  });
  $('calm').addEventListener('click', () => {
    calm = !calm;
    store.set('cosmic-rally-calm', calm ? 'on' : 'off');
    updateToolButtons();
    $('boost').classList.toggle('pulse', !calm && state === 'ready');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  window.addEventListener('pagehide', () => setPaused(true));
  window.addEventListener('pageshow', () => { lastFrame = null; });
  // Block pinch and double-tap zoom gestures that Safari still allows.
  document.addEventListener('gesturestart', event => event.preventDefault());
  document.addEventListener('dblclick', event => event.preventDefault());

  updateToolButtons();
  resetRun();
  requestAnimationFrame(frame);

  // FUN gate: checked before anything playable shows, and again on Back, wake, or 15 idle minutes.
  const gate = window.FunGate;
  function requireUnlock() {
    if (gate.isUnlocked()) { document.documentElement.classList.add('fun-open'); return; }
    document.documentElement.classList.remove('fun-open');
    if (audioContext || state !== 'choose') setPaused(true);
    gate.prompt({
      onUnlock: () => { gateWatch.refresh(); document.documentElement.classList.add('fun-open'); },
      onCancel: () => location.replace('index.html#' + gate.previousTab())
    });
  }
  const gateWatch = gate.watch(requireUnlock);
  window.addEventListener('pageshow', requireUnlock);
  requireUnlock();

  // Read-only view for browser checks.
  window.cosmicRally = {
    get state() { return state; },
    get problem() { return problem; },
    get course() { return course.map(p => p.given); },
    get index() { return index; },
    get route() { return route; },
    get kind() { return leg ? leg.kind : null; },
    get misses() { return misses; },
    get paused() { return paused; },
    get clock() { return clock; },
    get legs() { return legs.length; },
    get battery() { return leg ? leg.battery : null; },
    get audio() { return { state: audioContext ? audioContext.state : 'none', music: musicOn && !!musicBus }; },
    get pending() { return { tasks: tasks.length, particles: particles.length, timeline: !!timeline }; }
  };
})();
