const $ = (id) => document.getElementById(id);

let toastTimer = 0;
export function showToast(text) {
  const toast = $('toast');
  toast.textContent = text;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

let onCloseCb = null;
export function openCard({ label, title, line, href, linkText, onClose }) {
  $('card-label').textContent = label || '';
  $('card-title').textContent = title || '';
  $('card-line').textContent = line || '';
  const a = $('card-link');
  a.hidden = !href;
  if (href) { a.href = href; a.textContent = linkText || '閱讀本章 →'; }
  onCloseCb = onClose || null;
  $('card').hidden = false;
  document.body.classList.add('card-open');
}
export function closeCard() {
  const card = $('card');
  if (card.hidden) return;
  card.hidden = true;
  document.body.classList.remove('card-open');
  const cb = onCloseCb; onCloseCb = null;
  if (cb) cb();
}

export function setCaption(text) {
  const el = $('caption');
  el.textContent = text || '';
  el.hidden = !text;
}

let lastStage = '';
export function setStageCaption(text) {
  if (text === lastStage) return;
  lastStage = text;
  $('sand-cap').textContent = text;
}

export function initUi() {
  $('card-close').addEventListener('click', closeCard);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });
}

export const ui = { showToast, openCard, closeCard, setCaption, setStageCaption };
