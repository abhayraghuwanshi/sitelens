// Synced from site-analytics-extension/src/lib by `npm run sync` — edit it there.
// Thin, dependency-free client for the Google Search Console API
// (Search Analytics + URL Inspection), plus site matching and aggregation.
// Uses the same pasted OAuth token as GA4; it needs the webmasters.readonly scope.

import { gaFetch, GaApiError } from './ga4.js';
import { getRange } from './reports.js';
import { hostKeys, parseUrl } from './site.js';
import { formatDate } from './format.js';

const GSC_BASE = 'https://searchconsole.googleapis.com';
export const SEARCH_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

// Search Console finalizes data with a ~2 day lag. Ending the range there keeps
// the last bars of the trend from looking like a sudden drop.
const DATA_LAG_DAYS = 2;

/* ---------- errors ---------- */

function friendlySearch(kind, detail) {
  switch (kind) {
    case 'auth':
      return 'Google rejected the access token. It probably expired — paste a fresh token in Settings.';
    case 'scope':
      return `This token was created without Search Console access. Generate a new token with both the Analytics scope and ${SEARCH_SCOPE}.`;
    case 'disabled':
      return 'The Google Search Console API is not enabled for this token\'s Google Cloud project. Enable it, then try again.';
    case 'permission':
      return 'This Google account cannot read that Search Console property. Use an account with at least Restricted access.';
    case 'quota':
      return 'Search Console rate limit reached. Wait a minute, then refresh.';
    case 'notfound':
      return 'That Search Console property could not be found. Check the property in Settings.';
    case 'server':
      return 'Search Console is having trouble right now. Try again in a moment.';
    case 'network':
      return 'Could not reach Google Search Console. Check your internet connection.';
    case 'timeout':
      return 'The Search Console request timed out. Try again.';
    default:
      return detail || 'Search Console request failed.';
  }
}

export function isScopeError(err) {
  const text = `${err?.detail || ''} ${err?.message || ''}`.toLowerCase();
  return (
    err?.status === 403 &&
    (text.includes('insufficient authentication scopes') || text.includes('access_token_scope_insufficient'))
  );
}

async function searchFetch(endpoint, options) {
  try {
    return await gaFetch(endpoint, options);
  } catch (err) {
    if (!(err instanceof GaApiError)) throw err;
    const kind = isScopeError(err) ? 'scope' : err.kind;
    throw new GaApiError(friendlySearch(kind, err.detail), {
      status: err.status,
      kind,
      detail: err.detail,
      endpoint: err.endpoint,
    });
  }
}

/* ---------- dates ---------- */

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBefore(date, days) {
  const out = new Date(date);
  out.setDate(out.getDate() - days);
  return out;
}

export function searchRange(rangeKey, now = new Date()) {
  // Search Console has no intraday data and finalises rows ~2 days late, so a
  // one-day window would come back empty or with a single point. Live ranges
  // therefore show the last 7 days of finalised search data instead.
  const base = getRange(['today', 'week'].includes(rangeKey) ? '7d' : rangeKey);
  const end = daysBefore(now, DATA_LAG_DAYS);
  const start = daysBefore(end, base.days - 1);
  const prevEnd = daysBefore(start, 1);
  const prevStart = daysBefore(prevEnd, base.days - 1);
  return {
    key: base.key,
    label: base.label,
    title: base.title,
    days: base.days,
    current: { startDate: isoDate(start), endDate: isoDate(end) },
    previous: { startDate: isoDate(prevStart), endDate: isoDate(prevEnd) },
    startLabel: formatDate(new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())), { withYear: true }),
    endLabel: formatDate(new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())), { withYear: true }),
    lagDays: DATA_LAG_DAYS,
  };
}

/* ---------- site matching ---------- */

export function searchSiteKind(siteUrl) {
  return String(siteUrl || '').startsWith('sc-domain:') ? 'domain' : 'prefix';
}

