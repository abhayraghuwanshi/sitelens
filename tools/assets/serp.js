import { $, $$, esc, live, track, trackResult } from './site.js';

const form = $('#f');
const ctx = document.createElement('canvas').getContext('2d');
const width = (text, font) => { ctx.font = font; return ctx.measureText(text).width; };
const LIMITS = {
  desktop: { tFont: '20px Arial', tMax: 600, dFont: '14px Arial', dMax: 920 },
  mobile: { tFont: '18px Arial', tMax: 540, dFont: '14px Arial', dMax: 680 },
};
let view = 'desktop';

// Cut text to fit `max` pixels, at a word boundary, with an ellipsis.
function fit(text, font, max) {
  if (width(text, font) <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (width(`${text.slice(0, mid)} ...`, font) <= max) lo = mid; else hi = mid - 1; }
  const cut = text.slice(0, lo);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > lo * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, '')} ...`;
}

function meter(id, used, max, chars) {
  const bar = $(`#${id}Bar`);
  bar.classList.toggle('over', used > max);
  bar.firstElementChild.style.width = `${Math.min(100, (used / max) * 100)}%`;
  $(`#${id}Meta`).textContent = `${chars} characters · ${Math.round(used)} of ${max} px${used > max ? ' – will be cut off' : ''}`;
}

function render(e) {
  if (e) trackResult('preview');
  const L = LIMITS[view];
  const title = form.elements.title.value.trim(), desc = form.elements.desc.value.trim().replace(/\s+/g, ' ');
  const site = form.elements.site.value.trim();
  let host = '', path = '';
  try { const u = new URL(form.elements.url.value); host = u.host; path = u.pathname.split('/').filter(Boolean).join(' › '); } catch { /* keep blank */ }
  const tw = width(title, L.tFont), dw = width(desc, L.dFont);
  meter('t', tw, L.tMax, title.length);
  meter('d', dw, L.dMax, desc.length);
  $('#serp').classList.toggle('mobile', view === 'mobile');
  $('#fav').textContent = (site || host || '?').charAt(0).toUpperCase();
  $('#sn').textContent = site || host;
  $('#crumb').textContent = `https://${host}${path ? ` › ${path}` : ''}`;
  $('#st').textContent = fit(title || 'Your page title', L.tFont, L.tMax);
  $('#sd').textContent = fit(desc || 'Your meta description.', L.dFont, L.dMax);
  const tips = [];
  if (!title) tips.push('Add a title.');
  else if (tw < 300) tips.push('The title is short. You have room for a benefit or keyword.');
  if (desc && desc.length < 70) tips.push('The description is short. Google may write its own.');
  if (title && site && !title.toLowerCase().includes(site.toLowerCase()) && tw + width(` | ${site}`, L.tFont) <= L.tMax) tips.push(`You have room to end the title with “ | ${site}”.`);
  $('#tips').innerHTML = tips.map((t) => `<p class="warn">${esc(t)}</p>`).join('');
}

$('#view').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  view = b.dataset.v;
  track('tool_option', { detail: `view:${view}` });
  for (const x of $$('#view button')) x.setAttribute('aria-pressed', String(x === b));
  render();
};
live(form, render);
