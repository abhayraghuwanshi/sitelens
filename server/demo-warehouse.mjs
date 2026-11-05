// Deterministic event-level sample data: a 120-day world of users and
// sessions with GA4-like events and parameters. Each analysis here returns the
// same rows the BigQuery SQL in sql.mjs returns, so the UI cannot tell them apart.

import { stepKey, AUTO_EVENTS } from './sql.mjs';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAGES = ['/', '/pricing', '/features', '/docs/getting-started', '/blog/how-to-measure-product-engagement',
  '/integrations', '/customers', '/signup', '/blog/ga4-vs-plausible', '/changelog', '/about', '/contact'];

// Landing weights and next-page transitions, shaped like a SaaS marketing site.
const LANDING = [['/', 0.36], ['/blog/how-to-measure-product-engagement', 0.16], ['/pricing', 0.12],
  ['/blog/ga4-vs-plausible', 0.1], ['/docs/getting-started', 0.1], ['/features', 0.08], ['/integrations', 0.05], ['/changelog', 0.03]];

const NEXT = {
  '/': [['/pricing', 0.3], ['/features', 0.24], ['/customers', 0.08], ['/docs/getting-started', 0.08], ['/about', 0.04]],
  '/pricing': [['/signup', 0.34], ['/features', 0.12], ['/contact', 0.08], ['/customers', 0.06]],
  '/features': [['/pricing', 0.36], ['/integrations', 0.16], ['/signup', 0.1]],
  '/docs/getting-started': [['/integrations', 0.18], ['/pricing', 0.12], ['/signup', 0.12]],
  '/blog/how-to-measure-product-engagement': [['/', 0.18], ['/features', 0.12], ['/blog/ga4-vs-plausible', 0.1], ['/pricing', 0.08]],
  '/blog/ga4-vs-plausible': [['/pricing', 0.16], ['/', 0.12], ['/features', 0.08]],
  '/integrations': [['/pricing', 0.24], ['/docs/getting-started', 0.16], ['/signup', 0.08]],
  '/customers': [['/pricing', 0.3], ['/signup', 0.1]],
  '/signup': [],
  '/changelog': [['/', 0.18], ['/features', 0.1]],
  '/about': [['/careers', 0.1], ['/contact', 0.1]],
  '/contact': [],
};

const SOURCES = [['google', 'organic', 0.38], ['(direct)', '(none)', 0.28], ['news.ycombinator.com', 'referral', 0.08],
  ['chatgpt.com', 'referral', 0.05], ['linkedin.com', 'social', 0.07], ['google', 'cpc', 0.07], ['newsletter', 'email', 0.05], ['github.com', 'referral', 0.02]];
const DEVICES = [['desktop', 0.52], ['mobile', 0.44], ['tablet', 0.04]];
const COUNTRIES = [['United States', 0.33], ['India', 0.19], ['United Kingdom', 0.1], ['Germany', 0.08], ['Canada', 0.07],
  ['France', 0.05], ['Australia', 0.04], ['Brazil', 0.04], ['Netherlands', 0.03], ['Japan', 0.03], ['Spain', 0.02], ['Poland', 0.02]];
const PLANS = [['starter', 0.5], ['team', 0.38], ['business', 0.12]];
const OS = [['macos', 0.48], ['windows', 0.36], ['linux', 0.16]];

function pick(rand, list) {
  let r = rand() * list.reduce((acc, item) => acc + item[item.length - 1], 0);
  for (const item of list) {
    r -= item[item.length - 1];
    if (r <= 0) return item;
  }
  return list[list.length - 1];
}

