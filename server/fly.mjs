// Fly.io: apps, their releases and machines, and edge traffic from Fly's own
// metrics. Releases become deploy moments on the matched site's Timeline.
//
// Two APIs, one token:
//  - GraphQL at api.fly.io/graphql: who's signed in, apps (with their
//    *.fly.dev name and certificate hostnames, for matching sites), releases
//    and machines.
//  - Prometheus at api.fly.io/prometheus/<org>/api/v1: edge request counts,
//    5xx and response times per app (fly_edge_http_* series).
//
// Token: Settings, else FLY_API_TOKEN in .env. `fly tokens create readonly`
// (or `fly auth token`) makes one. Macaroon tokens ("FlyV1 fm2_…") go in the
// header as they are; others as a Bearer token.
//
// A site matches an app by host (its *.fly.dev name or a certificate's
// hostname, www. ignored), unless one was picked by hand (fly.appMap).

import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';

const GRAPHQL = 'https://api.fly.io/graphql';
const PROM = (org) => `https://api.fly.io/prometheus/${encodeURIComponent(org)}/api/v1`;
const DAY = 86_400_000;
const APP_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '');

// The Authorization value for a token as Fly hands it out.
export function flyAuthHeader(token) {
  const t = String(token || '').trim();
  if (/^FlyV1 /.test(t)) return t;
  if (/^fm\d_/.test(t)) return `FlyV1 ${t}`;
  return `Bearer ${t}`;
}

