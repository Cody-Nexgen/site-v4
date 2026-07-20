const one = (selector, scope = document) => scope.querySelector(selector);
const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];

all('[data-card-toggle]').forEach((button) => button.addEventListener('click', () => {
  const active = button.getAttribute('aria-pressed') === 'true';
  button.setAttribute('aria-pressed', String(!active));
  const status = button.querySelector('em');
  if (status) status.textContent = active ? 'OFF' : 'ON';
}));

const coachWidget = one('.coach-widget');
const coachLauncher = one('[data-coach-launcher]');
const coachPanel = one('.coach-panel');
const coachInput = one('#coach-widget-input');
const coachMessages = one('[data-coach-messages]');
const coachForm = one('[data-coach-form]');
const coachState = one('[data-coach-state]');
const coachSend = coachForm?.querySelector('button[type="submit"]');
const coachHistory = [];
let coachController = null;

const rememberDismissed = (dismissed) => {
  try {
    if (dismissed) sessionStorage.setItem('focuznow-coach-dismissed', 'true');
    else sessionStorage.removeItem('focuznow-coach-dismissed');
  } catch { /* Storage can be unavailable in privacy-restricted contexts. */ }
};

const wasDismissed = () => {
  try { return sessionStorage.getItem('focuznow-coach-dismissed') === 'true'; }
  catch { return false; }
};

const setCoachOpen = (open) => {
  if (!coachWidget || !coachPanel) return;
  if (open) {
    coachWidget.classList.remove('dismissed');
    rememberDismissed(false);
  }
  coachWidget.classList.toggle('open', open);
  coachLauncher?.setAttribute('aria-expanded', String(open));
  coachPanel.hidden = !open;
  if (open) requestAnimationFrame(() => coachInput?.focus());
  else coachLauncher?.focus();
};

const dismissCoach = () => {
  coachController?.abort();
  coachWidget.classList.remove('open');
  coachWidget.classList.add('dismissed');
  coachPanel.hidden = true;
  coachLauncher?.setAttribute('aria-expanded', 'false');
  rememberDismissed(true);
};

window.openFocuzCoach = () => setCoachOpen(true);
coachLauncher?.addEventListener('click', () => setCoachOpen(true));
one('[data-coach-dismiss]')?.addEventListener('click', dismissCoach);
one('[data-coach-close]')?.addEventListener('click', () => setCoachOpen(false));
all('[data-open-coach]').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); setCoachOpen(true); }));

const addCoachMessage = (role, text = '', extra = '') => {
  const article = document.createElement('article');
  article.className = `coach-message ${role} ${extra}`.trim();
  const avatar = document.createElement('span');
  avatar.textContent = role === 'assistant' ? '○' : '';
  avatar.setAttribute('aria-hidden', 'true');
  const body = document.createElement('p');
  body.textContent = text;
  article.append(avatar, body);
  coachMessages.append(article);
  coachMessages.scrollTop = coachMessages.scrollHeight;
  return { article, body };
};

const readCoachStream = async (response, onDelta) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';
    for (const event of events) {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('');
      if (!data || data === '[DONE]') continue;
      const delta = JSON.parse(data).choices?.[0]?.delta?.content;
      if (delta) onDelta(delta);
    }
    if (done) break;
  }
};

const sendCoachMessage = async (value) => {
  const text = value.trim();
  if (!text || coachController) return;
  addCoachMessage('user', text);
  coachHistory.push({ role: 'user', content: text });
  coachInput.value = '';
  const answer = addCoachMessage('assistant', '', 'streaming');
  coachController = new AbortController();
  coachInput.disabled = true;
  coachSend.disabled = true;
  coachState.textContent = 'Thinking…';
  try {
    if (location.protocol === 'file:') throw new Error('The helper is available on the deployed site.');
    const response = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: coachHistory }), signal: coachController.signal });
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      throw new Error(details?.error || 'The helper could not answer right now.');
    }
    if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('The helper is available when the Vercel function is running.');
    let complete = '';
    await readCoachStream(response, (delta) => { complete += delta; answer.body.textContent = complete; coachMessages.scrollTop = coachMessages.scrollHeight; });
    if (!complete) throw new Error('The helper returned an empty response.');
    coachHistory.push({ role: 'assistant', content: complete });
  } catch (error) {
    answer.article.classList.add('error');
    answer.body.textContent = error.name === 'AbortError' ? 'Response stopped.' : error.message;
  } finally {
    answer.article.classList.remove('streaming');
    coachController = null;
    coachInput.disabled = false;
    coachSend.disabled = false;
    coachState.textContent = 'Ready';
    coachInput.focus();
  }
};

coachForm?.addEventListener('submit', (event) => { event.preventDefault(); sendCoachMessage(coachInput.value); });
coachInput?.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); coachForm.requestSubmit(); } });
all('[data-coach-prompt]').forEach((button) => button.addEventListener('click', () => sendCoachMessage(button.dataset.coachPrompt)));
addEventListener('keydown', (event) => { if (event.key === 'Escape' && coachPanel && !coachPanel.hidden) setCoachOpen(false); });

if (wasDismissed()) coachWidget?.classList.add('dismissed');
if (location.hash === '#ai-coach') setCoachOpen(true);
