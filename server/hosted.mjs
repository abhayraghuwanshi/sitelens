// SiteLens Studio, hosted: an invite-only gateway in front of one app per user.
//
//  - Sign-in is Google; the email must be on ALLOWED_EMAILS. The same consent
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
//  - /mcp speaks MCP over HTTP to Claude Code and Claude Desktop. A personal
//    access token (slk_…, made in Account → Claude; only its hash is kept)
//    picks the user, and the tools run against that user's app and folder.
//
// Env: STUDIO_HOST, MASTER_KEY (32 bytes, base64), GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, ALLOWED_EMAILS (comma-separated), STUDIO_DATA_DIR, PORT.

import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import { createApp, selfFetch } from './index.mjs';
import { createMcp } from './mcp.mjs';
import { createStore } from './store.mjs';
import { SCOPES } from './auth.mjs';
import { guardOutgoingFetch } from './net-guard.mjs';

const COOKIE = '__Host-sitelens';
const SESSION_DAYS = 30;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
// What a user's app may see of the server's environment.
const APP_ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'BING_CLIENT_ID', 'BING_CLIENT_SECRET', 'VERCEL_CLIENT_ID', 'VERCEL_CLIENT_SECRET', 'VERCEL_INTEGRATION_SLUG', 'GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET', 'GITHUB_APP_SLUG', 'TZ'];

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

export function parseMasterKey(value) {
  const key = Buffer.from(String(value || ''), 'base64');
  if (key.length !== 32) throw new Error('MASTER_KEY must be 32 random bytes, base64 (openssl rand -base64 32).');
  return key;
}