export function createFly({ store, env = process.env, cacheDb = null, fetchImpl = fetch, now = () => Date.now() }) {
  const cache = createCache({ db: cacheDb, name: 'fly', staleFor: cacheDb ? DAY : 0, now });
  let lastError = '';
  let who = null;

  async function config() {
    const s = await store.get();
    return {
      token: s.sources?.flyToken || env.FLY_API_TOKEN || '',
      tokenSource: s.sources?.flyToken ? 'settings' : env.FLY_API_TOKEN ? 'env' : '',
      appMap: s.fly?.appMap || {},
    };
  }

  function authError(message) {
    return new EngineError(`Fly rejected the token: ${message}`, {
      status: 502,
      kind: 'fly-auth',
      hint: 'Make one with `fly tokens create readonly <org>` (or `fly auth token`), then save it in Account → Connections → Fly.io, or set FLY_API_TOKEN in .env.',
    });
  }

  async function gql(query, variables = {}, token) {
    let res;
    try {
      res = await fetchImpl(GRAPHQL, {
        method: 'POST',
        headers: { Authorization: flyAuthHeader(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      throw new EngineError(`Couldn’t reach Fly: ${err.message}`, { status: 502, kind: 'fly' });
    }
    const data = await res.json().catch(() => ({}));
    const message = data.errors?.map((e) => e.message).join(' ') || `Fly returned ${res.status}.`;
    if (res.status === 401 || res.status === 403 || /unauthori[sz]ed|not authenticated/i.test(message)) throw authError(message);
    if (!res.ok || (data.errors?.length && !data.data)) throw new EngineError(`Fly: ${message}`, { status: 502, kind: 'fly' });
    return data.data;
  }

  async function prom(org, path, params, token) {
    const url = new URL(`${PROM(org)}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    let res;
    try {
      res = await fetchImpl(url, { headers: { Authorization: flyAuthHeader(token) }, signal: AbortSignal.timeout(25_000) });
    } catch (err) {
      throw new EngineError(`Couldn’t reach Fly metrics: ${err.message}`, { status: 502, kind: 'fly' });
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) throw authError(data.error || `metrics returned ${res.status}`);
    if (!res.ok || data.status !== 'success') throw new EngineError(`Fly metrics: ${data.error || `returned ${res.status}`}`, { status: 502, kind: 'fly' });
    return data.data;
  }

  async function token() {
    const cfg = await config();
    if (!cfg.token) {
      throw new EngineError('No Fly.io token yet.', {
        status: 409,
        kind: 'needs-fly',
        hint: 'Make one with `fly tokens create readonly <org>`, then add it in Account → Connections → Fly.io, or set FLY_API_TOKEN in .env and restart Kauzl.',
      });
    }
    return cfg.token;
  }

  // Who the token is: a person (email) or a scoped token (no email).
  async function verify(value) {
    const data = await gql('{ viewer { email name } organizations(first: 20) { nodes { slug name } } }', {}, value);
    who = { login: data.viewer?.email || data.viewer?.name || '', orgs: (data.organizations?.nodes || []).map((o) => ({ slug: o.slug, name: o.name })) };
    return who;
  }

  async function status() {
    const cfg = await config();
    if (cfg.token && !who && !lastError) await verify(cfg.token).catch((err) => { lastError = err.message; });
    return { tokenSource: cfg.tokenSource, login: who?.login || '', orgs: who?.orgs || [], lastError };
  }

  async function saveToken(value) {
    const t = String(value ?? '').trim();
    if (t) await verify(t);
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (t) s.sources.flyToken = t;
      else delete s.sources.flyToken;
    });
    cache.clear();
    lastError = '';
    if (!t) who = null;
    return { ok: true, ...(t ? who : {}) };
  }

  async function apps({ fresh = false } = {}) {
    const t = await token();
    return cache.wrap(`apps:${t.slice(-6)}`, 10 * 60_000, fresh, async () => {
      try {
        const data = await gql(`{ apps(first: 100) { nodes {
          name hostname status deployed
          organization { slug name }
          currentRelease { version createdAt status }
          certificates(first: 20) { nodes { hostname } }
        } } }`, {}, t);
        lastError = '';
        return (data.apps?.nodes || []).map(publicApp);
      } catch (err) {
        lastError = err.message;
        throw err;
      }
    });
  }

  async function matches(sites, opts) {
    const cfg = await config();
    if (!cfg.token) return {};
    return matchFlySites(sites, await apps(opts), cfg.appMap);
  }

  async function setMatch(siteId, appName) {
    const name = String(appName ?? '').trim();
    if (name && !APP_NAME.test(name)) throw new EngineError('That isn’t a Fly app name.', { kind: 'validation' });
    await store.update((s) => {
      s.fly = { ...(s.fly || {}), appMap: { ...(s.fly?.appMap || {}), [siteId]: name } };
    });
    return { ok: true };
  }

  async function releases(appName, { fresh = false } = {}) {
    if (!APP_NAME.test(appName)) throw new EngineError('That isn’t a Fly app name.', { kind: 'validation' });
    const t = await token();
    return cache.wrap(`releases:${appName}`, 10 * 60_000, fresh, async () => {
      const data = await gql(`query($name: String!) { app(name: $name) {
        releasesUnprocessed(first: 50) { nodes { version status reason description createdAt user { email } } }
      } }`, { name: appName }, t);
      return (data.app?.releasesUnprocessed?.nodes || []).map((r) => ({
        version: r.version,
        status: String(r.status || '').toLowerCase(),
        reason: r.reason || '',
        description: String(r.description || '').slice(0, 160),
        created: Date.parse(r.createdAt) || 0,
        by: r.user?.email || '',
      }));
    });
  }

  async function machines(appName, { fresh = false } = {}) {
    if (!APP_NAME.test(appName)) throw new EngineError('That isn’t a Fly app name.', { kind: 'validation' });
    const t = await token();
    return cache.wrap(`machines:${appName}`, 2 * 60_000, fresh, async () => {
      const data = await gql(`query($name: String!) { app(name: $name) {
        machines(first: 50) { nodes { id name region state updatedAt } }
      } }`, { name: appName }, t);
      return (data.app?.machines?.nodes || []).map((m) => ({ id: m.id, name: m.name || '', region: m.region || '', state: m.state || '', updated: Date.parse(m.updatedAt) || 0 }));
    });
  }

  // Edge traffic for one app: the last 24 hours, and requests per day for a week.
  async function traffic(appName, org, { fresh = false } = {}) {
    if (!APP_NAME.test(appName)) throw new EngineError('That isn’t a Fly app name.', { kind: 'validation' });
    const t = await token();
    return cache.wrap(`traffic:${org}:${appName}`, 10 * 60_000, fresh, async () => {
      const sel = `app="${appName}"`;
      const one = async (q) => {
        const d = await prom(org, 'query', { query: q }, t);
        const v = Number(d.result?.[0]?.value?.[1]);
        return Number.isFinite(v) ? v : null;
      };
      const end = Math.floor(now() / 1000);
      const [requests, errors, p95, range] = await Promise.all([
        one(`sum(increase(fly_edge_http_responses_count{${sel}}[24h]))`),
        one(`sum(increase(fly_edge_http_responses_count{${sel},status=~"5.."}[24h]))`),
        one(`histogram_quantile(0.95, sum(rate(fly_edge_http_response_time_seconds_bucket{${sel}}[24h])) by (le))`),
        prom(org, 'query_range', { query: `sum(increase(fly_edge_http_responses_count{${sel}}[1d]))`, start: end - 7 * 86_400, end, step: 86_400 }, t),
      ]);
      const days = (range.result?.[0]?.values || []).map(([ts, v]) => ({ date: isoDay(ts * 1000 - DAY), requests: Math.round(Number(v) || 0) }));
      return {
        requests: requests === null ? null : Math.round(requests),
        errors: errors === null ? null : Math.round(errors),
        p95ms: p95 === null || !Number.isFinite(p95) ? null : Math.round(p95 * 1000),
        days,
      };
    });
  }

  // Finished releases as deploy moments on the matched site's Timeline.
  // Registered with annotations.registerSource('fly', …).
  async function annotations({ from = '', to = '', scopes = null } = {}) {
    if (!(await config()).token) return [];
    const matched = await matches(await store.sites()).catch(() => ({}));
    const wanted = scopes?.length ? new Set(scopes) : null;
    const since = from ? Date.parse(`${from}T00:00:00Z`) : now() - 365 * DAY;
    const until = to ? Date.parse(`${to}T23:59:59Z`) : now();
    const lists = await Promise.all(Object.entries(matched)
      .filter(([siteId, m]) => m.app && (!wanted || wanted.has(`site:${siteId}`)))
      .map(async ([siteId, m]) => (await releases(m.app).catch(() => []))
        .filter((r) => r.created >= since && r.created <= until && /^(complete|succeeded|successful)$/.test(r.status))
        .map((r) => ({
          id: `fly-${m.app}-v${r.version}`,
          date: isoDay(r.created),
          at: r.created,
          label: `Deploy ${m.app} v${r.version}${r.description ? `: ${r.description}` : ''}`.slice(0, 140),
          kind: 'deploy',
          source: 'fly',
          url: `https://fly.io/apps/${m.app}/releases`,
          scope: `site:${siteId}`,
        }))));
    return lists.flat();
  }

  const reset = () => {
    cache.clear();
    lastError = '';
    who = null;
  };

  return { status, verify, saveToken, reset, apps, matches, setMatch, releases, machines, traffic, annotations };
}

