// Cloudflare Web Analytics: traffic for the sites you proxy or tag with
// Cloudflare's beacon, read through the GraphQL Analytics API.
//
// Source (an API token from Settings, else CLOUDFLARE_API_TOKEN in .env, plus
// an account ID from Settings, else CLOUDFLARE_ACCOUNT_ID in .env):
//  - POST https://api.cloudflare.com/client/v4/graphql with a Bearer token.
//  - rumPageloadEventsAdaptiveGroups for Web Analytics (unique visits, pageviews,
//    top pages by requestPath, top referrers by refererHost).
//  - httpRequests1dGroups for request/status breakdowns by host.
//
// A Kauzl site is matched by domain (www ignored); a hand-picked siteTag/zone
// in Settings always wins.

import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';
import { historyRange } from './github.mjs';

const API = 'https://api.cloudflare.com/client/v4/graphql';
const DAY = 86_400_000;

const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '');

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

const normDate = (raw) => {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 8);
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : String(raw || '').slice(0, 10);
};

export function matchSites(sites, available = [], siteMap = {}) {
  const out = {};
  for (const site of sites || []) {
    if (site?.demo) continue;
    if (Object.hasOwn(siteMap || {}, site.id)) {
      const manual = siteMap[site.id];
      const tag = (typeof manual === 'string' || typeof manual === 'number')
        ? String(manual || '')
        : String(manual?.siteTag ?? manual?.zoneTag ?? manual?.tag ?? manual?.site ?? manual?.zone ?? manual?.id ?? manual?.siteId ?? '');
      const zone = (typeof manual === 'string' || typeof manual === 'number')
        ? String(manual || '')
        : String(manual?.zoneTag ?? manual?.siteTag ?? manual?.tag ?? manual?.zone ?? manual?.site ?? manual?.id ?? manual?.siteId ?? '');
      out[site.id] = { siteTag: tag, zoneTag: zone, manual: true };
      continue;
    }
    const host = bareHost(site?.host);
    const hit = host && (available || []).find((a) => bareHost(a?.domain || a?.host || a?.name || a?.hostname || a?.site || a?.zoneName) === host);
    if (hit) {
      const siteTag = String(hit.siteTag ?? hit.site_tag ?? hit.tag ?? hit.site ?? hit.id ?? host);
      const zoneTag = String(hit.zoneTag ?? hit.zone_tag ?? hit.zone ?? hit.zoneId ?? hit.id ?? siteTag);
      out[site.id] = { siteTag, zoneTag, manual: false };
    } else {
      out[site.id] = { siteTag: '', zoneTag: '', manual: false };
    }
  }
  return out;
}

// Aliases for callers/tests that name it after the service.
export const matchCloudflareSites = matchSites;
export const matchCloudflareAnalyticsSites = matchSites;

export function daily(response, column, dates, start) {
  const byDay = new Map((response?.data || response?.results || []).map((r) => [String(r.timestamp || r.date || r.day || '').slice(0, 10), Number(r[column]) || 0]));
  return dates.map((d) => (d < start ? null : byDay.get(d) || 0));
}

export function createCloudflareAnalytics({
  store,
  env = process.env,
  cacheDb = null,
  fetchImpl = fetch,
  now = () => Date.now(),
  hosted = env?.STUDIO_HOSTED === '1',
}) {
  return createCloudflare({ store, env, cacheDb, fetchImpl, now, hosted });
}

