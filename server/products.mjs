// Products: one page that joins a site, its repos and its Chrome extensions on
// a shared daily axis. Config lives in studio.json `products`; every source is
// fetched independently so a missing token or link only blanks its own tiles.

import { runReport } from '../shared/sitelens/ga4.js';
import { hostFilter } from '../shared/sitelens/reports.js';
import { baseDomain } from '../shared/sitelens/site.js';
import { ValidationError } from './store.mjs';
import { historyRange, githubOverview, githubRepoSeries, SourceError } from './github.mjs';
import { listingAnalytics } from './cws-ga.mjs';
import { createCache } from './cache.mjs';

const DAY = 86_400_000;
const TTL = 10 * 60_000;
const EXT_RE = /^[a-p]{32}$/;
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PROJECT_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const SERVICE_RE = /^[a-z][a-z0-9-]{0,62}$/;
const VERCEL_RE = /^prj_[A-Za-z0-9]+$/;

// Who registered the domain (renewals) and who serves the site (deploys).
// `feed`: Studio can read deploys from it; the rest are recorded for context.
export const REGISTRARS = {
  hostinger: { label: 'Hostinger', dashboard: 'https://hpanel.hostinger.com/domains' },
  cloudflare: { label: 'Cloudflare', dashboard: 'https://dash.cloudflare.com/?to=/:account/domains' },
  godaddy: { label: 'GoDaddy', dashboard: 'https://dcc.godaddy.com/control/portfolio' },
  namecheap: { label: 'Namecheap', dashboard: 'https://ap.www.namecheap.com/domains/list/' },
  porkbun: { label: 'Porkbun', dashboard: 'https://porkbun.com/account/domainsSpeedy' },
  squarespace: { label: 'Squarespace (ex-Google Domains)', dashboard: 'https://account.squarespace.com/domains' },
  other: { label: 'Other', dashboard: '' },
};
export const HOSTING = {
  firebase: { label: 'Firebase App Hosting', feed: true },
  vercel: { label: 'Vercel', feed: true },
  hostinger: { label: 'Hostinger', feed: false },
  netlify: { label: 'Netlify', feed: false },
  'cloudflare-pages': { label: 'Cloudflare Pages', feed: false },
  'github-pages': { label: 'GitHub Pages', feed: false },
  other: { label: 'Other / self-hosted', feed: false },
};

function normalizeHosting(input) {
  const provider = String(input?.provider || '').trim();
  if (!provider) return null;
  if (!HOSTING[provider]) throw new ValidationError(`Unknown hosting provider “${provider}”.`);
  const out = { provider };
  if (provider === 'firebase') {
    const project = String(input.firebase?.project || '').trim();
    const service = String(input.firebase?.service || '').trim();
    if (project || service) {
      if (!PROJECT_RE.test(project)) throw new ValidationError('That isn’t a Google Cloud project ID.');
      if (!SERVICE_RE.test(service)) throw new ValidationError('A backend name is lowercase letters, digits and dashes.');
      out.firebase = { project, service, location: String(input.firebase.location || '') };
    }
  }
  if (provider === 'vercel' && input.vercel?.projectId) {
    if (!VERCEL_RE.test(input.vercel.projectId)) throw new ValidationError('That isn’t a Vercel project ID.');
    out.vercel = { projectId: input.vercel.projectId };
  }
  if (input.note) out.note = String(input.note).trim().slice(0, 140);
  return out;
}
// Business goals: what counts as a step towards a result, and what counts as the
// result itself. Site goals are measured from GA4; the rest from synced sources.
export const GOAL_SOURCES = {
  event: { label: 'Site event', site: true },
  page: { label: 'Page visited', site: true },
  installs: { label: 'Store installs' },
  downloads: { label: 'Release downloads' },
  stars: { label: 'New GitHub stars' },
};
const EVENT_RE = /^[A-Za-z][\w]{0,39}$/;

