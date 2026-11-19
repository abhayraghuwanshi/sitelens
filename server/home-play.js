// "Ship it": the home page hero as a toy. The visitor picks something to ship,
// a flag drops on four weeks of traffic, the line after it plays out, and the
// owl gives Kauzl's verdict against a normal week's range (the shaded band).
// Honest outcomes on purpose: one worked, one was a spike, one was noise, one
// made things worse.
//
// One file, two uses: server/home.mjs imports it to draw the finished chart
// into the HTML (so the hero works with no script), and the page loads it as
// /home-play.js to make it playable. No inline script: the public CSP forbids it.

// Sample numbers. Day-to-day wobble before the ship, the same for every scenario.
const WOBBLE = [0.02, -0.05, 0.04, -0.01, 0.06, -0.04, 0.01, -0.06, 0.03, 0.05, -0.02, -0.04, 0.02, 0.04, -0.03, 0.01, -0.05, 0.03];
export const NORMAL = 0.08; // a normal week moves ±8%

export const SCENARIOS = [
  { key: 'pricing', label: 'Pricing page v2', metric: 'Sign-ups', base: 12, tone: 'good', verdict: 'Worked',
    after: [1.08, 1.14, 1.2, 1.16, 1.22, 1.18, 1.21, 1.17, 1.2, 1.19],
    say: 'Sign-ups went from {before} to {after} a day after Pricing page v2, up {pct}. A normal week moves ±8%, so it’s probably real.' },
  { key: 'reddit', label: 'Reddit launch post', metric: 'Visits', base: 60, tone: 'amber', verdict: 'Spike',
    after: [1.1, 4.8, 2.6, 1.5, 1.25, 1.15, 1.1, 1.08, 1.12, 1.1],
    say: 'Reddit sent {peak} visits the day after, then it faded. It settled {settleAbs} above where you were, so some of it stuck. Post there again.' },
  { key: 'redesign', label: 'Homepage redesign', metric: 'Visits', base: 60, tone: 'muted', verdict: 'Noise',
    after: [1.03, 0.98, 1.05, 0.97, 1.04, 1.01, 0.99, 1.05, 1.02, 1.03],
    say: 'Visits moved {change} after the redesign. A normal week moves ±8%, so this is noise. Don’t call it a win yet.' },
  { key: 'checkout', label: 'Checkout update', metric: 'Sign-ups', base: 12, tone: 'bad', verdict: 'Worse',
    after: [0.72, 0.66, 0.7, 0.68, 0.65, 0.71, 0.69, 0.67, 0.7, 0.68],
    say: 'Sign-ups fell {pct} the day checkout shipped, far outside a normal week. Mobile Safari stopped converting. To-do added: roll it back.' },
];

