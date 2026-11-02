// Vercel: projects, deployments and Web Analytics for the sites hosted there.
//
// Sources (all with a Vercel access token: Settings, else VERCEL_TOKEN in .env):
//  - REST: /v2/user, /v10/projects (production aliases = domains), /v6/deployments.
//  - Web Analytics: POST /v2/observability/query with metric
//    `vercel.analytics_pageview.count` — the same endpoint `vercel metrics` uses
//    (dimensions request_path, referrer_hostname…, aggregation sum or
//    unique/visitor_id). It isn't in the REST reference yet, so errors are
//    surfaced as-is. Hobby plans can only query the latest 31 days; a request
//    past that is clamped and retried once.
//
// Vercel's visitor_id is a hash with a daily salt, so "visitors" over a range is
// closer to a sum of daily visitors than to GA4's users. The GA4 comparison
// therefore lines up page views, which both count the same way.

import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';
import { historyRange } from './github.mjs';
import { runReport } from '../shared/sitelens/ga4.js';
import { hostFilter } from '../shared/sitelens/reports.js';

const API = 'https://api.vercel.com';
const METRIC = 'vercel.analytics_pageview.count';
const COLUMN = { sum: 'vercel_analytics_pageview_count_sum', 'unique/visitor_id': 'vercel_analytics_pageview_count_unique_visitor_id' };
const DAY = 86_400_000;
const PROJECT_ID = /^prj_[A-Za-z0-9]{6,64}$/;

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '');

