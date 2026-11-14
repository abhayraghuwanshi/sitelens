import { $, esc, live, values, pct, rememberInHash, trackResult } from './site.js';
import { abTest } from './lib/stats.js';

const form = $('#f');

// A in before-grey, B in after-amber, scaled to the higher rate.
function bars(a, b) {
  const top = Math.max(a, b) || 1;
  return `<div class="ba" aria-hidden="true"><span>A</span><span class="track"><i style="width:${(a / top) * 100}%"></i></span><span class="v">${pct(a, 2)}</span>
    <span>B</span><span class="track after"><i style="width:${(b / top) * 100}%"></i></span><span class="v">${pct(b, 2)}</span></div>`;
}

function render(e) {
  const v = values(form);
  const conf = Number(v.confidence);
  const r = abTest({ ...v, confidence: conf });
  const out = $('#out');
  if (r.error) { out.innerHTML = `<p class="warn">${esc(r.error)}</p>`; return; }
  if (e) trackResult(r.significant ? 'significant' : 'not_significant');
  const lift = r.lift == null ? '–' : `${r.lift >= 0 ? '+' : ''}${pct(r.lift)}`;
  const better = r.diff > 0 ? 'B' : 'A';
  const cls = r.significant ? (r.diff > 0 ? 'good' : 'bad') : 'maybe';
  const head = r.significant
    ? `${better} wins at ${pct(conf, 0)} confidence`
    : 'Not significant yet';
  const sub = r.significant
    ? `B converts ${lift} ${r.diff > 0 ? 'better' : 'worse'} than A, and that gap is unlikely to be luck.`
    : `The ${lift} gap could still be chance. Keep the test running, or accept that the difference is small.`;
  const ci = r.ci.map((d) => `${d >= 0 ? '+' : ''}${(d * 100).toFixed(2)} pts`).join(' to ');
  out.innerHTML = `
    <div class="verdict ${cls}"><strong>${head}</strong>${sub}</div>
    ${bars(r.rateA, r.rateB)}
    <div class="stats">
      <div class="stat"><b>${pct(r.rateA, 2)}</b><span>A conversion rate</span></div>
      <div class="stat"><b>${pct(r.rateB, 2)}</b><span>B conversion rate</span></div>
      <div class="stat"><b>${lift}</b><span>uplift</span></div>
      <div class="stat"><b>${r.pValue < 0.0001 ? '<0.0001' : r.pValue.toFixed(4)}</b><span>p-value</span></div>
      <div class="stat"><b>${pct(r.chanceBBeatsA, 1)}</b><span>chance B beats A</span></div>
      <div class="stat"><b>${r.z.toFixed(2)}</b><span>z-score</span></div>
    </div>
    <p class="hint">${pct(conf, 0)} confidence interval for B − A: <strong>${ci}</strong>${r.ci[0] < 0 && r.ci[1] > 0 ? ' (crosses zero)' : ''}.</p>`;
}

rememberInHash(form);
live(form, render);
