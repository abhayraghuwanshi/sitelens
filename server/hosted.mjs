// Kauzl, hosted: an invite-only gateway in front of one app per user.
//
//  - Sign-in is Google; the email must be invited: on ALLOWED_EMAILS, or invited
//    from the admin page (/admin, for ADMIN_EMAILS). The same consent
//    connects the user's GA4, Search Console and BigQuery, so it's one step.
//  - A session is a random 256-bit id in an HttpOnly cookie; only its SHA-256
//    is stored, in /data/gateway.db.
//  - Each user gets their own createApp() over their own folder,
//    /data/users/<id>/, whose studio.json (tokens, keys) is sealed with a key
//    derived from MASTER_KEY and the user id. The user id only ever comes from
//    the session, never from the request.
//  - User apps see a short allowlist of env vars, so they can't fall back to
//    (or read) the server's own keys.
//  - Every outgoing fetch is kept off private and internal addresses.
//  - An invited user can share one of their sites, view only, with anyone by
//    email (Setup → People with access). Those people may sign in too (an
//    email-only Google sign-in), and their requests about that site go to the
//    owner's app — reads only, by the allowlist in sharing.mjs. Everything else
//    they do stays in their own app, which can't connect anything or write.
//  - /mcp speaks MCP over HTTP to Claude Code and Claude Desktop. A personal
//    access token (slk_…, made in Account → Claude; only its hash is kept)
//    picks the user, and the tools run against that user's app and folder.
//  - No sign-in needed: /start gives this browser a random 256-bit secret in an
//    HttpOnly cookie. Its folder, /data/users/b-<hash>/, is sealed with a key
//    derived from that secret, so the keys and tokens it holds open only while
//    that browser is here: no background syncs, sharing or MCP for it, and
//    "Forget this browser" deletes the folder. Google sign-in stays for
//    invited accounts.
//  - Early access: anyone can leave an email (/waitlist, from the home and
//    sign-in pages; also anyone not invited who tries to sign in). Admins see
//    the list, who's live, and invite people from /admin.
//
// Env: STUDIO_HOST (STUDIO_OLD_HOSTS: other names, comma-separated, that redirect to it), MASTER_KEY (32 bytes, base64), GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, ALLOWED_EMAILS (comma-separated), ADMIN_EMAILS (comma-separated; default ALLOWED_EMAILS), STUDIO_DATA_DIR, PORT.

import { createServer } from 'node:http';
import { BlockList, isIP } from 'node:net';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { createApp, selfFetch } from './index.mjs';
import { createMcp } from './mcp.mjs';
import { createStore } from './store.mjs';
import { SCOPES } from './auth.mjs';
import { Agent } from 'undici';
import { guardOutgoingFetch } from './net-guard.mjs';
import { homePage } from './home.mjs';
import { privacyPage, termsPage } from './legal.mjs';
import { loginPage, waitlistPage, adminPage, waitlistCsv, signedInPage } from './pages.mjs';
import { siteRequest, viewerUrl, cleanEmail } from './sharing.mjs';

const COOKIE = '__Host-sitelens';
// The public tour (kauzl.com/tour): the design prototype with sample data,
// built by scripts/build-tour.mjs. No app, no data, nothing to sign in to.
// The old live demo (/demo) redirects there and clears its old cookie.
const DEMO_COOKIE = '__Host-kauzl-demo';
// A browser using Kauzl without signing in: the secret that opens its folder.
const BROWSER_COOKIE = '__Host-kauzl-browser';
const BROWSER_DAYS = 400; // the longest a browser keeps a cookie
const BROWSER_IDLE_MS = 30 * 60_000; // an idle browser's app is let go, and its key forgotten
const SESSION_DAYS = 30;
// How long a new MCP token lasts; 0 is never (until revoked). The default limits
// what a token copied out of someone's Claude config is good for.
export const TOKEN_DAYS = [30, 90, 365, 0];
const DEFAULT_TOKEN_DAYS = 90;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
// What a user's app may see of the server's environment.
const APP_ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'BING_CLIENT_ID', 'BING_CLIENT_SECRET', 'VERCEL_CLIENT_ID', 'VERCEL_CLIENT_SECRET', 'VERCEL_INTEGRATION_SLUG', 'GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET', 'GITHUB_APP_SLUG', 'POSTHOG_API_KEY', 'POSTHOG_PROJECT_ID', 'POSTHOG_BASE_URL', 'TZ'];

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
};

// Public pages (the home page, sign-in, and the free tools from tools/ in this
// repo, which live on their own static host and are shown at /tools/ so links
// they earn count for this domain) use the brand's Google Fonts; still no
// inline JS.
const HOME_PLAY_JS = readFileSync(new URL('./home-play.js', import.meta.url), 'utf8');
const TOUR_HTML = readFileSync(new URL('./tour/index.html', import.meta.url), 'utf8');
const TOUR_JS = readFileSync(new URL('./tour/tour.js', import.meta.url), 'utf8');