export function createVercel({ store, env = process.env, fetchImpl = fetch, now = () => Date.now() }) {
  const cache = createCache();
  let lastError = '';
  let who = null;

  async function config() {
    const s = await store.get();
    return {
      token: s.sources?.vercelToken || env.VERCEL_TOKEN || '',
      tokenSource: s.sources?.vercelToken ? 'settings' : env.VERCEL_TOKEN ? 'env' : '',
      teamId: s.vercel?.teamId || env.VERCEL_TEAM_ID || '',
      projectMap: s.vercel?.projectMap || {},
    };
  }

  async function call(path, { token, teamId, method = 'GET', body, query = {} } = {}) {
    const url = new URL(path, API);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    if (teamId) url.searchParams.set('teamId', teamId);
    let res;
    try {
      res = await fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      throw new EngineError(`Couldn’t reach Vercel: ${err.message}`, { status: 502, kind: 'vercel' });
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    const message = data.error?.message || data.message || `Vercel returned ${res.status}.`;
    if (res.status === 401 || res.status === 403) {
      throw new EngineError(`Vercel rejected the token: ${message}`, {
        status: 502,
        kind: 'vercel-auth',
        hint: 'Create a new token at vercel.com/account/settings/tokens with access to your team, then save it in Settings → Vercel or set VERCEL_TOKEN in .env.',
      });
    }
    const err = new EngineError(message, { status: res.status === 429 ? 429 : 502, kind: 'vercel' });
    err.retentionDays = Number(/latest (\d+) days/.exec(message)?.[1]) || 0;
    throw err;
  }

  // Token + team for a request. No team saved → the token user's default team
  // (new Hobby accounts keep their projects there, not on the personal account).
  async function context() {
    const cfg = await config();
    if (!cfg.token) {
      throw new EngineError('No Vercel token yet.', {
        status: 409,
        kind: 'needs-vercel',
        hint: 'Create a token at vercel.com/account/settings/tokens, then add it in Settings → Vercel, or set VERCEL_TOKEN in .env and restart Studio.',
      });
    }
    if (!cfg.teamId) {
      const user = await cache.wrap(`user:${cfg.token.slice(-6)}`, 60 * 60_000, false, () => verify(cfg.token));
      cfg.teamId = user.defaultTeamId || '';
    }
    return cfg;
  }

  async function verify(token) {
    const { user } = await call('/v2/user', { token });
    who = { login: user?.username || '', defaultTeamId: user?.defaultTeamId || '' };
    return who;
  }

  async function status() {
    const cfg = await config();
    return { tokenSource: cfg.tokenSource, login: who?.login || '', teamId: cfg.teamId || who?.defaultTeamId || '', lastError };
  }

  async function saveToken(token, teamId) {
    const value = String(token ?? '').trim();
    const team = String(teamId ?? '').trim();
    if (team && !/^team_[A-Za-z0-9]{6,64}$/.test(team)) throw new EngineError('A team ID looks like team_… (Vercel → team Settings → General).', { kind: 'validation' });
    if (value) await verify(value);
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (value) s.sources.vercelToken = value;
      else if (!team) delete s.sources.vercelToken;
      s.vercel = { ...(s.vercel || {}), teamId: team };
    });
    cache.clear();
    lastError = '';
    return { ok: true, ...(value ? who : {}) };
  }

  async function projects({ fresh = false } = {}) {
    const ctx = await context();
    return cache.wrap(`projects:${ctx.teamId}`, 10 * 60_000, fresh, async () => {
      const out = [];
      let until;
      for (let page = 0; page < 10; page++) {
        const data = await call('/v10/projects', { ...ctx, query: { limit: 100, until } });
        out.push(...(data.projects || []).map(publicProject));
        until = data.pagination?.next;
        if (!until) break;
      }
      lastError = '';
      return out;
    }).catch((err) => {
      lastError = err.message;
      throw err;
    });
  }

  // siteId → { projectId, manual }. A saved override wins ('' = "not on Vercel"),
  // else the first project whose production domains include the site's host.
  async function matches(sites, { fresh = false } = {}) {
    const [list, cfg] = await Promise.all([projects({ fresh }), config()]);
    return matchSites(sites, list, cfg.projectMap);
  }

  // The GitHub repo the site's Vercel project deploys from, or '' (no token, no match, not linked).
  async function repoFor(site) {
    if (site.demo || !(await config()).tokenSource) return '';
    try {
      const id = (await matches([site]))[site.id]?.projectId;
      return (id && (await projects()).find((p) => p.id === id)?.repo) || '';
    } catch {
      return '';
    }
  }

  async function setMatch(siteId, projectId) {
    const id = String(siteId || '');
    if (!/^[\w-]{1,80}$/.test(id)) throw new EngineError('Unknown site.', { kind: 'validation' });
    if (projectId && !PROJECT_ID.test(projectId)) throw new EngineError('That isn’t a Vercel project ID.', { kind: 'validation' });
    await store.update((s) => {
      const map = { ...(s.vercel?.projectMap || {}) };
      if (projectId === null || projectId === undefined) delete map[id];
      else map[id] = String(projectId);
      s.vercel = { ...(s.vercel || {}), projectMap: map };
    });
    return { ok: true };
  }

  async function deployments(projectId, { limit = 20, target = '', since = 0, until = 0, fresh = false } = {}) {
    if (!PROJECT_ID.test(projectId)) throw new EngineError('That isn’t a Vercel project ID.', { kind: 'validation' });
    const ctx = await context();
    const key = `deploys:${projectId}:${limit}:${target}:${since}:${until}`;
    return cache.wrap(key, 5 * 60_000, fresh, async () => {
      const data = await call('/v6/deployments', {
        ...ctx,
        query: { projectId, limit: Math.min(100, Math.max(1, limit)), target, since: since || undefined, until: until || undefined },
      });
      return (data.deployments || []).map(publicDeployment);
    });
  }

  async function query(ctx, body) {
    return call('/v2/observability/query', { ...ctx, method: 'POST', body });
  }

  // Web Analytics for one project over a history range (7d/28d/90d/1y, UTC days).
  async function analytics(projectId, rangeKey = '28d', { fresh = false } = {}) {
    if (!PROJECT_ID.test(projectId)) throw new EngineError('That isn’t a Vercel project ID.', { kind: 'validation' });
    const ctx = await context();
    const range = historyRange(rangeKey, now());
    return cache.wrap(`wa:${projectId}:${range.key}:${range.end}`, 10 * 60_000, fresh, async () => {
      let start = range.start;
      let retentionDays = 0;
      const run = (startDay) => {
        const base = {
          scope: { type: 'project', ownerId: ctx.teamId, projectIds: [projectId] },
          metric: METRIC,
          startTime: `${startDay}T00:00:00.000Z`,
          endTime: new Date(now()).toISOString(),
          granularity: { days: 1 },
        };
        const top = (dimension) => ({ ...base, aggregation: 'sum', groupBy: [dimension], limit: 10, orderBy: COLUMN.sum, orderDirection: 'desc' });
        return Promise.all([
          query(ctx, { ...base, aggregation: 'sum' }),
          query(ctx, { ...base, aggregation: 'unique/visitor_id' }),
          query(ctx, top('request_path')),
          query(ctx, top('referrer_hostname')),
        ]);
      };
      let results;
      try {
        results = await run(start);
      } catch (err) {
        if (!err.retentionDays) throw err;
        // Plan limit ("latest 31 days"): ask again for what the plan allows.
        retentionDays = err.retentionDays;
        start = isoDay(Math.max(Date.parse(`${range.start}T00:00:00Z`), now() - (retentionDays - 1) * DAY));
        results = await run(start);
      }
      const [views, visitors, paths, referrers] = results;
      const pageviews = daily(views, COLUMN.sum, range.dates, start);
      return {
        range,
        dataStart: start,
        retentionDays,
        series: { pageviews, visitors: daily(visitors, COLUMN['unique/visitor_id'], range.dates, start) },
        totals: {
          pageviews: pageviews.reduce((a, v) => a + (v || 0), 0),
          visitors: Number(visitors.summary?.[0]?.[COLUMN['unique/visitor_id']]) || 0,
        },
        pages: (paths.summary || []).map((r) => ({ path: r.request_path || '/', views: Number(r[COLUMN.sum]) || 0 })).filter((r) => r.views > 0),
        referrers: (referrers.summary || []).map((r) => ({ host: r.referrer_hostname || '', views: Number(r[COLUMN.sum]) || 0 })).filter((r) => r.views > 0),
      };
    });
  }

  // GA4 page views for the same UTC days, filtered to the site's host. GA4 days
  // follow the property's time zone, so single days can shift by a few hours.
  async function compare({ site, projectId, rangeKey, gaToken }) {
    const wa = await analytics(projectId, rangeKey);
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
      vercel: wa.series.pageviews,
      ga,
      totals: { vercel: wa.totals.pageviews, ga: gaViews },
      // Share of Vercel's page views GA4 also saw; < 1 is mostly ad/tracker blocking.
      capture: wa.totals.pageviews ? gaViews / wa.totals.pageviews : null,
    };
  }

  // Production deployments as chart annotations, scoped to the matched site.
  // Registered by the integrator with annotations.registerSource('vercel', …).
  async function annotations({ from = '', to = '', scopes = null } = {}) {
    if (!(await config()).token) return [];
    const sites = await store.sites();
    const matched = await matches(sites);
    const wanted = scopes?.length ? new Set(scopes) : null;
    const since = from ? Date.parse(`${from}T00:00:00Z`) : now() - 365 * DAY;
    const until = to ? Date.parse(`${to}T23:59:59Z`) : now();
    const lists = await Promise.all(Object.entries(matched)
      .filter(([siteId, m]) => m.projectId && (!wanted || wanted.has(`site:${siteId}`)))
      .map(async ([siteId, m]) => (await deployments(m.projectId, { limit: 100, target: 'production', since, until }))
        .filter((d) => d.state === 'READY')
        .map((d) => ({
          id: `vercel-${d.id}`,
          date: isoDay(d.created),
          label: d.commit ? `Deploy: ${d.commit}` : `Deploy ${d.id.slice(-6)}`,
          kind: 'deploy',
          source: 'vercel',
          url: d.inspectUrl || `https://${d.url}`,
          scope: `site:${siteId}`,
        }))));
    return lists.flat();
  }

  return { status, verify, saveToken, projects, matches, repoFor, setMatch, deployments, analytics, compare, annotations };
}

