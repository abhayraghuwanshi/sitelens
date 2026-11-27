// Plausible: privacy-first web analytics, hosted at plausible.io or self-hosted.
//
// Sources (an API key from Settings, else PLAUSIBLE_API_KEY in .env):
//  - Stats API v2: POST {base}/api/v2/query with a Bearer key. The same endpoint
//    the Plausible dashboard uses, so it answers daily visitors/pageviews/visits/
//    bounce rate, top pages and sources, and goal conversions.
//  - Sites API: GET {base}/api/v1/sites, to know which site_id values the key can
//    read. A Stats API key can list sites too; no Sites API key is needed.
//
// Plausible site_id is the domain as added in Plausible. A Kauzl site is matched
// by domain (www ignored); a hand-picked map in Settings always wins.
//
// Hosted, a self-hosted base URL must resolve to a public address, as every
// other outgoing fetch does (see net-guard.mjs).

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';
import { historyRange } from './github.mjs';
import { runReport } from './ga-limit.mjs';
import { hostFilter } from '../shared/sitelens/reports.js';
import { isPrivateAddress } from './net-guard.mjs';

export const DEFAULT_BASE = 'https://plausible.io';
const DAY = 86_400_000;
const SITE_ID = /^[a-z0-9][a-z0-9.:_-]{0,254}$/i;

const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '');
const metric = (row, index) => Number(row?.metrics?.[index]) || 0;

export function normalizeBase(value) {
  const raw = String(value ?? '').trim() || DEFAULT_BASE;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new EngineError(`That isn’t a URL. It looks like ${DEFAULT_BASE}.`, { kind: 'validation' });
  }
  if (!/^https?:$/.test(url.protocol)) throw new EngineError('The Plausible URL must start with https:// (or http:// on your own network).', { kind: 'validation' });
  if (url.username || url.password) throw new EngineError('The Plausible URL shouldn’t include a username or password.', { kind: 'validation' });
  url.search = '';
  url.hash = '';
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

// Hosted: the base URL must resolve to a public address. Checked when saved, and
// again before a request, so a DNS answer that changes later can't slip through.
export async function assertPublicBase(value, { hosted = false } = {}) {
  const base = normalizeBase(value);
  if (!hosted) return base;
  const url = new URL(base);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch((err) => {
    throw new EngineError(`Couldn’t find ${host}: ${err.code || err.message}`, { kind: 'validation' });
  });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new EngineError(`Refusing to connect to ${host}: it is a private or internal address.`, {
      kind: 'validation',
      hint: 'Hosted Kauzl only reaches Plausible on the public internet.',
    });
  }
  return base;
}

export function matchSites(sites, available = [], siteMap = {}) {
  const out = {};
  for (const site of sites) {
    if (site.demo) continue;
    // A hand-picked site_id wins even if the Sites API didn't list it.
    if (Object.hasOwn(siteMap, site.id)) {
      out[site.id] = { siteId: String(siteMap[site.id] || ''), manual: true };
      continue;
    }
    const host = bareHost(site.host);
    const hit = host && available.find((a) => bareHost(a.domain) === host);
    out[site.id] = { siteId: hit ? hit.domain : '', manual: false };
  }
  return out;
}

// Daily rows → values aligned to `dates`; days Plausible omits are zero.
export function daily(response, dates, index = 0) {
  const byDay = new Map((response?.results || []).map((r) => [String(r.dimensions?.[0] || '').slice(0, 10), metric(r, index)]));
  return dates.map((d) => byDay.get(d) ?? 0);
}

