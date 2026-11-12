import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtemp, rm, readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createGateway, userKey, parseEmails, parseMasterKey } from '../server/hosted.mjs';
import { createStore } from '../server/store.mjs';
import { isPrivateAddress } from '../server/net-guard.mjs';
import { selfFetch } from '../server/index.mjs';

const HOST = 'sitelens.test';
const ORIGIN = `https://${HOST}`;
const SECRET = 'SENTINEL-SECRET-7f3a';
let dir;
let server;
let base;
let gateway;
const masterKey = randomBytes(32);

// Google's token and userinfo endpoints, faked: the code is the email.
async function fakeFetch(url, init = {}) {
  const u = String(url);
  if (u === 'https://oauth2.googleapis.com/token') {
    const code = new URLSearchParams(String(init.body)).get('code');
    return Response.json({ access_token: `at:${code}`, refresh_token: `rt:${code}`, expires_in: 3599, scope: 'openid email https://www.googleapis.com/auth/analytics.readonly' });
  }
  if (u === 'https://openidconnect.googleapis.com/v1/userinfo') {
    const email = String(init.headers.Authorization).replace('Bearer at:', '');
    return Response.json({ email, email_verified: true });
  }
  // Anything else fails without echoing the URL (which may carry a token).
  throw new Error('offline');
}

