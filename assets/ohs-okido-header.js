(() => {
  const root = document.querySelector('[data-ohs-okido]');
  if (!root) return;

  const openBtn = root.querySelector('[data-ohs-okido-open]');
  const drawer = root.querySelector('[data-ohs-okido-drawer]');
  const closeEls = root.querySelectorAll('[data-ohs-okido-close]');

  const setOpen = (open) => {
    if (!drawer) return;
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (openBtn) openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  openBtn?.addEventListener('click', () => setOpen(true));
  closeEls.forEach((el) => el.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
})();
