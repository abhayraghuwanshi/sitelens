import { $, esc, live, values, pct, num, rememberInHash, trackResult } from './site.js';
import { sampleSize } from './lib/stats.js';

const form = $('#f');

function render(e) {
  const v = values(form);
  const variants = Math.max(2, Math.round(Number(v.variants) || 2));
  const r = sampleSize({ baseline: Number(v.baseline) / 100, mde: Number(v.mde) / 100, confidence: Number(v.confidence), power: Number(v.power) });
  const out = $('#out');
  if (r.error) { out.innerHTML = `<p class="warn">${esc(r.error)}</p>`; return; }
  if (e) trackResult('calculated');
  const total = r.perVariant * variants;
  const daily = Number(v.daily);
  const days = daily > 0 ? Math.ceil(total / daily) : null;
  const weeks = days ? Math.max(1, Math.ceil(days / 7)) : null;
  out.innerHTML = `
    <p class="result-big">${num(r.perVariant)}</p><p class="muted" style="margin-top:0">visitors per variant</p>
    <div class="ba" aria-hidden="true"><span>Today</span><span class="track"><i style="width:${(Number(v.baseline) / 100 / r.target) * 100}%"></i></span><span class="v">${pct(Number(v.baseline) / 100, 2)}</span>
      <span>Target</span><span class="track after"><i style="width:100%"></i></span><span class="v">${pct(r.target, 2)}</span></div>
    <div class="stats">
      <div class="stat"><b>${num(total)}</b><span>visitors in total (${variants} variants)</span></div>
      <div class="stat"><b>${days ? num(days) : '–'}</b><span>days at ${num(daily)} a day</span></div>
    </div>
    ${weeks ? `<p class="hint">Round up to <strong>${weeks} full week${weeks > 1 ? 's' : ''}</strong> so every weekday is counted equally.</p>` : ''}
    ${days > 60 ? '<p class="warn">That’s a long test. Consider testing a bigger change or a busier page, or check the result before/after instead.</p>' : ''}`;
}

rememberInHash(form);
live(form, render);
