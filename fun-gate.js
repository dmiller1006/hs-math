// FUN parent gate. This is a convenience lock on a static site, not real security.
window.FunGate = (() => {
  // The one shared FUN code. Change it here and redeploy; every gate uses this constant.
  const FUN_PASSCODE = '1234';
  const IDLE_LIMIT_MS = 15 * 60 * 1000;
  const UNLOCK_KEY = 'hs-math-fun-unlock';
  const TAB_KEY = 'hs-math-last-tab';
  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch (_) {} },
    remove(key) { try { sessionStorage.removeItem(key); } catch (_) {} }
  };

  // The unlock lasts for this tab session and ends after 15 idle minutes of wall-clock time.
  function isUnlocked() {
    const lastActive = Number(session.get(UNLOCK_KEY));
    if (lastActive && Date.now() - lastActive >= 0 && Date.now() - lastActive < IDLE_LIMIT_MS) return true;
    session.remove(UNLOCK_KEY);
    return false;
  }
  let lastWrite = 0;
  function touch() {
    if (Date.now() - lastWrite < 5000 || !isUnlocked()) return;
    lastWrite = Date.now();
    session.set(UNLOCK_KEY, String(lastWrite));
  }
  function unlock(code) {
    if (code !== FUN_PASSCODE) return false;
    lastWrite = Date.now();
    session.set(UNLOCK_KEY, String(lastWrite));
    return true;
  }
  function lock() { session.remove(UNLOCK_KEY); }
  function rememberTab(tab) { if (tab === '2025' || tab === '2026') session.set(TAB_KEY, tab); }
  function previousTab() { const tab = session.get(TAB_KEY); return tab === '2026' ? '2026' : '2025'; }

  let gate = null;
  function prompt({ onUnlock, onCancel }) {
    if (gate) { gate.callbacks = { onUnlock, onCancel }; return; }
    let entry = '';
    const root = document.createElement('div');
    root.className = 'fun-gate';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'fun-gate-title');
    root.innerHTML = `
      <div class="fun-gate-card" tabindex="-1">
        <p class="fun-gate-icon" aria-hidden="true">🔒</p>
        <h2 id="fun-gate-title">Grown-ups</h2>
        <p class="fun-gate-copy">Enter the FUN code.</p>
        <div class="fun-gate-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <p class="fun-gate-error" role="status" aria-live="polite"></p>
        <div class="fun-gate-keys"></div>
        <button class="fun-gate-cancel" type="button">Cancel</button>
      </div>`;
    const keys = root.querySelector('.fun-gate-keys');
    const dots = [...root.querySelectorAll('.fun-gate-dots i')];
    const error = root.querySelector('.fun-gate-error');
    const render = () => dots.forEach((dot, i) => dot.classList.toggle('filled', i < entry.length));
    const close = () => { root.remove(); document.removeEventListener('keydown', onKey); gate = null; };
    const press = key => {
      if (key === 'back') { entry = entry.slice(0, -1); render(); return; }
      if (entry.length >= 4) return;
      entry += key;
      error.textContent = '';
      render();
      if (entry.length < 4) return;
      if (unlock(entry)) { const { onUnlock } = gate.callbacks; close(); if (onUnlock) onUnlock(); return; }
      entry = '';
      error.textContent = 'Not quite. Try again.';
      root.querySelector('.fun-gate-card').classList.remove('shake');
      void root.offsetWidth;
      root.querySelector('.fun-gate-card').classList.add('shake');
      render();
    };
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].forEach(key => {
      const button = document.createElement('button');
      button.type = 'button';
      if (!key) { button.disabled = true; button.className = 'spacer'; button.setAttribute('aria-hidden', 'true'); }
      else if (key === 'back') { button.textContent = '⌫'; button.setAttribute('aria-label', 'Delete'); }
      else button.textContent = key;
      button.addEventListener('click', () => press(key));
      keys.append(button);
    });
    const onKey = event => {
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') press('back');
      else if (event.key === 'Escape') cancel();
    };
    const cancel = () => { const { onCancel } = gate.callbacks; close(); if (onCancel) onCancel(); };
    root.querySelector('.fun-gate-cancel').addEventListener('click', cancel);
    document.addEventListener('keydown', onKey);
    gate = { root, close, callbacks: { onUnlock, onCancel } };
    document.body.append(root);
    root.querySelector('.fun-gate-card').focus({ preventScroll: true });
  }
  const isPrompting = () => !!gate;
  // Closes an open prompt without calling either callback (for example after Back leaves the FUN tab).
  function dismiss() { if (gate) gate.close(); }

  // Counts taps as activity and reports when the unlock has run out, including after sleep or Back.
  function watch(onExpire) {
    let wasUnlocked = isUnlocked();
    const recheck = () => {
      const now = isUnlocked();
      if (wasUnlocked && !now) onExpire();
      wasUnlocked = now;
    };
    ['pointerdown', 'keydown'].forEach(type => document.addEventListener(type, () => { recheck(); touch(); }, true));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck(); });
    window.addEventListener('pageshow', recheck);
    setInterval(recheck, 20000);
    return { refresh() { wasUnlocked = isUnlocked(); } };
  }

  return { isUnlocked, unlock, lock, prompt, isPrompting, dismiss, watch, rememberTab, previousTab, IDLE_LIMIT_MS };
})();
