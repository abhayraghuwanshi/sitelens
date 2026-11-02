// Suggested funnels: which conversion events a site has, and what usually
// happens before them. Two inputs:
//   - the GA4 export: per session, when each event first fired (the real order)
//   - the site's own code on GitHub, when a repo's homepage is the site: which
//     events it tracks and which component fires them, so steps from the same
//     flow (Downloads.tsx: download_intent_click → download_cta_click) group up
// Only events that actually fired become steps; code alone never invents one.

import { gunzipSync } from 'node:zlib';
import { basename, extname } from 'node:path';

const API = 'https://api.github.com';
const CODE_FILE = /\.(m?[jt]sx?|astro|vue|svelte|html?)$/i;
const SKIP_PATH = /(^|\/)(node_modules|dist|build|out|vendor|coverage|\.next|\.astro)\/|\.min\.js$|\.d\.ts$/;
const MAX_FILE = 300_000;
const MAX_TARBALL = 60_000_000;
const CODE_TTL = 60 * 60_000;

// Event names passed to the usual analytics calls: gtag('event', 'x'),
// trackEvent('x'), track*(…, 'x'), logEvent(analytics, 'x'), posthog.capture('x'),
// plausible('x'), dataLayer.push({ event: 'x' }).
const NAME = `['"\`]([A-Za-z][\\w-]{1,60})['"\`]`;
const EVENT_CALLS = [
  new RegExp(`gtag\\(\\s*['"]event['"]\\s*,\\s*${NAME}`, 'g'),
  new RegExp(`\\b(?:track\\w*|logEvent|capture|sendEvent|plausible)\\(\\s*(?:[\\w.]+\\s*,\\s*)?${NAME}`, 'g'),
  new RegExp(`dataLayer\\.push\\(\\s*\\{[^}]*?\\bevent\\s*:\\s*${NAME}`, 'g'),
];

export function scanEvents(text) {
  const found = new Set();
  for (const re of EVENT_CALLS) {
    for (const m of String(text).matchAll(re)) found.add(m[1]);
  }
  return [...found];
}

// Minimal ustar reader: GitHub tarballs are plain files plus pax headers for long paths.
export function* tarEntries(buf) {
  let offset = 0;
  let paxPath = '';
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const str = (a, b) => header.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(str(124, 136).trim() || '0', 8);
    const type = str(156, 157);
    const prefix = str(345, 500);
    const name = paxPath || (prefix ? `${prefix}/${str(0, 100)}` : str(0, 100));
    const body = buf.subarray(offset + 512, offset + 512 + size);
    paxPath = '';
    if (type === 'x') paxPath = /\d+ path=([^\n]+)\n/.exec(body.toString('utf8'))?.[1] || '';
    else if (type === '0' || type === '') yield { path: name.replace(/^[^/]+\//, ''), size, body };
    offset += 512 + Math.ceil(size / 512) * 512;
  }
}

// event name → files that fire it, from a gzipped GitHub tarball.
export function scanTarball(gz) {
  const events = new Map();
  for (const entry of tarEntries(gunzipSync(gz))) {
    if (!CODE_FILE.test(entry.path) || SKIP_PATH.test(entry.path) || entry.size > MAX_FILE) continue;
    for (const name of scanEvents(entry.body.toString('utf8'))) {
      if (!events.has(name)) events.set(name, []);
      events.get(name).push(entry.path);
    }
  }
  return events;
}

const bareHost = (h) => String(h || '').toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '').replace(/^www\./, '');

export function homepageMatches(homepage, host) {
  const a = bareHost(homepage);
  const b = bareHost(host);
  return Boolean(a && b) && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));
}

/* ---------- suggestions (pure) ---------- */

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};

// How much an event looks like an outcome, by name: 3 = done (download, sign-up,
// purchase), 2 = asked for it (CTA, intent), 1 = some other click, 0 = viewing.
export function goalTier(name) {
  const n = name.toLowerCase();
  if (/(view|section|preview|scroll|hover|impression|faq|_open$|toggle|video|play|watch)/.test(n)) return 0;
  if (/(purchase|checkout|sign_?up|register|subscribe|install|file_download|generate_lead|form_submit|trial|conversion|download_complete)/.test(n)) return 3;
  if (/(download|cta|intent|copy|contact|lead|get_started|os_select)/.test(n)) return 2;
  if (/click/.test(n) && !/(nav|internal|outbound|github|link)/.test(n)) return 1;
  return 0;
}

// Each name's first time is after the previous one's (first times only, so a
// lower bound on what the funnel query counts).
function inOrder(session, names) {
  let prev = -Infinity;
  for (const name of names) {
    const ts = session.events.find((e) => e.name === name)?.ts;
    if (ts === undefined || ts <= prev) return false;
    prev = ts;
  }
  return true;
}

const humanize = (name) => name.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const component = (path) => basename(path, extname(path)).replace(/([a-z])([A-Z])/g, '$1 $2');