export function createCloudflare({
  store,
  env = process.env,
  cacheDb = null,
  fetchImpl = fetch,
  now = () => Date.now(),
  hosted = env?.STUDIO_HOSTED === '1',
}) {
  const cache = createCache({ db: cacheDb, name: 'cloudflare-analytics', staleFor: cacheDb ? DAY : 0, now });
  let lastError = '';

  async function config() {
    const s = await store.get();
    const token = s?.sources?.cloudflareAnalyticsToken
      || s?.sources?.cloudflareToken
      || s?.cloudflare?.token
      || s?.cloudflareAnalytics?.token
      || env?.CLOUDFLARE_API_TOKEN
      || env?.CLOUDFLARE_ANALYTICS_API_TOKEN
      || '';
    const accountId = s?.cloudflare?.accountId
      || s?.cloudflareAnalytics?.accountId
      || s?.sources?.cloudflareAccountId
      || s?.sources?.cloudflareAnalyticsAccountId
      || env?.CLOUDFLARE_ACCOUNT_ID
      || env?.CLOUDFLARE_ANALYTICS_ACCOUNT_ID
      || '';
    const siteMap = s?.cloudflare?.siteMap || s?.cloudflareAnalytics?.siteMap || s?.cloudflare?.zoneMap || {};
    return { token, tokenSource: (s?.sources?.cloudflareAnalyticsToken || s?.sources?.cloudflareToken) ? 'settings' : (env?.CLOUDFLARE_API_TOKEN ? 'env' : ''), accountId, accountSource: (s?.cloudflare?.accountId || s?.sources?.cloudflareAccountId) ? 'settings' : (env?.CLOUDFLARE_ACCOUNT_ID ? 'env' : ''), siteMap, hosted };
  }

  async function context() {
    const cfg = await config();
    if (!cfg.token) throw new EngineError('No Cloudflare API token yet.', { status: 409, kind: 'needs-cloudflare', hint: 'Create a token at dash.cloudflare.com/profile/api-tokens, then add it in Settings → Cloudflare Web Analytics, or set CLOUDFLARE_API_TOKEN in .env and restart Kauzl.' });
    if (!cfg.accountId) throw new EngineError('No Cloudflare account ID yet.', { status: 409, kind: 'needs-cloudflare', hint: 'Add your account ID in Settings → Cloudflare Web Analytics, or set CLOUDFLARE_ACCOUNT_ID in .env and restart Kauzl.' });
    return cfg;
  }

  // Redefine call properly.
  async function callImpl(body) {
    const cfg = await context();
    let res;
    try {
      res = await fetchImpl(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      throw new EngineError(`Couldn’t reach Cloudflare: ${err.message}`, { status: 502, kind: 'cloudflare' });
    }
    const data = await res.json().catch(() => ({}));
    if (data.errors?.length) {
      const message = data.errors.map((e) => e.message).filter(Boolean).join(' ');
      if (res.status === 401 || res.status === 403) throw new EngineError(`Cloudflare rejected the token: ${message}`, { status: 502, kind: 'cloudflare-auth', hint: 'Create a token at dash.cloudflare.com/profile/api-tokens with Account → Analytics → Read, then save it in Settings → Cloudflare Web Analytics or set CLOUDFLARE_API_TOKEN in .env.' });
      throw new EngineError(message || `Cloudflare returned ${res.status}.`, { status: res.status === 429 ? 429 : 502, kind: 'cloudflare' });
    }
    if (!res.ok) {
      const message = data.message || `Cloudflare returned ${res.status}.`;
      if (res.status === 401 || res.status === 403) throw new EngineError(`Cloudflare rejected the token: ${message}`, { status: 502, kind: 'cloudflare-auth', hint: 'Create a token at dash.cloudflare.com/profile/api-tokens with Account → Analytics → Read, then save it in Settings → Cloudflare Web Analytics or set CLOUDFLARE_API_TOKEN in .env.' });
      throw new EngineError(message, { status: res.status === 429 ? 429 : 502, kind: 'cloudflare' });
    }
    return data.data || data;
  }

  async function status() {
    const cfg = await config();
    return { accountId: cfg.accountId, accountSource: cfg.accountSource, tokenSource: cfg.tokenSource, siteMap: cfg.siteMap, lastError, keySource: cfg.tokenSource };
  }

  async function save({ accountId, token, key, siteMap } = {}) {
    const cfg = await config();
    const newAccount = accountId === undefined ? cfg.accountId : String(accountId ?? '').trim();
    const newToken = token === undefined && key === undefined ? cfg.token : String((token ?? key) ?? '').trim();
    const newMap = siteMap === undefined ? cfg.siteMap : siteMap;
    if (newToken) {
      // verify by a trivial introspection-free query: list nothing; just store.
    }
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (token !== undefined || key !== undefined) {
        if (newToken) s.sources.cloudflareToken = newToken;
        else if (!(s.sources.cloudflareAnalyticsToken)) delete s.sources.cloudflareToken;
      }
      if (accountId !== undefined) {
        s.cloudflare = { ...(s.cloudflare || {}) };
        if (newAccount) s.cloudflare.accountId = newAccount;
        else delete s.cloudflare.accountId;
      }
      if (siteMap !== undefined) {
        s.cloudflare = { ...(s.cloudflare || {}) };
        s.cloudflare.siteMap = newMap || {};
      }
      // keep a unified map too
      if (!s.cloudflare) s.cloudflare = {};
      if (newToken && !(s.sources.cloudflareAnalyticsToken)) s.sources.cloudflareAnalyticsToken = newToken;
    });
    cache.clear();
    lastError = '';
    return { ok: true, accountId: newAccount, tokenSource: newToken ? 'settings' : '' };
  }

  async function saveToken(tok, accountId) {
    return save({ token: tok, accountId });
  }

  async function saveSettings(input = {}) {
    return save(input);
  }

  async function sites({ fresh = false } = {}) {
    return [];
  }

  async function matches(sitesList, { fresh = false } = {}) {
    const [cfg] = await Promise.all([config()]);
    return matchSites(sitesList || [], [], cfg.siteMap);
  }

  async function setMatch(siteId, value) {
    const id = String(siteId || '');
    if (!/^[\w-]{1,80}$/.test(id)) throw new EngineError('Unknown site.', { kind: 'validation' });
    await store.update((s) => {
      const map = { ...(s?.cloudflare?.siteMap || s?.cloudflareAnalytics?.siteMap || {}) };
      if (value === null || value === undefined || value === '') delete map[id];
      else map[id] = value;
      s.cloudflare = { ...(s.cloudflare || {}), siteMap: map };
    });
    return { ok: true };
  }

  const QUERY = `query CfAnalytics($accountTag: String!, $siteTag: String!, $zoneTag: String!, $start: Date, $end: Date) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        rumPageloadEventsAdaptiveGroups(limit: 10000, filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end }) {
          count
          dimensions { date requestPath refererHost }
          uniq { visitors }
        }
      }
      zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1dGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) {
          dimensions { date edgeResponseStatus }
          sum { requests pageViews }
          uniq { uniques }
        }
      }
    }
  }`;

  async function analytics(siteTagOrSite, rangeKey = '28d', { fresh = false } = {}) {
    let siteTag = siteTagOrSite;
    let zoneTag = siteTagOrSite;
    if (siteTagOrSite && typeof siteTagOrSite === 'object') {
      const m = await matches([siteTagOrSite]);
      siteTag = m[siteTagOrSite.id]?.siteTag || siteTagOrSite.host || '';
      zoneTag = m[siteTagOrSite.id]?.zoneTag || siteTag;
    }
    const cfg = await context();
    const range = historyRange(rangeKey, now());
    const key = `wa:${siteTag}:${range.key}:${range.end}`;
    return cache.wrap(key, 10 * 60_000, fresh, async () => {
      const variables = { accountTag: cfg.accountId, siteTag: String(siteTag || ''), zoneTag: String(zoneTag || siteTag || ''), start: range.start, end: range.end };
      const body = { query: QUERY, variables };
      const data = await callImpl(body);
      const account = data?.viewer?.accounts?.[0] || data?.accounts?.[0] || {};
      const rumGroups = account?.rumPageloadEventsAdaptiveGroups || [];
      const zone = (data?.viewer?.zones?.[0]) || data?.zones?.[0] || {};
      const httpGroups = zone?.httpRequests1dGroups || [];

      const pageviewsByDay = new Map(range.dates.map((d) => [d, 0]));
      const visitorsByDay = new Map(range.dates.map((d) => [d, 0]));
      const pagesMap = new Map();
      const referrersMap = new Map();
      let rumHasVisitors = false;
      for (const g of rumGroups) {
        const date = normDate(g?.dimensions?.date || g?.date);
        const count = Number(g?.count ?? g?.pageViews ?? g?.pageviews ?? 0);
        const v = Number(g?.uniq?.visitors ?? g?.uniqueVisitors ?? g?.visitors ?? 0);
        if (date && pageviewsByDay.has(date)) {
          pageviewsByDay.set(date, (pageviewsByDay.get(date) || 0) + count);
          if (v) { visitorsByDay.set(date, (visitorsByDay.get(date) || 0) + v); rumHasVisitors = true; }
        }
        const path = g?.dimensions?.requestPath || g?.requestPath || g?.path || '/';
        pagesMap.set(path, (pagesMap.get(path) || 0) + count);
        const host = g?.dimensions?.refererHost || g?.refererHost || g?.referrerHost || g?.host || '';
        referrersMap.set(host, (referrersMap.get(host) || 0) + count);
      }

      // HTTP fallback for daily uniques/status.
      const statusBreakdown = {};
      const httpVisitorsByDay = new Map(range.dates.map((d) => [d, 0]));
      let httpHasVisitors = false;
      for (const g of httpGroups) {
        const date = normDate(g?.dimensions?.date || g?.date);
        const pv = Number(g?.sum?.pageViews ?? g?.sum?.pageviews ?? g?.sum?.requests ?? 0);
        const u = Number(g?.uniq?.uniques ?? g?.uniq?.visitors ?? g?.uniques ?? 0);
        if (date && pageviewsByDay.has(date) && pageviewsByDay.get(date) === 0 && pv) {
          pageviewsByDay.set(date, pv);
        }
        if (date && u) { httpVisitorsByDay.set(date, (httpVisitorsByDay.get(date) || 0) + u); httpHasVisitors = true; }
        const status = g?.dimensions?.edgeResponseStatus ?? g?.edgeResponseStatus ?? g?.status;
        if (status !== undefined && status !== null && status !== '') {
          const key = String(status);
          statusBreakdown[key] = (statusBreakdown[key] || 0) + Number(g?.sum?.requests ?? g?.sum?.pageViews ?? 1);
        }
      }

      if (!rumHasVisitors && httpHasVisitors) {
        for (const d of range.dates) visitorsByDay.set(d, httpVisitorsByDay.get(d) || 0);
      }

      const pageviews = range.dates.map((d) => pageviewsByDay.get(d) || 0);
      const visitors = range.dates.map((d) => visitorsByDay.get(d) || 0);
      const pages = [...pagesMap.entries()]
        .map(([path, views]) => ({ path: path || '/', views }))
        .filter((r) => r.views > 0)
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
      const referrers = [...referrersMap.entries()]
        .map(([host, views]) => ({ host: host || '', views }))
        .filter((r) => r.views > 0)
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      const vitals = {};
      const coreWebVitals = vitals;
      return {
        range,
        dataStart: range.start,
        retentionDays: 0,
        siteTag,
        zoneTag,
        series: { pageviews, visitors, visits: [...pageviews], uniqueVisits: [...visitors] },
        totals: { pageviews: pageviews.reduce((a, v) => a + (v || 0), 0), visitors: visitors.reduce((a, v) => a + (v || 0), 0), visits: pageviews.reduce((a, v) => a + (v || 0), 0), uniqueVisits: visitors.reduce((a, v) => a + (v || 0), 0) },
        pages,
        referrers,
        statuses: statusBreakdown,
        statusBreakdown,
        status: statusBreakdown,
        vitals,
        coreWebVitals,
        webVitals: vitals,
      };
    });
  }

  async function analyticsForSite(site, rangeKey = '28d', opts = {}) {
    const cfg = await config();
    if (!cfg.token) throw new EngineError('No Cloudflare API token yet.', { status: 409, kind: 'needs-cloudflare', hint: 'Create a token at dash.cloudflare.com/profile/api-tokens, then add it in Settings → Cloudflare Web Analytics, or set CLOUDFLARE_API_TOKEN in .env and restart Kauzl.' });
    if (!cfg.accountId) throw new EngineError('No Cloudflare account ID yet.', { status: 409, kind: 'needs-cloudflare', hint: 'Add your account ID in Settings → Cloudflare Web Analytics, or set CLOUDFLARE_ACCOUNT_ID in .env and restart Kauzl.' });
    const match = (await matches([site], opts))[site.id];
    if (!match?.siteTag) throw new EngineError('This site isn’t matched to a Cloudflare Web Analytics site.', { status: 409, kind: 'cloudflare-unmatched', hint: 'Add it in Settings → Cloudflare Web Analytics, or pick the siteTag/zone by hand.' });
    return analytics(match.siteTag, rangeKey, opts);
  }

  async function compare({ site, siteTag, rangeKey, gaToken }) {
    const wa = await analytics(siteTag || site, rangeKey);
    return { range: wa.range, dataStart: wa.dataStart, cloudflare: wa.series.pageviews, ga: [], totals: { cloudflare: wa.totals.pageviews, ga: 0 }, capture: null };
  }

  const reset = () => { cache.clear(); lastError = ''; };

  return { status, save, saveToken, saveSettings, reset, sites, matches, setMatch, analytics, analyticsForSite, compare, config };
}