const PUBLIC_CSP = [
  "default-src 'self'",
  // Google Tag Manager / Analytics on the public pages only (tools/assets/ga.js).
  "script-src 'self' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');
const TOOLS_PASS_HEADERS = ['content-type', 'etag', 'last-modified'];
const STATIC_PREFIX = /^\/(tools|guides)(\/|$)/;

export function robotsTxt(origin, { tools = false } = {}) {
  return `User-agent: *\nDisallow: /api/\nDisallow: /login\nDisallow: /mcp\nDisallow: /admin\n${tools ? `\nSitemap: ${origin}/sitemap.xml\n` : ''}`;
}

export function parseMasterKey(value) {
  const key = Buffer.from(String(value || ''), 'base64');
  if (key.length !== 32) throw new Error('MASTER_KEY must be 32 random bytes, base64 (openssl rand -base64 32).');
  return key;
}

export function userKey(masterKey, userId) {
  return Buffer.from(hkdfSync('sha256', masterKey, 'sitelens-studio', `user:${userId}`, 32));
}

// A browser's folder id and sealing key both come from its cookie secret; the
// server keeps neither. MASTER_KEY is mixed in, so the secret alone is no key either.
export function browserUserFrom(masterKey, secret) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(secret || ''))) return null;
  const id = `b-${createHash('sha256').update(`browser:${secret}`).digest('hex').slice(0, 32)}`;
  const key = Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'base64url'), masterKey, `browser:${id}`, 32));
  return { id, email: '', browser: true, key };
}

