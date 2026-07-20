const header = document.querySelector('.site-header');
const menu = document.querySelector('[data-site-menu]');
const links = document.querySelector('#nav-links');

const closeMenu = () => {
  if (!menu || !links) return;
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open navigation');
  links.classList.remove('open');
};

menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  links?.classList.toggle('open', open);
});

links?.addEventListener('click', closeMenu);
addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
addEventListener('scroll', () => header?.classList.toggle('scrolled', scrollY > 12), { passive: true });
header?.classList.add('scrolled');
