(() => {
  const lesson = mathLessons.find(item => item.id === new URLSearchParams(location.search).get('lesson'));
  const $ = id => document.getElementById(id);
  if (!lesson) {
    $('lesson-title').textContent = 'Choose a lesson';
    $('practice').hidden = true;
    return;
  }
  document.title = `${lesson.id} · ${lesson.title} · HS Math`;
  $('lesson-number').textContent = `2026 · LESSON ${lesson.id}`;
  $('lesson-title').textContent = lesson.title;
  // Skill definitions supply fresh problems and the visual/hint behavior.
  const skills = {
    'count-groups': {
      answers: q => [q.given, 10 - q.given],
      tappable: () => true,
      instruction: 'Count each group. Tap a box. Choose a number.',
      hint: 'Tap each shape to count its group.'
    },
    'missing-addend': {
      answers: q => [q.given, 10 - q.given],
      tappable: (q, i) => i >= q.given,
      instruction: 'How many more? Tap a box. Choose a number.',
      hint: 'Tap each empty space to count how many more.'
    }
  };
  const skill = skills[lesson.skill];
  let questions, index, values, selected, mistakes, hint, locked, counted, setId, credited;
  let audioContext;
  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  function start() {
    // One endpoint pair per set; remaining questions practice nonzero groups.
    const given = shuffle([Math.random() < .5 ? 0 : 10, ...shuffle([1,2,3,4,5,6,7,8,9]).slice(0, 4)]);
    questions = given.map(n => ({ given: n }));
    index = 0;
    // Each set of five gets its own id, so a finished set pays out one star ticket at most.
    setId = `lesson-${lesson.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    // Hints and a few retries keep the ticket; guessing through many numbers on a question does not.
    credited = true;
    $('practice').hidden = false;
    $('finish').hidden = true;
    render();
  }
  function render() {
    const q = questions[index];
    values = [null, null];
    selected = lesson.skill === 'count-groups' ? 0 : 1;
    mistakes = 0; hint = false; locked = false; counted = new Set();
    $('help').hidden = true;
    $('hint-counts').hidden = true;
    $('feedback').textContent = '';
    $('instruction').textContent = skill.instruction;
    $('progress').replaceChildren(...questions.map((_, i) => {
      const dot = document.createElement('span');
      dot.className = i < index ? 'done' : i === index ? 'current' : '';
      dot.setAttribute('aria-label', `Question ${i + 1}${i < index ? ', complete' : i === index ? ', current' : ''}`);
      return dot;
    }));
    $('frame').replaceChildren(...Array.from({length: 10}, (_, i) => {
      const cell = document.createElement('button');
      cell.className = `frame-cell${i >= q.given ? ' group-two' : ''}`;
      const filled = lesson.skill === 'count-groups' || i < q.given;
      cell.setAttribute('aria-label', `Space ${i + 1}: ${filled ? i < q.given ? 'circle, first group' : 'square, second group' : 'empty'}`);
      if (filled) { const shape = document.createElement('span'); shape.className = 'object'; cell.append(shape); }
      cell.disabled = true;
      cell.addEventListener('click', () => {
        if (!hint || locked || counted.has(i)) return;
        counted.add(i);
        cell.classList.add('counted');
        cell.setAttribute('aria-pressed', 'true');
        const groupCount = [...counted].filter(n => (n < q.given) === (i < q.given)).length;
        const label = document.createElement('span'); label.className = 'count-label'; label.textContent = groupCount; cell.append(label);
        const first = [...counted].filter(n => n < q.given).length;
        const second = counted.size - first;
        $('hint-counts').textContent = lesson.skill === 'count-groups' ? `● ${first}     ■ ${second}` : `Empty spaces counted: ${second}`;
      });
      return cell;
    }));
    $('equation').replaceChildren();
    for (let part = 0; part < 2; part++) {
      if (part) { const plus = document.createElement('span'); plus.textContent = '+'; $('equation').append(plus); }
      const blank = lesson.skill === 'count-groups' || part === 1;
      const el = document.createElement(blank ? 'button' : 'span');
      if (blank) {
        el.className = 'blank'; el.dataset.part = part;
        el.addEventListener('click', () => { if (!locked) { selected = part; update(); } });
      } else el.textContent = q.given;
      $('equation').append(el);
    }
    const total = document.createElement('span'); total.textContent = '= 10'; $('equation').append(total);
    update();
  }
  function update() {
    document.querySelectorAll('.blank').forEach(el => {
      const part = Number(el.dataset.part);
      el.textContent = values[part] === null ? '?' : values[part];
      el.classList.toggle('selected', selected === part);
      el.setAttribute('aria-label', `${part === 0 ? 'First' : 'Second'} number: ${values[part] === null ? 'blank' : values[part]}`);
      el.setAttribute('aria-pressed', String(selected === part));
    });
    $('practice').querySelectorAll('button').forEach(el => {
      el.disabled = locked || (el.classList.contains('frame-cell') && (!hint || !skill.tappable(questions[index], [...$('frame').children].indexOf(el))));
    });
  }
  for (let n = 0; n <= 10; n++) {
    const button = document.createElement('button'); button.textContent = n;
    button.addEventListener('click', () => {
      if (locked) return;
      values[selected] = n;
      if (lesson.skill === 'count-groups' && values[1 - selected] === null) selected = 1 - selected;
      $('feedback').textContent = '';
      update();
    });
    $('number-pad').append(button);
  }
  $('clear').addEventListener('click', () => { values = [null, null]; $('feedback').textContent = ''; update(); });
  $('help').addEventListener('click', () => {
    hint = true; $('help').hidden = true;
    $('instruction').textContent = skill.hint;
    $('hint-counts').hidden = false;
    $('hint-counts').textContent = lesson.skill === 'count-groups' ? '● 0     ■ 0' : 'Empty spaces counted: 0';
    update();
  });
  function celebrate() {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume();
      [523,659,784].forEach((frequency, i) => {
        const osc = audioContext.createOscillator(), gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination); osc.frequency.value = frequency;
        const t = audioContext.currentTime + i * .12;
        gain.gain.setValueAtTime(.08, t); gain.gain.exponentialRampToValueAtTime(.001, t + .2);
        osc.start(t); osc.stop(t + .2);
      });
    } catch (_) {}
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < 18; i++) {
      const piece = document.createElement('span'); piece.className = 'lesson-confetti'; piece.textContent = ['✦','●','■'][i % 3];
      piece.style.left = `${Math.random() * 100}%`; piece.style.color = ['var(--blue)','var(--mint)','var(--peach)'][i % 3];
      document.body.append(piece); setTimeout(() => piece.remove(), 2000);
    }
  }
  $('check').addEventListener('click', () => {
    if (locked) return;
    const blanks = [...document.querySelectorAll('.blank')].map(el => Number(el.dataset.part));
    if (blanks.some(part => values[part] === null)) { $('feedback').textContent = 'Choose a number for each box.'; return; }
    const answers = skill.answers(questions[index]);
    if (!blanks.every(part => values[part] === answers[part])) {
      mistakes++;
      $('feedback').textContent = mistakes === 1 ? 'Try again. You can do it!' : 'Try again. Help is here if you need it.';
      $('help').hidden = mistakes < 2 || hint;
      return;
    }
    if (window.StarTickets && !window.StarTickets.earnsCredit(mistakes)) credited = false;
    locked = true; update(); $('feedback').textContent = 'You did it! 🌟'; celebrate();
    setTimeout(() => {
      index++;
      if (index < questions.length) render();
      else { $('practice').hidden = true; $('finish').hidden = false; $('finish-title').focus(); earnTicket(); }
    }, 2000);
  });
  function earnTicket() {
    const tickets = window.StarTickets;
    if (!tickets) return;
    const earned = credited && tickets.award(setId);
    $('ticket-earned').hidden = !earned;
    $('ticket-missed').hidden = earned || credited;
    $('ticket-count').textContent = tickets.balance();
  }
  $('again').addEventListener('click', start);
  start();
})();