export function publicApp(a) {
  const certs = (a.certificates?.nodes || []).map((c) => c.hostname).filter(Boolean);
  return {
    name: a.name,
    hostname: a.hostname || `${a.name}.fly.dev`,
    domains: certs,
    status: String(a.status || '').toLowerCase(),
    deployed: Boolean(a.deployed),
    org: a.organization?.slug || '',
    orgName: a.organization?.name || '',
    release: a.currentRelease ? { version: a.currentRelease.version, created: Date.parse(a.currentRelease.createdAt) || 0 } : null,
  };
}

export function matchFlySites(sites, apps, appMap = {}) {
  const out = {};
  for (const site of sites) {
    if (site.demo) continue;
    if (Object.hasOwn(appMap, site.id)) {
      const manual = appMap[site.id];
      out[site.id] = { app: apps.some((a) => a.name === manual) ? manual : '', manual: true };
      continue;
    }
    const host = bareHost(site.host);
    const hit = host && apps.find((a) => [a.hostname, ...a.domains].some((d) => bareHost(d) === host));
    out[site.id] = { app: hit ? hit.name : '', manual: false };
  }
  return out;
}

export function flyRoutes({ fly, store }) {
  const appOf = async (name) => {
    const app = (await fly.apps()).find((a) => a.name === name);
    if (!app) throw new EngineError('No Fly app by that name for this token.', { status: 404, kind: 'notfound' });
    return app;
  };
  return [
    ['GET', /^\/api\/fly\/status$/, async () => fly.status()],
    ['POST', /^\/api\/fly\/token$/, async ({ body }) => fly.saveToken(body.token)],
    ['GET', /^\/api\/fly\/apps$/, async ({ query }) => {
      const list = await fly.apps({ fresh: query.has('fresh') });
      const sites = (await store.sites()).filter((s) => !s.demo);
      const matched = await fly.matches(sites);
      return { apps: list, sites: sites.map((s) => ({ id: s.id, label: s.label || s.host, host: s.host || '', ...(matched[s.id] || { app: '', manual: false }) })) };
    }],
    ['POST', /^\/api\/fly\/match$/, async ({ body }) => fly.setMatch(body.siteId, body.app)],
    ['GET', /^\/api\/fly\/apps\/([a-z0-9-]{1,63})$/, async ({ match, query }) => {
      const app = await appOf(match[1]);
      const fresh = { fresh: query.has('fresh') };
      const [releases, machines, traffic] = await Promise.all([
        fly.releases(app.name, fresh).catch((err) => ({ error: err.message })),
        fly.machines(app.name, fresh).catch((err) => ({ error: err.message })),
        fly.traffic(app.name, app.org, fresh).catch((err) => ({ error: err.message })),
      ]);
      return { app, releases, machines, traffic };
    }],
  ];
}