export function createPlausible({
  store,
  env = process.env,
  cacheDb = null,
  fetchImpl = fetch,
  now = () => Date.now(),
  hosted = env.STUDIO_HOSTED === '1',
}) {
  const cache = createCache({ db: cacheDb, name: 'plausible', staleFor: cacheDb ? DAY : 0, now });
  let lastError = '';

  async function config() {
    const s = await store.get();
    return {
      token: s.sources?.plausibleKey || env.PLAUSIBLE_API_KEY || '',
      keySource: s.sources?.plausibleKey ? 'settings' : env.PLAUSIBLE_API_KEY ? 'env' : '',
      baseUrl: normalizeBase(s.plausible?.baseUrl || env.PLAUSIBLE_BASE_URL || DEFAULT_BASE),
      baseSource: s.plausible?.baseUrl ? 'settings' : env.PLAUSIBLE_BASE_URL ? 'env' : 'default',
      siteMap: s.plausible?.siteMap || {},
      hosted,
    };
  }

  async function call(path, { token, baseUrl, method = 'GET', body, query = {} } = {}) {
    const url = new URL(`${String(baseUrl).replace(/\/+$/, '')}${path}`);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    let res;
    try {
      res = await fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      throw new EngineError(`Couldn’t reach Plausible: ${err.message}`, { status: 502, kind: 'plausible' });
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    const message = data.error || data.message || `Plausible returned ${res.status}.`;
    if (res.status === 401 || res.status === 403) {
      throw new EngineError(`Plausible rejected the API key: ${message}`, {
        status: 502,
        kind: 'plausible-auth',
        hint: 'Create a Stats API key in Plausible → Settings → API keys, then save it in Settings → Plausible or set PLAUSIBLE_API_KEY in .env.',
      });
    }
    throw new EngineError(message, { status: res.status === 429 ? 429 : 502, kind: 'plausible' });
  }

  async function context() {
    const cfg = await config();
    if (!cfg.token) {
      throw new EngineError('No Plausible API key yet.', {
        status: 409,
        kind: 'needs-plausible',
        hint: 'Create a Stats API key in Plausible → Settings → API keys, then add it in Settings → Plausible, or set PLAUSIBLE_API_KEY in .env and restart Kauzl.',
      });
    }
    if (cfg.hosted) await assertPublicBase(cfg.baseUrl, { hosted: true });
    return cfg;
  }

  async function status() {
    const cfg = await config();
    return { baseUrl: cfg.baseUrl, baseSource: cfg.baseSource, keySource: cfg.keySource, siteMap: cfg.siteMap, lastError };
  }

  async function listSites({ token, baseUrl, fresh = false } = {}) {
    const cfg = await config();
    const key = token ?? cfg.token;
    const base = baseUrl ?? cfg.baseUrl;
    if (!key) {
      throw new EngineError('No Plausible API key yet.', {
        status: 409,
        kind: 'needs-plausible',
        hint: 'Create a Stats API key in Plausible → Settings → API keys, then add it in Settings → Plausible.',
      });
    }
    if (hosted) await assertPublicBase(base, { hosted: true });
    return cache.wrap(`sites:${base}:${key.slice(-6)}`, 10 * 60_000, fresh, async () => {
      const out = [];
      let after;
      for (let page = 0; page < 10; page++) {
        const data = await call('/api/v1/sites', { token: key, baseUrl: base, query: { limit: 100, after } });
        out.push(...(data.sites || []).map((s) => ({ domain: s.domain, timezone: s.timezone || '' })));
        after = data.meta?.after;
        if (!after) break;
      }
      lastError = '';
      return out;
    }).catch((err) => {
      lastError = err.message;
      throw err;
    });
  }

  async function sites({ fresh = false } = {}) {
    return listSites({ fresh });
  }

  async function matches(sitesList, { fresh = false } = {}) {
    const [available, cfg] = await Promise.all([sites({ fresh }), config()]);
    return matchSites(sitesList, available, cfg.siteMap);
  }

  async function save({ key, baseUrl } = {}) {
    const cfg = await config();
    const base = baseUrl === undefined ? cfg.baseUrl : await assertPublicBase(baseUrl, { hosted });
    const value = key === undefined ? cfg.token : String(key ?? '').trim();
    let verified = null;
    if (key !== undefined && value) verified = await listSites({ token: value, baseUrl: base, fresh: true });
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (key !== undefined) {
        if (value) s.sources.plausibleKey = value;
        else delete s.sources.plausibleKey;
      }
      s.plausible = { ...(s.plausible || {}) };
      if (base === DEFAULT_BASE) delete s.plausible.baseUrl;
      else s.plausible.baseUrl = base;
    });
    cache.clear();
    lastError = '';
    return { ok: true, baseUrl: base, ...(verified ? { sites: verified.length } : {}) };
  }

  async function setMatch(siteId, plausibleSite) {
    const id = String(siteId || '');
    if (!/^[\w-]{1,80}$/.test(id)) throw new EngineError('Unknown site.', { kind: 'validation' });
    const value = String(plausibleSite ?? '').trim();
    if (value && !SITE_ID.test(value)) throw new EngineError('That isn’t a Plausible site ID (usually the domain, like example.com).', { kind: 'validation' });
    await store.update((s) => {
      const map = { ...(s.plausible?.siteMap || {}) };
      if (!value) delete map[id];
      else map[id] = value;
      s.plausible = { ...(s.plausible || {}), siteMap: map };
    });
    return { ok: true };
  }

  async function query(ctx, body) {
    return call('/api/v2/query', { ...ctx, method: 'POST', body });
  }

  // Plausible traffic for one site over a history range (UTC days).
  async function analytics(siteId, rangeKey = '28d', { fresh = false } = {}) {
    if (!SITE_ID.test(String(siteId || ''))) throw new EngineError('That isn’t a Plausible site ID.', { kind: 'validation' });
    const ctx = await context();
    const range = historyRange(rangeKey, now());
    return cache.wrap(`analytics:${siteId}:${range.key}:${range.end}`, 10 * 60_000, fresh, async () => {
      const base = {
        site_id: siteId,
        date_range: [range.start, range.end],
      };
      const [timeline, aggregate, pages, sources, goals] = await Promise.all([
        query(ctx, { ...base, metrics: ['visitors', 'pageviews', 'visits', 'bounce_rate'], dimensions: ['time:day'], include: { time_labels: true } }),
        query(ctx, { ...base, metrics: ['visitors', 'pageviews', 'visits', 'bounce_rate'] }),
        query(ctx, { ...base, metrics: ['pageviews', 'visitors'], dimensions: ['event:page'], order_by: [['pageviews', 'desc']], pagination: { limit: 10 } }),
        query(ctx, { ...base, metrics: ['visitors', 'pageviews'], dimensions: ['visit:source'], order_by: [['visitors', 'desc']], pagination: { limit: 10 } }),
        query(ctx, { ...base, metrics: ['visitors', 'events', 'conversion_rate'], dimensions: ['event:goal'], order_by: [['visitors', 'desc']], pagination: { limit: 20 } }),
      ]);
      const pageviews = daily(timeline, range.dates, 1);
      const visitors = daily(timeline, range.dates, 0);
      const visits = daily(timeline, range.dates, 2);
      const bounceRate = daily(timeline, range.dates, 3);
      const totalsRow = aggregate.results?.[0];
      const topSources = (sources.results || [])
        .map((r) => ({ source: r.dimensions?.[0] || 'Direct / None', visitors: metric(r, 0), views: metric(r, 1) }))
        .filter((r) => r.visitors > 0 || r.views > 0);
      return {
        range,
        dataStart: range.start,
        retentionDays: 0,
        siteId,
        series: { pageviews, visitors, visits, bounceRate },
        totals: {
          pageviews: pageviews.reduce((a, v) => a + (v || 0), 0),
          visitors: metric(totalsRow, 0),
          visits: metric(totalsRow, 2),
          bounceRate: metric(totalsRow, 3),
        },
        pages: (pages.results || [])
          .map((r) => ({ path: r.dimensions?.[0] || '/', views: metric(r, 0), visitors: metric(r, 1) }))
          .filter((r) => r.views > 0),
        // Same shape as Vercel's referrers; `source` keeps Plausible's own label.
        referrers: topSources.map((r) => ({ host: r.source === 'Direct / None' ? '' : r.source, views: r.views, visitors: r.visitors })),
        sources: topSources,
        goals: (goals.results || [])
          .map((r) => ({ goal: r.dimensions?.[0] || 'Goal', visitors: metric(r, 0), events: metric(r, 1), conversionRate: metric(r, 2) }))
          .filter((r) => r.events > 0 || r.visitors > 0),
      };
    });
  }

  // Plausible traffic for one Kauzl site, using its hand-picked or domain match.
  async function analyticsForSite(site, rangeKey = '28d', opts = {}) {
    const cfg = await config();
    if (!cfg.token) {
      throw new EngineError('No Plausible API key yet.', {
        status: 409,
        kind: 'needs-plausible',
        hint: 'Create a Stats API key in Plausible → Settings → API keys, then add it in Settings → Plausible.',
      });
    }
    const match = (await matches([site], opts))[site.id];
    if (!match?.siteId) {
      throw new EngineError('This site isn’t matched to a Plausible site.', {
        status: 409,
        kind: 'plausible-unmatched',
        hint: 'Add it in Settings → Plausible, or pick the Plausible site by hand.',
      });
    }
    return analytics(match.siteId, rangeKey, opts);
  }

  // GA4 page views for the same UTC days, filtered to the site's host. GA4 days
  // follow the property's time zone, so single days can shift by a few hours.
  async function compare({ site, siteId, rangeKey, gaToken }) {
    const wa = await analytics(siteId, rangeKey);
    const report = await runReport({
      token: gaToken,
      propertyId: site.propertyId,
      body: {
        dateRanges: [{ startDate: wa.dataStart, endDate: wa.range.end }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        dimensionFilter: hostFilter(site.host, { includeSubdomains: site.includeSubdomains }),
        limit: 400,
      },
    });
    const byDay = new Map(report.rows.map((r) => [`${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`, Number(r.screenPageViews) || 0]));
    const ga = wa.range.dates.map((d) => (d < wa.dataStart ? null : byDay.get(d) || 0));
    const gaViews = ga.reduce((a, v) => a + (v || 0), 0);
    return {
      range: wa.range,
      dataStart: wa.dataStart,
      plausible: wa.series.pageviews,
      ga,
      totals: { plausible: wa.totals.pageviews, ga: gaViews },
      // Share of Plausible's page views GA4 also saw; < 1 is mostly ad/tracker blocking.
      capture: wa.totals.pageviews ? gaViews / wa.totals.pageviews : null,
    };
  }

  const reset = () => {
    cache.clear();
    lastError = '';
  };

  return { status, save, reset, sites, matches, setMatch, analytics, analyticsForSite, compare };
}

