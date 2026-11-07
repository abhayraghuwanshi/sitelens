// "What happened": one site's period told as a story, for the top of Overview.
// A headline (visits, or search clicks for a site without GA4, against the
// previous period), the few sources, landing pages and queries that moved it,
// and the days that broke from a usual weekday, each next to what shipped
// around then. Everything comes from the calendar's stored history, so it
// costs no extra Google calls once that's synced (server/calendar.mjs).
//
// Causes are only ever suggested: a post to Reddit in the same period as more
// visits from Reddit, a release the day before a spike. The text says "around
// then", never "because".

import { ValidationError } from './store.mjs';

const DAY = 86_400_000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date, n) => isoDay(Date.parse(`${date}T00:00:00Z`) + n * DAY);
const shortDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (v) => Math.round(v).toLocaleString('en-US');
const pct = (change) => `${Math.round(Math.abs(change) * 100)}%`;

export const STORY_DAYS = { '7d': 7, '28d': 28, '90d': 90 };
// The things you did, as opposed to notes and alerts about them.
const SHIPPED = new Set(['deploy', 'release', 'post', 'extension', 'mention']);

// Sources whose name tells which events could explain them.
function sourceWords(key) {
  const k = key.toLowerCase();
  if (k.includes('ycombinator') || k === 'hacker news') return ['hacker news', 'news.ycombinator', 'hn:'];
  if (k.includes('product hunt') || k.includes('producthunt')) return ['product hunt', 'producthunt'];
  if (['direct', 'google', 'bing', 'unknown', '(not set)', 'desktop', 'mobile', 'tablet'].includes(k) || k.length < 4) return [];
  return [k.replace(/\.(com|org|net|io)$/, '')];
}

// An event in the period that could explain a mover, or null.
export function causeFor(mover, events) {
  const text = (e) => `${e.label} ${e.url || ''}`.toLowerCase();
  let words = [];
  if (mover.kind === 'source') words = sourceWords(mover.key);
  // A landing page: an event naming its path (article edits, posts linking it).
  if (mover.kind === 'page' && mover.key !== '/' && mover.key.length > 3) words = [mover.key.toLowerCase().replace(/\/$/, '')];
  if (!words.length) return null;
  const hits = events.filter((e) => SHIPPED.has(e.kind) && words.some((w) => text(e).includes(w)));
  return hits.length ? { ...hits[0], count: hits.length } : null;
}

function moverText(m) {
  const what = m.kind === 'query' ? 'search clicks' : 'visits';
  if (m.kind === 'query') {
    return m.delta > 0
      ? `“${m.key}” got ${fmt(m.delta)} more ${what} (${fmt(m.value)}, from ${fmt(m.previous)}).`
      : `“${m.key}” got ${fmt(-m.delta)} fewer ${what} (${fmt(m.value)}, from ${fmt(m.previous)}).`;
  }
  const who = m.kind === 'page' ? (m.key === '/' ? 'The home page' : m.key) : m.key;
  const verb = m.kind === 'page' ? 'drew' : 'sent';
  if (!m.previous) return `${who} is new: ${fmt(m.value)} ${what}, none the period before.`;
  if (!m.value) return `${who} stopped: no ${what}, from ${fmt(m.previous)}.`;
  // From almost nothing, a percentage says less than the number it started at.
  const how = m.previous * 4 < m.value ? `from ${fmt(m.previous)}` : `${m.delta > 0 ? 'up' : 'down'} ${pct(m.delta / m.previous)}`;
  return `${who} ${verb} ${fmt(Math.abs(m.delta))} ${m.delta > 0 ? 'more' : 'fewer'} ${what} (${fmt(m.value)}, ${how}).`;
}

