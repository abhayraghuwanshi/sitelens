import { $, esc, live, values, pct, num, rememberInHash, trackResult } from './site.js';
import { parseSeries, beforeAfter } from './lib/stats.js';
import { owlSays } from './lib/owl.js';

const EMPTY = owlSays('Paste a week or two of daily numbers on each side, and I’ll tell you whether the change is real or just a normal wobble.');

const form = $('#f');

function chart(before, after) {
  const all = [...before, ...after];
  const max = Math.max(...all, 0) || 1;
  const W = 600, H = 160, pad = 18, bw = (W - pad * 2) / all.length;
  const y = (v) => H - pad - (Math.max(v, 0) / max) * (H - pad * 2);
  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const split = pad + before.length * bw;
  const bars = all.map((v, i) => `<rect class="${i < before.length ? 'b' : 'a'}" x="${pad + i * bw + bw * 0.12}" y="${y(v)}" width="${bw * 0.76}" height="${H - pad - y(v)}" rx="1.5"/>`).join('');
  return `<svg class="series" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily values before and after the change">
    ${bars}
    <line class="mean" x1="${pad}" x2="${split}" y1="${y(avg(before))}" y2="${y(avg(before))}"/>
    <line class="mean" x1="${split}" x2="${W - pad}" y1="${y(avg(after))}" y2="${y(avg(after))}"/>
    <line class="split" x1="${split}" x2="${split}" y1="4" y2="${H - pad}"/>
    <text x="${pad}" y="12">Before</text><text x="${split + 6}" y="12">After</text>
  </svg>`;
}

// Chance as words, never "0.00%".
const chance = (p) => (p < 0.0001 ? 'less than 0.01%' : pct(p, p < 0.01 ? 2 : 1));

function render(e) {
  const v = values(form);
  const metric = esc(v.metric.trim() || 'value');
  const before = parseSeries(v.before), after = parseSeries(v.after);
  const out = $('#out');
  if (!before.length && !after.length) { out.innerHTML = EMPTY; return; }
  const r = beforeAfter(before, after);
  if (r.error) { out.innerHTML = owlSays(`${esc(r.error)} So far: ${before.length} before, ${after.length} after.`); return; }
  if (e) trackResult(r.verdict);
  const change = r.change == null ? '' : `${r.change >= 0 ? '+' : ''}${pct(r.change)}`;
  const V = {
    up: ['good', `Yes: ${metric} went up ${change}`, `A gap this big would happen by chance ${chance(r.pValue)} of the time.`],
    down: ['bad', `${metric} went down ${change.replace('-', '')}`, `A drop this big would happen by chance ${chance(r.pValue)} of the time. Worth looking into.`],
    maybe: ['maybe', `Maybe: ${change} so far`, `Promising but not certain (${pct(r.pValue)} chance it’s noise). Give it more days.`],
    none: ['', `No clear change (${change || 'flat'})`, `The difference is within normal day-to-day swings (${pct(r.pValue)} chance it’s noise).`],
  }[r.verdict];
  out.innerHTML = `
    <div class="verdict ${V[0]}"><strong>${V[1]}</strong>${V[2]}</div>
    ${chart(before, after)}
    <div class="stats">
      <div class="stat"><b>${num(r.meanBefore, 1)}</b><span>avg per day before (${before.length} days)</span></div>
      <div class="stat"><b>${num(r.meanAfter, 1)}</b><span>avg per day after (${after.length} days)</span></div>
      <div class="stat"><b>${change || '–'}</b><span>change</span></div>
      <div class="stat"><b>${r.pValue < 0.0001 ? '<0.0001' : r.pValue.toFixed(4)}</b><span>p-value (${r.method === 'paired' ? 'same weekdays compared' : 'Welch’s t-test'})</span></div>
    </div>
    ${r.warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')}`;
}

$('#example').onclick = () => {
  form.elements.metric.value = 'sign-ups';
  form.elements.before.value = '42\n45\n39\n47\n44\n21\n19\n43\n41\n46\n40\n44\n23\n20';
  form.elements.after.value = '51\n55\n49\n58\n53\n27\n24\n56\n52\n57\n50\n54\n26\n25';
  form.dispatchEvent(new Event('input', { bubbles: true }));
};
$('#clear').onclick = () => { form.reset(); history.replaceState(null, '', location.pathname); render(); };
rememberInHash(form);
live(form, render);
