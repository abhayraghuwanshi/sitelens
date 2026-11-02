// Search demand: Search Console queries grouped into user-defined buckets
// (brand, category…) over time, plus queries that are new or moving.
// Google Trends has no generally available API (alpha only since 2025), so this
// view uses the user's own Search Console data and only links out to Trends.

import { querySearchAnalytics, searchRange, hostPageFilter } from '../shared/sitelens/gsc.js';
import { demoSearch } from '../shared/sitelens/demo.js';
import { SourceError } from './github.mjs';

export const OTHER = 'Other';
const MAX_GROUPS = 8;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// "cool-desk.com" → Brand: /cool[\s-]*desk/ — a starting point the user edits.
export function defaultGroups(site) {
  const core = String(site.host || '').toLowerCase().replace(/^www\./, '').split('.').slice(0, -1).join('.').split('.').pop() || '';
  const parts = core.split(/[-_]+/).filter(Boolean).map(escapeRegex);
  return parts.length ? [{ name: 'Brand', pattern: parts.join('[\\s-]*') }] : [];
}

export function normalizeGroups(input) {
  if (!Array.isArray(input)) throw new SourceError('Groups must be a list.', { kind: 'validation' });
  if (input.length > MAX_GROUPS) throw new SourceError(`Up to ${MAX_GROUPS} groups.`, { kind: 'validation' });
  const seen = new Set();
  return input.map((g) => {
    const name = String(g?.name || '').trim().slice(0, 40);
    const pattern = String(g?.pattern || '').trim().slice(0, 300);
    if (!name || !pattern) throw new SourceError('Each group needs a name and a pattern.', { kind: 'validation' });
    if (name === OTHER || seen.has(name.toLowerCase())) throw new SourceError(`Group names must be unique and not "${OTHER}".`, { kind: 'validation' });
    seen.add(name.toLowerCase());
    try {
      new RegExp(pattern, 'i');
    } catch (err) {
      throw new SourceError(`“${name}” is not a valid pattern: ${err.message}`, { kind: 'validation' });
    }
    return { name, pattern };
  });
}

export function classifier(groups) {
  const compiled = groups.map((g) => ({ name: g.name, re: new RegExp(g.pattern, 'i') }));
  return (query) => compiled.find((g) => g.re.test(query))?.name || OTHER;
}

// rows: [{ date, query, clicks, impressions, position }] for the current period;
// prevRows: [{ query, clicks, impressions, position }] for the previous one.
export function aggregateDemand({ rows, prevRows, groups, dates, siteTotals }) {
  const groupOf = classifier(groups);
  const names = [...groups.map((g) => g.name), OTHER];
  const index = new Map(dates.map((d, i) => [d, i]));
  const blank = () => ({
    impressions: 0, clicks: 0, posWeight: 0,
    prevImpressions: 0, prevClicks: 0, prevPosWeight: 0,
    daily: dates.map(() => ({ impressions: 0, clicks: 0, posWeight: 0 })),
    queries: 0,
  });
  const byGroup = Object.fromEntries(names.map((n) => [n, blank()]));
  const queries = new Map();

  for (const r of rows) {
    const g = byGroup[groupOf(r.query)];
    g.impressions += r.impressions;
    g.clicks += r.clicks;
    g.posWeight += r.position * r.impressions;
    const i = index.get(r.date);
    if (i !== undefined) {
      g.daily[i].impressions += r.impressions;
      g.daily[i].clicks += r.clicks;
      g.daily[i].posWeight += r.position * r.impressions;
    }
    const q = queries.get(r.query) || { query: r.query, group: groupOf(r.query), impressions: 0, clicks: 0, posWeight: 0, prevImpressions: 0, prevClicks: 0 };
    q.impressions += r.impressions;
    q.clicks += r.clicks;
    q.posWeight += r.position * r.impressions;
    queries.set(r.query, q);
  }
  for (const r of prevRows) {
    const g = byGroup[groupOf(r.query)];
    g.prevImpressions += r.impressions;
    g.prevClicks += r.clicks;
    g.prevPosWeight += r.position * r.impressions;
    const q = queries.get(r.query) || { query: r.query, group: groupOf(r.query), impressions: 0, clicks: 0, posWeight: 0, prevImpressions: 0, prevClicks: 0 };
    q.prevImpressions += r.impressions;
    q.prevClicks += r.clicks;
    queries.set(r.query, q);
  }

  const avgPos = (weight, impressions) => (impressions ? weight / impressions : null);
  const totalImpressions = Object.values(byGroup).reduce((a, g) => a + g.impressions, 0);
  const groupRows = names.map((name) => {
    const g = byGroup[name];
    return {
      name,
      pattern: groups.find((x) => x.name === name)?.pattern || '',
      impressions: g.impressions,
      clicks: g.clicks,
      position: avgPos(g.posWeight, g.impressions),
      share: totalImpressions ? g.impressions / totalImpressions : 0,
      previous: { impressions: g.prevImpressions, clicks: g.prevClicks, position: avgPos(g.prevPosWeight, g.prevImpressions) },
      queries: [...queries.values()].filter((q) => q.group === name && q.impressions > 0).length,
      daily: {
        impressions: g.daily.map((d) => d.impressions),
        clicks: g.daily.map((d) => d.clicks),
        position: g.daily.map((d) => avgPos(d.posWeight, d.impressions)),
      },
    };
  });

  const list = [...queries.values()].map((q) => ({
    query: q.query,
    group: q.group,
    impressions: q.impressions,
    clicks: q.clicks,
    position: avgPos(q.posWeight, q.impressions),
    prevImpressions: q.prevImpressions,
    change: q.impressions - q.prevImpressions,
  }));
  const MIN = 5; // ignore single-digit noise when calling something new or rising
  return {
    groups: groupRows,
    queries: list.filter((q) => q.impressions > 0).sort((a, b) => b.impressions - a.impressions).slice(0, 300),
    newQueries: list.filter((q) => q.prevImpressions === 0 && q.impressions >= MIN).sort((a, b) => b.impressions - a.impressions).slice(0, 25),
    rising: list.filter((q) => q.prevImpressions > 0 && q.change >= MIN).sort((a, b) => b.change - a.change).slice(0, 25),
    falling: list.filter((q) => q.change <= -MIN).sort((a, b) => a.change - b.change).slice(0, 25),
    // Search Console drops rare queries for privacy; the gap shows how much.
    anonymized: siteTotals ? Math.max(0, siteTotals.impressions - totalImpressions) : 0,
    siteImpressions: siteTotals?.impressions ?? totalImpressions,
  };
}