export function parseEmails(value) {
  return new Set(String(value || '').split(/[\s,]+/).map((e) => e.trim().toLowerCase()).filter(Boolean));
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function createGateway({
  dataDir,
  masterKey,
  host,
  oldHosts = [],
  allowedEmails: envInvited,
  port = 8080,
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
  startJobs = true,
  // New waitlist entries allowed per hour, all addresses together: a flood
  // from many addresses can't bury real sign-ups.
  waitlistPerHour = 300,
  // A user's own app over their own sealed folder; tests swap it.
  createUserApp = (user) => createApp({
    store: createStore(join(dataDir, 'users', user.id), { key: user.key || userKey(masterKey, user.id) }),
    port,
    env: {
      ...Object.fromEntries(APP_ENV.filter((k) => env[k]).map((k) => [k, env[k]])),
      STUDIO_HOSTED: '1',
      STUDIO_HOST: host,
      GOOGLE_REDIRECT_URI: `https://${host}/auth/callback`,
    },
    fetchImpl,
  }),
}) {
  mkdirSync(join(dataDir, 'users'), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dataDir, 'gateway.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_seen INTEGER);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mcp_tokens (hash TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
      label TEXT NOT NULL, created_at INTEGER NOT NULL, last_used INTEGER);
    CREATE TABLE IF NOT EXISTS shares (owner_id TEXT NOT NULL REFERENCES users(id), site_id TEXT NOT NULL, email TEXT NOT NULL,
      created_at INTEGER NOT NULL, PRIMARY KEY (owner_id, site_id, email));
    CREATE INDEX IF NOT EXISTS shares_email ON shares (email);
    CREATE TABLE IF NOT EXISTS waitlist (email TEXT PRIMARY KEY, source TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invites (email TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS activity (user_id TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user_id, day));
  `);
  // Invited: ALLOWED_EMAILS plus everyone invited from /admin.
  const allowedEmails = new Set(envInvited);
  for (const { email } of db.prepare('SELECT email FROM invites').all()) allowedEmails.add(email);
  const admins = env.ADMIN_EMAILS ? parseEmails(env.ADMIN_EMAILS) : new Set(envInvited);
  // Tokens made before expiry existed keep lasting until revoked (NULL).
  if (!db.prepare('PRAGMA table_info(mcp_tokens)').all().some((c) => c.name === 'expires_at')) db.exec('ALTER TABLE mcp_tokens ADD COLUMN expires_at INTEGER');
  const origin = `https://${host}`;
  const apps = new Map(); // user id → app
  const loginStates = new Map(); // state → expires at
  const attempts = new Map(); // client ip → { count, resetAt }
  const mcps = new Map(); // user id → MCP server over that user's app

  const browserSeen = new Map(); // browser user id → last request
  function appFor(user) {
    if (user.browser) {
      browserSeen.set(user.id, now());
      for (const [id, at] of browserSeen) {
        if (now() - at > BROWSER_IDLE_MS) {
          browserSeen.delete(id);
          apps.delete(id);
        }
      }
    }
    let app = apps.get(user.id);
    if (!app) {
      app = createUserApp(user);
      // A browser's folder opens only while it's here, so nothing runs in the background for it.
      if (startJobs && !user.browser) for (const job of ['extensions', 'github', 'vitals', 'alerts', 'mentions', 'firebase', 'posts', 'bing', 'aiSearch', 'redditCycles', 'history', 'timelineJobs']) app[job]?.start?.();
      apps.set(user.id, app);
    }
    return app;
  }

  const DEMO_CLEAR = `${DEMO_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

  function sessionUser(req) {
    const id = cookies(req)[COOKIE];
    if (!id) return null;
    const row = db.prepare('SELECT u.id, u.email, u.last_seen, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ?').get(sha256(id));
    if (!row || row.expires_at < now()) return null;
    // Someone taken off the invite list (and every share) loses access at once.
    if (!mayEnter(row.email)) return null;
    // Last seen, at most once a minute: the admin page's "live now" and retention.
    if (!row.last_seen || now() - row.last_seen > 60_000) seen(row.id);
    return { id: row.id, email: row.email };
  }

  /* ---------- Sharing a site, view only ---------- */

  // Invited people, and anyone a still-invited owner shared a site with.
  const mayEnter = (email) => allowedEmails.has(email) || sharedWith(email).size > 0;

  // site id → owner, for the sites shared with this email by owners still invited.
  function sharedWith(email) {
    const rows = db.prepare('SELECT s.site_id, u.id AS owner_id, u.email AS owner_email FROM shares s JOIN users u ON u.id = s.owner_id WHERE s.email = ?').all(email);
    return new Map(rows.filter((r) => allowedEmails.has(r.owner_email)).map((r) => [r.site_id, { id: r.owner_id, email: r.owner_email }]));
  }

  const jsonOut = (res, status, body) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
  const VIEW_ONLY = { error: 'View only: this site was shared with you to look at, not to change.', kind: 'view-only' };

  // A viewer's request about a site shared with them, answered by the owner's app.
  async function forwardShared(req, res, url, target, owner) {
    if (!target.allowed) return jsonOut(res, 403, VIEW_ONLY);
    const app = appFor(owner);
    const next = viewerUrl(url);
    req.url = next.pathname + next.search;
    if (target.check !== 'todo') return app.handle(req, res);
    // A to-do asked for by its id: only if it is that site's.
    const answer = await selfFetch(app.handle, `${origin}${req.url}`);
    const body = await answer.json().catch(() => null);
    if (!answer.ok || body?.todo?.site !== target.site) return jsonOut(res, 404, { error: 'Not found' });
    return jsonOut(res, 200, body);
  }

  // The app's state, plus the sites shared with this person (marked, view only).
  async function stateWithShared(user, shared, invited) {
    const own = await (await selfFetch(appFor(user).handle, `${origin}/api/state`)).json();
    // Someone here only to view has no sites of their own (not even the sample).
    if (!invited) own.sites = [];
    const mine = new Set(own.sites.map((s) => s.id));
    const byOwner = new Map();
    for (const [site, owner] of shared) {
      if (mine.has(site)) continue;
      if (!byOwner.has(owner.id)) byOwner.set(owner.id, { owner, ids: new Set() });
      byOwner.get(owner.id).ids.add(site);
    }
    for (const { owner, ids } of byOwner.values()) {
      const theirs = await (await selfFetch(appFor(owner).handle, `${origin}/api/state`)).json().catch(() => ({ sites: [] }));
      for (const site of theirs.sites || []) {
        if (ids.has(site.id) && !site.demo) own.sites.push({ ...site, shared: { by: owner.email } });
      }
    }
    own.viewer = !invited;
    return own;
  }

  // An owner lists, adds and removes the people who can see one of their sites.
  async function shareRoutes(req, res, url, user) {
    if (req.method !== 'GET' && req.headers['x-studio'] !== '1') return jsonOut(res, 403, { error: 'Missing X-Studio header.' });
    let site = url.searchParams.get('site') || '';
    let email = cleanEmail(url.searchParams.get('email'));
    if (req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req, 10_000) || '{}');
        site = String(body.site || '');
        email = cleanEmail(body.email);
        if (!email) return jsonOut(res, 400, { error: 'Enter an email address like name@example.com.' });
      } catch {
        return jsonOut(res, 400, { error: 'Send { site, email }.' });
      }
    }
    const owned = await appFor(user).store.site(site);
    if (!owned || owned.demo) return jsonOut(res, 404, { error: 'That site isn’t one of yours.' });
    const list = () => db.prepare(`SELECT s.email, s.created_at AS addedAt, u.last_seen AS lastSeen
      FROM shares s LEFT JOIN users u ON u.email = s.email WHERE s.owner_id = ? AND s.site_id = ? ORDER BY s.created_at`).all(user.id, site);
    if (req.method === 'GET') return jsonOut(res, 200, { people: list() });
    if (req.method === 'POST') {
      if (email === user.email) return jsonOut(res, 400, { error: 'That’s you: you already have this site.' });
      if (list().length >= 25 && !list().some((p) => p.email === email)) return jsonOut(res, 400, { error: 'Up to 25 people per site. Remove someone first.' });
      db.prepare('INSERT OR IGNORE INTO shares (owner_id, site_id, email, created_at) VALUES (?, ?, ?, ?)').run(user.id, site, email, now());
      return jsonOut(res, 200, { people: list(), signIn: `${origin}/login` });
    }
    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM shares WHERE owner_id = ? AND site_id = ? AND email = ?').run(user.id, site, email);
      return jsonOut(res, 200, { people: list() });
    }
    return jsonOut(res, 405, { error: 'Method not allowed' });
  }

  // A user was active: now (live) and today (the days behind retention).
  function seen(userId) {
    db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now(), userId);
    db.prepare('INSERT OR IGNORE INTO activity (user_id, day) VALUES (?, ?)').run(userId, new Date(now()).toISOString().slice(0, 10));
  }

  function startSession(res, email) {
    let user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) {
      user = { id: randomUUID(), email };
      db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').run(user.id, email, now());
    }
    const id = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
    db.prepare('INSERT INTO sessions (hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(id), user.id, now() + SESSION_DAYS * 86_400_000);
    seen(user.id);
    res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}`);
    return user;
  }

  function endSession(req, res) {
    const id = cookies(req)[COOKIE];
    if (id) db.prepare('DELETE FROM sessions WHERE hash = ?').run(sha256(id));
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  }

  const browserUser = (req) => browserUserFrom(masterKey, cookies(req)[BROWSER_COOKIE]);
  const BROWSER_CLEAR = `${BROWSER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  // "Forget this browser": its folder goes, since nothing else could ever open it.
  function forgetBrowser(user) {
    apps.delete(user.id);
    browserSeen.delete(user.id);
    rmSync(join(dataDir, 'users', user.id), { recursive: true, force: true });
  }

  /* ---------- MCP over HTTP ---------- */

  function mcpFor(user) {
    let mcp = mcps.get(user.id);
    if (!mcp) {
      const app = appFor(user);
      // The tools' API calls stay in-process, inside this user's app.
      mcp = createMcp({ baseUrl: `http://127.0.0.1:${port}`, dataDir: app.store.dir, fetchImpl: (url, init) => selfFetch(app.handle, url, init) });
      mcps.set(user.id, mcp);
    }
    return mcp;
  }

  function tokenUser(req) {
    const match = String(req.headers.authorization || '').match(/^Bearer (slk_[A-Za-z0-9_-]{20,100})$/);
    if (!match) return null;
    const row = db.prepare('SELECT t.id AS token_id, t.expires_at, u.id, u.email FROM mcp_tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ?').get(sha256(match[1]));
    if (!row || !allowedEmails.has(row.email)) return null;
    if (row.expires_at !== null && row.expires_at <= now()) return null;
    db.prepare('UPDATE mcp_tokens SET last_used = ? WHERE id = ?').run(now(), row.token_id);
    return { id: row.id, email: row.email };
  }

  async function handleMcp(req, res) {
    const json = (status, body, headers = {}) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(body));
    // A browser page on another site must not drive it (the spec's DNS-rebinding advice).
    if (req.headers.origin && req.headers.origin !== origin) return json(403, { error: 'Cross-site request refused.' });
    if (req.method !== 'POST') return res.writeHead(405, { Allow: 'POST' }).end();
    if (limitedFailures(req)) return json(429, { error: 'Too many failed attempts. Wait a few minutes.' });
    const user = tokenUser(req);
    if (!user) {
      failed(req);
      return json(401, { error: 'A valid Kauzl access token is required: Account → Claude Code & Claude Desktop.' }, { 'WWW-Authenticate': 'Bearer realm="sitelens"' });
    }
    let body;
    try {
      body = JSON.parse(await readBody(req, 1_000_000));
    } catch {
      return json(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    const mcp = mcpFor(user);
    const messages = Array.isArray(body) ? body : [body];
    const replies = [];
    for (const message of messages) {
      const reply = await mcp.handle(message);
      if (reply) replies.push(reply);
    }
    // Only notifications: accepted, nothing to say.
    if (!replies.length) return res.writeHead(202).end();
    return json(200, Array.isArray(body) ? replies : replies[0]);
  }

  // Tokens a signed-in user makes, lists and revokes for their agents.
  function tokenRoutes(req, res, url, user) {
    const json = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
    if (req.method !== 'GET' && req.headers['x-studio'] !== '1') return json(403, { error: 'Missing X-Studio header.' });
    if (url.pathname === '/api/mcp/tokens' && req.method === 'GET') {
      const tokens = db.prepare('SELECT id, label, created_at AS createdAt, last_used AS lastUsed, expires_at AS expiresAt FROM mcp_tokens WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
      return json(200, { url: `${origin}/mcp`, days: TOKEN_DAYS, defaultDays: DEFAULT_TOKEN_DAYS, tokens: tokens.map((t) => ({ ...t, expired: t.expiresAt !== null && t.expiresAt <= now() })) });
    }
    if (url.pathname === '/api/mcp/tokens' && req.method === 'POST') {
      return readBody(req, 10_000).then((raw) => {
        let label = '';
        let days = DEFAULT_TOKEN_DAYS;
        try {
          const body = JSON.parse(raw || '{}');
          label = String(body.label || '').trim().slice(0, 60);
          if (body.days !== undefined) days = Number(body.days);
        } catch { /* defaults */ }
        if (!TOKEN_DAYS.includes(days)) return json(400, { error: `A token lasts ${TOKEN_DAYS.filter(Boolean).join(', ')} days, or 0 for until revoked.` });
        if (db.prepare('SELECT COUNT(*) AS n FROM mcp_tokens WHERE user_id = ?').get(user.id).n >= 20) return json(400, { error: 'Up to 20 tokens. Revoke one you no longer use.' });
        const token = `slk_${randomBytes(32).toString('base64url')}`;
        const id = randomBytes(6).toString('hex');
        const expiresAt = days ? now() + days * 86_400_000 : null;
        db.prepare('INSERT INTO mcp_tokens (hash, id, user_id, label, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(sha256(token), id, user.id, label || 'Claude', now(), expiresAt);
        // The only time the token itself is ever shown.
        return json(200, { id, token, url: `${origin}/mcp`, expiresAt });
      });
    }
    const revoke = url.pathname.match(/^\/api\/mcp\/tokens\/([a-f0-9]{12})$/);
    if (revoke && req.method === 'DELETE') {
      db.prepare('DELETE FROM mcp_tokens WHERE id = ? AND user_id = ?').run(revoke[1], user.id);
      return json(200, { ok: true });
    }
    return json(404, { error: 'Not found' });
  }

  // Wrong tokens count like sign-in attempts: 20 per address per 10 minutes.
  function failed(req) {
    const ip = clientIp(req);
    const entry = attempts.get(`mcp:${ip}`);
    if (!entry || entry.resetAt < now()) attempts.set(`mcp:${ip}`, { count: 1, resetAt: now() + 10 * 60_000 });
    else entry.count += 1;
  }
  function limitedFailures(req) {
    const entry = attempts.get(`mcp:${clientIp(req)}`);
    return Boolean(entry && entry.resetAt >= now() && entry.count >= 20);
  }

  // 20 sign-in attempts per address per 10 minutes.
  function limited(req) {
    const ip = clientIp(req);
    const entry = attempts.get(ip);
    if (!entry || entry.resetAt < now()) {
      attempts.set(ip, { count: 1, resetAt: now() + 10 * 60_000 });
      return false;
    }
    entry.count += 1;
    return entry.count > 20;
  }

  /* ---------- Early access: the waitlist and invites ---------- */

  const WAITLIST_MAX = 50_000;
  const waitlistBusy = () => db.prepare('SELECT COUNT(*) AS n FROM waitlist WHERE created_at > ?').get(now() - 3_600_000).n >= waitlistPerHour;
  function joinWaitlist(email, source) {
    if (db.prepare('SELECT COUNT(*) AS n FROM waitlist').get().n >= WAITLIST_MAX) return;
    db.prepare('INSERT OR IGNORE INTO waitlist (email, source, created_at) VALUES (?, ?, ?)').run(email, source, now());
  }
  // 10 waitlist posts per address per 10 minutes.
  function waitlistLimited(req) {
    const key = `wl:${clientIp(req)}`;
    const entry = attempts.get(key);
    if (!entry || entry.resetAt < now()) {
      attempts.set(key, { count: 1, resetAt: now() + 10 * 60_000 });
      return false;
    }
    entry.count += 1;
    return entry.count > 10;
  }
  const html = (res, status, page) => res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': PUBLIC_CSP }).end(page);
  const seeOther = (res, location) => res.writeHead(303, { Location: location, 'Cache-Control': 'no-store' }).end();
  const formBody = async (req) => new URLSearchParams(await readBody(req, 4_000).catch(() => ''));

  async function waitlistRoutes(req, res, url) {
    if (req.method === 'POST') {
      if (waitlistLimited(req)) return seeOther(res, `/waitlist?error=${encodeURIComponent('Too many tries. Wait a few minutes.')}`);
      const form = await formBody(req);
      // A field people never see: only bots fill it in. They get the thank-you, and nothing is kept.
      if (form.get('website')) return seeOther(res, '/waitlist?joined=1');
      const email = cleanEmail(form.get('email'));
      if (!email) return seeOther(res, `/waitlist?error=${encodeURIComponent('That doesn’t look like an email address.')}`);
      const from = ['home', 'login', 'waitlist', 'tools', 'guides'].includes(form.get('from')) ? form.get('from') : 'waitlist';
      const known = db.prepare('SELECT 1 FROM waitlist WHERE email = ?').get(email);
      if (!known && waitlistBusy()) return seeOther(res, `/waitlist?error=${encodeURIComponent('Lots of requests right now. Try again in a little while.')}`);
      joinWaitlist(email, from);
      return seeOther(res, `/waitlist?joined=${from}`);
    }
    if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
    return html(res, 200, waitlistPage({ joined: url.searchParams.get('joined') || '', error: url.searchParams.get('error') || '', tools: Boolean(toolsOrigin), ga: tagId, v: await assetVersion() }));
  }

  async function adminRoutes(req, res, url) {
    if (url.pathname === '/admin' && ['GET', 'HEAD'].includes(req.method)) {
      const users = db.prepare('SELECT email, created_at AS createdAt, last_seen AS lastSeen FROM users ORDER BY COALESCE(last_seen, created_at) DESC').all();
      const waitlist = db.prepare('SELECT email, source, created_at AS createdAt FROM waitlist ORDER BY created_at DESC LIMIT 300').all();
      const waitlistTotal = db.prepare('SELECT COUNT(*) AS n FROM waitlist').get().n;
      const invites = db.prepare('SELECT email, created_at AS createdAt FROM invites ORDER BY created_at DESC').all();
      const activity = db.prepare('SELECT u.email, a.day FROM activity a JOIN users u ON u.id = a.user_id').all();
      return html(res, 200, adminPage({ users, waitlist, waitlistTotal, invites, activity, envInvited, now: now(), origin, flash: url.searchParams.get('done') || '' }));
    }
    if (url.pathname === '/admin/waitlist.csv' && req.method === 'GET') {
      const rows = db.prepare('SELECT email, source, created_at AS createdAt FROM waitlist ORDER BY created_at').all();
      return res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="kauzl-waitlist.csv"', 'Cache-Control': 'no-store' }).end(waitlistCsv(rows));
    }
    if (req.method === 'POST' && ['/admin/invite', '/admin/revoke', '/admin/waitlist/remove'].includes(url.pathname)) {
      const email = cleanEmail((await formBody(req)).get('email'));
      if (!email) return seeOther(res, `/admin?done=${encodeURIComponent('That doesn’t look like an email address.')}`);
      let done;
      if (url.pathname === '/admin/invite') {
        db.prepare('INSERT OR IGNORE INTO invites (email, created_at) VALUES (?, ?)').run(email, now());
        allowedEmails.add(email);
        done = `Invited ${email}. Send them the link: “Email the link” below.`;
      } else if (url.pathname === '/admin/revoke') {
        db.prepare('DELETE FROM invites WHERE email = ?').run(email);
        if (!envInvited.has(email)) allowedEmails.delete(email);
        done = envInvited.has(email) ? `${email} is on the server list (ALLOWED_EMAILS), so they stay invited.` : `${email} is no longer invited.`;
      } else {
        db.prepare('DELETE FROM waitlist WHERE email = ?').run(email);
        done = `Removed ${email} from the waitlist.`;
      }
      return seeOther(res, `/admin?done=${encodeURIComponent(done)}`);
    }
    return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }

  async function finishLogin(code, state) {
    const pending = loginStates.get(state);
    loginStates.delete(state);
    if (!pending || pending.expires < now()) throw new Error('That sign-in link expired. Try again.');
    const tokenRes = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${origin}/login/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const token = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !token.access_token) throw new Error('Google sign-in failed. Try again.');
    const infoRes = await fetchImpl(USERINFO_URL, { headers: { Authorization: `Bearer ${token.access_token}` } });
    const info = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok || !info.email || info.email_verified !== true) throw new Error('Google did not confirm an email address.');
    return { email: String(info.email).toLowerCase(), token, consented: pending.consent, viewer: pending.viewer };
  }

  // Signing in also connects Google (GA4, Search Console, BigQuery), so
  // there's no second Google step inside the app. Returns false when Google
  // held back a refresh token and the consent screen has to be shown once.
  async function connectGoogle(user, email, token, consented) {
    const app = appFor(user);
    const previous = (await app.store.get()).auth;
    // Connected a different Google account inside the app: leave it be.
    if (previous?.mode === 'oauth' && previous.email && previous.email !== email) return true;
    const refreshToken = token.refresh_token || (previous?.mode === 'oauth' ? previous.refreshToken : '');
    if (!refreshToken) return consented;
    await app.store.update((s) => {
      s.auth = {
        mode: 'oauth',
        accessToken: token.access_token,
        refreshToken,
        email,
        scopes: String(token.scope || '').split(/\s+/).filter(Boolean),
        expiresAt: now() + (Number(token.expires_in) || 3600) * 1000,
      };
    });
    return true;
  }

  // Public, no session: the free tools, fetched from their static host.
  const toolsOrigin = String(env.TOOLS_ORIGIN || '').replace(/\/$/, '');
  // TOOLS_ORIGIN is the operator's own setting, never a user's URL, so it may be
  // a private address (a local tools server in development, or Fly's private
  // network). Only these fetches skip the net guard; every other fetch keeps it.
  const toolsAgent = toolsOrigin ? new Agent() : null;
  // kauzl.com's own Google tag, on the public pages only; its scripts come from the tools host.
  const tagId = toolsOrigin && /^(GTM|G)-[A-Z0-9]+$/.test(env.GOOGLE_TAG_ID || '') ? env.GOOGLE_TAG_ID : '';
  // The tools build stamps its asset URLs (?v=<hash>). Our own pages load site.js
  // and ga.js from there too, with the same stamp, so a tools deploy reaches
  // visitors at once instead of after a CDN or browser cache runs out.
  // Read from the tools index, at most every 5 minutes.
  const assets = { v: '', at: 0 };
  async function assetVersion() {
    if (!toolsOrigin || now() - assets.at < 5 * 60_000) return assets.v;
    assets.at = now();
    try {
      const page = await fetchImpl(`${toolsOrigin}/tools/`, { dispatcher: toolsAgent });
      const m = page.ok && (await page.text()).match(/assets\/site\.css\?v=([a-f0-9]{6,40})/);
      if (m) assets.v = m[1];
    } catch {}
    return assets.v;
  }
  async function proxyTools(req, res, url) {
    if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    if (url.pathname === '/tools' || url.pathname === '/guides') return res.writeHead(308, { Location: `${url.pathname}/${url.search}` }).end();
    let upstream;
    try {
      upstream = await fetchImpl(`${toolsOrigin}${url.pathname}${url.search}`, { method: req.method, redirect: 'manual', dispatcher: toolsAgent });
    } catch {
      return res.writeHead(502, { 'Content-Type': 'text/plain' }).end('The tools are unavailable right now.');
    }
    const headers = { 'Content-Security-Policy': PUBLIC_CSP };
    for (const h of TOOLS_PASS_HEADERS) { const v = upstream.headers.get(h); if (v) headers[h] = v; }
    const loc = upstream.headers.get('location');
    if (loc) headers.Location = loc.startsWith(toolsOrigin) ? loc.slice(toolsOrigin.length) || '/' : loc;
    // Pages change with each deploy; scripts and styles aren't hashed, so keep it short.
    if (upstream.ok) headers['Cache-Control'] = /text\/html/.test(headers['content-type'] || '') ? 'public, max-age=300' : 'public, max-age=3600';
    const body = req.method === 'HEAD' ? null : Buffer.from(await upstream.arrayBuffer());
    return res.writeHead(upstream.status, headers).end(body);
  }

  async function handle(req, res) {
    const url = new URL(req.url, origin);
    if (url.pathname === '/healthz') return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');

    const reqHost = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
    if (reqHost !== host) {
      if (!oldHosts.includes(reqHost)) return res.writeHead(421, { 'Content-Type': 'text/plain' }).end('Misdirected request');
      // An old or extra name (the pre-rename host, www): agents set up with it
      // keep working, since a token, not a cookie, picks the user; people are
      // sent to the same page on the main host.
      if (url.pathname === '/mcp') return handleMcp(req, res);
      return res.writeHead(308, { Location: `${origin}${url.pathname}${url.search}` }).end();
    }
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

    // The home page hero's script (server/home-play.js, also imported by home.mjs).
    if (url.pathname === '/home-play.js') {
      return res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }).end(HOME_PLAY_JS);
    }
    if (url.pathname === '/robots.txt') {
      return res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }).end(robotsTxt(origin, { tools: Boolean(toolsOrigin) }));
    }
    // The free tools, the guides, the sitemap and llms.txt for all of kauzl.com come from the static host.
    if (toolsOrigin && (STATIC_PREFIX.test(url.pathname) || url.pathname === '/sitemap.xml' || url.pathname === '/llms.txt')) return proxyTools(req, res, url);

    // Agents, not browsers: a token instead of a session (checked inside).
    if (url.pathname === '/mcp') return handleMcp(req, res);

    // Writes must come from our own pages. (The app also wants X-Studio on /api writes.)
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) {
      return res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Cross-site request refused.');
    }

    if (url.pathname === '/waitlist') return waitlistRoutes(req, res, url);
    // Use Kauzl in this browser, no sign-in.
    if (url.pathname === '/start') {
      if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      if (sessionUser(req) || browserUser(req)) return res.writeHead(302, { Location: '/' }).end();
      if (limited(req)) return redirectLogin(res, 'Too many tries. Wait a few minutes.');
      const secret = randomBytes(32).toString('base64url');
      res.setHeader('Set-Cookie', `${BROWSER_COOKIE}=${secret}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${BROWSER_DAYS * 86_400}`);
      return res.writeHead(302, { Location: '/' }).end();
    }
    if (url.pathname === '/login') {
      if (sessionUser(req)) return res.writeHead(302, { Location: '/' }).end();
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': PUBLIC_CSP }).end(loginPage(url.searchParams.get('error'), { tools: Boolean(toolsOrigin), ga: tagId, joined: url.searchParams.get('joined') === 'sign-in', v: await assetVersion() }));
    }
    if (url.pathname === '/login/google') {
      if (limited(req)) return redirectLogin(res, 'Too many sign-in attempts. Wait a few minutes.');
      const state = randomBytes(18).toString('base64url');
      const consent = url.searchParams.has('consent');
      // Someone invited to view a shared site only needs to say who they are.
      const viewer = url.searchParams.has('viewer');
      loginStates.set(state, { expires: now() + 10 * 60_000, consent, viewer });
      const params = new URLSearchParams(viewer ? {
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: `${origin}/login/callback`,
        response_type: 'code',
        scope: 'openid email',
        prompt: 'select_account',
        state,
      } : {
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: `${origin}/login/callback`,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        include_granted_scopes: 'true',
        prompt: consent ? 'consent select_account' : 'select_account',
        state,
      });
      return res.writeHead(302, { Location: `${AUTH_URL}?${params}` }).end();
    }
    if (url.pathname === '/login/callback') {
      if (limited(req)) return redirectLogin(res, 'Too many sign-in attempts. Wait a few minutes.');
      try {
        if (url.searchParams.get('error')) throw new Error('Sign-in was cancelled.');
        const { email, token, consented, viewer } = await finishLogin(url.searchParams.get('code'), url.searchParams.get('state'));
        if (!mayEnter(email)) {
          // They told us who they are, so they're on the waitlist now.
          if (!waitlistBusy()) joinWaitlist(email, 'sign-in');
          const message = `${email} isn’t invited yet. You’re on the waitlist now; we’ll email you when your spot opens.`;
          return res.writeHead(302, { Location: `/login?error=${encodeURIComponent(message)}&joined=sign-in` }).end();
        }
        const firstTime = !db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
        const user = startSession(res, email);
        // Only invited people connect their Google data; viewers just look.
        const done = allowedEmails.has(email) && !viewer ? await connectGoogle(user, email, token, consented) : true;
        if (!done) return res.writeHead(302, { Location: '/login/google?consent=1' }).end();
        // With kauzl.com's analytics on, pass through a page that records the sign-in.
        return res.writeHead(302, { Location: tagId ? `/signed-in?e=${firstTime ? 'sign_up' : 'login'}` : '/' }).end();
      } catch (err) {
        return redirectLogin(res, err.message);
      }
    }
    // The tour, and the old live demo's address pointing to it (?to=<screen> carries over).
    if (url.pathname === '/demo') {
      const to = url.searchParams.get('to');
      res.setHeader('Set-Cookie', DEMO_CLEAR);
      return res.writeHead(301, { Location: `/tour/${to ? `?to=${encodeURIComponent(to)}` : ''}` }).end();
    }
    if (url.pathname === '/tour') return res.writeHead(301, { Location: `/tour/${url.search}` }).end();
    if (url.pathname === '/tour/' || url.pathname === '/tour/tour.js') {
      if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      const js = url.pathname.endsWith('.js');
      // Framed by the home page (same origin), so frame-ancestors is 'self' here.
      return res.writeHead(200, {
        'Content-Type': js ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Content-Security-Policy': PUBLIC_CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
      }).end(js ? TOUR_JS : TOUR_HTML);
    }
    if (url.pathname === '/logout' && req.method === 'POST') {
      const browser = browserUser(req);
      if (browser) forgetBrowser(browser);
      endSession(req, res);
      res.setHeader('Set-Cookie', [res.getHeader('Set-Cookie'), DEMO_CLEAR, browser ? BROWSER_CLEAR : null].flat().filter(Boolean));
      return res.writeHead(303, { Location: browser ? '/home' : '/login' }).end();
    }

    // Public legal pages (Google's OAuth review reads /privacy without signing in).
    if (url.pathname === '/privacy' || url.pathname === '/terms') {
      if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Content-Security-Policy': PUBLIC_CSP })
        .end(url.pathname === '/privacy' ? privacyPage() : termsPage());
    }

    // A signed-in account wins over this browser's no-sign-in folder.
    const user = sessionUser(req) || browserUser(req);
    // The public home page: at /home for everyone, at / for visitors without a session.
    if (url.pathname === '/home' || (!user && url.pathname === '/')) {
      if (!['GET', 'HEAD'].includes(req.method)) return res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': PUBLIC_CSP }).end(homePage({ signedIn: Boolean(user), tools: Boolean(toolsOrigin), ga: env.GOOGLE_TAG_ID, v: await assetVersion() }));
    }
    if (!user) {
      if (url.pathname.startsWith('/api/')) {
        return res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: 'Sign in to continue.', kind: 'login' }));
      }
      return res.writeHead(302, { Location: '/login' }).end();
    }
    if (url.pathname === '/signed-in') {
      if (!tagId) return res.writeHead(302, { Location: '/' }).end();
      return html(res, 200, signedInPage({ event: url.searchParams.get('e') === 'sign_up' ? 'sign_up' : 'login', ga: tagId, v: await assetVersion() }));
    }
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      if (!admins.has(user.email)) return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return adminRoutes(req, res, url);
    }
    // In this browser, no sign-in: their own app, everything it does, nothing tied to an account.
    if (user.browser) {
      if (url.pathname === '/api/me') return jsonOut(res, 200, { email: '', hosted: true, viewer: false, browser: true });
      if (url.pathname === '/api/shares' || url.pathname === '/api/mcp/tokens' || url.pathname.startsWith('/api/mcp/tokens/')) {
        return jsonOut(res, 403, { error: 'Sign in with an invited account to share sites or connect Claude.', kind: 'browser-only' });
      }
      if (url.pathname === '/api/state' && req.method === 'GET') {
        const own = await (await selfFetch(appFor(user).handle, `${origin}/api/state`)).json();
        return jsonOut(res, 200, { ...own, browser: true });
      }
      return appFor(user).handle(req, res);
    }
    const invited = allowedEmails.has(user.email);
    if (url.pathname === '/api/me') {
      return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify({ email: user.email, hosted: true, viewer: !invited }));
    }
    if (invited && (url.pathname === '/api/mcp/tokens' || url.pathname.startsWith('/api/mcp/tokens/'))) return tokenRoutes(req, res, url, user);
    if (invited && url.pathname === '/api/shares') return shareRoutes(req, res, url, user);

    // A site shared with this person: its reads go to the owner's app.
    const shared = sharedWith(user.email);
    if (shared.size) {
      const target = siteRequest(req.method, url);
      if (target && shared.has(target.site)) {
        const mine = invited && (await appFor(user).store.site(target.site));
        if (!mine) return forwardShared(req, res, url, target, shared.get(target.site));
      }
      if (url.pathname === '/api/state' && req.method === 'GET') return jsonOut(res, 200, await stateWithShared(user, shared, invited));
    }
    // Here only to view: their own app answers reads, and can't connect or change anything.
    if (!invited) {
      const read = req.method === 'GET' || req.method === 'HEAD';
      const reaching = /^\/(api\/)?(auth|connect|google|github|vercel|plausible|posthog|mcp|bing\/auth|extensions)(\/|$)/.test(url.pathname);
      if (!read || reaching) return jsonOut(res, 403, VIEW_ONLY);
    }
    return appFor(user).handle(req, res);
  }

  // Starts every known user's app, so their background syncs keep running.
  function startAll() {
    for (const user of db.prepare('SELECT id, email FROM users').all()) if (allowedEmails.has(user.email)) appFor({ ...user });
  }

  return { handle, startAll, apps, db };
}

