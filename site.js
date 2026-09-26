(() => {
  const home = document.body.dataset.page === 'home';
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    ${home ? '<button class="shell-button menu-button" aria-label="Open navigation" aria-haspopup="dialog" aria-controls="site-menu" aria-expanded="false"><span aria-hidden="true">☰</span></button>' : ''}
    <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true">✦</span> HS Math<span class="brand-tag">little steps, big discoveries</span></a>
    <button class="shell-button theme-button" type="button"></button>`;
  document.body.prepend(header);
  if (home) {
    const menu = document.createElement('dialog');
    menu.id = 'site-menu';
    menu.className = 'site-menu';
    menu.setAttribute('aria-labelledby', 'menu-title');
    menu.innerHTML = `
      <div class="menu-heading"><h2 id="menu-title">Let’s explore</h2><button class="shell-button close-menu" aria-label="Close navigation">✕</button></div>
      <p class="eyebrow">YOUR MATH NOTEBOOK</p>
      <nav aria-label="Years and lessons">
        <a class="year-link" data-year="2025" href="index.html#2025"><span>2025</span><span class="nav-caption">Practice corner</span></a>
        <a class="year-link" data-year="2026" href="index.html#2026"><span>2026</span><span class="nav-caption">A new adventure</span></a>
        <div class="lesson-nav" id="lesson-nav"><span>Lessons coming soon</span></div>
      </nav>
      <div class="menu-note"><span aria-hidden="true">🚙</span><p>A little practice.<br>A new discovery.</p></div>`;
    document.body.append(menu);
    const openButton = header.querySelector('.menu-button');
    openButton.addEventListener('click', () => {
      menu.showModal();
      openButton.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
    });
    const closeMenu = () => menu.close();
    menu.querySelector('.close-menu').addEventListener('click', closeMenu);
    menu.addEventListener('click', event => { if (event.target === menu && event.clientX >= menu.getBoundingClientRect().right) closeMenu(); });
    menu.addEventListener('close', () => {
      openButton.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      openButton.focus();
    });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  }
  if (home && window.mathLessons) {
    const cards = document.getElementById('lesson-cards');
    const navigation = document.getElementById('lesson-nav');
    navigation.replaceChildren();
    document.getElementById('lesson-count').textContent = `${mathLessons.length} lessons`;
    mathLessons.forEach(lesson => {
      const card = document.createElement('a');
      card.className = 'lesson-card';
      card.href = lessonHref(lesson);
      const tag = document.createElement('div'); tag.className = 'card-tag'; tag.textContent = `LESSON ${lesson.id}`;
      const title = document.createElement('h3'); title.textContent = lesson.title;
      const description = document.createElement('p'); description.textContent = lesson.description;
      const action = document.createElement('span'); action.className = 'card-action'; action.textContent = 'Let’s practice ↗';
      const top = document.createElement('div'); top.className = 'card-top';
      const art = document.createElement('span');
      art.className = `ten-card-art ${lesson.skill === 'count-groups' ? 'two-groups' : 'make-ten'}`;
      art.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 10; i++) {
        const dot = document.createElement('i'); art.append(dot);
      }
      if (lesson.skill === 'missing-addend') {
        const badge = document.createElement('b'); badge.textContent = '?'; art.append(badge);
      }
      top.append(art, tag);
      card.append(top, title, description, action); cards.append(card);
      const link = document.createElement('a'); link.href = lessonHref(lesson); link.textContent = `Lesson ${lesson.id}`;
      link.addEventListener('click', () => document.getElementById('site-menu').close());
      navigation.append(link);
    });
  }
  const toggle = header.querySelector('.theme-button');
  const updateThemeButton = () => {
    const dark = document.documentElement.dataset.theme !== 'light';
    toggle.textContent = dark ? '☀ Light' : '☾ Dark';
    toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  };
  toggle.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('hs-math-theme', theme); } catch (_) {}
    updateThemeButton();
  });
  updateThemeButton();
  function selectYear() {
    const year = home && location.hash === '#2026' ? '2026' : '2025';
    document.querySelectorAll('[data-year]').forEach(link => {
      if (link.dataset.year === year) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (home) {
      document.querySelectorAll('[data-year-panel]').forEach(panel => { panel.hidden = panel.dataset.yearPanel !== year; });
      document.title = `${year} · HS Math`;
    }
  }
  window.addEventListener('hashchange', selectYear);
  selectYear();
})();