export function plausibleRoutes({ plausible, store, siteOr404, auth }) {
  const fresh = (query) => query.has('fresh');
  return [
    ['GET', /^\/api\/plausible\/status$/, async () => plausible.status()],
    ['POST', /^\/api\/plausible\/settings$/, async ({ body }) => plausible.save({ key: body.key, baseUrl: body.baseUrl })],
    ['GET', /^\/api\/plausible\/sites$/, async ({ query }) => {
      const sites = await store.sites();
      const [list, status] = await Promise.all([plausible.sites({ fresh: fresh(query) }), plausible.status()]);
      const matched = matchSites(sites, list, status.siteMap || {});
      return {
        ...status,
        sites: list,
        matches: sites.filter((s) => !s.demo).map((s) => ({ id: s.id, label: s.label, host: s.host || '', ...matched[s.id] })),
      };
    }],
    ['POST', /^\/api\/plausible\/match$/, async ({ body }) => plausible.setMatch(body.siteId, body.plausibleSite)],
    ['GET', /^\/api\/plausible\/sites\/([\w-]+)\/analytics$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      return plausible.analyticsForSite(site, query.get('range') || '28d', { fresh: fresh(query) });
    }],
    ['GET', /^\/api\/plausible\/sites\/([\w-]+)\/compare$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      if (!site.propertyId) throw new EngineError('Link a GA4 property to this site to compare it with Plausible.', { kind: 'needs-property' });
      const status = await plausible.status();
      const siteId = query.get('site') || (await plausible.matches([site]))[site.id]?.siteId;
      if (!siteId) throw new EngineError('This site isn’t matched to a Plausible site.', { kind: 'validation' });
      return plausible.compare({ site, siteId, rangeKey: query.get('range') || '28d', gaToken: await auth.token() });
    }],
  ];
}