// Cloudflare's edge addresses (cloudflare.com/ips). kauzl.com is behind
// Cloudflare, so Fly sees Cloudflare, and the visitor is in CF-Connecting-IP.
// The Fly app can also be reached directly, where anyone could set that
// header, so it's trusted only on requests that come from Cloudflare.
const CLOUDFLARE = new BlockList();
for (const net of ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14',
  '172.64.0.0/13', '131.0.72.0/22']) CLOUDFLARE.addSubnet(...net.split('/').map((x, i) => (i ? Number(x) : x)), 'ipv4');
for (const net of ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'])
  CLOUDFLARE.addSubnet(...net.split('/').map((x, i) => (i ? Number(x) : x)), 'ipv6');
const fromCloudflare = (ip) => {
  const v = isIP(ip);
  return Boolean(v) && CLOUDFLARE.check(ip, v === 4 ? 'ipv4' : 'ipv6');
};

export function clientIp(req) {
  const peer = String(req.headers['fly-client-ip'] || req.socket?.remoteAddress || '');
  const visitor = String(req.headers['cf-connecting-ip'] || '').trim();
  return visitor && isIP(visitor) && fromCloudflare(peer) ? visitor : peer;
}

async function readBody(req, max) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function redirectLogin(res, message) {
  res.writeHead(302, { Location: `/login?error=${encodeURIComponent(message)}` }).end();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const name of ['STUDIO_HOST', 'MASTER_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ALLOWED_EMAILS']) {
    if (!process.env[name]) throw new Error(`${name} is not set.`);
  }
  guardOutgoingFetch();
  const port = Number(process.env.PORT) || 8080;
  const gateway = createGateway({
    dataDir: resolve(process.env.STUDIO_DATA_DIR || '/data'),
    masterKey: parseMasterKey(process.env.MASTER_KEY),
    host: process.env.STUDIO_HOST,
    oldHosts: String(process.env.STUDIO_OLD_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
    allowedEmails: parseEmails(process.env.ALLOWED_EMAILS),
    port,
  });
  gateway.startAll();
  createServer((req, res) => gateway.handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Unexpected server error.');
  })).listen(port, '0.0.0.0', () => console.log(`Kauzl (hosted) → https://${process.env.STUDIO_HOST} on :${port}`));
}
