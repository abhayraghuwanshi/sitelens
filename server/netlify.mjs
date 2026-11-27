// Netlify: sites, their production deploys and the people who shipped them.
// Deploys become moments on the matched site's Timeline — including failed ones.
//
// REST at api.netlify.com/api/v1: /user (who the token is), /sites and
// /sites/<id>/deploys. Token: a personal access token from Settings, else
// NETLIFY_TOKEN in .env. Kauzl only reads these endpoints.
//
// A site matches a Netlify site by its custom domain, a domain alias or its
// *.netlify.app address (www. ignored), unless one was picked by hand
// (netlify.siteMap).

import { EngineError } from './engines.mjs';
import { createCache } from './cache.mjs';

const API = 'https://api.netlify.com/api/v1';
const DAY = 86_400_000;
const SITE_ID = /^[\w-]{1,80}$/;
const FAILURE = new Set(['failed', 'error']);

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const bareHost = (h) => String(h || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:?#].*$/, '').replace(/^www\./, '');
const stamp = (v) => Date.parse(v || '') || 0;

export function createNetlify({ store, env = process.env, cacheDb = null, fetchImpl = fetch, now = () => Date.now() }) {
  // Kept on disk and served stale while Netlify is asked again, so deploys never
  // hold up a Timeline (the same way fly.mjs caches apps and releases).
  const cache = createCache({ db: cacheDb, name: 'netlify', staleFor: cacheDb ? DAY : 0, now });
  let lastError = '';
  let who = null;

  async function config() {
    const s = await store.get();
    return {
      token: s.sources?.netlifyToken || env.NETLIFY_TOKEN || '',
      tokenSource: s.sources?.netlifyToken ? 'settings' : env.NETLIFY_TOKEN ? 'env' : '',
      siteMap: s.netlify?.siteMap || {},
    };
  }

  function authError(message) {
    return new EngineError(`Netlify rejected the token: ${message}`, {
      status: 502,
      kind: 'netlify-auth',
      hint: 'Create a personal access token at app.netlify.com → User settings → Applications → Personal access tokens, then save it in Account → Connections → Netlify, or set NETLIFY_TOKEN in .env.',
    });
  }

  async function call(path, token, { query = {} } = {}) {
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    let res;
    try {
      res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      throw new EngineError(`Couldn’t reach Netlify: ${err.message}`, { status: 502, kind: 'netlify' });
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    const message = (data && (data.message || data.error)) || `Netlify returned ${res.status}.`;
    if (res.status === 401 || res.status === 403) throw authError(message);
    throw new EngineError(`Netlify: ${message}`, { status: res.status === 429 ? 429 : 502, kind: 'netlify' });
  }

  async function token() {
    const cfg = await config();
    if (!cfg.token) {
      throw new EngineError('No Netlify token yet.', {
        status: 409,
        kind: 'needs-netlify',
        hint: 'Create a personal access token at app.netlify.com → User settings → Applications → Personal access tokens, then add it in Account → Connections → Netlify, or set NETLIFY_TOKEN in .env and restart Kauzl.',
      });
    }
    return cfg.token;
  }

  // Who the token belongs to, for the settings page and the Connections row.
  async function verify(value) {
    const user = await call('/user', value);
    who = { login: user.email || user.full_name || user.slug || '' };
    return who;
  }

  async function status() {
    const cfg = await config();
    if (cfg.token && !who && !lastError) await verify(cfg.token).catch((err) => { lastError = err.message; });
    return { tokenSource: cfg.tokenSource, login: who?.login || '', lastError };
  }

  async function saveToken(value) {
    const t = String(value ?? '').trim();
    if (t) await verify(t);
    await store.update((s) => {
      s.sources = { ...(s.sources || {}) };
      if (t) s.sources.netlifyToken = t;
      else delete s.sources.netlifyToken;
    });
    cache.clear();
    lastError = '';
    if (!t) who = null;
    return { ok: true, ...(t ? who : {}) };
  }

  async function sites({ fresh = false } = {}) {
    const t = await token();
    return cache.wrap(`sites:${t.slice(-6)}`, 10 * 60_000, fresh, async () => {
      try {
        const list = await call('/sites', t, { query: { per_page: 100 } });
        lastError = '';
        return (Array.isArray(list) ? list : []).map(publicSite);
      } catch (err) {
        lastError = err.message;
        throw err;
      }
    });
  }

  async function matches(sitesToMatch, opts = {}) {
    const cfg = await config();
    if (!cfg.token) return {};
    return matchNetlifySites(sitesToMatch, await sites(opts), cfg.siteMap);
  }

  async function setMatch(siteId, netlifySiteId) {
    const id = String(siteId ?? '');
    if (!SITE_ID.test(id)) throw new EngineError('Unknown site.', { kind: 'validation' });
    const picked = String(netlifySiteId ?? '').trim();
    if (picked && !SITE_ID.test(picked)) throw new EngineError('That isn’t a Netlify site ID.', { kind: 'validation' });
    await store.update((s) => {
      s.netlify = { ...(s.netlify || {}), siteMap: { ...(s.netlify?.siteMap || {}), [id]: picked } };
    });
    return { ok: true };
  }

  async function deploys(siteId, { fresh = false } = {}) {
    if (!SITE_ID.test(siteId)) throw new EngineError('That isn’t a Netlify site ID.', { kind: 'validation' });
    const t = await token();
    return cache.wrap(`deploys:${siteId}`, 10 * 60_000, fresh, async () => {
      const list = await call(`/sites/${encodeURIComponent(siteId)}/deploys`, t, { query: { per_page: 100 } });
      return (Array.isArray(list) ? list : []).map(publicDeploy);
    });
  }

  // Production deploys as chart annotations, scoped to the matched site. Failed
  // deploys stay on the Timeline too: a broken build is worth seeing next to
  // the traffic that followed it. Registered with annotations.registerSource.
  async function annotations({ from = '', to = '', scopes = null } = {}) {
    if (!(await config()).token) return [];
    const matched = await matches(await store.sites()).catch(() => ({}));
    const list = await sites().catch(() => []);
    const nameOf = (id) => list.find((n) => n.id === id)?.name || id.slice(0, 8);
    const wanted = scopes?.length ? new Set(scopes) : null;
    const since = from ? Date.parse(`${from}T00:00:00Z`) : now() - 365 * DAY;
    const until = to ? Date.parse(`${to}T23:59:59Z`) : now();
    const rows = await Promise.all(Object.entries(matched)
      .filter(([siteId, m]) => m.siteId && (!wanted || wanted.has(`site:${siteId}`)))
      .map(async ([siteId, m]) => (await deploys(m.siteId).catch(() => []))
        .filter((d) => d.context === 'production' && (d.state === 'ready' || FAILURE.has(d.state)) && d.created >= since && d.created <= until)
        .map((d) => ({
          id: `netlify-${d.id}`,
          date: isoDay(d.created),
          at: d.created,
          label: `${FAILURE.has(d.state) ? 'Failed deploy' : 'Deploy'} on ${nameOf(m.siteId)}${d.commit ? `: ${d.commit}` : ''}`.slice(0, 140),
          kind: 'deploy',
          source: 'netlify',
          url: `https://app.netlify.com/sites/${encodeURIComponent(nameOf(m.siteId))}/deploys/${encodeURIComponent(d.id)}`,
          scope: `site:${siteId}`,
        }))));
    return rows.flat();
  }

  const reset = () => {
    cache.clear();
    lastError = '';
    who = null;
  };

  return { status, verify, saveToken, reset, sites, matches, setMatch, deploys, annotations };
}

// Only the fields worth showing; Netlify's /sites also carries build hooks and
// environment keys, which never leave this module.
export function publicSite(s) {
  const netlifyDomain = s.name ? `${s.name}.netlify.app` : '';
  return {
    id: s.id || '',
    name: s.name || '',
    url: s.url || (netlifyDomain ? `https://${netlifyDomain}` : ''),
    customDomain: s.custom_domain || '',
    domains: (s.domain_aliases || []).filter(Boolean),
    netlifyDomain,
  };
}

export function publicDeploy(d) {
  return {
    id: d.id || '',
    siteId: d.site_id || '',
    state: String(d.state || '').toLowerCase(),
    context: String(d.context || 'production').toLowerCase(),
    created: stamp(d.created_at || d.updated_at || d.publish_time),
    published: stamp(d.published_at),
    commit: String(d.commit_msg || '').split('\n')[0].slice(0, 120),
    ref: d.commit_ref || d.branch || '',
    url: d.deploy_url || d.deploy_ssl_url || d.ssl_url || '',
  };
}

export const netlifyHosts = (site) => [site.customDomain, site.url, ...(site.domains || []), site.netlifyDomain].filter(Boolean);

export function matchNetlifySites(sites, netlifySites, siteMap = {}) {
  const out = {};
  for (const site of sites) {
    if (site.demo) continue;
    if (Object.hasOwn(siteMap, site.id)) {
      const manual = siteMap[site.id];
      out[site.id] = { siteId: netlifySites.some((n) => n.id === manual) ? manual : '', manual: true };
      continue;
    }
    const host = bareHost(site.host);
    const hit = host && netlifySites.find((n) => netlifyHosts(n).some((d) => bareHost(d) === host));
    out[site.id] = { siteId: hit ? hit.id : '', manual: false };
  }
  return out;
}

export function netlifyRoutes({ netlify, store }) {
  return [
    ['GET', /^\/api\/netlify\/status$/, async () => netlify.status()],
    ['POST', /^\/api\/netlify\/token$/, async ({ body }) => netlify.saveToken(body.token)],
    ['GET', /^\/api\/netlify\/sites$/, async ({ query }) => {
      const list = await netlify.sites({ fresh: query.has('fresh') });
      const sites = (await store.sites()).filter((s) => !s.demo);
      const matched = await netlify.matches(sites);
      return {
        netlifySites: list,
        sites: sites.map((s) => ({ id: s.id, label: s.label || s.host, host: s.host || '', ...(matched[s.id] || { siteId: '', manual: false }) })),
      };
    }],
    ['POST', /^\/api\/netlify\/match$/, async ({ body }) => netlify.setMatch(body.siteId, body.netlifySiteId)],
    ['GET', /^\/api\/netlify\/sites\/([\w-]{1,80})\/deploys$/, async ({ match, query }) =>
      ({ deploys: await netlify.deploys(match[1], { fresh: query.has('fresh') }) })],
  ];
}
