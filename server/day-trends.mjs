// A day's search trends (Timeline → a day → Trends): was the day up or down because
// fewer (or more) people searched, because you ranked differently, or because fewer
// clicked? Google Trends has no public API, so this reads the site's own Search Console
// rows: a search's impressions are how many people searched it (that you showed for),
// its position is where you ranked. Each is set against the same weekday in the four
// weeks before, so a quiet Sunday isn't a "drop".
//
//   demand  impressions moved ≥ 25% while the position held (within 1.5 places): a trend
//   rank    the position moved by 1.5 places or more
//   ctr     impressions and position held, clicks moved: the snippet or the result page changed
//   new     searched that day, not on the weekdays before
//   gone    searched on the weekdays before, not that day

import { querySearchAnalytics, hostPageFilter } from '../shared/sitelens/gsc.js';

const DAY = 86_400_000;
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const WHY = {
  demand: 'Searched more or less',
  rank: 'You ranked differently',
  ctr: 'Clicked more or less',
  new: 'New search',
  gone: 'Not searched that day',
};

// rows: [{ date, query, clicks, impressions, position }] for the day and the four same weekdays before it.
export function explainDay(rows, date, { limit = 8 } = {}) {
  const before = [1, 2, 3, 4].map((w) => addDays(date, -7 * w));
  const seen = new Set(rows.filter((r) => before.includes(r.date)).map((r) => r.date));
  const weeks = Math.max(1, seen.size);
  const by = new Map();
  for (const r of rows) {
    if (r.date !== date && !before.includes(r.date)) continue;
    const q = by.get(r.query) || { query: r.query, day: { clicks: 0, impressions: 0, pos: 0 }, usual: { clicks: 0, impressions: 0, pos: 0 } };
    const side = r.date === date ? q.day : q.usual;
    side.clicks += r.clicks || 0;
    side.impressions += r.impressions || 0;
    side.pos += (r.position || 0) * (r.impressions || 0); // impression-weighted
    by.set(r.query, q);
  }
  const queries = [...by.values()].map((q) => {
    const day = { clicks: q.day.clicks, impressions: q.day.impressions, position: q.day.impressions ? q.day.pos / q.day.impressions : null };
    const usual = { clicks: q.usual.clicks / weeks, impressions: q.usual.impressions / weeks, position: q.usual.impressions ? q.usual.pos / q.usual.impressions : null };
    let why;
    if (!usual.impressions && day.impressions) why = 'new';
    else if (usual.impressions && !day.impressions) why = 'gone';
    else if (day.position != null && usual.position != null && Math.abs(day.position - usual.position) >= 1.5) why = 'rank';
    else if (usual.impressions && Math.abs(day.impressions / usual.impressions - 1) >= 0.25) why = 'demand';
    else why = 'ctr';
    return { query: q.query, why, day, usual, clickGap: day.clicks - usual.clicks, imprGap: day.impressions - usual.impressions };
  });

  const sum = (list, side, k) => list.reduce((a, q) => a + q[side][k], 0);
  const total = {
    clicks: sum(queries, 'day', 'clicks'), usualClicks: sum(queries, 'usual', 'clicks'),
    impressions: sum(queries, 'day', 'impressions'), usualImpressions: sum(queries, 'usual', 'impressions'),
  };
  // How much of the day's change in search clicks each cause explains.
  const parts = Object.fromEntries(Object.keys(WHY).map((k) => [k, Math.round(queries.filter((q) => q.why === k).reduce((a, q) => a + q.clickGap, 0) * 10) / 10]));
  const gap = total.clicks - total.usualClicks;
  const lead = Object.entries(parts).filter(([, v]) => Math.sign(v) === Math.sign(gap) && v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const demandShift = total.usualImpressions ? total.impressions / total.usualImpressions - 1 : null;

  let verdict;
  if (!queries.length) verdict = 'No searches recorded for this day.';
  else if (Math.abs(gap) < Math.max(2, total.usualClicks * 0.15)) verdict = `Search was about usual: ${Math.round(total.clicks)} clicks, usually ${Math.round(total.usualClicks)}.`;
  else if (!lead) verdict = `${Math.round(total.clicks)} search clicks, usually ${Math.round(total.usualClicks)}; no single cause.`;
  else {
    const up = gap > 0;
    const say = {
      demand: up ? 'more people searched for what you rank for' : 'fewer people searched for what you rank for: a trend, not your page',
      rank: up ? 'you ranked higher' : 'you ranked lower',
      ctr: up ? 'more people clicked at the same positions' : 'fewer people clicked at the same positions',
      new: 'new searches found you',
      gone: 'searches you usually get didn’t happen',
    }[lead[0]];
    const wd = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    verdict = `${up ? 'Up' : 'Down'} ${Math.abs(Math.round(gap))} search clicks against a usual ${wd}, mostly because ${say}.`;
  }

  return {
    date, weeks: seen.size, verdict, total, demandShift, parts, lead: lead?.[0] || null,
    queries: queries.filter((q) => q.clickGap || Math.abs(q.imprGap) >= 5).sort((a, b) => Math.abs(b.clickGap) - Math.abs(a.clickGap) || Math.abs(b.imprGap) - Math.abs(a.imprGap)).slice(0, limit),
  };
}

export async function fetchDayTrends({ token, site, date }) {
  const filter = hostPageFilter(site.searchSite, site.host, { includeSubdomains: site.includeSubdomains });
  const rows = await querySearchAnalytics({
    token, siteUrl: site.searchSite,
    body: { startDate: addDays(date, -28), endDate: date, dimensions: ['date', 'query'], rowLimit: 25000, ...(filter ? { dimensionFilterGroups: [{ groupType: 'and', filters: [filter] }] } : {}) },
  });
  const flat = rows.map((r) => ({ date: r.keys[0], query: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: r.position }));
  if (!flat.some((r) => r.date === date)) return { date, pending: true, verdict: 'Search Console hasn’t reported this day yet: it usually takes 2–3 days.', queries: [] };
  return explainDay(flat, date);
}

// One search over time (a search's panel → Trend): its clicks, impressions and position per day,
// from Search Console, for the site's pages.
export async function fetchQueryTrend({ token, site, query, days = 91, end = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10) }) {
  const filter = hostPageFilter(site.searchSite, site.host, { includeSubdomains: site.includeSubdomains });
  const rows = await querySearchAnalytics({
    token, siteUrl: site.searchSite,
    body: {
      startDate: addDays(end, -(days - 1)), endDate: end, dimensions: ['date'], rowLimit: 1000,
      dimensionFilterGroups: [{ groupType: 'and', filters: [{ dimension: 'query', operator: 'equals', expression: query }, ...(filter ? [filter] : [])] }],
    },
  });
  return { query, from: addDays(end, -(days - 1)), to: end, days: rows.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position })) };
}