const DAY = 86_400_000;
const WORLD_DAYS = 120;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoDay(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let cached = null;

// Built once per process (and per calendar day) — ~14k sessions, ~70k events.
export function demoWorld(now = new Date()) {
  const anchor = startOfDay(now).getTime();
  if (cached?.anchor === anchor) return cached;
  const rand = mulberry32(0x5eed);
  const sessions = [];
  const events = [];
  let userSeq = 0;

  for (let day = WORLD_DAYS; day >= 1; day--) {
    const dayStart = anchor - day * DAY;
    const dow = new Date(dayStart).getDay();
    const growth = 1 + (WORLD_DAYS - day) / WORLD_DAYS * 0.35;
    const newUsers = Math.round((dow === 0 || dow === 6 ? 52 : 74) * growth * (0.85 + rand() * 0.3));

    for (let u = 0; u < newUsers; u++) {
      const userId = `${(1e9 + userSeq++).toString(36)}.${Math.floor(rand() * 1e9)}`;
      const device = pick(rand, DEVICES)[0];
      const country = pick(rand, COUNTRIES)[0];
      const [source, medium] = pick(rand, SOURCES);
      const firstTouch = dayStart + Math.floor(rand() * DAY * 0.95);
      // Returning behaviour: an engaged minority comes back for weeks.
      const loyalty = rand() < 0.22 ? 0.55 : 0.12;
      let at = firstTouch;
      let index = 0;
      while (at < anchor) {
        buildSession({ rand, userId, device, country, source: index ? '(direct)' : source, medium: index ? '(none)' : medium,
          startedAt: at, firstTouch, sessions, events, returning: index > 0 });
        index += 1;
        if (rand() > loyalty * Math.pow(0.86, index - 1)) break;
        at += Math.floor(DAY * (1 + rand() * 9));
      }
    }
  }
  cached = { anchor, sessions, events };
  return cached;
}

function buildSession({ rand, userId, device, country, source, medium, startedAt, firstTouch, sessions, events, returning }) {
  const sessionId = Math.floor(startedAt / 1000);
  const seq = [];
  const pages = [];
  let ts = startedAt * 1000;
  const push = (name, params = {}, page = pages[pages.length - 1]) => {
    ts += Math.floor((name === 'page_view' ? 8 + rand() * 70 : 2 + rand() * 25) * 1e6);
    seq.push({ k: name === 'page_view' ? `page:${page}` : `event:${name}`, ts });
    events.push({ userId, date: isoDay(startedAt), name, params: { page_location: `https://example.com${page}`, ...params }, ts });
  };

  let page = returning && rand() < 0.4 ? '/docs/getting-started' : pick(rand, LANDING)[0];
  if (!returning) push('first_visit', {}, page);
  push('session_start', {}, page);
  for (let step = 0; step < 9 && page; step++) {
    pages.push(page);
    push('page_view', { page_title: page });
    if (rand() < 0.42) push('scroll', { percent_scrolled: 90 });
    if (page === '/pricing' && rand() < 0.3) push('plan_select', { plan: pick(rand, PLANS)[0] });
    if (page === '/docs/getting-started' && rand() < 0.22) push('file_download', { download_os: pick(rand, OS)[0], file_extension: 'dmg' });
    if (page === '/signup') {
      push('signup_start', { method: rand() < 0.6 ? 'google' : 'email' });
      if (rand() < 0.46) push('sign_up', { method: rand() < 0.6 ? 'google' : 'email', plan: pick(rand, PLANS)[0] });
    }
    if (page === '/contact' && rand() < 0.3) push('generate_lead', { form: 'contact' });
    const options = NEXT[page] || [];
    const exit = 1 - options.reduce((acc, o) => acc + o[1], 0);
    const next = pick(rand, [...options, [null, Math.max(0.05, exit)]])[0];
    page = next;
  }

  sessions.push({
    user_id: userId,
    session_id: sessionId,
    session_date: isoDay(startedAt),
    first_touch_date: isoDay(firstTouch),
    started_at: startedAt * 1000,
    ended_at: ts,
    device,
    country,
    source,
    medium,
    pages,
    seq,
  });
}

/* ---------- analyses (mirror sql.mjs) ---------- */

function inRange(range) {
  return (iso) => iso >= range.startDate && iso <= range.endDate;
}

function sessionsIn(range) {
  const test = inRange(range);
  return demoWorld().sessions.filter((s) => test(s.session_date));
}

export function demoPaths(range, { depth = 4, startPath = '', top = 12 } = {}) {
  const counts = new Map();
  const pages = new Map();
  let total = 0;
  for (const s of sessionsIn(range)) {
    if (!s.pages.length || (startPath && s.pages[0] !== startPath)) continue;
    total += 1;
    s.pages.forEach((page, i) => {
      const row = pages.get(page) || { page, views: 0, exits: 0 };
      row.views += 1;
      if (i === s.pages.length - 1) row.exits += 1;
      pages.set(page, row);
    });
    s.pages.slice(0, depth).forEach((from, i) => {
      const to = s.pages[i + 1] || '(exit)';
      const key = `${i}\u0000${from}\u0000${to}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  }
  const byStep = new Map();
  for (const [key, sessions] of counts) {
    const [step, from_path, to_path] = key.split('\u0000');
    const list = byStep.get(step) || [];
    list.push({ step: Number(step), from_path, to_path, sessions });
    byStep.set(step, list);
  }
  const rows = [...byStep.values()].flatMap((list) => list.sort((a, b) => b.sessions - a.sessions).slice(0, top));
  return {
    rows: rows.sort((a, b) => a.step - b.step || b.sessions - a.sessions),
    exits: [...pages.values()].sort((a, b) => b.views - a.views).slice(0, 40),
    total,
  };
}

export function demoFunnelDiscovery(range) {
  const out = [];
  for (const s of sessionsIn(range)) {
    const firsts = new Map();
    for (const e of s.seq) {
      const name = e.k.startsWith('event:') ? e.k.slice(6) : '';
      if (name && !AUTO_EVENTS.includes(name) && !firsts.has(name)) firsts.set(name, e.ts);
    }
    if (firsts.size) out.push({ landing: s.pages[0] || '', start: s.seq[0]?.ts, events: [...firsts].map(([name, ts]) => ({ name, ts })) });
  }
  return out;
}

export function demoFunnel(range, steps) {
  const keys = steps.map(stepKey);
  const reached = keys.map(() => 0);
  const gaps = keys.map(() => []);
  for (const s of sessionsIn(range)) {
    let prev = -Infinity;
    for (let i = 0; i < keys.length; i++) {
      const hit = s.seq.find((e) => e.k === keys[i] && e.ts > prev);
      if (!hit) break;
      reached[i] += 1;
      if (i > 0) gaps[i].push((hit.ts - prev) / 1e6);
      prev = hit.ts;
    }
  }
  const row = {};
  reached.forEach((n, i) => {
    row[`step_${i}`] = n;
    if (i > 0) row[`avg_seconds_${i}`] = gaps[i].length ? gaps[i].reduce((a, b) => a + b, 0) / gaps[i].length : null;
  });
  return row;
}

function mondayOf(iso) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDay(d.getTime());
}

export function demoCohorts(range) {
  const test = inRange(range);
  const cells = new Map();
  for (const s of demoWorld().sessions) {
    if (!test(s.first_touch_date) || !test(s.session_date)) continue;
    const cohort = mondayOf(s.first_touch_date);
    const week = mondayOf(s.session_date);
    const offset = Math.round((new Date(`${week}T12:00:00`) - new Date(`${cohort}T12:00:00`)) / (7 * DAY));
    const key = `${cohort}|${offset}`;
    if (!cells.has(key)) cells.set(key, new Set());
    cells.get(key).add(s.user_id);
  }
  return [...cells]
    .map(([key, users]) => {
      const [cohort, week_offset] = key.split('|');
      return { cohort, week_offset: Number(week_offset), users: users.size };
    })
    .sort((a, b) => a.cohort.localeCompare(b.cohort) || a.week_offset - b.week_offset);
}

export function demoSessionsList(range, { path = '', converted = '', limit = 50 } = {}) {
  const key = converted ? `event:${converted}` : '';
  return sessionsIn(range)
    .filter((s) => (!path || s.pages.includes(path)) && (!key || s.seq.some((e) => e.k === key)))
    .sort((a, b) => b.started_at - a.started_at)
    .slice(0, limit)
    .map((s) => ({
      user_id: s.user_id,
      session_id: s.session_id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      device: s.device,
      country: s.country,
      source: s.source,
      medium: s.medium,
      pages: s.pages.slice(0, 30),
      page_count: s.pages.length,
      event_count: s.seq.length,
      conversions: key ? s.seq.filter((e) => e.k === key).length : 0,
    }));
}

function eventsIn(range) {
  const test = inRange(range);
  return demoWorld().events.filter((e) => test(e.date));
}

export function demoEventsCatalog(range) {
  const map = new Map();
  for (const e of eventsIn(range)) {
    const row = map.get(e.name) || { event_name: e.name, events: 0, users: new Set() };
    row.events += 1;
    row.users.add(e.userId);
    map.set(e.name, row);
  }
  return [...map.values()]
    .map((r) => ({ event_name: r.event_name, events: r.events, users: r.users.size }))
    .sort((a, b) => b.events - a.events);
}

export function demoEventDetail(range, eventName) {
  const keys = new Map();
  const days = new Map();
  for (const e of eventsIn(range)) {
    if (e.name !== eventName) continue;
    const day = days.get(e.date) || { date: e.date.replaceAll('-', ''), events: 0, users: new Set() };
    day.events += 1;
    day.users.add(e.userId);
    days.set(e.date, day);
    for (const [key, value] of Object.entries(e.params)) {
      const row = keys.get(key) || { key, events: 0, values: new Set() };
      row.events += 1;
      row.values.add(String(value));
      keys.set(key, row);
    }
  }
  return {
    keys: [...keys.values()].map((r) => ({ key: r.key, events: r.events, distinct_values: r.values.size })).sort((a, b) => b.events - a.events),
    trend: [...days.values()].map((d) => ({ date: d.date, events: d.events, users: d.users.size })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function demoParamBreakdown(range, eventName, key) {
  const map = new Map();
  for (const e of eventsIn(range)) {
    if (e.name !== eventName || !(key in e.params)) continue;
    const value = String(e.params[key]);
    const row = map.get(value) || { value, events: 0, users: new Set() };
    row.events += 1;
    row.users.add(e.userId);
    map.set(value, row);
  }
  return [...map.values()]
    .map((r) => ({ value: r.value, events: r.events, users: r.users.size }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 50);
}