const W = 320, H = 132, PAD = 10, TOP = 26, BOTTOM = 112;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const fmt = (v) => (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('en-US');
const signed = (r) => `${r >= 0 ? '+' : '−'}${Math.abs(Math.round(r * 100))}%`;

// Everything needed to draw one scenario: points, band, flag, numbers, words.
export function scene(s) {
  const before = WOBBLE.map((w) => s.base * (1 + w));
  const after = s.after.map((f) => s.base * f);
  const all = [...before, ...after];
  const lo = Math.min(...all, s.base * (1 - NORMAL)) * 0.92;
  const hi = Math.max(...all, s.base * (1 + NORMAL)) * 1.04;
  const n = all.length;
  const x = (i) => PAD + (i * (W - 2 * PAD)) / (n - 1);
  const y = (v) => BOTTOM - ((v - lo) / (hi - lo)) * (BOTTOM - TOP);
  const pts = (vals, from) => vals.map((v, i) => `${x(from + i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ship = before.length - 1; // the after line starts where the before line ends
  const b = mean(before), a = mean(after);
  const nums = { before: fmt(b), after: fmt(a), change: signed(a / b - 1), peak: fmt(Math.max(...after)), settle: signed(mean(after.slice(-5)) / b - 1) };
  nums.pct = nums.change.slice(1);
  nums.settleAbs = nums.settle.slice(1);
  return {
    ...s, nums,
    text: s.say.replace(/\{(\w+)\}/g, (_, k) => nums[k]),
    beforePts: pts(before, 0),
    afterPts: `${x(ship).toFixed(1)},${y(before[ship]).toFixed(1)} ${pts(after, before.length)}`,
    flagX: x(ship),
    band: { x: x(ship), w: x(n - 1) - x(ship), y: y(s.base * (1 + NORMAL)), h: y(s.base * (1 - NORMAL)) - y(s.base * (1 + NORMAL)) },
    baseY: y(s.base),
    end: { x: x(n - 1), y: y(after[after.length - 1]) },
  };
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The chart as SVG markup (used by the server, and by the page on every ship).
export function chartSvg(c) {
  const label = c.label.length > 18 ? `${c.label.slice(0, 17)}…` : c.label;
  const right = c.flagX > W - 110;
  return `<svg class="pc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${c.metric} a day for four weeks; ${c.label} shipped on day 18. ${c.verdict}.`)}">
  <rect class="pc-band" x="${c.band.x.toFixed(1)}" y="${c.band.y.toFixed(1)}" width="${c.band.w.toFixed(1)}" height="${c.band.h.toFixed(1)}" rx="4"/>
  <line class="pc-base" x1="${PAD}" x2="${W - PAD}" y1="${c.baseY.toFixed(1)}" y2="${c.baseY.toFixed(1)}"/>
  <text class="pc-normal" x="${(W - PAD).toFixed(1)}" y="${(c.band.y - 4).toFixed(1)}" text-anchor="end">normal week ±${Math.round(NORMAL * 100)}%</text>
  <polyline class="pc-before" points="${c.beforePts}"/>
  <polyline class="pc-after" pathLength="1" points="${c.afterPts}"/>
  <g class="pc-flag" transform="translate(${c.flagX.toFixed(1)} 0)">
    <line x1="0" x2="0" y1="8" y2="${BOTTOM + 4}"/>
    <path d="M0 8 h${right ? -8 : 8} l${right ? -3 : 3} 4 l${right ? 3 : -3} 4 h${right ? 8 : -8} z"/>
    <text x="${right ? -14 : 14}" y="16" text-anchor="${right ? 'end' : 'start'}">${esc(label)}</text>
  </g>
  <circle class="pc-end" cx="${c.end.x.toFixed(1)}" cy="${c.end.y.toFixed(1)}" r="3.5"/>
  <text class="pc-axis" x="${PAD}" y="${H - 4}">4 weeks ago</text><text class="pc-axis" x="${W - PAD}" y="${H - 4}" text-anchor="end">today</text>
</svg>`;
}

/* ---------- in the page ---------- */

function play(root) {
  const chart = root.querySelector('.play-chart');
  const say = root.querySelector('.say');
  const live = root.querySelector('.play-live');
  const verdict = root.querySelector('.verdict');
  const stats = root.querySelectorAll('.play-stats b');
  const metric = root.querySelector('.play-metric');
  const buttons = [...root.querySelectorAll('.ship button')];
  const owl = root.closest('.play-wrap')?.querySelector('svg.owl .pupils');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let run = 0;

  const look = (dx, dy) => { if (owl) owl.style.transform = `translate(${dx}px, ${dy}px)`; };
  const wait = (ms) => new Promise((r) => setTimeout(r, still ? 0 : ms));

  async function ship(key) {
    const id = ++run;
    const c = scene(SCENARIOS.find((s) => s.key === key));
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === key)));
    root.dataset.tone = c.tone;
    metric.textContent = `${c.metric} a day`;
    chart.innerHTML = chartSvg(c);
    root.classList.remove('done');
    root.classList.add('shipping');
    say.textContent = '';
    verdict.textContent = '';
    verdict.className = 'verdict';
    stats.forEach((s) => { s.textContent = '–'; });
    look(-2.2, 1.6); // the owl looks down at the flag
    await wait(1700); // flag drops, line plays out (CSS)
    if (id !== run) return;
    root.classList.remove('shipping');
    root.classList.add('reading');
    look(0, 0);
    await wait(500);
    if (id !== run) return;
    root.classList.remove('reading');
    root.classList.add('done');
    [c.nums.before, c.nums.after, c.nums.change].forEach((v, i) => { stats[i].textContent = v; });
    verdict.textContent = c.verdict;
    verdict.className = `verdict ${c.tone}`;
    live.textContent = `${c.verdict}. ${c.text}`;
    look(1.4, -0.6);
    if (still) { say.textContent = c.text; return; }
    for (let i = 1; i <= c.text.length; i += 2) {
      if (id !== run) return;
      say.textContent = c.text.slice(0, i);
      await wait(16);
    }
    say.textContent = c.text;
  }

  root.querySelector('.ship').hidden = false;
  root.classList.add('live');
  buttons.forEach((b) => b.addEventListener('click', () => ship(b.dataset.s)));
  // Play the first one by itself once the hero is on screen.
  new IntersectionObserver((entries, io) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); ship(SCENARIOS[0].key); }
  }, { threshold: 0.4 }).observe(root);
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('play');
  if (root) play(root);
}