export function normalizeGoals(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const g of input.slice(0, 12)) {
    const source = String(g?.source || '').trim();
    if (!GOAL_SOURCES[source]) throw new ValidationError(`Unknown goal type “${source}”.`);
    let match = String(g.match || '').trim();
    if (source === 'event' && !EVENT_RE.test(match)) throw new ValidationError(`“${match || '(empty)'}” isn’t a GA4 event name.`);
    if (source === 'page') {
      match = match.replace(/^https?:\/\/[^/]+/, '');
      if (!match.startsWith('/') || match.length > 200) throw new ValidationError(`“${match || '(empty)'}” isn’t a page path like /pricing.`);
    }
    if (!GOAL_SOURCES[source].site) match = '';
    const label = String(g.label || '').trim().slice(0, 60) || (match ? match : GOAL_SOURCES[source].label);
    const role = g.role === 'step' ? 'step' : 'outcome';
    const value = Number(g.value);
    const id = slugify(`${source}-${match || source}`) || source;
    if (out.some((x) => x.id === id)) throw new ValidationError(`“${label}” is listed twice.`);
    out.push({ id, label, source, ...(match ? { match } : {}), role, ...(Number.isFinite(value) && value > 0 ? { value: Math.round(value * 100) / 100 } : {}) });
  }
  return out;
}

const COOLDESK_EXTENSION = 'ioggffobciopdddacpclplkeodllhjko';

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const sum = (list) => list.reduce((a, b) => a + (b || 0), 0);
const isoFromGa = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

