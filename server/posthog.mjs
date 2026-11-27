// PostHog: product & traffic analytics, hosted at us.posthog.com / eu.posthog.com
// or a custom self-hosted URL.
//
// Source: the PostHog Query API — POST {base}/api/projects/{project_id}/query/
// with `Authorization: Bearer <personal API key>`. Queries are HogQL
// (`{ query: { kind: 'HogQLQuery', query: "SELECT …" } }`; Trends bodies are
// passed through unchanged). The personal API key and project_id come from
// Settings, else POSTHOG_API_KEY and POSTHOG_PROJECT_ID in .env. The base URL
// comes from Settings, else POSTHOG_BASE_URL, else https://us.posthog.com.
//
// A Kauzl site is matched to a PostHog site by host/domain: the `$host`
// property on `$pageview` events (www. ignored). A hand-picked map in Settings
// (posthog.siteMap, Kauzl site id → `$host` value) always wins.
//
// Analytics are shaped identically to vercel.mjs so existing Timeline and site
// views draw them without changes: daily unique visitors (persons/distinct_id),
// pageviews (`$pageview`), sessions (`$session_id`), bounce rate, top pages
// (`$pathname`), top referrers (`$referring_domain`) and custom conversion
// events (any event not starting with `$`).
//
// Hosted, the base URL must resolve to a public address, as every other
// outgoing fetch does (see net-guard.mjs).

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';
import { historyRange } from './github.mjs';
import { runReport } from './ga-limit.mjs';
import { hostFilter } from '../shared/sitelens/reports.js';
import { isPrivateAddress } from './net-guard.mjs';

export const DEFAULT_BASE = 'https://us.posthog.com';
export const EU_BASE = 'https://eu.posthog.com';
const DAY = 86_400_000;
const PAGEVIEW = '$pageview';
const PROJECT_ID = /^[A-Za-z0-9_-]{1,80}$/;
const SITE = /^[a-z0-9][a-z0-9.:_-]{0,254}$/i;

const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:?#].*$/, '').replace(/^www\./, '');
const num = (v) => Number(v) || 0;
const sqlString = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;

export function normalizeBase(value) {
  const raw = String(value ?? '').trim() || DEFAULT_BASE;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new EngineError(`That isn’t a URL. It looks like ${DEFAULT_BASE}.`, { kind: 'validation' });
  }
  if (!/^https?:$/.test(url.protocol)) throw new EngineError('The PostHog URL must start with https:// (or http:// on your own network).', { kind: 'validation' });
  if (url.username || url.password) throw new EngineError('The PostHog URL shouldn’t include a username or password.', { kind: 'validation' });
  url.search = '';
  url.hash = '';
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

// Hosted: the base URL must resolve to a public address. Checked when saved,
// and again before a request, so a DNS answer that changes later can't slip
// through. net-guard.mjs blocks private/loopback IP ranges at connect time too.
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
      hint: 'Hosted Kauzl only reaches PostHog on the public internet.',
    });
  }
  return base;
}

// Kauzl site ↔ PostHog `$host`. A saved override wins ('' = "not in PostHog"),
// else a PostHog site whose host matches the site's host, www. ignored.
export function matchSites(sites, available = [], siteMap = {}) {
  const out = {};
  for (const site of sites) {
    if (site.demo) continue;
    if (Object.hasOwn(siteMap, site.id)) {
      out[site.id] = { siteId: bareHost(siteMap[site.id]), manual: true };
      continue;
    }
    const host = bareHost(site.host);
    const hit = host && available.find((a) => bareHost(typeof a === 'string' ? a : a?.host) === host);
    out[site.id] = { siteId: hit ? bareHost(typeof hit === 'string' ? hit : hit.host) : '', manual: false };
  }
  return out;
}

// `AND lower(...$host) IN (...)`, port and www. ignored, for a `$host`.
export function hostFilterSql(host) {
  const h = bareHost(host);
  if (!h) return '';
  const variants = [...new Set([h, `www.${h}`])];
  return `AND lower(properties.$host) IN (${variants.map(sqlString).join(', ')})`;
}

// HogQL response `results` (arrays) → row objects keyed by `columns`.
export function table(res) {
  const cols = Array.isArray(res?.columns) ? res.columns : [];
  return (Array.isArray(res?.results) ? res.results : []).map((r) => (Array.isArray(r) ? Object.fromEntries(cols.map((c, i) => [c, r[i]])) : r));
}

