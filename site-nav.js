import { supabase } from './supabase-client.js';
import './site-actions.js';

const header = document.querySelector('.site-header');
const menu = document.querySelector('[data-site-menu]');
const links = document.querySelector('#nav-links');

const closeMenu = () => {
  if (!menu || !links) return;
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open navigation');
  links.classList.remove('open');
};

const closeAccountMenu = () => {
  const account = document.querySelector('[data-account-menu]');
  if (!account) return;
  account.querySelector('[data-account-trigger]')?.setAttribute('aria-expanded', 'false');
  const popover = account.querySelector('[data-account-popover]');
  if (popover) popover.hidden = true;
};

menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  links?.classList.toggle('open', open);
});

links?.addEventListener('click', closeMenu);
addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeMenu();
  closeAccountMenu();
});
addEventListener('pointerdown', (event) => {
  if (!event.target.closest('[data-account-menu]')) closeAccountMenu();
});
addEventListener('scroll', () => header?.classList.toggle('scrolled', scrollY > 12), { passive: true });
header?.classList.add('scrolled');

const getAccountProfile = (user) => {
  const metadata = user.user_metadata || {};
  const composedName = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim();
  const displayName = metadata.full_name || metadata.name || composedName || user.email?.split('@')[0] || 'Account';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'FN';
  const avatarUrl = metadata.avatar_url || metadata.picture || '';
  return { displayName, initials, avatarUrl, email: user.email || '' };
};

const createAvatar = ({ displayName, initials, avatarUrl }) => {
  const avatar = document.createElement('span');
  avatar.className = 'account-avatar';
  avatar.setAttribute('aria-hidden', 'true');

  const fallback = document.createElement('span');
  fallback.textContent = initials;
  avatar.append(fallback);

  if (avatarUrl) {
    try {
      const imageUrl = new URL(avatarUrl, window.location.origin);
      if (imageUrl.protocol === 'https:' || imageUrl.protocol === 'http:') {
        const image = document.createElement('img');
        image.src = imageUrl.href;
        image.alt = '';
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('load', () => { fallback.hidden = true; }, { once: true });
        image.addEventListener('error', () => image.remove(), { once: true });
        avatar.prepend(image);
      }
    } catch {
      // Invalid provider avatar URLs fall back to initials.
    }
  }

  avatar.title = displayName;
  return avatar;
};

const renderGuest = () => {
  const account = document.querySelector('[data-account-menu]');
  if (!account) return;
  const link = document.createElement('a');
  link.className = 'text-link sign-in';
  link.href = '/login';
  link.textContent = 'Sign in';
  if (window.location.pathname === '/login') link.setAttribute('aria-current', 'page');
  account.replaceWith(link);
};

const renderAccount = (session) => {
  const target = document.querySelector('.nav-actions .sign-in, .nav-actions [data-account-menu]');
  if (!target || !session?.user) return;
  const profile = getAccountProfile(session.user);
  const account = document.createElement('div');
  account.className = 'account-menu';
  account.dataset.accountMenu = '';

  const trigger = document.createElement('button');
  trigger.className = 'account-trigger';
  trigger.type = 'button';
  trigger.dataset.accountTrigger = '';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', `Open account menu for ${profile.displayName}`);
  trigger.append(createAvatar(profile));

  const name = document.createElement('span');
  name.className = 'account-trigger-name';
  name.textContent = profile.displayName;
  trigger.append(name);

  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('viewBox', '0 0 16 16');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = '<path d="m4.5 6.25 3.5 3.5 3.5-3.5"/>';
  trigger.append(chevron);

  const popover = document.createElement('div');
  popover.className = 'account-popover';
  popover.dataset.accountPopover = '';
  popover.setAttribute('role', 'menu');
  popover.hidden = true;

  const identity = document.createElement('div');
  identity.className = 'account-identity';
  const identityName = document.createElement('strong');
  identityName.textContent = profile.displayName;
  const identityEmail = document.createElement('span');
  identityEmail.textContent = profile.email;
  identity.append(identityName, identityEmail);

  const menuItems = document.createElement('div');
  menuItems.className = 'account-menu-items';
  const menuOptions = [
    ['Account settings', '', true, '<circle cx="8" cy="5.25" r="2.25"/><path d="M3.75 13c.35-2.3 1.77-3.45 4.25-3.45S11.9 10.7 12.25 13"/>'],
    ['Billing', '/billing', false, '<rect x="2.5" y="4" width="11" height="8" rx="1.5"/><path d="M2.5 6.75h11M5 9.5h2.5"/>'],
    ['Preferences', '', true, '<path d="M3 4.25h10M5.5 8h7.5M3 11.75h10"/><circle cx="4" cy="8" r="1"/>'],
    ['Data & privacy', '', true, '<rect x="4" y="6.5" width="8" height="6.5" rx="1.5"/><path d="M6 6.5V5a2 2 0 0 1 4 0v1.5"/>'],
  ];
  menuOptions.forEach(([label, href, disabled, iconPath]) => {
    const item = document.createElement(disabled ? 'button' : 'a');
    item.className = 'account-menu-item';
    item.setAttribute('role', 'menuitem');
    if (disabled) {
      item.type = 'button';
      item.disabled = true;
      item.setAttribute('aria-disabled', 'true');
    } else {
      item.href = href;
    }
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = iconPath;
    const title = document.createElement('span');
    title.textContent = label;
    const state = document.createElement('em');
    state.textContent = disabled ? 'Soon' : '→';
    item.append(icon, title, state);
    menuItems.append(item);
  });

  const signOut = document.createElement('button');
  signOut.type = 'button';
  signOut.className = 'account-signout';
  signOut.dataset.accountSignout = '';
  signOut.setAttribute('role', 'menuitem');
  signOut.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 3H3.75A1.25 1.25 0 0 0 2.5 4.25v7.5A1.25 1.25 0 0 0 3.75 13H6.5M9.5 5l3 3-3 3M12.5 8H6"/></svg><span>Sign out</span>';
  popover.append(identity, menuItems, signOut);
  account.append(trigger, popover);
  target.replaceWith(account);

  trigger.addEventListener('click', () => {
    const open = trigger.getAttribute('aria-expanded') !== 'true';
    trigger.setAttribute('aria-expanded', String(open));
    popover.hidden = !open;
  });

  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    signOut.querySelector('span').textContent = 'Signing out…';
    const { error } = await supabase.auth.signOut();
    if (error) {
      signOut.disabled = false;
      signOut.querySelector('span').textContent = 'Try again';
      return;
    }
    window.postMessage({ type: 'FOCUZNOW_SESSION_SYNC', source: 'FOCUZNOW_WEB', session: null }, '*');
    renderGuest();
  });
};

const previewAccount = import.meta.env.DEV && new URLSearchParams(window.location.search).get('auth_preview') === 'account';

if (previewAccount) {
  renderAccount({
    user: {
      email: 'member@focuznow.com',
      user_metadata: { full_name: 'FocuzNow Member' },
    },
  });
} else if (supabase) {
  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) renderAccount(session);
    else renderGuest();
  });

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) renderAccount(data.session);
  });

  addEventListener('pagehide', () => authListener.subscription.unsubscribe(), { once: true });
}
