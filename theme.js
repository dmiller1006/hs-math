// Apply the saved palette before the page paints. Dark is the default.
(() => {
  let theme = 'dark';
  try { if (localStorage.getItem('hs-math-theme') === 'light') theme = 'light'; } catch (_) {}
  document.documentElement.dataset.theme = theme;
})();