export function slugify(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function normalizeProduct(input = {}) {
  const label = String(input.label || '').trim().slice(0, 80);
  if (!label) throw new ValidationError('Give the product a name.');
  const id = slugify(input.id || label);
  if (!id) throw new ValidationError('The product name needs at least one letter or digit.');
  const repos = [...new Set((input.repos || []).map((r) => String(r).trim()).filter(Boolean))];
  const bad = repos.find((r) => !REPO_RE.test(r));
  if (bad) throw new ValidationError(`“${bad}” isn’t an owner/name repo.`);
  const extensionIds = [...new Set((input.extensionIds || []).map((e) => String(e).trim()).filter(Boolean))];
  const badExt = extensionIds.find((e) => !EXT_RE.test(e));
  if (badExt) throw new ValidationError(`“${badExt}” isn’t a Chrome extension ID.`);
  const siteId = String(input.siteId || '').trim();
  const domains = [];
  for (const d of input.domains || []) {
    const name = String(d?.name ?? d).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '');
    if (!name || domains.some((x) => x.name === name)) continue;
    if (!DOMAIN_RE.test(name)) throw new ValidationError(`“${name}” isn’t a domain name.`);
    const registrar = String(d?.registrar || '').trim();
    if (registrar && !REGISTRARS[registrar]) throw new ValidationError(`Unknown registrar “${registrar}”.`);
    domains.push(registrar ? { name, registrar } : { name });
  }
  const hosting = normalizeHosting(input.hosting);
  if (hosting?.provider === 'firebase' && hosting.firebase && !siteId) throw new ValidationError('Pick the analytics site too: Firebase request logs are stored per site.');
  if (hosting?.provider === 'vercel' && hosting.vercel && !siteId) throw new ValidationError('Pick the analytics site too: Vercel deploys are matched per site.');
  const keywords = [...new Set((input.keywords || []).map((k) => String(k).trim().toLowerCase()).filter(Boolean))].slice(0, 20);
  const bad2 = keywords.find((k) => k.length < 4 || k.length > 60);
  if (bad2) throw new ValidationError(`Keyword “${bad2}” must be 4–60 characters.`);
  if (!siteId && !repos.length && !extensionIds.length && !domains.length) throw new ValidationError('Pick at least a domain, a site, a repo or an extension.');
  const goals = normalizeGoals(input.goals);
  if (goals.some((g) => GOAL_SOURCES[g.source].site) && !siteId) throw new ValidationError('Site event and page goals need the GA4 site picked under Analytics.');
  return {
    id, label, siteId, repos, extensionIds,
    ...(domains.length ? { domains } : {}),
    ...(hosting ? { hosting } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(goals.length ? { goals } : {}),
  };
}

// The product's range plus the same number of days before it, so one fetch
// yields both the current series and the previous-period totals.
export function spanRange(range) {
  const first = Date.parse(`${range.start}T00:00:00Z`);
  const before = Array.from({ length: range.days }, (_, i) => isoDay(first - (range.days - i) * DAY));
  return { start: before[0], end: range.end, days: range.days * 2, dates: [...before, ...range.dates] };
}

// Splits a doubled-range series into [previous, current] halves.
export function halves(values, days) {
  return [values.slice(0, values.length - days), values.slice(values.length - days)];
}

// Last known snapshot value on or before each day (null before the first one).
export function carrySnapshots(points, field, dates) {
  const sorted = [...points].filter((p) => p[field] !== null && p[field] !== undefined).sort((a, b) => a.date.localeCompare(b.date));
  let i = 0;
  let last = null;
  return dates.map((d) => {
    while (i < sorted.length && sorted[i].date <= d) last = sorted[i++][field];
    return last;
  });
}

export function blankLeadingZeros(values) {
  const first = values.findIndex((v) => v > 0);
  return first < 0 ? values : values.map((v, i) => (i < first ? null : v));
}

// One-click suggestions built from what Studio already tracks.
export function suggestProducts({ products, sites, repos, extensions }) {
  if (products.some((p) => p.id === 'cooldesk')) return [];
  const site = sites.find((s) => !s.demo && baseDomain(String(s.host || '')) === 'cool-desk.com');
  const repo = repos.filter((r) => /\/cooldesk-extension$/i.test(r));
  const ext = extensions.filter((e) => e.id === COOLDESK_EXTENSION).map((e) => e.id);
  if (!site && !repo.length && !ext.length) return [];
  return [{ id: 'cooldesk', label: 'Cooldesk', siteId: site?.id || '', repos: repo, extensionIds: ext }];
}

function failure(err) {
  return { ok: false, error: err.message, kind: err.kind || 'source', hint: err.hint || '' };
}

// Demo series: deterministic, gently growing, weekday-shaped.
function demoSeries(dates, seed, scale) {
  return dates.map((d, i) => {
    const t = Date.parse(`${d}T00:00:00Z`);
    const dow = new Date(t).getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 0.7 : 1;
    const noise = 0.8 + ((Math.sin(t / DAY * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1 * 0.4;
    return Math.max(0, Math.round(scale * weekend * noise * (1 + i / dates.length * 0.15)));
  });
}

export function createProducts({ store, auth, extensions, listingProperty, githubDb }) {
  const cache = createCache();

  async function list() {
    return (await store.get()).products || [];
  }

  async function repoNames() {
    try {
      return githubOverview(githubDb(), '7d').repos.map((r) => r.name);
    } catch {
      return [];
    }
  }

  async function siteSource(site, span, range) {
    if (!site) return { source: { key: 'site', type: 'site', label: 'Site', ...failure(new SourceError('This product’s site was removed.', { kind: 'notfound', hint: 'Pick another site in Settings → Products.' })) } };
    const source = { key: `site:${site.id}`, type: 'site', label: site.label, href: `#/site/${site.id}/overview` };
    try {
      let sessions;
      let users;
      if (site.demo) {
        sessions = demoSeries(span.dates, 1, 180);
        users = sessions.map((v) => Math.round(v * 0.84));
      } else {
        if (!site.propertyId) throw new SourceError('No GA4 property linked to this site.', { kind: 'needs-property', hint: 'Link one in Settings → Sites.' });
        const report = await runReport({
          token: await auth.token(),
          propertyId: site.propertyId,
          body: {
            dateRanges: [{ startDate: span.start, endDate: span.end }],
            dimensions: [{ name: 'date' }],
            metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
            dimensionFilter: hostFilter(site.host, { includeSubdomains: site.includeSubdomains }),
            limit: 1000,
          },
        });
        const byDay = new Map(report.rows.map((r) => [isoFromGa(r.date), r]));
        sessions = span.dates.map((d) => Number(byDay.get(d)?.sessions) || 0);
        users = span.dates.map((d) => Number(byDay.get(d)?.activeUsers) || 0);
      }
      const [prevSessions, curSessions] = halves(sessions, range.days);
      const [prevUsers, curUsers] = halves(users, range.days);
      return {
        source: { ...source, ok: true, demo: Boolean(site.demo) },
        kpis: [
          // Daily active users summed: GA4 doesn't dedupe across days in a date-dimension report.
          { key: 'sessions', label: 'Site sessions', value: sum(curSessions), previous: sum(prevSessions), meta: site.host },
          { key: 'users', label: 'Site users', value: sum(curUsers), previous: sum(prevUsers), meta: 'sum of daily users' },
        ],
        series: { sessions: curSessions, users: curUsers },
      };
    } catch (err) {
      return { source: { ...source, ...failure(err) } };
    }
  }

  async function extensionSource(ext, id, span, range, demo) {
    const label = ext?.label || ext?.title || id;
    const source = { key: `ext:${id}`, type: 'extension', label, href: '#/extensions' };
    if (demo) {
      const installs = demoSeries(span.dates, 2, 6);
      return { source: { ...source, ok: true, demo: true }, installs, views: installs.map((v) => v * 5), users: range.dates.map((_, i) => 400 + i * 2), ratings: { rating: 4.8, ratings: 21 } };
    }
    if (!ext) return { source: { ...source, ...failure(new SourceError('This extension isn’t tracked.', { kind: 'notfound', hint: 'Add it on the Extensions page.' })) } };
    const out = { source: { ...source, ok: true } };
    // Snapshot users/rating are local, so they survive a GA4 failure.
    out.users = carrySnapshots(ext.history || [], 'users', range.dates);
    const latest = (ext.history || []).at(-1);
    out.ratings = latest ? { rating: latest.rating, ratings: latest.ratings } : null;
    try {
      const propertyId = await listingProperty(id);
      const data = await listingAnalytics({ token: await auth.token(), propertyId, range: span });
      out.installs = data.series.installs;
      out.views = data.series.views;
    } catch (err) {
      out.source = { ...out.source, ...failure(err), partial: out.users.some((v) => v !== null) };
    }
    return out;
  }

  function repoSource(names, span, range, demo) {
    const source = { key: `repos`, type: 'repos', label: names.length === 1 ? names[0] : `${names.length} repos`, href: names.length === 1 ? `#/github?repo=${encodeURIComponent(names[0])}` : '#/github' };
    try {
      let repos;
      if (demo) {
        let stars = 120;
        repos = [{ name: 'demo/app', series: { stars: demoSeries(span.dates, 3, 1).map((v) => (stars += v > 0 ? 1 : 0)), downloads: demoSeries(span.dates, 4, 14), views: demoSeries(span.dates, 5, 40) } }];
      } else {
        repos = githubRepoSeries(githubDb(), names, span);
      }
      const missing = names.filter((n) => !repos.some((r) => r.name === n));
      const total = (field) => span.dates.map((_, i) => sum(repos.map((r) => r.series[field][i])));
      const [prevStars, curStars] = halves(total('stars'), range.days);
      const [prevDownloads, curDownloads] = halves(total('downloads'), range.days);
      const [, curViews] = halves(total('views'), range.days);
      const starsNow = curStars.at(-1) || 0;
      // No snapshot before the range: count gains from the first one inside it, like the GitHub page.
      const starsBefore = prevStars.at(-1) || curStars.find((v) => v > 0) || starsNow;
      return {
        source: {
          ...source,
          ok: repos.length > 0,
          demo,
          ...(missing.length ? { error: `No synced data for ${missing.join(', ')}.`, kind: 'notfound', hint: 'Check the repo name, or wait for the next GitHub sync.' } : {}),
        },
        kpis: repos.length
          ? [
              { key: 'stars', label: 'Stars', value: starsNow, meta: starsNow - starsBefore > 0 ? `+${starsNow - starsBefore} this period` : 'no new stars' },
              { key: 'downloads', label: 'Release downloads', value: sum(curDownloads), previous: sum(prevDownloads) },
            ]
          : [],
        // Days before the first star snapshot are unknown, not zero.
        series: repos.length ? { stars: blankLeadingZeros(curStars), downloads: curDownloads, repoViews: curViews } : {},
      };
    } catch (err) {
      return { source: { ...source, ...failure(err) } };
    }
  }

  async function view(product, rangeKey) {
    const range = historyRange(rangeKey);
    const span = spanRange(range);
    const sites = await store.sites();
    const site = product.siteId ? sites.find((s) => s.id === product.siteId) || null : undefined;
    const demo = Boolean(site?.demo) && !product.extensionIds.length && !product.repos.length;
    const tracked = await extensions.list();

    const parts = [];
    const series = {};
    const kpis = [];
    if (site !== undefined) parts.push(siteSource(site, span, range));
    const extIds = demo ? ['demo'] : product.extensionIds;
    const exts = await Promise.all(extIds.map((id) => extensionSource(tracked.find((e) => e.id === id), id, span, range, demo)));
    const repo = product.repos.length || demo ? repoSource(demo ? ['demo/app'] : product.repos, span, range, demo) : null;

    const sources = [];
    for (const part of await Promise.all(parts)) {
      sources.push(part.source);
      kpis.push(...(part.kpis || []));
      Object.assign(series, part.series || {});
    }

    if (exts.length) {
      for (const e of exts) sources.push(e.source);
      const withInstalls = exts.filter((e) => e.installs);
      if (withInstalls.length) {
        const installs = span.dates.map((_, i) => sum(withInstalls.map((e) => e.installs[i])));
        const views = span.dates.map((_, i) => sum(withInstalls.map((e) => e.views[i])));
        const [prevInstalls, curInstalls] = halves(installs, range.days);
        const [prevViews, curViews] = halves(views, range.days);
        const visits = sum(curViews);
        kpis.push({ key: 'installs', label: 'Store installs', value: sum(curInstalls), previous: sum(prevInstalls), meta: visits ? `${((sum(curInstalls) / visits) * 100).toFixed(1)}% of listing views` : 'from the listing page' });
        series.installs = curInstalls;
        series.listingViews = curViews;
      }
      const withUsers = exts.filter((e) => e.users?.some((v) => v !== null));
      if (withUsers.length) {
        const users = range.dates.map((_, i) => (withUsers.some((e) => e.users[i] !== null) ? sum(withUsers.map((e) => e.users[i])) : null));
        const known = users.filter((v) => v !== null);
        kpis.push({ key: 'storeUsers', label: 'Store users', value: known.at(-1), meta: known.length > 1 && known.at(-1) !== known[0] ? `${known.at(-1) - known[0] >= 0 ? '+' : ''}${known.at(-1) - known[0]} since ${range.dates[users.indexOf(known[0])]}` : 'Web Store listing' });
        series.storeUsers = users;
      }
      const rated = exts.map((e) => e.ratings).filter((r) => r?.rating);
      if (rated.length) {
        const count = sum(rated.map((r) => r.ratings || 0));
        const rating = count ? sum(rated.map((r) => r.rating * (r.ratings || 0))) / count : rated[0].rating;
        kpis.push({ key: 'rating', label: 'Rating', value: Math.round(rating * 10) / 10, format: 'rating', meta: count ? `${count} ratings` : '' });
      }
    }

    if (repo) {
      sources.push(repo.source);
      kpis.push(...(repo.kpis || []));
      Object.assign(series, repo.series || {});
    }

    const scopes = [
      ...(site ? [`site:${site.id}`] : []),
      ...product.repos.map((r) => `repo:${r}`),
      ...product.extensionIds.map((e) => `ext:${e}`),
    ];
    return { product, range, demo: demo || Boolean(site?.demo), sources, kpis, series, scopes };
  }

  return {
    list,
    async options() {
      const [sites, products, exts] = [await store.sites(), await list(), await extensions.list()];
      const repos = await repoNames();
      return {
        products,
        suggestions: suggestProducts({ products, sites, repos, extensions: exts }),
        options: {
          sites: sites.map((s) => ({ id: s.id, label: s.label, host: s.host, demo: Boolean(s.demo) })),
          repos,
          extensions: exts.map((e) => ({ id: e.id, label: e.label || e.title || e.id })),
        },
      };
    },
    async save(input) {
      const product = normalizeProduct(input);
      await store.update((s) => {
        s.products ||= [];
        let i = s.products.findIndex((p) => p.id === (input.previousId || product.id));
        // A new product never replaces another one that happens to share its name.
        if (i >= 0 && !input.previousId) {
          for (let n = 2; s.products.some((p) => p.id === product.id); n++) product.id = `${slugify(input.id || product.label)}-${n}`;
          i = -1;
        }
        if (i >= 0) s.products[i] = product;
        else s.products.push(product);
      });
      cache.clear(`product:${product.id}:`);
      return product;
    },
    async remove(id) {
      await store.update((s) => {
        s.products = (s.products || []).filter((p) => p.id !== id);
      });
      cache.clear(`product:${id}:`);
    },
    async get(id, rangeKey, { fresh = false } = {}) {
      const product = (await list()).find((p) => p.id === id);
      if (!product) throw new SourceError('Unknown product.', { kind: 'notfound' });
      const key = `product:${id}:${rangeKey}:${historyRange(rangeKey).end}`;
      const data = await cache.wrap(key, TTL, fresh, () => view(product, rangeKey));
      // Don't keep a failed source around for 10 minutes: the fix is usually one click away.
      if (data.sources.some((s) => s.error)) cache.clear(key);
      return data;
    },
  };
}

export function productRoutes({ products, ...deps }) {
  products ||= createProducts(deps);
  return [
    ['GET', /^\/api\/products$/, async () => products.options()],
    ['POST', /^\/api\/products$/, async ({ body }) => products.save(body)],
    ['DELETE', /^\/api\/products\/([\w-]+)$/, async ({ match }) => {
      await products.remove(match[1]);
      return { ok: true };
    }],
    ['GET', /^\/api\/products\/([\w-]+)$/, async ({ match, query }) =>
      products.get(match[1], query.get('range') || '28d', { fresh: query.has('fresh') })],
  ];
}
