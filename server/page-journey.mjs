// What people do after landing on a page: where they go next, how many leave,
// and how many go on to the site's goals (downloads, sign-ups…).
//
//  - With the GA4 BigQuery export: real session paths from the warehouse
//    (sessions that started on the page), two steps deep with exits, and each
//    goal event reached later in the same session. Last 28 days, to keep scans small.
//  - With GA4 only: the pages viewed with this page as the referrer (the clicks
//    out of it), and the goal events fired in sessions that landed here.
//    GA4's API has no exits, so that part is left out.
// Results are kept on disk and refreshed in the background like other reports.

import { runReport } from './ga-limit.mjs';
import { hostFilter, getRange } from '../shared/sitelens/reports.js';
import { createCache } from './cache.mjs';

const HOUR = 3_600_000;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const share = (n, of) => (of ? n / of : 0);

// Warehouse paths → the journey from `path`. Pure.
export function journeyFromPaths(paths, path, { top = 8 } = {}) {
  const total = paths.total || 0;
  const step0 = paths.edges.filter((e) => e.step === 0 && e.from === path);
  const exit = step0.find((e) => e.to === '(exit)');
  const next = step0.filter((e) => e.to !== '(exit)').sort((a, b) => b.sessions - a.sessions).slice(0, top)
    .map((e) => ({ page: e.to, sessions: e.sessions, share: share(e.sessions, total) }));
  const then = {};
  for (const n of next.slice(0, 3)) {
    then[n.page] = paths.edges.filter((e) => e.step === 1 && e.from === n.page).sort((a, b) => b.sessions - a.sessions).slice(0, 4)
      .map((e) => ({ page: e.to, sessions: e.sessions, share: share(e.sessions, n.sessions) }));
  }
  return { landed: total, next, exit: { sessions: exit?.sessions || 0, share: share(exit?.sessions || 0, total) }, then };
}

export function createPageJourney({ engines, outcomes, store, auth, cacheDb = null }) {
  const cache = createCache({ db: cacheDb, name: 'page-journey', staleFor: cacheDb ? 86_400_000 : 0 });

  // The site's event goals, outcomes first (from the product's goals in Outcomes).
  async function goalsFor(site) {
    const product = ((await store.get()).products || []).find((p) => p.siteId === site.id);
    if (!product) return [];
    const out = await outcomes.get(product.id, '28d').catch(() => null);
    return (out?.goals?.list || [])
      .filter((g) => g.source === 'event' && g.match)
      .sort((a, b) => (a.role === 'outcome' ? 0 : 1) - (b.role === 'outcome' ? 0 : 1))
      .slice(0, 4)
      .map((g) => ({ label: g.label, match: g.match, role: g.role }));
  }

  // The export's daily tables end yesterday: today and this week read its last 7 days.
  async function fromWarehouse(site, path, goals, rangeKey) {
    const key = ['7d', '28d', '90d'].includes(rangeKey) ? rangeKey : '7d';
    const paths = await engines.paths(site, key, { startPath: path, depth: 3, top: 12 });
    const j = journeyFromPaths(paths, path);
    const reached = await Promise.all(goals.map(async (g) => {
      const f = await engines.funnel(site, key, [{ kind: 'page', value: path }, { kind: 'event', value: g.match }]).catch(() => null);
      const saw = f?.steps?.[0]?.sessions || 0;
      const did = f?.steps?.[1]?.sessions || 0;
      return { ...g, sessions: did, share: share(did, saw), of: saw };
    }));
    const days = Number(key.replace('d', ''));
    return { source: 'warehouse', days, period: `the last ${days} days${key !== rangeKey ? ' (the export ends yesterday)' : ''}`, ...j, goals: reached };
  }

  async function fromGa4(site, path, goals, rangeKey) {
    const token = await auth.token();
    const host = hostFilter(site.host, { includeSubdomains: site.includeSubdomains });
    const and = (...x) => ({ andGroup: { expressions: [host, ...x].filter(Boolean) } });
    const landing = { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'EXACT', value: path } } };
    const hostRe = esc(String(site.host || '').replace(/^www\./, ''));
    const fromHere = { filter: { fieldName: 'pageReferrer', stringFilter: { matchType: 'FULL_REGEXP', value: `^https?://(www\\.)?${hostRe}${path === '/' ? '' : esc(path)}/?([?#].*)?$` } } };
    const notHere = { notExpression: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'EXACT', value: path } } } };
    const r = getRange(rangeKey);
    const range = { startDate: r.current.startDate, endDate: r.current.endDate };
    const [landed, next, events] = await Promise.all([
      runReport({ token, propertyId: site.propertyId, body: { dateRanges: [range], dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], dimensionFilter: and(landing), limit: 1 } }),
      runReport({ token, propertyId: site.propertyId, body: { dateRanges: [range], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], dimensionFilter: and(fromHere, notHere), orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 8 } }),
      goals.length
        ? runReport({ token, propertyId: site.propertyId, body: { dateRanges: [range], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'totalUsers' }], dimensionFilter: and(landing, { filter: { fieldName: 'eventName', inListFilter: { values: goals.map((g) => g.match) } } }), limit: 20 } })
        : { rows: [] },
    ]);
    const sessions = Number(landed.rows[0]?.sessions) || 0;
    const users = Number(landed.rows[0]?.totalUsers) || 0;
    const byEvent = new Map(events.rows.map((r) => [r.eventName, Number(r.totalUsers) || 0]));
    return {
      source: 'ga4', days: r.days, period: (r.title || '').toLowerCase(), landed: sessions,
      next: next.rows.map((r) => ({ page: r.pagePath, views: Number(r.screenPageViews) || 0, share: share(Number(r.screenPageViews) || 0, sessions) })),
      exit: null, then: {},
      goals: goals.map((g) => ({ ...g, users: byEvent.get(g.match) || 0, share: share(byEvent.get(g.match) || 0, users), of: users })),
    };
  }

  async function journey(site, path, { fresh = false, range = '28d' } = {}) {
    return cache.wrap(`${site.id}:${path}:${range}`, range === 'today' || range === 'week' ? 10 * 60_000 : HOUR, fresh, async () => {
      const goals = await goalsFor(site);
      if (site.demo || site.bq) return fromWarehouse(site, path, goals, range);
      if (site.propertyId) return fromGa4(site, path, goals, range);
      return { source: '', note: 'Link a GA4 property (or its BigQuery export) to see where people go from here.' };
    });
  }

  return { journey };
}

export function pageJourneyRoutes({ journey, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/page-journey$/, async ({ match, query }) =>
      journey.journey(await siteOr404(match[1]), query.get('path') || '/', { fresh: query.has('fresh'), range: query.get('range') || '28d' })],
  ];
}
