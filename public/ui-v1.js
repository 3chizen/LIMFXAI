(() => {
  const pages = [...document.querySelectorAll('.module-page')];
  const buttons = [...document.querySelectorAll('.module-nav [data-page]')];
  function activate(id) {
    const page = pages.find(p => p.dataset.page === id);
    if (!page) return;
    pages.forEach(p => p.classList.toggle('active', p === page));
    buttons.forEach(b => {
      const on = b.dataset.page === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    page.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  buttons.forEach(b => b.addEventListener('click', () => activate(b.dataset.page)));
  activate('market');
})();
