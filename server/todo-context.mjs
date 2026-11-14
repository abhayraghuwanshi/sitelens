// The data behind a to-do, so you (and Claude, over MCP) see what it's about
// without going looking: for a source, its visits and the searches and pages
// that moved; for a page or article, its visits and the searches it shows up
// for (impressions, position, CTR); for a search, the pages that rank for it;
// for an outcome finding, that finding as it reads today. Once the to-do is
// done, the same numbers since then against as many days before.
//
// Everything is the last 28 whole days against the 28 before, from the
// Calendar's stored history and the (cached) Search Console report.

import { sourceFamily } from './journey.mjs';

const DAY = 86_400_000;
const PERIOD = 28;
const isoDay = (ms) => new Date(ms).toLocaleDateString('en-CA');
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const SEARCH_ENGINES = new Set(['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia']);
const round = (v, d = 1) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : v);

// What a to-do is about: its own subject, else read from its link
// (an article or a page in Studio), else nothing to show.
export function subjectOf(todo) {
  if (todo.subject) return todo.subject;
  const link = todo.link || '';
  const params = new URLSearchParams(link.split('?')[1] || '');
  if (params.get('article')) return { kind: 'search', key: params.get('article') };
  if (/\/pages\b/.test(link) && params.get('path')) return { kind: 'page', key: params.get('path') };
  return null;
}

const row = (rows, key) => rows.find((r) => r.key.toLowerCase() === key.toLowerCase()) || { key, value: 0, previous: 0 };
const movers = (rows, n = 8) => rows
  .map((r) => ({ key: r.key, value: r.value, previous: r.previous || 0, change: r.value - (r.previous || 0) }))
  .filter((r) => r.change)
  .sort((a, b) => a.change - b.change)
  .slice(0, n);
const searches = (rows) => rows.map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, ctr: round(q.ctr * 100), position: round(q.position) }));

export function createTodoContext({ calendar, engines, outcomes, store, today = () => isoDay(Date.now()) }) {
  async function search(site) {
    if (!site.demo && !site.searchSite) return null;
    return engines.search(site, '28d').catch(() => null);
  }

  // Rows for [from, to] against the same length before, from the stored history.
  const breakdown = (site, by, from, to) => calendar.breakdown({ site: site.id, from, to, by, limit: 200 }).then((r) => r.rows).catch(() => []);

  // The subject's own number over a span: visits for a source or page, clicks for a query.
  async function measureOver(site, subject, from, to) {
    const by = subject.kind === 'query' ? 'query' : subject.kind === 'source' ? 'source' : 'page';
    const key = by === 'source' ? sourceFamily(subject.key) : subject.key;
    const r = row(await breakdown(site, by, from, to), key);
    return { metric: by === 'query' ? 'search clicks' : 'visits', value: r.value, before: r.previous || 0 };
  }

  return async function context(todo) {
    const subject = subjectOf(todo);
    const site = todo.site ? (await store.sites()).find((s) => s.id === todo.site) : null;
    if (!subject || !site) return { subject, note: site ? 'This to-do has no data attached: it was written by hand.' : 'This to-do isn’t tied to a site.' };

    const to = addDays(today(), -1);
    const from = addDays(to, -(PERIOD - 1));
    const out = { subject, period: { from, to, comparedWith: `${addDays(from, -PERIOD)} to ${addDays(from, -1)}` }, ...(todo.baseline ? { whenAdded: todo.baseline } : {}) };
    const sc = ['page', 'search', 'query', 'source'].includes(subject.kind) ? await search(site) : null;

    if (subject.kind === 'source') {
      const family = sourceFamily(subject.key);
      const [sources, pages, queries] = await Promise.all([
        breakdown(site, 'source', from, to),
        breakdown(site, 'page', from, to),
        SEARCH_ENGINES.has(subject.key.toLowerCase()) ? breakdown(site, 'query', from, to) : [],
      ]);
      out.source = row(sources, family);
      out.pagesThatMoved = { note: 'Visits from every source: the stored history has no source × page split.', rows: movers(pages) };
      if (queries.length) out.searchesThatMoved = { note: 'Search Console clicks per query.', rows: movers(queries) };
      if (sc && subject.key.toLowerCase() === 'google') out.searchTotals = { clicks: sc.current?.clicks, impressions: sc.current?.impressions, ctr: round((sc.current?.ctr || 0) * 100), position: round(sc.current?.position), previous: sc.previous };
    }

    if (subject.kind === 'page' || subject.kind === 'search') {
      const pages = await breakdown(site, 'page', from, to);
      out.page = row(pages, subject.key);
      if (sc) {
        out.searches = searches((sc.queryPages || []).filter((q) => q.path === subject.key).sort((a, b) => b.impressions - a.impressions).slice(0, 15));
        const pageRow = (sc.pages || []).find((p) => p.path === subject.key);
        if (pageRow) out.searchTotals = { clicks: pageRow.clicks, impressions: pageRow.impressions, ctr: round(pageRow.ctr * 100), position: round(pageRow.position) };
      }
    }

    if (subject.kind === 'query') {
      out.query = row(await breakdown(site, 'query', from, to), subject.key);
      if (sc) {
        out.pagesRanking = (sc.queryPages || []).filter((q) => q.query === subject.key).map((q) => ({ path: q.path, clicks: q.clicks, impressions: q.impressions, ctr: round(q.ctr * 100), position: round(q.position) }));
        const q = (sc.queries || []).find((x) => x.query === subject.key);
        if (q) out.searchTotals = searches([q])[0];
      }
    }

    if (subject.kind === 'outcome') {
      const product = ((await store.get()).products || []).find((p) => p.siteId === site.id);
      const data = product ? await outcomes.get(product.id, '28d').catch(() => null) : null;
      out.finding = data?.insights?.find((i) => `outcome:${i.key}` === todo.from || i.key === subject.key) || { note: 'That finding no longer shows up for the last 28 days.' };
      if (data) out.outcomes = data.scorecard;
    }

    // Done: the same number since the change, against as many days before it.
    if (todo.status === 'done' && todo.doneAt && subject.kind !== 'outcome' && subject.kind !== 'posts') {
      const start = isoDay(todo.doneAt);
      const days = Math.min(PERIOD, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY) + 1);
      if (days < 3) {
        out.sinceDone = { note: `Done on ${start}. Check back after ${addDays(start, 7)}: a few days say little, and Search Console reports 2–3 days late.` };
      } else {
        const m = await measureOver(site, subject, start, addDays(start, days - 1));
        out.sinceDone = { from: start, days, ...m, note: `${m.metric} in the ${days} days since it was done, against the ${days} days before.` };
      }
    }
    return out;
  };
}