// → { headline, tone, changes[], days[], shipped[] }. Pure.
//   metrics: calendar.metrics for the period (days with baseline, totals)
//   previous: its totals for the period before
//   breakdowns: { source, page, query } rows from calendar.breakdown
//   events: calendar.events for the period
export function buildStory({ metrics, previous, breakdowns = {}, events = [], days: span }) {
  const traffic = metrics.days.some((d) => d.sessions !== null && d.sessions !== undefined) && (metrics.totals.sessions || previous.sessions);
  const metric = traffic ? 'sessions' : 'clicks';
  const noun = traffic ? 'Visits' : 'Search clicks';
  const value = metrics.totals[metric] || 0;
  const before = previous[metric] || 0;
  const change = before ? value / before - 1 : null;
  const period = `the previous ${span} days`;
  let headline;
  let tone = 'good';
  if (!value && !before) {
    headline = `No ${noun.toLowerCase()} recorded in this period or ${period}.`;
    tone = 'idle';
  } else if (change === null) {
    headline = `${noun}: ${fmt(value)}, with nothing to compare against in ${period}.`;
  } else if (Math.abs(change) < 0.05) {
    headline = `${noun} held steady: ${fmt(value)}, against ${fmt(before)} in ${period}.`;
    tone = 'idle';
  } else {
    headline = `${noun} were ${change > 0 ? 'up' : 'down'} ${pct(change)} on ${period}: ${fmt(value)}, against ${fmt(before)}.`;
    tone = change > 0 ? 'good' : change <= -0.2 ? 'bad' : 'warn';
  }

  // The movers: biggest absolute changes, big enough to matter for this site.
  const floor = Math.max(5, Math.round(Math.max(value, before) * 0.03));
  const movers = [];
  for (const kind of ['source', 'page', 'query']) {
    for (const r of breakdowns[kind] || []) {
      const delta = (r.value || 0) - (r.previous || 0);
      if (Math.abs(delta) < (kind === 'query' ? Math.max(3, Math.round(floor / 2)) : floor)) continue;
      if (['(not set)', '(other)'].includes(r.key)) continue;
      movers.push({ kind, key: r.key, value: r.value || 0, previous: r.previous || 0, delta });
    }
  }
  // Lead with the direction the headline went, then the biggest moves against it.
  const sign = change === null || change >= 0 ? 1 : -1;
  movers.sort((a, b) => (Math.sign(b.delta) === sign) - (Math.sign(a.delta) === sign) || Math.abs(b.delta) - Math.abs(a.delta));
  const told = movers.map((m) => {
    const cause = causeFor(m, events);
    return { ...m, text: moverText(m), ...(cause ? { cause: { date: cause.date, label: cause.label, kind: cause.kind, url: cause.url || '', more: cause.count - 1 } } : {}) };
  });
  // The three biggest, plus the biggest one with a likely cause when they have none.
  const changes = told.slice(0, 3);
  const explained = told.slice(3).find((m) => m.cause);
  if (explained && !changes.some((m) => m.cause)) changes.push(explained);

  // Days well off a usual same weekday, with what shipped that day or the day before.
  const daily = Math.max(1, value / Math.max(1, metrics.days.length));
  const notable = metrics.days
    .filter((d) => Number.isFinite(d[metric]) && d.baseline > 0 && metric === 'sessions')
    .map((d) => ({ ...d, diff: d.sessions - d.baseline }))
    .filter((d) => Math.abs(d.diff) >= Math.max(5, daily * 0.6) && Math.abs(d.sessions / d.baseline - 1) >= 0.5)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 3)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => {
      const near = events.filter((e) => SHIPPED.has(e.kind) && (e.date === d.date || e.date === addDays(d.date, -1)));
      const times = d.sessions / d.baseline;
      return {
        date: d.date,
        sessions: d.sessions,
        baseline: d.baseline,
        text: `${shortDate(d.date)}: ${fmt(d.sessions)} visits, ${times >= 1.5 ? `${times >= 2 ? `${Math.round(times * 10) / 10}×` : `up ${pct(times - 1)} on`} a usual ${d.weekday}` : `down ${pct(times - 1)} on a usual ${d.weekday}`} (${fmt(d.baseline)}).`,
        events: near.slice(0, 3).map((e) => ({ date: e.date, label: e.label, kind: e.kind, url: e.url || '' })),
      };
    });

  const shipped = events.filter((e) => SHIPPED.has(e.kind) && e.kind !== 'mention');
  return { metric, value, previous: before, change, headline, tone, changes, days: notable, shipped: shipped.length };
}

// `calendar` is createCalendar's API; `today()` → YYYY-MM-DD.
export function createStory({ calendar, today }) {
  return {
    async get(site, rangeKey) {
      const span = STORY_DAYS[rangeKey];
      if (!span) throw new ValidationError('Unknown range.');
      // Whole days only: today is still filling in.
      const to = addDays(today(), -1);
      const from = addDays(to, -(span - 1));
      const prev = { from: addDays(from, -span), to: addDays(from, -1) };
      const at = { site: site.id };
      const rowsFor = (by, end = to) => (end >= from ? calendar.breakdown({ ...at, from, to: end, by, limit: 40 }).catch(() => ({ rows: [] })) : { rows: [] });
      const [metrics, before, events, ...rows] = await Promise.all([
        calendar.metrics({ ...at, from, to }),
        calendar.metrics({ ...at, ...prev }),
        calendar.events({ ...at, from, to }),
        rowsFor('source'),
        rowsFor('page'),
      ]);
      // Search Console lags 2–3 days: compare queries only over days it has reported.
      rows.push(await rowsFor('query', metrics.searchLast && metrics.searchLast < to ? metrics.searchLast : to));
      const story = buildStory({
        metrics, previous: before.totals, events: events.events, days: span,
        breakdowns: { source: rows[0].rows, page: rows[1].rows, query: rows[2].rows },
      });
      return { range: { key: rangeKey, from, to, previous: prev }, ...story };
    },
  };
}

export function storyRoutes({ calendar, siteOr404, today, story = createStory({ calendar, today }) }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/story$/, async ({ match, query }) =>
      story.get(await siteOr404(match[1]), STORY_DAYS[query.get('range')] ? query.get('range') : '28d')],
  ];
}