export function searchSiteLabel(siteUrl) {
  const value = String(siteUrl || '');
  if (value.startsWith('sc-domain:')) return `${value.slice(10)} (domain)`;
  return value.replace(/^https?:\/\//, '').replace(/\/$/, '') || value;
}

// Every verified Search Console property that covers this URL, best first.
// Domain properties win because they include every protocol and subdomain;
// URL-prefix properties are ranked by how specific the prefix is.
export function searchSiteCandidates(sites, url) {
  const parsed = parseUrl(url);
  if (!parsed) return [];
  const host = parsed.hostname.toLowerCase();
  const href = `${parsed.protocol}//${host}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  const matches = [];
  for (const site of sites || []) {
    const siteUrl = String(site?.siteUrl || '');
    if (!siteUrl) continue;
    if (siteUrl.startsWith('sc-domain:')) {
      const domain = siteUrl.slice(10).toLowerCase();
      if (host === domain || host.endsWith(`.${domain}`)) {
        matches.push({ siteUrl, kind: 'domain', score: 10000 + domain.length });
      }
      continue;
    }
    const prefix = parseUrl(siteUrl);
    if (!prefix) continue;
    const normalized = `${prefix.protocol}//${prefix.hostname.toLowerCase()}${prefix.port ? `:${prefix.port}` : ''}${prefix.pathname}`;
    const withSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
    if (href.startsWith(withSlash) || `${href}/` === withSlash) {
      matches.push({ siteUrl, kind: 'prefix', score: normalized.length });
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

export function resolveSearchSite(settings, url) {
  const parsed = parseUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  const sites = settings?.searchSites || [];
  const candidates = searchSiteCandidates(sites, url);
  const map = settings?.searchMap || {};
  for (const key of hostKeys(host)) {
    if (map[key]) {
      return { siteUrl: map[key], kind: searchSiteKind(map[key]), source: 'site', key, candidates };
    }
  }
  if (candidates[0]) return { ...candidates[0], source: 'auto', key: '', candidates };
  return { siteUrl: '', kind: '', source: 'none', key: '', candidates };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Domain and broad prefix properties can cover more than the host being viewed.
// Narrow them to this host (www and bare host count as one site).
export function hostPageFilter(siteUrl, host, { includeSubdomains = false } = {}) {
  const bare = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!bare) return null;
  if (searchSiteKind(siteUrl) === 'domain') {
    if (includeSubdomains) return null;
  } else {
    const prefix = parseUrl(siteUrl);
    if (prefix && prefix.hostname.toLowerCase().replace(/^www\./, '') === bare) return null;
  }
  return {
    dimension: 'page',
    operator: 'includingRegex',
    expression: `^https?://(www\\.)?${escapeRegex(bare)}([/:?#]|$)`,
  };
}

// Search Console reports canonical page URLs without fragments or tracking
// parameters. Matching on origin + path is the most reliable equivalent.
export function searchPageUrl(url) {
  const parsed = parseUrl(url);
  if (!parsed) return '';
  return `${parsed.origin}${parsed.pathname || '/'}`;
}

/* ---------- response parsing ---------- */

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseSearchRows(response) {
  return (response?.rows || []).map((row) => ({
    keys: Array.isArray(row.keys) ? row.keys : [],
    key: Array.isArray(row.keys) ? row.keys[0] ?? '' : '',
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    ctr: toNumber(row.ctr),
    position: toNumber(row.position),
  }));
}

function totalsFrom(rows) {
  const row = rows[0];
  return {
    clicks: row?.clicks || 0,
    impressions: row?.impressions || 0,
    ctr: row?.ctr || 0,
    position: row?.position || 0,
  };
}

export function parseInspection(response) {
  const result = response?.inspectionResult || {};
  const index = result.indexStatusResult || {};
  return {
    verdict: index.verdict || 'VERDICT_UNSPECIFIED',
    coverageState: index.coverageState || '',
    indexingState: index.indexingState || '',
    robotsTxtState: index.robotsTxtState || '',
    pageFetchState: index.pageFetchState || '',
    lastCrawlTime: index.lastCrawlTime || '',
    crawledAs: index.crawledAs || '',
    googleCanonical: index.googleCanonical || '',
    userCanonical: index.userCanonical || '',
    referringUrls: (index.referringUrls || []).slice(0, 5),
    richResults: result.richResultsResult?.verdict || '',
    link: result.inspectionResultLink || '',
  };
}

/* ---------- endpoints ---------- */

export async function listSearchSites({ token }) {
  const payload = await searchFetch(`${GSC_BASE}/webmasters/v3/sites`, { token });
  return (payload.siteEntry || [])
    .filter((entry) => entry.siteUrl && entry.permissionLevel !== 'siteUnverifiedUser')
    .map((entry) => ({ siteUrl: entry.siteUrl, permissionLevel: entry.permissionLevel || '' }))
    .sort((a, b) => searchSiteLabel(a.siteUrl).localeCompare(searchSiteLabel(b.siteUrl)));
}

export async function querySearchAnalytics({ token, siteUrl, body }) {
  if (!siteUrl) throw new GaApiError('No Search Console property is linked to this site.', { kind: 'notfound' });
  const payload = await searchFetch(
    `${GSC_BASE}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { token, method: 'POST', body: { type: 'web', dataState: 'all', ...body } },
  );
  return parseSearchRows(payload);
}

export async function inspectUrl({ token, siteUrl, url }) {
  const payload = await searchFetch(`${GSC_BASE}/v1/urlInspection/index:inspect`, {
    token,
    method: 'POST',
    body: { inspectionUrl: url, siteUrl, languageCode: 'en-US' },
  });
  return parseInspection(payload);
}

/* ---------- report fetchers ---------- */

function filterGroups(...filters) {
  const list = filters.filter(Boolean);
  return list.length ? [{ groupType: 'and', filters: list }] : undefined;
}

function isFatal(err) {
  return err instanceof GaApiError && ['auth', 'scope', 'disabled', 'permission', 'notfound'].includes(err.kind);
}

export async function fetchSearchReports({ token, siteUrl, host, includeSubdomains = false, rangeKey }) {
  const range = searchRange(rangeKey);
  const hostFilter = hostPageFilter(siteUrl, host, { includeSubdomains });
  const run = (dateRange, dimensions = [], rowLimit = 1) =>
    querySearchAnalytics({
      token,
      siteUrl,
      body: {
        ...dateRange,
        dimensions,
        dimensionFilterGroups: filterGroups(hostFilter),
        rowLimit,
      },
    });

  const tasks = [
    ['current', () => run(range.current)],
    ['previous', () => run(range.previous)],
    ['trend', () => run(range.current, ['date'], 400)],
    ['queries', () => run(range.current, ['query'], 50)],
    ['pages', () => run(range.current, ['page'], 50)],
    // Which URLs each query actually earned clicks on. 500 rows is enough to
    // cover the top query list many times over (Search Analytics is sorted by
    // clicks), and it is the only way to tie a query to a landing page.
    ['queryPages', () => run(range.current, ['query', 'page'], 500)],
    ['devices', () => run(range.current, ['device'], 5)],
  ];

  const warnings = [];
  const settled = await Promise.allSettled(tasks.map(([, task]) => task()));
  const data = {};
  settled.forEach((result, index) => {
    const key = tasks[index][0];
    if (result.status === 'fulfilled') {
      data[key] = result.value;
      return;
    }
    if (isFatal(result.reason) || key === 'current') throw result.reason;
    warnings.push(`Search ${key}: ${result.reason?.message || 'failed'}`);
    data[key] = [];
  });

  const queries = data.queries.map(({ key, clicks, impressions, ctr, position }) => ({
    query: key,
    clicks,
    impressions,
    ctr,
    position,
  }));

  return {
    range,
    current: totalsFrom(data.current),
    previous: totalsFrom(data.previous),
    trend: data.trend
      .map(({ key, clicks, impressions, ctr, position }) => ({ date: key, clicks, impressions, ctr, position }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    queries,
    pages: data.pages.map(({ key, clicks, impressions, ctr, position }) => {
      const parsed = parseUrl(key);
      return { url: key, path: parsed ? parsed.pathname || '/' : key, clicks, impressions, ctr, position };
    }),
    queryPages: data.queryPages.map(({ keys, clicks, impressions, ctr, position }) => {
      const [query = '', url = ''] = keys;
      const parsed = parseUrl(url);
      return {
        query,
        url,
        path: parsed ? parsed.pathname || '/' : url,
        host: parsed ? parsed.hostname : '',
        clicks,
        impressions,
        ctr,
        position,
      };
    }),
    devices: data.devices.map(({ key, clicks, impressions, ctr, position }) => ({
      device: key ? key.charAt(0) + key.slice(1).toLowerCase() : 'Unknown',
      clicks,
      impressions,
      ctr,
      position,
    })),
    opportunities: searchOpportunities(queries),
    warnings,
  };
}

export async function fetchSearchPage({ token, siteUrl, url, rangeKey }) {
  const range = searchRange(rangeKey);
  const pageUrl = searchPageUrl(url);
  const pageFilter = { dimension: 'page', operator: 'equals', expression: pageUrl };
  const run = (dateRange, dimensions = [], rowLimit = 1) =>
    querySearchAnalytics({
      token,
      siteUrl,
      body: { ...dateRange, dimensions, dimensionFilterGroups: filterGroups(pageFilter), rowLimit },
    });
  const [current, previous, queries] = await Promise.all([
    run(range.current),
    run(range.previous),
    run(range.current, ['query'], 15),
  ]);
  return {
    url: pageUrl,
    current: totalsFrom(current),
    previous: totalsFrom(previous),
    queries: queries.map(({ key, clicks, impressions, ctr, position }) => ({
      query: key,
      clicks,
      impressions,
      ctr,
      position,
    })),
  };
}

/* ---------- insights ---------- */

// Rough organic CTR by rounded position. Only used to rank opportunities,
// never shown as a fact about the site.
const EXPECTED_CTR = [0.28, 0.16, 0.11, 0.08, 0.06, 0.045, 0.035, 0.03, 0.025, 0.02];

export function expectedCtr(position) {
  const p = Number(position) || 0;
  if (p <= 0) return 0;
  if (p > 10.5) return 0.01;
  return EXPECTED_CTR[Math.min(10, Math.max(1, Math.round(p))) - 1];
}

// "Striking distance" queries (ranking 4–20 with real demand) and top-3
// queries whose CTR is far below what that position usually earns.
export function searchOpportunities(queries, { limit = 4 } = {}) {
  const list = queries || [];
  const maxImpressions = Math.max(0, ...list.map((q) => Number(q.impressions) || 0));
  const floor = Math.max(30, maxImpressions * 0.03);
  const out = [];
  for (const q of list) {
    if (!q.query || q.impressions < floor) continue;
    if (q.position > 3.5 && q.position <= 20) {
      out.push({ type: 'striking', ...q, potential: Math.round(q.impressions * expectedCtr(3) - q.clicks) });
    } else if (q.position <= 3.5 && q.ctr < expectedCtr(q.position) * 0.5) {
      out.push({ type: 'low-ctr', ...q, potential: Math.round(q.impressions * expectedCtr(q.position) - q.clicks) });
    }
  }
  return out
    .filter((item) => item.potential > 0)
    .sort((a, b) => b.potential - a.potential)
    .slice(0, limit);
}

export function searchConsoleUrl(siteUrl, page = '') {
  if (!siteUrl) return 'https://search.google.com/search-console';
  const params = new URLSearchParams({ resource_id: siteUrl });
  if (page) params.set('page', `!${page}`);
  return `https://search.google.com/search-console/performance/search-analytics?${params.toString()}`;
}

export const _internals = { searchFetch, totalsFrom, isoDate, escapeRegex };