const dayOf = (v) => String(v ?? '').slice(0, 10);
const metric = (row, key) => num(row?.[key]);

export function createPostHog({
  store,
  env = process.env,
  cacheDb = null,
  fetchImpl = fetch,
  now = () => Date.now(),
  hosted = env.STUDIO_HOSTED === '1',
}) {
  const cache = createCache({ db: cacheDb, name: 'posthog', staleFor: cacheDb ? DAY : 0, now });
  let lastError = '';

  async function config() {
    const s = await store.get();
    return {
      token: s.sources?.posthogKey || env.POSTHOG_API_KEY || '',
      keySource: s.sources?.posthogKey ? 'settings' : env.POSTHOG_API_KEY ? 'env' : '',
      projectId: s.posthog?.projectId || env.POSTHOG_PROJECT_ID || '',
      projectSource: s.posthog?.projectId ? 'settings' : env.POSTHOG_PROJECT_ID ? 'env' : '',
      baseUrl: normalizeBase(s.posthog?.baseUrl || env.POSTHOG_BASE_URL || DEFAULT_BASE),
      baseSource: s.posthog?.baseUrl ? 'settings' : env.POSTHOG_BASE_URL ? 'env' : 'default',
      siteMap: s.posthog?.siteMap || {},
      hosted,
    };
  }

  async function query({ token, baseUrl, projectId }, body) {
    if (!PROJECT_ID.test(String(projectId || ''))) {
      throw new EngineError('No PostHog project_id yet.', {
        status: 409,
        kind: 'needs-posthog',
        hint: 'Add the project_id in Settings → PostHog, or set POSTHOG_PROJECT_ID in .env.',
      });
    }
    const base = await assertPublicBase(baseUrl, { hosted });
    const url = `${base}/api/projects/${encodeURIComponent(projectId)}/query/`;
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      throw new EngineError(`Couldn’t reach PostHog: ${err.message}`, { status: 502, kind: 'posthog' });
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    const message = data.error || data.detail || data.message || `PostHog returned ${res.status}.`;
    if (res.status === 401 || res.status === 403) {
      throw new EngineError(`PostHog rejected the API key: ${message}`, {
        status: 502,
        kind: 'posthog-auth',
        hint: 'Create a personal API key in PostHog → Settings → Personal API keys, then save it in Settings → PostHog or set POSTHOG_API_KEY in .env.',
      });
    }
    throw new EngineError(message, { status: res.status === 429 ? 429 : 502, kind: 'posthog' });
  }

  async function hogql(ctx, sql) {
    return query(ctx, { query: { kind: 'HogQLQuery', query: sql } });
  }

  async function context() {
    const cfg = await config();
    if (!cfg.token) {
      throw new EngineError('No PostHog API key yet.', {
        status: 409,
        kind: 'needs-posthog',
        hint: 'Create a personal API key in PostHog → Settings → Personal API keys, then add it in Settings → PostHog, or set POSTHOG_API_KEY in .env and restart Kauzl.',
      });
    }
    if (!cfg.projectId) {
      throw new EngineError('No PostHog project_id yet.', {
        status: 409,
        kind: 'needs-posthog',
        hint: 'Add the project_id in Settings → PostHog, or set POSTHOG_PROJECT_ID in .env and restart Kauzl.',
      });
    }
    return cfg;
  }

  async function status() {
    const cfg = await config();
    return {
      baseUrl: cfg.baseUrl,
      baseSource: cfg.baseSource,
      keySource: cfg.keySource,
      projectId: cfg.projectId,
      projectSource: cfg.projectSource,
      siteMap: cfg.siteMap,
      lastError,
    };
  }

  // PostHog sites seen on `$pageview` events in the project (last 30 days).
  async function listSites({ token, projectId, baseUrl, fresh = false } = {}) {
    const cfg = await config();
    const key = token ?? cfg.token;
    const project = projectId ?? cfg.projectId;
    const base = baseUrl ?? cfg.baseUrl;
    if (!key || !project) {
      throw new EngineError('No PostHog API key and project_id yet.', {
        status: 409,
        kind: 'needs-posthog',
        hint: 'Create a personal API key in PostHog → Settings → Personal API keys, then add it in Settings → PostHog.',
      });
    }
    const cacheKey = `sites:${base}:${project}:${key.slice(-6)}`;
    return cache.wrap(cacheKey, 10 * 60_000, fresh, async () => {
      const sql = `SELECT properties.$host AS host, count() AS views FROM events WHERE event = '${PAGEVIEW}' AND properties.$host != '' AND timestamp >= now() - INTERVAL 30 DAY GROUP BY host ORDER BY views DESC LIMIT 100`;
      const data = await hogql({ token: key, projectId: project, baseUrl: base }, sql);
      lastError = '';
      return table(data).map((r) => ({ host: String(r.host || '').trim(), views: num(r.views) })).filter((r) => r.host);
    }).catch((err) => {
      lastError = err.message;
      throw err;
    });
  }

  async function sites({ fresh = false } = {}) {
    return listSites({ fresh });
  }

  async function matches(sitesToMatch, { fresh = false } = {}) {
    const cfg = await config();
    if (!cfg.token || !cfg.projectId) return matchSites(sitesToMatch, [], cfg.siteMap);
    const available = await listSites({ fresh }).catch(() => []);
    return matchSites(sitesToMatch, available, cfg.siteMap);
  }

  async function verify(value) {
    const cfg = await config();
    const token = value?.key ?? value ?? cfg.token;
    const projectId = value?.projectId ?? cfg.projectId;
    const baseUrl = value?.baseUrl ?? cfg.baseUrl;
    await query({ token, projectId, baseUrl }, { query: { kind: 'HogQLQuery', query: 'SELECT 1 AS ok' } });
    return { ok: true };
  }

  async function save({ key, projectId, baseUrl } = {}) {
    const cfg = await config();
    const base = baseUrl === undefined ? cfg.baseUrl : await assertPublicBase(baseUrl, { hosted });
    const value = key === undefined ? cfg.token : String(key ?? '').trim();
    const project = projectId === undefined ? cfg.projectId : String(projectId ?? '').trim();
    if (project && !PROJECT_ID.test(project)) throw new EngineError('That isn’t a PostHog project_id (a number, like 12345).', { kind: 'validation' });
    if (value && project) await verify({ key: value, projectId: project, baseUrl: base });
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (key !== undefined) {
        if (value) s.sources.posthogKey = value;
        else delete s.sources.posthogKey;
      }
      s.posthog = { ...(s.posthog || {}) };
      s.posthog.projectId = project;
      if (base === DEFAULT_BASE) delete s.posthog.baseUrl;
      else s.posthog.baseUrl = base;
    });
    cache.clear();
    lastError = '';
    return { ok: true, baseUrl: base, projectId: project };
  }

  async function setMatch(siteId, posthogSite) {
    const id = String(siteId || '');
    if (!/^[\w-]{1,80}$/.test(id)) throw new EngineError('Unknown site.', { kind: 'validation' });
    const value = String(posthogSite ?? '').trim();
    if (value && !SITE.test(value)) throw new EngineError('That isn’t a PostHog site (a host, like example.com).', { kind: 'validation' });
    await store.update((s) => {
      const map = { ...(s.posthog?.siteMap || {}) };
      if (!value) delete map[id];
      else map[id] = value;
      s.posthog = { ...(s.posthog || {}), siteMap: map };
    });
    return { ok: true };
  }

  // Traffic for one PostHog `$host` over a history range (UTC days), shaped
  // like vercel.mjs `analytics`. `siteId` here is the matched `$host`.
  async function analytics(siteId, rangeKey = '28d', { fresh = false } = {}) {
    const host = String(siteId || '').trim();
    if (!host) throw new EngineError('That isn’t a PostHog site (a host, like example.com).', { kind: 'validation' });
    const ctx = await context();
    const range = historyRange(rangeKey, now());
    const cacheKey = `analytics:${host}:${range.key}:${range.end}`;
    return cache.wrap(cacheKey, 10 * 60_000, fresh, async () => {
      const dayFilter = `toDate(timestamp) >= ${sqlString(range.start)} AND toDate(timestamp) <= ${sqlString(range.end)}`;
      const hostSql = hostFilterSql(host);
      const pageviewsOnly = `event = '${PAGEVIEW}'`;

      const dailySql = `SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS visitors, count() AS pageviews FROM events WHERE ${pageviewsOnly} AND ${dayFilter} ${hostSql} GROUP BY day ORDER BY day`;
      const sessionsSql = `SELECT properties.$session_id AS session, toDate(min(timestamp)) AS day, count() AS views FROM events WHERE ${pageviewsOnly} AND properties.$session_id IS NOT NULL AND ${dayFilter} ${hostSql} GROUP BY session ORDER BY day`;
      const totalsSql = `SELECT count(DISTINCT person_id) AS visitors, count() AS pageviews FROM events WHERE ${pageviewsOnly} AND ${dayFilter} ${hostSql}`;
      const pagesSql = `SELECT properties.$pathname AS path, count() AS views, count(DISTINCT person_id) AS visitors FROM events WHERE ${pageviewsOnly} AND ${dayFilter} ${hostSql} GROUP BY path ORDER BY views DESC LIMIT 10`;
      const referrersSql = `SELECT properties.$referring_domain AS host, count() AS views, count(DISTINCT person_id) AS visitors FROM events WHERE ${pageviewsOnly} AND ${dayFilter} ${hostSql} GROUP BY host ORDER BY views DESC LIMIT 10`;
      const goalsSql = `SELECT event AS goal, count() AS events, count(DISTINCT person_id) AS visitors FROM events WHERE event NOT LIKE '$%' AND ${dayFilter} ${hostSql} GROUP BY goal ORDER BY visitors DESC LIMIT 20`;

      const [dailyRes, sessionsRes, totalsRes, pagesRes, referrersRes, goalsRes] = await Promise.all([
        hogql(ctx, dailySql),
        hogql(ctx, sessionsSql),
        hogql(ctx, totalsSql),
        hogql(ctx, pagesSql),
        hogql(ctx, referrersSql),
        hogql(ctx, goalsSql),
      ]);

      const dates = range.dates;
      const dailyRows = table(dailyRes);
      const pageviews = align(dailyRows, dates, 'pageviews');
      const visitorsDaily = align(dailyRows, dates, 'visitors');

      const sessionRows = table(sessionsRes).filter((r) => r.session);
      const sessionsByDay = new Map();
      const bouncedByDay = new Map();
      for (const r of sessionRows) {
        const d = dayOf(r.day);
        sessionsByDay.set(d, (sessionsByDay.get(d) || 0) + 1);
        if (num(r.views) <= 1) bouncedByDay.set(d, (bouncedByDay.get(d) || 0) + 1);
      }
      const sessions = dates.map((d) => sessionsByDay.get(d) || 0);
      const bounceRate = dates.map((d) => {
        const s = sessionsByDay.get(d) || 0;
        return s ? ((bouncedByDay.get(d) || 0) / s) * 100 : 0;
      });
      const totalSessions = sessionRows.length;
      const totalBounced = sessionRows.filter((r) => num(r.views) <= 1).length;

      const totalsRow = table(totalsRes)[0] || {};
      const totalVisitors = metric(totalsRow, 'visitors');
      const totalPageviews = pageviews.reduce((a, v) => a + v, 0);

      lastError = '';
      return {
        range,
        dataStart: range.start,
        retentionDays: 0,
        siteId: host,
        series: {
          pageviews,
          visitors: visitorsDaily,
          visits: sessions, // Plausible-compatible alias
          sessions,
          bounceRate,
        },
        totals: {
          pageviews: totalPageviews,
          visitors: totalVisitors,
          visits: totalSessions, // Plausible-compatible alias
          sessions: totalSessions,
          bounceRate: totalSessions ? (totalBounced / totalSessions) * 100 : 0,
        },
        pages: table(pagesRes)
          .map((r) => ({ path: String(r.path || '/') || '/', views: num(r.views), visitors: num(r.visitors) }))
          .filter((r) => r.views > 0),
        referrers: table(referrersRes)
          .map((r) => ({ host: referrerHost(r.host), views: num(r.views), visitors: num(r.visitors) }))
          .filter((r) => r.views > 0),
        // Custom conversion events (PostHog events not starting with `$`).
        goals: table(goalsRes)
          .map((r) => ({
            goal: String(r.goal || 'event'),
            visitors: num(r.visitors),
            events: num(r.events),
            conversionRate: totalVisitors ? (num(r.visitors) / totalVisitors) * 100 : 0,
          }))
          .filter((r) => r.events > 0 || r.visitors > 0),
      };
    });
  }

  // Traffic for one Kauzl site, using its hand-picked or domain match.
  async function analyticsForSite(site, rangeKey = '28d', opts = {}) {
    const cfg = await config();
    if (!cfg.token || !cfg.projectId) {
      throw new EngineError('No PostHog API key and project_id yet.', {
        status: 409,
        kind: 'needs-posthog',
        hint: 'Create a personal API key in PostHog → Settings → Personal API keys, then add it in Settings → PostHog.',
      });
    }
    const match = (await matches([site], opts))[site.id];
    if (!match?.siteId) {
      throw new EngineError('This site isn’t matched to a PostHog site.', {
        status: 409,
        kind: 'posthog-unmatched',
        hint: 'Add it in Settings → PostHog, or pick the PostHog site by hand.',
      });
    }
    return analytics(match.siteId, rangeKey, opts);
  }

  // GA4 page views for the same UTC days, filtered to the site's host. GA4 days
  // follow the property's time zone, so single days can shift by a few hours.
  async function compare({ site, siteId, rangeKey, gaToken }) {
    const ph = await analytics(siteId, rangeKey);
    const report = await runReport({
      token: gaToken,
      propertyId: site.propertyId,
      body: {
        dateRanges: [{ startDate: ph.dataStart, endDate: ph.range.end }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        dimensionFilter: hostFilter(site.host, { includeSubdomains: site.includeSubdomains }),
        limit: 400,
      },
    });
    const byDay = new Map(report.rows.map((r) => [`${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`, Number(r.screenPageViews) || 0]));
    const ga = ph.range.dates.map((d) => (d < ph.dataStart ? null : byDay.get(d) || 0));
    const gaViews = ga.reduce((a, v) => a + (v || 0), 0);
    return {
      range: ph.range,
      dataStart: ph.dataStart,
      posthog: ph.series.pageviews,
      ga,
      totals: { posthog: ph.totals.pageviews, ga: gaViews },
      capture: ph.totals.pageviews ? gaViews / ph.totals.pageviews : null,
    };
  }

  const reset = () => {
    cache.clear();
    lastError = '';
  };

  return { status, verify, save, reset, sites, listSites, matches, setMatch, query, hogql, analytics, analyticsForSite, compare };
}