// Weekly numbers per search, from daily rows: N weeks ending on `to` (the last one complete).
// rows: [{ date, query, clicks, impressions, position }] → [{ query, impressions, clicks, position,
//   was, weeks: [{ impressions, clicks, position }], change }] (change: last 4 weeks vs the 4 before).
export function weeklyByQuery(rows, to, { weeks = 13, limit = 20 } = {}) {
  const end = Date.parse(`${to}T00:00:00Z`);
  const by = new Map();
  for (const r of rows) {
    const i = weeks - 1 - Math.floor((end - Date.parse(`${r.date}T00:00:00Z`)) / (7 * DAY));
    if (i < 0 || i >= weeks) continue;
    const q = by.get(r.query) || { query: r.query, w: Array.from({ length: weeks }, () => ({ impressions: 0, clicks: 0, pos: 0 })) };
    q.w[i].impressions += r.impressions || 0;
    q.w[i].clicks += r.clicks || 0;
    q.w[i].pos += (r.position || 0) * (r.impressions || 0);
    by.set(r.query, q);
  }
  const posOf = (list) => {
    const imp = list.reduce((n, w) => n + w.impressions, 0);
    return imp ? list.reduce((n, w) => n + w.pos, 0) / imp : null;
  };
  return [...by.values()].map(({ query, w }) => {
    const sum = (a, b, k) => w.slice(a, b).reduce((n, x) => n + x[k], 0);
    const now = sum(weeks - 4, weeks, 'impressions'), before = sum(weeks - 8, weeks - 4, 'impressions');
    return {
      query, impressions: sum(0, weeks, 'impressions'), clicks: sum(0, weeks, 'clicks'),
      position: posOf(w.slice(weeks - 4)) ?? posOf(w), was: posOf(w.slice(0, 4)),
      change: before ? (now - before) / before : now ? null : 0,
      weeks: w.map((x) => ({ impressions: x.impressions, clicks: x.clicks, position: x.impressions ? x.pos / x.impressions : null })),
    };
  }).sort((a, b) => b.impressions - a.impressions).slice(0, limit);
}

// The searches one page is found for on Google, each with 13 weeks of history.
export async function fetchPageSearches({ token, site, path, weeks = 13, end = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10) }) {
  const host = String(site.host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const rows = await querySearchAnalytics({
    token, siteUrl: site.searchSite,
    body: {
      startDate: addDays(end, -(weeks * 7 - 1)), endDate: end, dimensions: ['date', 'query'], rowLimit: 25000,
      dimensionFilterGroups: [{ groupType: 'and', filters: [{ dimension: 'page', operator: 'equals', expression: `https://${host}${path}` }] }],
    },
  });
  const flat = rows.map((r) => ({ date: r.keys[0], query: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: r.position }));
  return { path, from: addDays(end, -(weeks * 7 - 1)), to: end, searches: weeklyByQuery(flat, end, { weeks }) };
}
