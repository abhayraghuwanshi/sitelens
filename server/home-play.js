// The home page hero: an analytics calendar you can click. Four weeks of a
// made-up site's visits, one cell a day, with what shipped and what was posted
// marked on its day. Pick a day and the card under it says what was in it, the
// way the app's day view does: a plain headline, the numbers against a usual
// weekday, where people came from, what happened, and "Now:" what to do.
//
// One file, two uses: server/home.mjs imports it to draw the calendar and the
// first day into the HTML (so the hero works with no script), and the page
// loads it as /home-play.js to make the days clickable. No inline script: the
// public CSP forbids it.

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const FIRST_DATE = 2; // Monday 2 March 2026
const MONTH = 'Mar';

// Visits a day, Monday first, four weeks. Sample numbers.
const VISITS = [
  60, 63, 61, 58, 54, 33, 29,
  62, 66, 63, 61, 56, 35, 31,
  64, 65, 131, 88, 70, 37, 32,
  66, 67, 64, 63, 57, 36, 32,
];
// A usual day for each weekday (the median of the weeks around it).
const USUAL = [62, 65, 62, 60, 55, 34, 30];
const USUAL_SIGNUPS = [5, 5, 5, 5, 4, 2, 2];

// The days with something on them: the whole story, written the way Kauzl says it.
const MARKED = {
  8: {
    verdict: ['Worked', 'good'],
    head: 'Pricing page v2 went live, and sign-ups have been up since.',
    nums: { signups: 7 },
    from: [['Google', 30, 0], ['Direct', 21, 1], ['producthunt.com', 6, 2]],
    happened: [['ship', 'Released Pricing page v2 · acme/web #214']],
    effect: 'Sign-ups <b class="good">+38%</b> in the 3 days after, against the 3 before.',
    now: 'Keep it. Kauzl checks again in a week to make sure it holds.',
  },
  16: {
    verdict: ['Spike', 'amber'],
    head: '2× a usual Wednesday. Your Reddit post brought most of it.',
    nums: { signups: 9 },
    from: [['reddit.com', 61, 'new'], ['Google', 38, 0], ['Direct', 24, 5]],
    happened: [['post', 'Posted in r/SideProject: “I made a calendar for my site’s traffic”']],
    effect: 'Visits <b class="good">+38%</b> in the 3 days after, against the 3 before.',
    now: 'Post there again. Readers from r/SideProject signed up 2× more than search visitors.',
  },
  24: {
    verdict: ['Worse', 'bad'],
    head: 'Sign-ups fell to 2, from a usual 5. The checkout update shipped that morning.',
    nums: { signups: 2 },
    from: [['Google', 33, 1], ['Direct', 22, 0], ['reddit.com', 5, 'new']],
    happened: [['ship', 'Released Checkout update · acme/web #231'], ['alert', 'Alert: sign-ups below your goal of 4 a day']],
    effect: 'Visits as usual. Sign-ups on Mobile Safari: <b class="bad">0</b>.',
    now: 'Roll back the checkout update, or fix the pay button on Mobile Safari.',
  },
};
// The days after the Reddit post: still up, and why.
const AFTER = { 17: 'Still up from Wednesday’s Reddit post: reddit.com sent 24 visits.', 18: 'Settling back after the Reddit post, still above a usual Friday.' };
export const FIRST_PICK = 16;

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const wd = (i) => WEEKDAYS[i % 7];
const dateOf = (i) => FIRST_DATE + i;
const short = (i) => `${wd(i).slice(0, 3)} ${dateOf(i)} ${MONTH}`;
const pct = (v, base) => Math.round((v / base - 1) * 100);
const change = (v, base) => {
  const p = pct(v, base);
  if (Math.abs(p) < 10) return '<span class="muted">as usual</span>';
  return `<span class="${p > 0 ? 'good' : 'bad'}">${p > 0 ? '+' : '−'}${Math.abs(p)}%</span>`;
};
const ICON = {
  ship: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 14V2.5M4 3h7l-1.5 2.5L11 8H4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  post: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  alert: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 2l6.5 11.5h-13z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6.5v3M8 11.5v.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

// Everything one day says. Marked days have their story; the rest say how the day went.
export function day(i) {
  const v = VISITS[i], u = USUAL[i % 7];
  const m = MARKED[i];
  const signups = m?.nums.signups ?? Math.max(1, Math.round(USUAL_SIGNUPS[i % 7] * (v / u) * (i > 24 ? 0.5 : i >= 8 ? 1.25 : 1)));
  const p = pct(v, u);
  const plainHead = Math.abs(p) < 10 ? `A usual ${wd(i)}: ${v} visits, close to the ${u} it usually gets.`
    : `${Math.abs(p)}% ${p > 0 ? 'more' : 'fewer'} visits than a usual ${wd(i)}, and nothing is marked.`;
  const g = Math.round(v * 0.5), d = Math.round(v * 0.32);
  return {
    i, label: short(i), visits: v, usual: u, signups, usualSignups: USUAL_SIGNUPS[i % 7],
    verdict: m?.verdict || (i > 24 ? ['Still low', 'bad'] : Math.abs(p) < 10 ? ['As usual', 'muted'] : [p > 0 ? 'Busier' : 'Quieter', 'amber']),
    head: m?.head || AFTER[i] || (i > 24 ? `Visits as usual, but sign-ups are still low: the checkout update is still live.` : plainHead),
    from: m?.from || [['Google', g, 0], ['Direct', d, 0], ['Other', v - g - d, 0]],
    happened: m?.happened || [],
    effect: m?.effect || '',
    now: m?.now || (i > 24 ? 'Roll back the checkout update. Thursday shows when it started.' : AFTER[i] ? 'Nothing to do. Wednesday’s post is still paying off.' : Math.abs(p) < 10 ? 'Nothing to do. Pick a marked day to see what moved.' : 'If you shipped or posted something, add it so Kauzl can track what it did.'),
  };
}

// The month: one cell a day, its bar the day's visits, a mark where something happened.
export function calendarHtml(pick = FIRST_PICK) {
  const max = Math.max(...VISITS);
  const cells = VISITS.map((v, i) => {
    const m = MARKED[i];
    const kind = m?.happened[0][0];
    const h = Math.round(8 + (v / max) * 52);
    return `<button type="button" class="cd${m ? ` marked ${m.verdict[1]}` : ''}" data-i="${i}" aria-pressed="${i === pick}" aria-label="${esc(`${short(i)}: ${v} visits${m ? `, ${m.happened[0][1]}` : ''}`)}"><span class="n">${dateOf(i)}</span>${kind ? `<span class="mk">${ICON[kind]}</span>` : ''}<i style="height:${h}%"></i></button>`;
  }).join('');
  return `<div class="cal-wk" aria-hidden="true">${WEEKDAYS.map((w) => `<span>${w[0]}</span>`).join('')}</div><div class="cal-grid" role="group" aria-label="March: pick a day">${cells}</div>`;
}

// The card under the calendar: what was in the picked day.
export function dayHtml(i) {
  const d = day(i);
  const rows = d.from.map(([l, v, c]) => `<div class="dp-row"><span>${esc(l)}</span><b>${v}</b>${c === 'new' ? '<span class="good">new</span>' : c ? `<span class="${c > 0 ? 'good' : 'bad'}">${c > 0 ? '+' : '−'}${Math.abs(c)}</span>` : '<span class="muted">as usual</span>'}</div>`).join('');
  const happened = d.happened.length
    ? d.happened.map(([k, t]) => `<div class="dp-ev ${k}">${ICON[k]}<span>${esc(t)}</span></div>`).join('') + (d.effect ? `<p class="dp-eff">${d.effect}</p>` : '')
    : '<p class="dp-none">Nothing marked. Releases, posts and your notes show here.</p>';
  return `<div class="dp-h"><b>${d.label}</b><span class="verdict ${d.verdict[1]}">${d.verdict[0]}</span></div>
<p class="dp-head">${esc(d.head)}</p>
<div class="dp-nums"><div><span>Visits</span><b>${d.visits}</b><span>usual ${d.usual} · ${change(d.visits, d.usual)}</span></div><div><span>Sign-ups</span><b>${d.signups}</b><span>usual ${d.usualSignups} · ${change(d.signups, d.usualSignups)}</span></div></div>
<div class="dp-cols"><div><p class="dp-lbl">Where they came from</p>${rows}</div><div><p class="dp-lbl">What happened</p>${happened}</div></div>
<p class="dp-now"><b>Now:</b> ${esc(d.now)}</p>`;
}

/* ---------- in the page ---------- */

function play(root) {
  const panel = root.querySelector('.dp');
  const live = root.querySelector('.cal-live');
  const cells = [...root.querySelectorAll('.cd')];
  const owl = root.closest('.play-wrap')?.querySelector('svg.owl .pupils');

  function pick(i, focus = false) {
    cells.forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.i) === i)));
    panel.innerHTML = dayHtml(i);
    panel.classList.remove('in');
    void panel.offsetWidth; // restart the fade
    panel.classList.add('in');
    live.textContent = `${day(i).label}. ${day(i).head}`;
    if (focus) cells[i].focus();
    // The owl glances at the picked day: left or right by its weekday.
    if (owl) owl.style.transform = `translate(${((i % 7) - 3) * 0.7}px, 1.2px)`;
  }

  cells.forEach((c) => {
    c.addEventListener('click', () => pick(Number(c.dataset.i)));
    c.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      const i = Number(c.dataset.i) + step;
      if (i >= 0 && i < cells.length) pick(i, true);
    });
  });
  root.classList.add('live');
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('play');
  if (root) play(root);
}