// Project fields Studio shows. The API also returns env vars — never pass those on.
export function publicProject(p) {
  const aliases = p.targets?.production?.alias || p.alias?.map((a) => a.domain) || [];
  const latest = p.targets?.production || p.latestDeployments?.find((d) => d.target === 'production') || null;
  return {
    id: p.id,
    name: p.name,
    framework: p.framework || '',
    domains: aliases.filter((d) => !d.endsWith('.vercel.app')),
    vercelDomains: aliases.filter((d) => d.endsWith('.vercel.app')).slice(0, 1),
    webAnalytics: { enabled: Boolean(p.webAnalytics?.enabledAt), hasData: Boolean(p.webAnalytics?.hasData) },
    speedInsights: { enabled: Boolean(p.speedInsights?.enabledAt), hasData: Boolean(p.speedInsights?.hasData) },
    repo: p.link?.repo ? `${p.link.org || p.link.repoOwner || ''}/${p.link.repo}`.replace(/^\//, '') : '',
    lastProduction: latest ? { created: latest.createdAt || latest.created || 0, state: latest.readyState || '' } : null,
  };
}

export function publicDeployment(d) {
  const meta = d.meta || {};
  return {
    id: d.uid || d.id,
    url: d.url || '',
    inspectUrl: d.inspectorUrl || '',
    created: d.created || d.createdAt || 0,
    state: d.readyState || d.state || '',
    target: d.target || 'preview',
    source: d.source || '',
    commit: String(meta.githubCommitMessage || meta.gitlabCommitMessage || meta.bitbucketCommitMessage || '').split('\n')[0].slice(0, 120),
    ref: meta.githubCommitRef || meta.gitlabCommitRef || meta.bitbucketCommitRef || '',
    sha: String(meta.githubCommitSha || meta.gitlabCommitSha || meta.bitbucketCommitSha || '').slice(0, 7),
  };
}

export function matchSites(sites, projects, projectMap = {}) {
  const out = {};
  for (const site of sites) {
    if (site.demo) continue;
    if (Object.hasOwn(projectMap, site.id)) {
      const manual = projectMap[site.id];
      out[site.id] = { projectId: projects.some((p) => p.id === manual) ? manual : '', manual: true };
      continue;
    }
    const host = bareHost(site.host);
    const hit = host && projects.find((p) => [...p.domains, ...p.vercelDomains].some((d) => bareHost(d) === host));
    out[site.id] = { projectId: hit ? hit.id : '', manual: false };
  }
  return out;
}

// Daily buckets → values aligned to `dates`; days before the queryable window are null.
export function daily(response, column, dates, start) {
  const byDay = new Map((response.data || []).map((r) => [String(r.timestamp).slice(0, 10), Number(r[column]) || 0]));
  return dates.map((d) => (d < start ? null : byDay.get(d) || 0));
}

export function vercelRoutes({ vercel, store, siteOr404, auth }) {
  const fresh = (query) => query.has('fresh');
  return [
    ['GET', /^\/api\/vercel\/status$/, async () => vercel.status()],
    ['POST', /^\/api\/vercel\/token$/, async ({ body }) => vercel.saveToken(body.token, body.teamId)],
    ['GET', /^\/api\/vercel\/projects$/, async ({ query }) => {
      const sites = await store.sites();
      const [projects, matched] = await Promise.all([vercel.projects({ fresh: fresh(query) }), vercel.matches(sites)]);
      return {
        ...(await vercel.status()),
        projects,
        sites: sites.filter((s) => !s.demo).map((s) => ({ id: s.id, label: s.label, host: s.host, propertyId: s.propertyId || '', ...matched[s.id] })),
      };
    }],
    ['POST', /^\/api\/vercel\/match$/, async ({ body }) => vercel.setMatch(body.siteId, body.projectId)],
    ['GET', /^\/api\/vercel\/projects\/(prj_[A-Za-z0-9]+)\/deployments$/, async ({ match, query }) =>
      ({ deployments: await vercel.deployments(match[1], { limit: Number(query.get('limit')) || 20, target: query.get('target') || '', fresh: fresh(query) }) })],
    ['GET', /^\/api\/vercel\/projects\/(prj_[A-Za-z0-9]+)\/analytics$/, async ({ match, query }) =>
      vercel.analytics(match[1], query.get('range') || '28d', { fresh: fresh(query) })],
    ['GET', /^\/api\/vercel\/sites\/([\w-]+)\/compare$/, async ({ match, query }) => {
      const site = await siteOr404(match[1]);
      if (!site.propertyId) throw new EngineError('Link a GA4 property to this site to compare it with Vercel.', { kind: 'needs-property' });
      const projectId = query.get('project') || (await vercel.matches([site]))[site.id]?.projectId;
      if (!projectId) throw new EngineError('This site isn’t matched to a Vercel project.', { kind: 'validation' });
      return vercel.compare({ site, projectId, rangeKey: query.get('range') || '28d', gaToken: await auth.token() });
    }],
  ];
}
