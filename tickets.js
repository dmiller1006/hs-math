// Star tickets: practice earns them, FUN games spend them. One jar per device, kept in localStorage.
// Rules live here once for every page:
// - Finishing a five-question practice set earns one ticket; each set id pays out only once.
// - Starting a game run (a Creature Island level, a Cosmic Rally course) costs one ticket.
//   An unfinished run resumes free, including after a reload.
// - Grown-up Free play (behind the FUN code) plays without spending, until FUN locks again.
window.StarTickets = (() => {
  const testing = new URLSearchParams(location.search).has('test');
  const KEY = testing ? 'hs-math-tickets-test' : 'hs-math-tickets';
  const FREE_KEY = testing ? 'hs-math-free-play-test' : 'hs-math-free-play';
  const MAX_BALANCE = 99;
  const MAX_REMEMBERED = 200;

  const blank = () => ({ balance: 0, awarded: [], runs: {} });
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      if (!data || typeof data !== 'object') return blank();
      return {
        balance: Math.max(0, Math.min(MAX_BALANCE, Math.floor(Number(data.balance)) || 0)),
        awarded: Array.isArray(data.awarded) ? data.awarded.filter(id => typeof id === 'string') : [],
        runs: data.runs && typeof data.runs === 'object' ? data.runs : {}
      };
    } catch (_) { return blank(); }
  }
  const listeners = new Set();
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {}
    listeners.forEach(fn => fn());
  }
  if (testing) { try { localStorage.removeItem(KEY); sessionStorage.removeItem(FREE_KEY); } catch (_) {} }

  const balance = () => load().balance;
  // Returns true only the first time a given set id pays out.
  function award(setId) {
    const data = load();
    if (!setId || data.awarded.includes(setId)) return false;
    data.awarded.push(setId);
    if (data.awarded.length > MAX_REMEMBERED) data.awarded = data.awarded.slice(-MAX_REMEMBERED);
    data.balance = Math.min(MAX_BALANCE, data.balance + 1);
    save(data);
    return true;
  }
  // Endless activities pay out after each five correctly solved problems.
  function practiceSet(activity) {
    let solved = 0;
    let setId = `${activity}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return {
      count: () => solved,
      recordCorrect() {
        solved++;
        if (solved < 5) return false;
        const earned = award(setId);
        solved = 0;
        setId = `${activity}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        return earned;
      }
    };
  }
  const activeRun = game => load().runs[game] || null;
  // Resume the matching unfinished run for free, or spend one ticket on a new run. Returns the run, or null.
  function startRun(game, info = {}) {
    const data = load();
    const run = data.runs[game];
    if (run && Object.keys(info).every(key => run[key] === info[key])) return run;
    const free = isFreePlay();
    if (!free && data.balance < 1) return null;
    if (!free) data.balance--;
    data.runs[game] = { ...info, free, started: Date.now() };
    save(data);
    return data.runs[game];
  }
  function finishRun(game) {
    const data = load();
    if (!data.runs[game]) return;
    delete data.runs[game];
    save(data);
  }
  // A new run is free right now (resuming, or Free play), so the ticket cost can be hidden.
  const wouldCharge = (game, info = {}) => {
    const run = activeRun(game);
    return !(run && Object.keys(info).every(key => run[key] === info[key])) && !isFreePlay();
  };

  const session = {
    get() { try { return sessionStorage.getItem(FREE_KEY); } catch (_) { return null; } },
    set(on) { try { if (on) sessionStorage.setItem(FREE_KEY, '1'); else sessionStorage.removeItem(FREE_KEY); } catch (_) {} }
  };
  // Free play only counts while the FUN unlock is still valid.
  const isFreePlay = () => session.get() === '1' && !!window.FunGate && window.FunGate.isUnlocked();
  function setFreePlay(on) { session.set(on); listeners.forEach(fn => fn()); }
  // Always asks for the code, even inside an unlocked FUN area, because a child may be holding the iPad.
  function requestFreePlay(onDone) {
    if (!window.FunGate) return;
    window.FunGate.prompt({ onUnlock: () => { setFreePlay(true); if (onDone) onDone(); }, onCancel: () => {} });
  }
  const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  window.addEventListener('storage', event => { if (event.key === KEY) listeners.forEach(fn => fn()); });

  // Shared "empty jar" card for games: practice link, grown-up Free play, and Back.
  let emptyCard = null;
  function showEmpty({ onFreePlay, onClose } = {}) {
    if (emptyCard) return;
    const root = document.createElement('div');
    root.className = 'ticket-empty';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'ticket-empty-title');
    root.innerHTML = `
      <div class="ticket-empty-card" tabindex="-1">
        <p class="ticket-empty-jar" aria-hidden="true">🫙</p>
        <h2 id="ticket-empty-title">Out of tickets</h2>
        <p class="ticket-empty-copy">Solve five 2025 activity problems or finish a 2026 lesson to earn a <span aria-hidden="true">🎟️</span> star ticket.</p>
        <a class="big-button ticket-practice" href="index.html#2025"><span aria-hidden="true">✏️</span> 2025 activities</a>
        <a class="big-button ticket-practice" href="index.html#2026"><span aria-hidden="true">✏️</span> 2026 lessons</a>
        <button class="shell-button ticket-free" type="button">Grown-ups: Free play</button>
        <button class="shell-button ticket-back" type="button">Back</button>
      </div>`;
    const close = () => { root.remove(); emptyCard = null; };
    root.querySelector('.ticket-back').addEventListener('click', () => { close(); if (onClose) onClose(); });
    root.querySelector('.ticket-free').addEventListener('click', () => requestFreePlay(() => { close(); if (onFreePlay) onFreePlay(); }));
    document.body.append(root);
    emptyCard = root;
    root.querySelector('.ticket-empty-card').focus({ preventScroll: true });
  }
  const isShowingEmpty = () => !!emptyCard;

  return { balance, award, practiceSet, activeRun, startRun, finishRun, wouldCharge, isFreePlay, setFreePlay, requestFreePlay, onChange, showEmpty, isShowingEmpty };
})();