function datesBetween(start, end) {
  const out = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

async function allRows(run, dateRange, dimensions) {
  const out = [];
  for (let page = 0; page < 4; page++) {
    const rows = await run(dateRange, dimensions, 25000, page * 25000);
    out.push(...rows);
    if (rows.length < 25000) break;
  }
  return out;
}

export async function fetchDemand({ token, site, rangeKey, groups }) {
  const range = searchRange(rangeKey);
  const dates = datesBetween(range.current.startDate, range.current.endDate);
  const filter = hostPageFilter(site.searchSite, site.host, { includeSubdomains: site.includeSubdomains });
  const run = (dateRange, dimensions, rowLimit, startRow = 0) =>
    querySearchAnalytics({
      token,
      siteUrl: site.searchSite,
      body: { ...dateRange, dimensions, rowLimit, startRow, ...(filter ? { dimensionFilterGroups: [{ groupType: 'and', filters: [filter] }] } : {}) },
    });
  const [current, previous, totals] = await Promise.all([
    allRows(run, range.current, ['date', 'query']),
    allRows(run, range.previous, ['query']),
    run(range.current, [], 1),
  ]);
  const rows = current.map((r) => ({ date: r.keys[0], query: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: r.position }));
  const prevRows = previous.map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position }));
  return { range, dates, ...aggregateDemand({ rows, prevRows, groups, dates, siteTotals: totals[0] }) };
}

// Demo: spread the demo site's query totals over the days with a gentle trend.
export function demoDemand({ site, rangeKey, groups }) {
  const range = searchRange(rangeKey);
  const dates = datesBetween(range.current.startDate, range.current.endDate);
  const { site: report } = demoSearch(site.host, `https://${site.host}/`, rangeKey);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = [];
  const prevRows = [];
  for (const q of report.queries) {
    const growth = /alternative|vs|best/.test(q.query) ? 1.6 : 1;
    dates.forEach((date, i) => {
      const w = (0.6 + rand() * 0.8) * (1 + (growth - 1) * (i / dates.length));
      const impressions = Math.round((q.impressions / dates.length) * w);
      if (impressions) rows.push({ date, query: q.query, impressions, clicks: Math.round(impressions * q.ctr), position: q.position + (rand() - 0.5) });
    });
    prevRows.push({ query: q.query, impressions: Math.round(q.impressions / growth / 1.1), clicks: Math.round(q.clicks / growth / 1.1), position: q.position + 0.6 });
  }
  return { range, dates, ...aggregateDemand({ rows, prevRows, groups, dates, siteTotals: null }) };
}