function call(path, { method = 'GET', headers = {}, body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(`${base}${path}`, {
      method,
      headers: { host: HOST, ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const write = (path, body, cookie) => call(path, { method: 'POST', body, cookie, headers: { origin: ORIGIN, 'x-studio': '1' } });

// Each sign-in from its own address, so the sign-in rate limit stays out of the way.
let signIns = 0;
async function signIn(email) {
  const headers = { 'fly-client-ip': `198.51.100.${++signIns}` };
  const start = await call('/login/google', { headers });
  const state = new URL(start.headers.location).searchParams.get('state');
  const done = await call(`/login/callback?code=${encodeURIComponent(email)}&state=${state}`, { headers });
  const cookie = String(done.headers['set-cookie'] || '').split(';')[0];
  return { done, cookie };
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'studio-hosted-'));
  gateway = createGateway({
    dataDir: dir,
    masterKey,
    host: HOST,
    allowedEmails: parseEmails('alice@example.com, Bob@Example.com, bob2@example.com'),
    env: { GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'csecret', ANTHROPIC_API_KEY: SECRET, GITHUB_TOKEN: SECRET, MASTER_KEY: SECRET },
    fetchImpl: fakeFetch,
    startJobs: false,
  });
  server = createServer((req, res) => gateway.handle(req, res));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('master key must be 32 bytes', () => {
  assert.throws(() => parseMasterKey('short'));
  assert.equal(parseMasterKey(randomBytes(32).toString('base64')).length, 32);
});

test('a sealed store keeps tokens unreadable on disk and refuses the wrong key', async () => {
  const folder = join(dir, 'sealed');
  const key = userKey(masterKey, 'u1');
  const store = createStore(folder, { key });
  await store.update((s) => {
    s.auth = { mode: 'oauth', refreshToken: SECRET };
  });
  const raw = await readFile(join(folder, 'studio.json'), 'utf8');
  assert.ok(!raw.includes(SECRET));
  assert.equal(JSON.parse(raw).sealed, 1);
  assert.equal((await createStore(folder, { key }).get()).auth.refreshToken, SECRET);
  await assert.rejects(createStore(folder, { key: userKey(masterKey, 'u2') }).get());
  await assert.rejects(createStore(folder).get(), /sealed/);
  // A plain file dropped in place of a sealed one is refused.
  const planted = join(dir, 'planted');
  await mkdir(planted);
  await writeFile(join(planted, 'studio.json'), JSON.stringify({ auth: { mode: 'token', accessToken: 'x' } }));
  await assert.rejects(createStore(planted, { key }).get(), /not sealed/);
});

test('only the public host is answered, and health checks need no host', async () => {
  assert.equal((await call('/', { headers: { host: 'evil.test' } })).status, 421);
  assert.equal((await call('/healthz', { headers: { host: '10.0.0.1' } })).status, 200);
});

test('without a session: / is the home page, other pages go to sign-in, the API says 401', async () => {
  const home = await call('/');
  assert.equal(home.status, 200);
  assert.match(home.body, /href="\/login">Enter Studio/);
  assert.equal((await call('/home')).status, 200);
  assert.equal((await call('/settings')).headers.location, '/login');
  const api = await call('/api/state');
  assert.equal(api.status, 401);
  assert.equal(JSON.parse(api.body).kind, 'login');
  assert.equal((await call('/api/state', { cookie: '__Host-sitelens=forged' })).status, 401);
  const login = await call('/login');
  assert.equal(login.status, 200);
  assert.match(login.headers['content-security-policy'], /frame-ancestors 'none'/);
});

test('someone not invited gets no session', async () => {
  const { done, cookie } = await signIn('mallory@example.com');
  assert.match(decodeURIComponent(done.headers.location), /isn’t invited/);
  assert.equal(cookie, '');
});

test('a sign-in callback needs a state this server issued', async () => {
  const done = await call('/login/callback?code=alice@example.com&state=made-up');
  assert.match(done.headers.location, /^\/login\?error=/);
  assert.equal(done.headers['set-cookie'], undefined);
});

test('invited users sign in with a secure cookie', async () => {
  const { done, cookie } = await signIn('alice@example.com');
  assert.equal(done.headers.location, '/');
  assert.match(done.headers['set-cookie'][0], /HttpOnly; Secure; SameSite=Lax/);
  const me = await call('/api/me', { cookie });
  assert.equal(JSON.parse(me.body).email, 'alice@example.com');
  // Signing in connected Google too: no second step in the app.
  const state = JSON.parse((await call('/api/state', { cookie })).body);
  assert.equal(state.auth.connected, true);
  assert.equal(state.auth.email, 'alice@example.com');
  // Invite emails match whatever case Google returns.
  assert.equal((await signIn('bob@example.com')).done.headers.location, '/');
  // Signed in, / is the app and the home page's button goes straight in.
  assert.doesNotMatch((await call('/', { cookie })).body, /Did what you shipped/);
  assert.match((await call('/home', { cookie })).body, /href="\/">Enter Studio/);
});

test('cross-site writes are refused', async () => {
  const { cookie } = await signIn('alice@example.com');
  const res = await call('/api/sites', { method: 'POST', cookie, body: { host: 'x.com' }, headers: { origin: 'https://evil.test', 'x-studio': '1' } });
  assert.equal(res.status, 403);
  const none = await call('/api/sites', { method: 'POST', cookie, body: { host: 'x.com' }, headers: { 'x-studio': '1' } });
  assert.equal(none.status, 403);
});

test('each user sees only their own sites and secrets', async () => {
  const alice = (await signIn('alice@example.com')).cookie;
  const bob = (await signIn('bob@example.com')).cookie;
  assert.equal((await write('/api/sites', { host: 'alice-only.com' }, alice)).status, 200);
  const aliceState = JSON.parse((await call('/api/state', { cookie: alice })).body);
  const bobState = JSON.parse((await call('/api/state', { cookie: bob })).body);
  assert.ok(aliceState.sites.some((s) => s.host === 'alice-only.com'));
  assert.ok(!bobState.sites.some((s) => s.host === 'alice-only.com'));
  assert.equal(aliceState.hosted, true);
  // The server's own GITHUB_TOKEN never fills in for a user.
  assert.equal(bobState.sources.github.tokenSource, '');
  // Two users, two folders, nothing readable in either.
  const users = await readdir(join(dir, 'users'));
  assert.equal(users.length, 2);
  const files = (await Promise.all(users.map((id) => readFile(join(dir, 'users', id, 'studio.json'), 'utf8').catch(() => null)))).filter(Boolean);
  assert.ok(files.length >= 1);
  for (const raw of files) assert.ok(!raw.includes('alice-only.com'));
});

test('signing out ends the session for good', async () => {
  const { cookie } = await signIn('alice@example.com');
  const out = await call('/logout', { method: 'POST', cookie, headers: { origin: ORIGIN } });
  assert.equal(out.headers.location, '/login');
  assert.equal((await call('/api/state', { cookie })).status, 401);
});

test('taking someone off the invite list locks them out at once', async () => {
  const { cookie } = await signIn('bob@example.com');
  assert.equal((await call('/api/state', { cookie })).status, 200);
  gateway.db.prepare("UPDATE users SET email = 'gone@example.com' WHERE email = 'bob@example.com'").run();
  assert.equal((await call('/api/state', { cookie })).status, 401);
});

test('no GET route ever hands a stored secret back to the browser', async () => {
  const { cookie } = await signIn('alice@example.com');
  await call('/api/state', { cookie });
  const app = [...gateway.apps.values()][0];
  await app.store.update((s) => {
    s.auth = { mode: 'oauth', accessToken: SECRET, refreshToken: SECRET, email: 'alice@example.com', scopes: [], expiresAt: Date.now() + 3_600_000 };
    s.sources = Object.fromEntries(['anthropicKey', 'bingApiKey', 'githubToken', 'googleApiKey', 'openrouterKey', 'productHuntToken', 'redditClientSecret', 'vercelToken', 'cloudflareToken'].map((k) => [k, SECRET]));
    s.sources.bingOAuth = { accessToken: SECRET, refreshToken: SECRET, expiresAt: Date.now() + 3_600_000 };
  });
  // Every GET route in the server, with "demo" for each parameter.
  const sources = await Promise.all((await readdir('server')).filter((f) => f.endsWith('.mjs')).map((f) => readFile(join('server', f), 'utf8')));
  const paths = new Set();
  for (const text of sources) {
    for (const [, re] of text.matchAll(/\['GET', \/\^(\\\/api[^$]*)\$\//g)) {
      paths.add(re.replace(/\([^)]*\)\??/g, 'demo').replace(/\\\//g, '/').replace(/\\\./g, '.').replace(/[?\\]/g, ''));
    }
  }
  assert.ok(paths.size > 40, `found only ${paths.size} routes`);
  const leaks = [];
  for (const path of paths) {
    const res = await call(path, { cookie });
    if (res.body.includes(SECRET)) leaks.push(path);
  }
  assert.deepEqual(leaks, []);
});

test('sign-in attempts are limited per address', async () => {
  const headers = { 'fly-client-ip': '203.0.113.99' };
  for (let i = 0; i < 20; i++) await call('/login/google', { headers });
  const res = await call('/login/google', { headers });
  assert.match(decodeURIComponent(res.headers.location), /Too many sign-in attempts/);
});

test('outgoing fetches stay off private and internal addresses', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fdaa::3', 'fe80::1', '::ffff:127.0.0.1', '0.0.0.0']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
});

test('the analyst reaches its own app in-process, with writes still guarded', async () => {
  const app = [...gateway.apps.values()][0];
  const res = await selfFetch(app.handle, 'http://127.0.0.1:8080/api/state');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).hosted, true);
  const write = await selfFetch(app.handle, 'http://127.0.0.1:8080/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio': '1' }, body: JSON.stringify({}) });
  assert.notEqual(write.status, 403);
});

test('importing a server-side file is refused when hosted', async () => {
  const { cookie } = await signIn('alice@example.com');
  const res = await write('/api/github/import', { path: join(dir, 'gateway.db') }, cookie);
  assert.equal(res.status, 404, res.body);
  assert.match(JSON.parse(res.body).error, /desktop app/);
});

test('MCP over HTTP: a personal token picks the user, tools see only their data, and revoking ends it', async () => {
  const alice = (await signIn('alice@example.com')).cookie;
  const bob = (await signIn('bob2@example.com')).cookie;
  const made = JSON.parse((await write('/api/mcp/tokens', { label: 'laptop' }, alice)).body);
  assert.match(made.token, /^slk_/);
  assert.equal(made.url, `${ORIGIN}/mcp`);
  // Only a fingerprint is stored.
  assert.equal(gateway.db.prepare('SELECT COUNT(*) AS n FROM mcp_tokens WHERE hash = ?').get(made.token).n, 0);

  const rpc = (body, token = made.token, headers = {}) => call('/mcp', { method: 'POST', body, headers: { authorization: `Bearer ${token}`, ...headers } });
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.status, 200);
  assert.equal(JSON.parse(init.body).result.serverInfo.name, 'sitelens-studio');
  assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);

  const sites = JSON.parse((await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_sites', arguments: {} } })).body);
  assert.match(sites.result.content.at(-1).text, /alice-only\.com/);

  // Bob can't see or revoke Alice's tokens.
  assert.equal(JSON.parse((await call('/api/mcp/tokens', { cookie: bob })).body).tokens.length, 0);
  await call(`/api/mcp/tokens/${made.id}`, { method: 'DELETE', cookie: bob, headers: { origin: ORIGIN, 'x-studio': '1' } });
  assert.equal((await rpc({ jsonrpc: '2.0', id: 3, method: 'ping' })).status, 200);

  // No token, a made-up one, or a browser on another site: refused.
  assert.equal((await rpc({ jsonrpc: '2.0', id: 4, method: 'ping' }, 'slk_madeupmadeupmadeupmadeup')).status, 401);
  assert.equal((await call('/mcp', { method: 'POST', body: { jsonrpc: '2.0', id: 5, method: 'ping' } })).status, 401);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 6, method: 'ping' }, made.token, { origin: 'https://evil.test' })).status, 403);

  await call(`/api/mcp/tokens/${made.id}`, { method: 'DELETE', cookie: alice, headers: { origin: ORIGIN, 'x-studio': '1' } });
  assert.equal((await rpc({ jsonrpc: '2.0', id: 7, method: 'ping' })).status, 401);
});

