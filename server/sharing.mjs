// Sharing a site, view only (hosted). An owner adds people by email to one of
// their sites; the gateway (hosted.mjs) then sends those people's requests for
// that site to the owner's app. This file decides, for one request, which site
// it is about and whether a viewer may make it. It is an allowlist: a request
// about a shared site that isn't listed here as a read is refused, and a
// request that names no site never reaches the owner's app.

const ID = '([\\w-]{1,64})';

// Reads under a site's own paths.
const SITE_PATHS = [
  new RegExp(`^/api/sites/${ID}(?:/[\\w./-]*)?$`),
  new RegExp(`^/api/(?:ai-search|bing|firebase|vitals)/sites/${ID}(?:/[\\w./-]*)?$`),
  new RegExp(`^/api/vercel/sites/${ID}/compare$`),
];

// Lists that take the site as ?site=, and only show that site when it's given.
const SITE_PARAM = new Set([
  '/api/alerts', '/api/todos', '/api/calendar', '/api/calendar/day', '/api/calendar/metrics',
  '/api/calendar/breakdown', '/api/calendar/events', '/api/outcomes/goals',
]);

// Reads that are POSTs because they carry a query in the body.
const READ_POSTS = [new RegExp(`^/api/sites/${ID}/warehouse/funnel$`)];

// Never for viewers, even as GET: they spend the owner's money, reach their
// accounts, or only serve the owner's Setup (where the config lives, drafts of it).
const NEVER = [/\/warehouse\/sql$/, /\/warehouse\/rollup$/, /\/warehouse\/estimate$/, /^\/api\/sites\/[\w-]+\/setup$/, /\/config\/draft$/];

/**
 * Which site a request is about, and whether a viewer may make it.
 * Returns null when it names no site (it then stays in the viewer's own app),
 * else { site, allowed, check? } — `check` asks the gateway to confirm the
 * answer belongs to that site (a to-do fetched by its own id).
 */
export function siteRequest(method, url) {
  const path = url.pathname;
  const read = method === 'GET' || method === 'HEAD';
  for (const re of READ_POSTS) {
    const m = re.exec(path);
    if (m) return { site: m[1], allowed: method === 'POST' };
  }
  for (const re of SITE_PATHS) {
    const m = re.exec(path);
    if (m) return { site: m[1], allowed: read && !NEVER.some((n) => n.test(path)) };
  }
  const site = url.searchParams.get('site');
  if (site && site !== 'all') {
    if (SITE_PARAM.has(path)) return { site, allowed: read };
    // One to-do by its id: allowed once the gateway sees it belongs to the site.
    if (/^\/api\/todos\/todo-\w+$/.test(path)) return { site, allowed: read, check: 'todo' };
    return { site, allowed: false };
  }
  // Notes, scoped like site:<id>: only when every scope is that one site.
  if (path === '/api/annotations') {
    const scopes = (url.searchParams.get('scope') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ids = [...new Set(scopes.map((s) => /^site:([\w-]{1,64})$/.exec(s)?.[1] || ''))];
    if (ids.length === 1 && ids[0]) return { site: ids[0], allowed: read };
  }
  return null;
}

// The URL a viewer's request is sent on with: never ?fresh (it re-runs queries
// on the owner's bill), otherwise as asked.
export function viewerUrl(url) {
  const next = new URL(url);
  next.searchParams.delete('fresh');
  return next;
}

const EMAIL = /^[^\s@,<>"']{1,64}@[^\s@,<>"']{1,190}\.[^\s@,<>"']{2,}$/;
export function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL.test(email) ? email : '';
}
