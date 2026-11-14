import { $, esc, live, values, download, rememberInHash, trackResult } from './site.js';
import { buildUtm, inspectUrl } from './lib/utm.js';
import { owlSays } from './lib/owl.js';

const form = $('#f');
const PRESETS = {
  Newsletter: { source: 'newsletter', medium: 'email' },
  Reddit: { source: 'reddit', medium: 'social' },
  X: { source: 'twitter', medium: 'social' },
  LinkedIn: { source: 'linkedin', medium: 'social' },
  'Product Hunt': { source: 'producthunt', medium: 'referral' },
  'Google Ads': { source: 'google', medium: 'cpc' },
  'Meta Ads': { source: 'facebook', medium: 'paid-social' },
};
for (const [label, p] of Object.entries(PRESETS)) {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn small', textContent: label });
  b.dataset.track = `preset:${p.source}`;
  b.onclick = () => {
    form.elements.source.value = p.source; form.elements.medium.value = p.medium;
    form.dispatchEvent(new Event('input', { bubbles: true }));
  };
  $('#presets').append(b);
}

const opts = (v) => ({ lowercase: v.lowercase, separator: v.dashes ? '-' : '' });
let bulkRows = [];

function render(e) {
  const v = values(form);
  const out = $('#out'), warn = $('#warn');
  out.hidden = !v.url.trim();
  $('#empty').innerHTML = v.url.trim() ? '' : owlSays('Give me the page you’re linking to, and where you’ll post it. I’ll keep the tags tidy for GA4.');
  if (!v.url.trim()) { out.textContent = ''; warn.innerHTML = ''; }
  else {
    const r = buildUtm(v.url, v, opts(v));
    out.textContent = r.error || r.url;
    if (e && r.url && v.source && v.medium) trackResult('link_built');
    warn.innerHTML = (r.warnings || []).map((w) => `<p class="warn">${esc(w)}</p>`).join('');
  }
  const lines = $('#bulkIn').value.split('\n').map((l) => l.trim()).filter(Boolean);
  bulkRows = v.url.trim() ? lines.map((l) => {
    const [source, medium = v.medium] = l.split(/\s*,\s*|\t/);
    const r = buildUtm(v.url, { ...v, source, medium }, opts(v));
    return { source, medium, url: r.url || r.error };
  }) : [];
  $('#bulkOut').hidden = $('#bulkBtns').hidden = !bulkRows.length;
  $('#bulkOut').textContent = bulkRows.map((r) => r.url).join('\n');
  if (e && bulkRows.length > 1) trackResult('bulk_links');
}

rememberInHash(form);
live(form, render);
$('#bulkIn').addEventListener('input', render);
$('#reset').onclick = () => { form.reset(); history.replaceState(null, '', location.pathname); render(); };
$('#csv').onclick = () => {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const v = values(form);
  download('utm-links.csv', ['source,medium,campaign,url', ...bulkRows.map((r) => [r.source, r.medium, v.campaign, r.url].map(q).join(','))].join('\n'), 'text/csv');
};

$('#inspect').addEventListener('input', (e) => {
  const box = $('#inspectOut');
  if (!e.target.value.trim()) { box.innerHTML = ''; return; }
  const r = inspectUrl(e.target.value);
  if (!r.error) trackResult(r.removed.length ? 'link_cleaned' : 'link_checked');
  if (r.error) { box.innerHTML = `<p class="warn">${esc(r.error)}</p>`; return; }
  const tags = Object.entries(r.utm);
  box.innerHTML = `
    ${tags.length ? `<table class="table" style="margin-bottom:12px"><tbody>${tags.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No UTM tags on this link.</p>'}
    <h3>Clean link${r.removed.length ? ` <span class="muted" style="font-weight:400">(removed ${r.removed.map(esc).join(', ')})</span>` : ''}</h3>
    <pre class="out" id="clean">${esc(r.clean)}</pre>
    <button class="btn" type="button" data-copy="#clean">Copy clean link</button>`;
});