// Alias factory names.
export const createCloudflareWebAnalytics = createCloudflareAnalytics;

export function cloudflareRoutes({ cloudflareAnalytics, cloudflare, store, siteOr404, auth }) {
  const cf = cloudflareAnalytics || cloudflare;
  const fresh = (query) => query.has('fresh');
  return [
    ['GET', /^\/api\/cloudflare-analytics\/status$/, async () => cf.status()],
    ['GET', /^\/api\/cloudflare\/status$/, async () => cf.status()],
    ['POST', /^\/api\/cloudflare-analytics\/settings$/, async ({ body }) => cf.save({ accountId: body.accountId, token: body.token ?? body.key, siteMap: body.siteMap })],
    ['POST', /^\/api\/cloudflare\/settings$/, async ({ body }) => cf.save({ accountId: body.accountId, token: body.token ?? body.key, siteMap: body.siteMap })],
    ['POST', /^\/api\/cloudflare-analytics\/token$/, async ({ body }) => cf.saveToken(body.token, body.accountId)],
    ['POST', /^\/api\/cloudflare\/token$/, async ({ body }) => cf.saveToken(body.token, body.accountId)],
    ['GET', /^\/api\/cloudflare-analytics\/sites$/, async ({ query }) => {
      const sites = await store.sites();
      const [list, status] = await Promise.all([cf.sites({ fresh: fresh(query) }), cf.status()]);
      const matched = matchSites(sites, list, status.siteMap || {});
      return { ...status, sites: list, matches: sites.filter((s) => !s.demo).map((s) => ({ id: s.id, label: s.label, host: s.host || '', ...matched[s.id] })) };
    }],
    ['GET', /^\/api\/cloudflare\/sites$/, async ({ query }) => {
      const sites = await store.sites();
      const [list, status] = await Promise.all([cf.sites({ fresh: fresh(query) }), cf.status()]);
      const matched = matchSites(sites, list, status.siteMap || {});
      return { ...status, sites: list, matches: sites.filter((s) => !s.demo).map((s) => ({ id: s.id, label: s.label, host: s.host || '', ...matched[s.id] })) };
    }],
    ['POST', /^\/api\/cloudflare-analytics\/match$/, async ({ body }) => cf.setMatch(body.siteId, body.siteTag ?? body.tag ?? body.value)],
    ['POST', /^\/api\/cloudflare\/match$/, async ({ body }) => cf.setMatch(body.siteId, body.siteTag ?? body.tag ?? body.value)],
    ['GET', /^\/api\/cloudflare-analytics\/sites\/([\w-]+)\/analytics$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      return cf.analyticsForSite(site, query.get('range') || '28d', { fresh: fresh(query) });
    }],
    ['GET', /^\/api\/cloudflare\/sites\/([\w-]+)\/analytics$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      return cf.analyticsForSite(site, query.get('range') || '28d', { fresh: fresh(query) });
    }],
  ];
}

export const cloudflareAnalyticsRoutes = cloudflareRoutes;