export function userKey(masterKey, userId) {
  return Buffer.from(hkdfSync('sha256', masterKey, 'sitelens-studio', `user:${userId}`, 32));
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
  allowedEmails,
  port = 8080,
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
  startJobs = true,
  // A user's own app over their own sealed folder; tests swap it.
  createUserApp = (user) => createApp({
    store: createStore(join(dataDir, 'users', user.id), { key: userKey(masterKey, user.id) }),
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
  `);
  const origin = `https://${host}`;
  const apps = new Map(); // user id → app
  const loginStates = new Map(); // state → expires at
  const attempts = new Map(); // client ip → { count, resetAt }
  const mcps = new Map(); // user id → MCP server over that user's app

  function appFor(user) {
    let app = apps.get(user.id);
    if (!app) {
      app = createUserApp(user);
      if (startJobs) for (const job of ['extensions', 'github', 'vitals', 'alerts', 'mentions', 'firebase', 'posts', 'bing', 'aiSearch', 'contentCycles', 'history']) app[job]?.start?.();
      apps.set(user.id, app);
    }
    return app;
  }

  function sessionUser(req) {
    const id = cookies(req)[COOKIE];
    if (!id) return null;
    const row = db.prepare('SELECT u.id, u.email, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ?').get(sha256(id));
    if (!row || row.expires_at < now()) return null;
    // Someone taken off the invite list loses access at once.
    if (!allowedEmails.has(row.email)) return null;
    return { id: row.id, email: row.email };
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
    db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now(), user.id);
    res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}`);
    return user;
  }

  function endSession(req, res) {
    const id = cookies(req)[COOKIE];
    if (id) db.prepare('DELETE FROM sessions WHERE hash = ?').run(sha256(id));
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
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
    const row = db.prepare('SELECT t.id AS token_id, u.id, u.email FROM mcp_tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ?').get(sha256(match[1]));
    if (!row || !allowedEmails.has(row.email)) return null;
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
      return json(401, { error: 'A valid SiteLens access token is required: Account → Claude Code & Claude Desktop.' }, { 'WWW-Authenticate': 'Bearer realm="sitelens"' });
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
      const tokens = db.prepare('SELECT id, label, created_at AS createdAt, last_used AS lastUsed FROM mcp_tokens WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
      return json(200, { url: `${origin}/mcp`, tokens: tokens.map((t) => ({ ...t })) });
    }
    if (url.pathname === '/api/mcp/tokens' && req.method === 'POST') {
      return readBody(req, 10_000).then((raw) => {
        let label = '';
        try {
          label = String(JSON.parse(raw || '{}').label || '').trim().slice(0, 60);
        } catch { /* default label */ }
        if (db.prepare('SELECT COUNT(*) AS n FROM mcp_tokens WHERE user_id = ?').get(user.id).n >= 20) return json(400, { error: 'Up to 20 tokens. Revoke one you no longer use.' });
        const token = `slk_${randomBytes(32).toString('base64url')}`;
        const id = randomBytes(6).toString('hex');
        db.prepare('INSERT INTO mcp_tokens (hash, id, user_id, label, created_at) VALUES (?, ?, ?, ?, ?)').run(sha256(token), id, user.id, label || 'Claude', now());
        // The only time the token itself is ever shown.
        return json(200, { id, token, url: `${origin}/mcp` });
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
    return { email: String(info.email).toLowerCase(), token, consented: pending.consent };
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

  async function handle(req, res) {
    const url = new URL(req.url, origin);
    if (url.pathname === '/healthz') return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');

    const reqHost = String(req.headers.host || '').replace(/:\d+$/, '');
    if (reqHost !== host) return res.writeHead(421, { 'Content-Type': 'text/plain' }).end('Misdirected request');
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

    // Agents, not browsers: a token instead of a session (checked inside).
    if (url.pathname === '/mcp') return handleMcp(req, res);

    // Writes must come from our own pages. (The app also wants X-Studio on /api writes.)
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) {
      return res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Cross-site request refused.');
    }

    if (url.pathname === '/login') {
      if (sessionUser(req)) return res.writeHead(302, { Location: '/' }).end();
      return res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(loginPage(url.searchParams.get('error')));
    }
    if (url.pathname === '/login/google') {
      if (limited(req)) return redirectLogin(res, 'Too many sign-in attempts. Wait a few minutes.');
      const state = randomBytes(18).toString('base64url');
      const consent = url.searchParams.has('consent');
      loginStates.set(state, { expires: now() + 10 * 60_000, consent });
      const params = new URLSearchParams({
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
        const { email, token, consented } = await finishLogin(url.searchParams.get('code'), url.searchParams.get('state'));
        if (!allowedEmails.has(email)) throw new Error(`${email} isn’t invited yet. Ask for an invite, then try again.`);
        const user = startSession(res, email);
        const done = await connectGoogle(user, email, token, consented);
        return res.writeHead(302, { Location: done ? '/' : '/login/google?consent=1' }).end();
      } catch (err) {
        return redirectLogin(res, err.message);
      }
    }
    if (url.pathname === '/logout' && req.method === 'POST') {
      endSession(req, res);
      return res.writeHead(303, { Location: '/login' }).end();
    }

    const user = sessionUser(req);
    if (!user) {
      if (url.pathname.startsWith('/api/')) {
        return res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: 'Sign in to continue.', kind: 'login' }));
      }
      return res.writeHead(302, { Location: '/login' }).end();
    }
    if (url.pathname === '/api/mcp/tokens' || url.pathname.startsWith('/api/mcp/tokens/')) return tokenRoutes(req, res, url, user);
    if (url.pathname === '/api/me') {
      return res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify({ email: user.email, hosted: true }));
    }
    return appFor(user).handle(req, res);
  }

  // Starts every known user's app, so their background syncs keep running.
  function startAll() {
    for (const user of db.prepare('SELECT id, email FROM users').all()) if (allowedEmails.has(user.email)) appFor({ ...user });
  }

  return { handle, startAll, apps, db };
}

function clientIp(req) {
  return String(req.headers['fly-client-ip'] || req.socket?.remoteAddress || '');
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

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function loginPage(error) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · SiteLens Studio</title><link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  :root { color-scheme: light dark; --bg: #f7f7f8; --card: #fff; --text: #17171c; --muted: #62626e; --line: #e3e3e8; --accent: #3b5bdb; --err: #c92a2a; }
  @media (prefers-color-scheme: dark) { :root { --bg: #111114; --card: #1b1b20; --text: #ececf1; --muted: #9a9aa6; --line: #2c2c34; --accent: #748ffc; --err: #ff8787; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; padding: 16px; box-sizing: border-box; }
  main { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 32px; max-width: 360px; width: 100%; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { color: var(--muted); margin: 0 0 24px; }
  a.btn { display: block; text-align: center; background: var(--accent); color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; }
  .err { color: var(--err); margin: 0 0 16px; }
</style></head>
<body><main>
  <h1>SiteLens Studio</h1>
  <p>Invite only. Sign in with the Google account you were invited with.</p>
  ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
  <a class="btn" href="/login/google">Sign in with Google</a>
</main></body></html>`;
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
    allowedEmails: parseEmails(process.env.ALLOWED_EMAILS),
    port,
  });
  gateway.startAll();
  createServer((req, res) => gateway.handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Unexpected server error.');
  })).listen(port, '0.0.0.0', () => console.log(`SiteLens Studio (hosted) → https://${process.env.STUDIO_HOST} on :${port}`));
}
