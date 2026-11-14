// Helpers shared by every tool page.

// ── Usage analytics ──────────────────────────────────────
// Events go to Google Tag Manager's dataLayer (GTM-…, loaded by ga.js); GTM
// forwards them to GA4. Only what was done is sent, never what was typed.
// The page says what it is on <body data-page="tool:utm-builder">.
const [pageKind, pageSlug] = (document.body?.dataset.page || 'page:').split(':');
const sent = new Set();
export function track(event, params = {}, { once = false } = {}) {
  const key = `${event}|${params.detail ?? ''}`;
  if (once && sent.has(key)) return;
  sent.add(key);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, [pageKind === 'guide' ? 'guide' : 'tool']: pageSlug || undefined, ...params });
}
// A result: sent once per distinct detail, so typing doesn't flood GA4.
export const trackResult = (detail) => track('tool_result', { detail: String(detail) }, { once: true });

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pct = (x, digits = 1) => (x == null || !Number.isFinite(x) ? '–' : `${(x * 100).toFixed(digits)}%`);
export const num = (x, digits = 0) => (x == null || !Number.isFinite(x) ? '–' : x.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }));

// Re-run `fn` whenever any input inside `root` changes.
export function live(root, fn) {
  root.addEventListener('input', fn);
  root.addEventListener('change', fn);
  fn();
}

// Read named form fields into an object.
export function values(root) {
  const out = {};
  for (const el of $$('[name]', root)) out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  return out;
}

export async function copyText(text, button) {
  // Counted first: the clipboard call can wait on a permission prompt.
  track('tool_copy', { detail: button?.dataset.copy?.replace('#', '') || button?.textContent?.trim() || 'text' });
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  if (button) {
    const was = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = was; }, 1400);
  }
}

export function download(name, text, type = 'text/plain') {
  track('tool_download', { detail: name });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// <button data-copy="#id"> copies that element's text (or value).
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const el = $(b.dataset.copy);
  if (el) copyText(el.value ?? el.textContent, b);
});

// Save form state in the URL hash so a filled-in tool can be bookmarked or shared.
export function rememberInHash(root) {
  try {
    const saved = JSON.parse(decodeURIComponent(location.hash.slice(1)) || 'null');
    if (saved && typeof saved === 'object') {
      for (const el of $$('[name]', root)) {
        if (!(el.name in saved)) continue;
        if (el.type === 'checkbox') el.checked = !!saved[el.name]; else el.value = saved[el.name];
      }
    }
  } catch { /* ignore a malformed hash */ }
  let t;
  root.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => history.replaceState(null, '', `#${encodeURIComponent(JSON.stringify(values(root)))}`), 300);
  });
}

// ── The owl ──────────────────────────────────────────────
// Its eyes follow the pointer, and once you start typing the empty "before"
// pupil fills in: the owl has noticed. Skipped for reduced motion.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!still) {
  let frame = 0, px = 0, py = 0;
  const look = () => {
    frame = 0;
    for (const svg of document.querySelectorAll('svg.owl')) {
      const r = svg.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.53;
      const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 300) * 3.2; // in owl units (viewBox 64)
      svg.querySelector('.pupils').style.transform = `translate(${(dx / d) * reach}px, ${(dy / d) * reach * 0.8}px)`;
    }
  };
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; if (!frame) frame = requestAnimationFrame(look); }, { passive: true });
}
document.addEventListener('input', () => document.body.classList.add('noticed'), { once: true });
document.addEventListener('click', (e) => { if (e.target.closest('main button')) document.body.classList.add('noticed'); }, { once: false });

// Tools recalculate as you type; Enter in a field must not reload the page.
// (Done here rather than inline onsubmit, so a strict CSP can block inline JS.)
document.addEventListener('submit', (e) => e.preventDefault());

// ── What people do on the page ─────────────────────────
if (pageKind === 'tool') {
  // First real interaction with the tool itself (not the page around it).
  const startOnce = (e) => { if (e.target.closest?.('.tool')) track('tool_start', {}, { once: true }); };
  document.addEventListener('input', startOnce);
  document.addEventListener('change', startOnce);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !b.closest('.tool')) return;
    startOnce(e);
    if (b.id === 'example') track('tool_example');
    else if (b.dataset.track) track('tool_option', { detail: b.dataset.track });
  });
}
// Clicks towards Kauzl, the demo, sign-in, other tools and guides.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  let u;
  try { u = new URL(a.href, location.href); } catch { return; }
  if (u.host !== location.host && !/(^|\.)kauzl\.com$/.test(u.host)) return;
  const path = u.pathname;
  if (!/^\/($|demo|login|tools\/|guides\/|home)/.test(path) || u.href === location.href) return;
  const where = a.closest('.cta, .top, .band, .hero, footer, .tile, .b-card, .grid, .content, nav')?.className.split(' ')[0] || 'page';
  track('cta_click', { location: where, detail: path + (u.search || '') });
});
// Guides: read to (most of) the end.
if (pageKind === 'guide') {
  const article = document.querySelector('.content.article');
  if (article && 'IntersectionObserver' in window) {
    const mark = document.createElement('span');
    const kids = [...article.children];
    kids[Math.floor(kids.length * 0.75)]?.before(mark);
    new IntersectionObserver((entries, obs) => {
      if (entries.some((x) => x.isIntersecting)) { track('guide_read', { detail: '75%' }, { once: true }); obs.disconnect(); }
    }).observe(mark);
  }
}