function referrerHost(host) {
  const h = String(host || '').trim();
  if (!h || h === '$direct' || h.toLowerCase() === 'direct') return '';
  return h;
}

// Per-day rows → values aligned to `dates`; days PostHog omits are zero.
export function align(rows, dates, key) {
  const byDay = new Map(rows.map((r) => [dayOf(r.day ?? r.timestamp), num(r[key])]));
  return dates.map((d) => byDay.get(d) || 0);
}

export function posthogRoutes({ posthog, store, siteOr404, auth }) {
  const fresh = (query) => query.has('fresh');
  return [
    ['GET', /^\/api\/posthog\/status$/, async () => posthog.status()],
    ['POST', /^\/api\/posthog\/settings$/, async ({ body }) => posthog.save({ key: body.key, projectId: body.projectId, baseUrl: body.baseUrl })],
    ['GET', /^\/api\/posthog\/sites$/, async ({ query }) => {
      const sites = await store.sites();
      const [list, status] = await Promise.all([posthog.sites({ fresh: fresh(query) }).catch(() => []), posthog.status()]);
      const matched = matchSites(sites, list, status.siteMap || {});
      return {
        ...status,
        sites: list,
        matches: sites.filter((s) => !s.demo).map((s) => ({ id: s.id, label: s.label, host: s.host || '', ...matched[s.id] })),
      };
    }],
    ['POST', /^\/api\/posthog\/match$/, async ({ body }) => posthog.setMatch(body.siteId, body.posthogSite)],
    ['GET', /^\/api\/posthog\/sites\/([\w-]+)\/analytics$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      return posthog.analyticsForSite(site, query.get('range') || '28d', { fresh: fresh(query) });
    }],
    ['GET', /^\/api\/posthog\/sites\/([\w-]+)\/compare$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      if (!site.propertyId) throw new EngineError('Link a GA4 property to this site to compare it with PostHog.', { kind: 'needs-property' });
      const siteId = query.get('site') || (await posthog.matches([site]))[site.id]?.siteId;
      if (!siteId) throw new EngineError('This site isn’t matched to a PostHog site.', { kind: 'validation' });
      return posthog.compare({ site, siteId, rangeKey: query.get('range') || '28d', gaToken: await auth.token() });
    }],
  ];
}
