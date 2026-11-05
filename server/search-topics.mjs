// Search topics: how each topic in a site's .sitelens.yml (search: topics) does
// in Google. Per topic: its clicks and impressions against the period before,
// which pages Google ranks for it, how each target query stands, and what's in
// the way: the wrong page ranking, one query split across pages, or a target
// Google never showed. Queries go to topics the same way Demand groups them
// (first match wins, Brand first), so the two pages always agree.

import { querySearchAnalytics, searchRange, hostPageFilter, expectedCtr } from '../shared/sitelens/gsc.js';
import { demoSearch } from '../shared/sitelens/demo.js';
import { searchGroups } from './site-config.mjs';

const MIN_IMPRESSIONS = 20; // below this a query's page mix is noise

// "https://www.x.com/blog/a/?q=1" → "/blog/a"
export function pathOf(url) {
  let path;
  try {
    path = new URL(url).pathname;
  } catch {
    path = String(url || '/').replace(/[?#].*$/, '');
  }
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

const weighted = (sum, impressions) => (impressions ? sum / impressions : null);

// rows: [{ query, page, clicks, impressions, position }] for the range, one per
// query and page. prevRows: [{ query, clicks, impressions }] for the period before.
export function topicReport({ search, rows, prevRows = [] }) {
  const topics = search?.topics || [];
  if (!topics.length) return { topics: [] };
  const compiled = searchGroups(search, { all: true }).map((g) => ({ name: g.name, re: new RegExp(g.pattern, 'i') }));
  const topicOf = (query) => {
    const name = compiled.find((g) => g.re.test(query))?.name;
    return topics.find((t) => t.name === name) || null;
  };

  const byTopic = new Map(topics.map((t) => [t.name, { queries: new Map(), previous: { clicks: 0, impressions: 0 } }]));
  for (const r of rows) {
    const query = String(r.query || '').toLowerCase();
    const t = topicOf(query);
    if (!t) continue;
    const queries = byTopic.get(t.name).queries;
    if (!queries.has(query)) queries.set(query, { query, clicks: 0, impressions: 0, posSum: 0, pages: new Map() });
    const q = queries.get(query);
    const page = pathOf(r.page);
    q.clicks += r.clicks;
    q.impressions += r.impressions;
    q.posSum += r.position * r.impressions;
    const p = q.pages.get(page) || { path: page, clicks: 0, impressions: 0, posSum: 0 };
    p.clicks += r.clicks;
    p.impressions += r.impressions;
    p.posSum += r.position * r.impressions;
    q.pages.set(page, p);
  }
  for (const r of prevRows) {
    const t = topicOf(String(r.query || '').toLowerCase());
    if (!t) continue;
    const prev = byTopic.get(t.name).previous;
    prev.clicks += r.clicks;
    prev.impressions += r.impressions;
  }

  const shapeQuery = (q) => {
    const pages = [...q.pages.values()].sort((a, b) => b.impressions - a.impressions);
    return {
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.impressions ? q.clicks / q.impressions : 0,
      position: weighted(q.posSum, q.impressions),
      page: pages[0]?.path || null,
      pages: pages.map((p) => ({ path: p.path, impressions: p.impressions, clicks: p.clicks, position: weighted(p.posSum, p.impressions), share: q.impressions ? p.impressions / q.impressions : 0 })),
    };
  };

  return {
    topics: topics.map((t) => {
      const { queries, previous } = byTopic.get(t.name);
      const list = [...queries.values()].map(shapeQuery).sort((a, b) => b.impressions - a.impressions);
      const clicks = list.reduce((n, q) => n + q.clicks, 0);
      const impressions = list.reduce((n, q) => n + q.impressions, 0);
      const pageTotals = new Map();
      for (const q of list) {
        for (const p of q.pages) {
          const x = pageTotals.get(p.path) || { path: p.path, impressions: 0, clicks: 0 };
          x.impressions += p.impressions;
          x.clicks += p.clicks;
          pageTotals.set(p.path, x);
        }
      }
      const pages = [...pageTotals.values()].sort((a, b) => b.impressions - a.impressions).map((p) => ({ ...p, share: impressions ? p.impressions / impressions : 0, own: p.path === t.page }));

      const targets = (t.targets || []).map((target) => {
        const q = list.find((x) => x.query === target);
        if (!q) return { query: target, status: 'unseen' };
        const status = q.position <= 3.5 ? 'top' : q.position <= 10.5 ? 'page1' : q.position <= 20.5 ? 'page2' : 'far';
        return {
          ...q,
          status,
          wrongPage: Boolean(t.page && q.page !== t.page),
          potential: q.position > 3.5 ? Math.max(0, Math.round(q.impressions * expectedCtr(3) - q.clicks)) : 0,
        };
      });

      // What's in the way, biggest first.
      const wrongPage = t.page ? list.filter((q) => q.impressions >= MIN_IMPRESSIONS && q.page !== t.page).slice(0, 5).map((q) => ({ query: q.query, page: q.page, impressions: q.impressions, ownShare: q.pages.find((p) => p.path === t.page)?.share || 0 })) : [];
      const split = list.filter((q) => q.impressions >= MIN_IMPRESSIONS && q.pages.filter((p) => p.share >= 0.2).length >= 2).slice(0, 5).map((q) => ({ query: q.query, impressions: q.impressions, pages: q.pages.filter((p) => p.share >= 0.2).map((p) => p.path) }));

      return {
        name: t.name,
        page: t.page || null,
        clicks,
        impressions,
        ctr: impressions ? clicks / impressions : 0,
        position: weighted(list.reduce((n, q) => n + q.position * q.impressions, 0), impressions),
        previous,
        queries: list.length,
        top: list.slice(0, 5).map(({ pages: _pages, ...q }) => q),
        pages: pages.slice(0, 4),
        ownShare: t.page ? pages.find((p) => p.own)?.share || 0 : null,
        targets,
        issues: { wrongPage, split, unseen: targets.filter((x) => x.status === 'unseen').map((x) => x.query) },
        potential: targets.reduce((n, x) => n + (x.potential || 0), 0),
      };
    }),
  };
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

export async function fetchTopics({ token, site, rangeKey, search }) {
  const range = searchRange(rangeKey);
  const filter = hostPageFilter(site.searchSite, site.host, { includeSubdomains: site.includeSubdomains });
  const run = (dateRange, dimensions, rowLimit, startRow = 0) =>
    querySearchAnalytics({
      token,
      siteUrl: site.searchSite,
      body: { ...dateRange, dimensions, rowLimit, startRow, ...(filter ? { dimensionFilterGroups: [{ groupType: 'and', filters: [filter] }] } : {}) },
    });
  const [current, previous] = await Promise.all([allRows(run, range.current, ['query', 'page']), allRows(run, range.previous, ['query'])]);
  return {
    range,
    ...topicReport({
      search,
      rows: current.map((r) => ({ query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, position: r.position })),
      prevRows: previous.map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
    }),
  };
}

export function demoTopics({ site, rangeKey, search }) {
  const { site: report, range } = demoSearch(site.host, `https://${site.host}/`, rangeKey);
  return {
    range: range || searchRange(rangeKey),
    ...topicReport({
      search,
      rows: report.queryPages.map((r) => ({ query: r.query, page: r.url, clicks: r.clicks, impressions: r.impressions, position: r.position })),
      prevRows: report.queries.map((q) => ({ query: q.query, clicks: Math.round(q.clicks * 0.85), impressions: Math.round(q.impressions * 0.9) })),
    }),
  };
}