// sessions: [{ landing, start, events: [{ name, ts }] }] with each event's first time.
// code: Map name → files (may be empty).
export function suggestFunnels(sessions, code = new Map(), { max = 4 } = {}) {
  const total = sessions.length;
  const reach = new Map();
  for (const s of sessions) for (const e of s.events) reach.set(e.name, (reach.get(e.name) || 0) + 1);

  const ranked = [...reach.entries()]
    .map(([name, n]) => ({ name, n, tier: goalTier(name) }))
    .filter((g) => g.tier > 0 && g.n >= 2)
    .sort((a, b) => b.tier - a.tier || b.n - a.n);
  const topTier = ranked[0]?.tier || 0;
  const goals = ranked.filter((g) => g.tier >= Math.min(2, topTier));

  const files = (name) => code.get(name) || [];
  const shareFile = (a, b) => files(a).some((f) => files(b).includes(f));
  const funnels = [];
  const seen = new Set();

  for (const goal of goals) {
    if (funnels.length >= max) break;
    // A step of a stronger funnel already shows how this one converts.
    if (funnels.some((f) => f.steps.some((st) => st.value === goal.name))) continue;
    const withGoal = sessions
      .map((s) => ({ s, at: s.events.find((e) => e.name === goal.name)?.ts }))
      .filter((x) => x.at !== undefined);

    // What came before the goal in those sessions, and how early.
    const before = new Map();
    for (const { s, at } of withGoal) {
      const start = s.start ?? s.events[0]?.ts ?? at;
      for (const e of s.events) {
        if (e.name === goal.name || e.ts >= at) continue;
        const row = before.get(e.name) || { name: e.name, n: 0, offsets: [] };
        row.n += 1;
        row.offsets.push(e.ts - start);
        before.set(e.name, row);
      }
    }
    const candidates = [...before.values()]
      .map((r) => ({
        ...r,
        share: r.n / withGoal.length,
        // Events every session fires anyway say little about this flow.
        lift: r.n / withGoal.length / ((reach.get(r.name) || 1) / total),
        sameCode: shareFile(r.name, goal.name),
      }))
      .filter((r) => r.n >= 2 && r.share >= 0.25 && (r.lift >= 1.2 || r.sameCode) && goalTier(r.name) <= goal.tier)
      .sort((a, b) => Number(b.sameCode) - Number(a.sameCode) || b.share - a.share);

    // The funnel is strictly ordered, so a step only stays if at least half the
    // goal sessions still pass every step in that order with it added.
    const byTime = (rows) => [...rows].sort((a, b) => median(a.offsets) - median(b.offsets));
    const passing = (rows) => withGoal.filter(({ s }) => inOrder(s, [...byTime(rows).map((r) => r.name), goal.name])).length;
    const need = Math.max(2, withGoal.length / 2);
    let steps = [];
    for (const candidate of candidates.slice(0, 8)) {
      if (steps.length >= 4) break;
      if (passing([...steps, candidate]) >= need) steps = [...steps, candidate];
    }
    steps = byTime(steps);

    const landings = new Map();
    for (const { s } of withGoal) if (s.landing) landings.set(s.landing, (landings.get(s.landing) || 0) + 1);
    const [landing, landingN = 0] = [...landings.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    const entry = landing && landingN / withGoal.length >= 0.5 ? [{ kind: 'page', value: landing }] : [];

    const funnelSteps = [...entry, ...steps.map((r) => ({ kind: 'event', value: r.name })), { kind: 'event', value: goal.name }];
    if (funnelSteps.length < 2) continue;
    const key = JSON.stringify(funnelSteps);
    if (seen.has(key)) continue;
    seen.add(key);

    // Name it after the component that fires the goal, not a shared tracking helper.
    const goalFile = files(goal.name).find((f) => !/(analytics|tracking|track|gtag|utils?|helpers?|index)\.\w+$/i.test(f));
    const lead = steps.length ? steps.reduce((a, b) => (b.share > a.share ? b : a)) : null;
    funnels.push({
      name: goalFile ? `${component(goalFile)}: ${humanize(goal.name).toLowerCase()}` : humanize(goal.name),
      goal: goal.name,
      steps: funnelSteps,
      goalSessions: withGoal.length,
      why: [
        `${goal.name} fired in ${withGoal.length} of ${total} sessions with tracked events.`,
        lead ? `${lead.name} came before it in ${Math.round(lead.share * 100)}% of those.` : '',
        entry.length ? `${Math.round((landingN / withGoal.length) * 100)}% of them landed on ${landing}.` : '',
        goalFile ? `Fired from ${goalFile}.` : '',
      ].filter(Boolean).join(' '),
    });
  }
  return funnels;
}

/* ---------- wiring ---------- */

// GitHub REST call with the user's token; throws on any non-2xx.
export async function githubGet(fetchImpl, path, token) {
  const res = await fetchImpl(`${API}${path}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
  return res;
}

// Repos whose homepage is this site, plus repos a product links to it.
// Repos picked in the site's settings or a product, the one its Vercel project deploys from.
export async function linkedRepos({ store, site, vercel = null }) {
  const fromVercel = vercel ? await vercel.repoFor(site) : '';
  const fromProducts = ((await store.get()).products || []).filter((p) => p.siteId === site.id).flatMap((p) => p.repos || []);
  return [...new Set([...(site.repos || []), ...(fromVercel ? [fromVercel] : []), ...fromProducts])];
}

// Those, plus any of the user's repos whose homepage is the site.
export async function siteRepos({ store, site, token, vercel = null, fetchImpl = fetch }) {
  const linked = await linkedRepos({ store, site, vercel });
  const repos = new Map(linked.map((r) => [r, { name: r, pushedAt: '' }]));
  for (let page = 1; page <= 3; page++) {
    const list = await (await githubGet(fetchImpl, `/user/repos?per_page=100&page=${page}&sort=pushed&affiliation=owner,collaborator,organization_member`, token)).json();
    for (const r of list) {
      if (repos.has(r.full_name)) Object.assign(repos.get(r.full_name), { pushedAt: r.pushed_at, branch: r.default_branch });
      else if (!r.archived && homepageMatches(r.homepage, site.host)) repos.set(r.full_name, { name: r.full_name, pushedAt: r.pushed_at, branch: r.default_branch });
    }
    if (list.length < 100) break;
  }
  return [...repos.values()];
}

export function createFunnelSuggest({ store, engines, getToken, vercel = null, fetchImpl = fetch, now = Date.now }) {
  const codeCache = new Map(); // repo → { at, pushedAt, events }
  const gh = (path, token) => githubGet(fetchImpl, path, token);

  async function repoEvents(repo, token) {
    const hit = codeCache.get(repo.name);
    if (hit && (hit.pushedAt === repo.pushedAt && repo.pushedAt ? true : now() - hit.at < CODE_TTL)) return hit.events;
    const res = await gh(`/repos/${repo.name}/tarball`, token);
    if (Number(res.headers.get('content-length')) > MAX_TARBALL) throw new Error(`${repo.name} is too large to scan`);
    const events = scanTarball(Buffer.from(await res.arrayBuffer()));
    codeCache.set(repo.name, { at: now(), pushedAt: repo.pushedAt, events });
    return events;
  }

  // Merged event → files across the site's repos, and what was read.
  async function codeFor(site) {
    const token = await getToken();
    if (!token) return { events: new Map(), repos: [], note: 'Add a GitHub token in Settings → GitHub so Studio can also read your site’s code.' };
    let repos;
    try {
      repos = await siteRepos({ store, site, token, vercel, fetchImpl });
    } catch (err) {
      return { events: new Map(), repos: [], note: `Couldn’t list your GitHub repos: ${err.message}` };
    }
    if (!repos.length) return { events: new Map(), repos: [], note: `No GitHub repo has ${site.host} as its homepage, so only the data was used. Pick the site’s repos in Settings → Sites.` };
    const events = new Map();
    const read = [];
    const failed = [];
    for (const repo of repos) {
      try {
        const found = await repoEvents(repo, token);
        read.push({ name: repo.name, events: found.size });
        for (const [name, files] of found) events.set(name, [...(events.get(name) || []), ...files.map((f) => `${repo.name.split('/')[1]}/${f}`)]);
      } catch (err) {
        failed.push(`${repo.name} (${err.message})`);
      }
    }
    return { events, repos: read, note: failed.length ? `Couldn’t read ${failed.join(', ')}.` : '' };
  }

  async function suggest(site, rangeKey, flags = {}) {
    const [data, code] = await Promise.all([engines.funnelDiscovery(site, rangeKey, flags), site.demo ? { events: new Map(), repos: [], note: '' } : codeFor(site)]);
    const funnels = suggestFunnels(data.sessions, code.events);
    const fired = new Set(data.sessions.flatMap((s) => s.events.map((e) => e.name)));
    return {
      ...data.meta,
      funnels,
      sessions: data.sessions.length,
      code: {
        repos: code.repos,
        note: code.note,
        tracked: code.events.size,
        // In the code but not in this range's data: renamed, removed, or a page nobody reached.
        unseen: [...code.events.keys()].filter((n) => !fired.has(n)).sort(),
      },
    };
  }

  return { suggest };
}

export function funnelSuggestRoutes({ funnelSuggest, siteOr404 }) {
  return [
    ['GET', /^\/api\/sites\/([\w-]+)\/warehouse\/funnel-suggestions$/, async ({ match, query }) =>
      funnelSuggest.suggest(await siteOr404(match[1]), query.get('range') || '28d', { fresh: query.get('fresh') === '1' })],
  ];
}