test('MCP tokens expire: 90 days by default, a chosen length, or never; an expired one is refused', async () => {
  const alice = (await signIn('alice@example.com')).cookie;
  const day = 86_400_000;
  const rpc = (token) => call('/mcp', { method: 'POST', body: { jsonrpc: '2.0', id: 1, method: 'ping' }, headers: { authorization: `Bearer ${token}` } });

  const plain = JSON.parse((await write('/api/mcp/tokens', { label: 'default' }, alice)).body);
  assert.ok(Math.abs(plain.expiresAt - (Date.now() + 90 * day)) < 60_000);
  const year = JSON.parse((await write('/api/mcp/tokens', { label: 'year', days: 365 }, alice)).body);
  assert.ok(Math.abs(year.expiresAt - (Date.now() + 365 * day)) < 60_000);
  const forever = JSON.parse((await write('/api/mcp/tokens', { label: 'forever', days: 0 }, alice)).body);
  assert.equal(forever.expiresAt, null);
  assert.equal((await write('/api/mcp/tokens', { label: 'odd', days: 7 }, alice)).status, 400);
  assert.equal((await rpc(plain.token)).status, 200);
  assert.equal((await rpc(forever.token)).status, 200);

  // Past its date: refused, and the list says so.
  gateway.db.prepare('UPDATE mcp_tokens SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, plain.id);
  assert.equal((await rpc(plain.token)).status, 401);
  const listed = JSON.parse((await call('/api/mcp/tokens', { cookie: alice })).body).tokens;
  assert.equal(listed.find((t) => t.id === plain.id).expired, true);
  assert.equal(listed.find((t) => t.id === forever.id).expired, false);
  for (const t of [plain, year, forever]) await call(`/api/mcp/tokens/${t.id}`, { method: 'DELETE', cookie: alice, headers: { origin: ORIGIN, 'x-studio': '1' } });
});
