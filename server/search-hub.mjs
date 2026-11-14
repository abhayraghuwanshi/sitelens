// Search, in one place: Google (Search Console) and Bing (Webmaster Tools) side
// by side for the same searches and pages, what people search for (Demand,
// plus Bing keyword research for any keywords), and whether each engine has a
// page indexed. The Explore "Search" tab and the MCP search tools read this.
//
//  - Rankings merge per search query and per page path. Each side is null when
//    that engine didn't show the site for it (or isn't connected).
//  - Index status: Google's URL Inspection API (whether the page is indexed,
//    last crawl, why not) and Bing's URL info (discovered, last crawled).
//    Google allows 2,000 inspections a day per property; answers are cached.
//
// Neither engine can rank a page before it's published and crawled: these are
// the numbers to compare before and after a change, not a preview of one.

import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';

const INSPECT = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const HOUR = 3_600_000;
const pathOf = (url) => {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
};
const side = (r) => (r ? { clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr ?? null, position: r.position ?? null } : null);

// Rows keyed by `key(row)` from both engines → [{ key, google, bing, impressions }], most seen first. Pure.
export function mergeRows(google = [], bing = [], key, limit = 50) {
  const out = new Map();
  for (const [engine, rows] of [['google', google], ['bing', bing]]) {
    for (const r of rows) {
      const k = key(r, engine);
      if (!k) continue;
      const row = out.get(k) || { key: k, google: null, bing: null };
      // A page can show up as several URLs (www, trailing slash): add them up.
      const prev = row[engine];
      const next = side(r);
      row[engine] = prev ? {
        clicks: prev.clicks + next.clicks, impressions: prev.impressions + next.impressions,
        ctr: prev.impressions + next.impressions ? (prev.clicks + next.clicks) / (prev.impressions + next.impressions) : null,
        position: prev.position !== null && next.position !== null ? (prev.position * prev.impressions + next.position * next.impressions) / Math.max(1, prev.impressions + next.impressions) : prev.position ?? next.position,
      } : next;
      out.set(k, row);
    }
  }
  return [...out.values()]
    .map((r) => ({ ...r, impressions: (r.google?.impressions || 0) + (r.bing?.impressions || 0) }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

// Explore's ranges → Bing's (it keeps days, not today/this week).
const BING_RANGE = { today: '7d', week: '7d', '7d': '7d', '28d': '28d', '90d': '90d' };

export function createSearchHub({ engines, bing, auth, fetchImpl = fetch }) {
  const cache = createCache();

  async function rankings(site, rangeKey = '28d') {
    const [google, b] = await Promise.all([
      site.demo || site.searchSite ? engines.search(site, rangeKey).then((data) => ({ data }), (error) => ({ error })) : { error: { message: 'Pick a Search Console property for this site in Settings.', kind: 'needs-search' } },
      bing.overview(site, BING_RANGE[rangeKey] || '28d').then((data) => ({ data }), (error) => ({ error })),
    ]);
    if (google.error && b.error && !['needs-bing', 'bing-site'].includes(b.error.kind)) throw google.error;
    const g = google.data;
    const bd = b.data;
    const problem = (e) => (e ? { message: e.message, kind: e.kind || '', hint: e.hint || '' } : null);
    return {
      google: g ? { range: g.range, current: g.current, previous: g.previous, trend: g.trend, warnings: g.warnings || [] } : { error: problem(google.error) },
      bing: bd ? { siteUrl: bd.siteUrl, range: bd.range, current: bd.current, previous: bd.previous, series: bd.series, crawl: bd.crawl, quota: bd.quota } : { error: problem(b.error) },
      opportunities: g?.opportunities || [],
      queries: mergeRows(g?.queries || [], bd?.queries || [], (r) => (r.query || '').toLowerCase(), 100),
      pages: mergeRows(g?.pages || [], bd?.pages || [], (r, engine) => (engine === 'google' ? r.path : pathOf(r.page)), 100),
      // Which pages each search lands on (Google only: Bing doesn't split query × page).
      queryPages: (g?.queryPages || []).map((q) => ({ query: q.query.toLowerCase(), path: q.path, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position })),
    };
  }

  // Google's verdict on one URL, or why it couldn't say.
  async function inspectGoogle(site, url) {
    if (site.demo) return { note: 'Not available for the sample site.' };
    if (!site.searchSite) return { note: 'Pick a Search Console property for this site in Settings.' };
    return cache.wrap(`inspect:${url}`, 6 * HOUR, false, async () => {
      const res = await fetchImpl(INSPECT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await auth.token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: site.searchSite, languageCode: 'en-US' }),
        signal: AbortSignal.timeout(30_000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { note: json.error?.message || `Google answered ${res.status}.` };
      const r = json.inspectionResult?.indexStatusResult || {};
      return {
        verdict: r.verdict || 'VERDICT_UNSPECIFIED', // PASS = indexed
        indexed: r.verdict === 'PASS',
        coverage: r.coverageState || '', // e.g. "Submitted and indexed", "Crawled - currently not indexed"
        lastCrawled: r.lastCrawlTime ? r.lastCrawlTime.slice(0, 10) : null,
        robots: r.robotsTxtState || '', fetch: r.pageFetchState || '', indexing: r.indexingState || '',
        googleCanonical: r.googleCanonical || '', userCanonical: r.userCanonical || '',
        link: json.inspectionResult?.inspectionResultLink || '',
      };
    });
  }

  // Is this page indexed, in Google and in Bing? `path` on the site, or a full URL on it.
  async function indexStatus(site, { path = '', url = '' } = {}) {
    const host = String(site.host || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    let full = url || (path ? `https://${host}${path.startsWith('/') ? path : `/${path}`}` : '');
    if (!full) throw new EngineError('Give a page path, e.g. /blog/post.', { kind: 'validation' });
    try {
      const u = new URL(full);
      if (host && u.host.replace(/^www\./, '') !== host.replace(/^www\./, '')) throw new Error();
      full = u.href;
    } catch {
      throw new EngineError(`That isn’t a URL on ${host}.`, { kind: 'validation' });
    }
    const [google, bingInfo] = await Promise.all([
      inspectGoogle(site, full).catch((err) => ({ note: err.message })),
      site.demo ? { note: 'Not available for the sample site.' } : bing.urlInfo(site, full).catch((err) => ({ note: err.message })),
    ]);
    return { url: full, google, bing: bingInfo };
  }

  return { rankings, indexStatus };
}

export function searchHubRoutes({ hub, bing, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/search-hub$/, async ({ match, query }) => hub.rankings(await siteOr404(match[1]), query.get('range') || '28d')],
    ['GET', /^\/api\/sites\/([\w-]+)\/index-status$/, async ({ match, query }) =>
      hub.indexStatus(await siteOr404(match[1]), { path: query.get('path') || '', url: query.get('url') || '' })],
    ['GET', /^\/api\/search\/keywords$/, async ({ query }) => {
      const [country, language] = (query.get('market') || 'us/en-US').split('/');
      return { market: `${country}/${language}`, keywords: await bing.keywords((query.get('q') || '').split(','), { country, language }) };
    }],
  ];
}
