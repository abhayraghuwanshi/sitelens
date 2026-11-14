import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnect, githubAccessToken } from '../server/connect.mjs';
import { createBing } from '../server/bing.mjs';
import { createVercel } from '../server/vercel.mjs';
import { createStore } from '../server/store.mjs';

const ENV = { GITHUB_APP_CLIENT_ID: 'Iv1.x', GITHUB_APP_CLIENT_SECRET: 'gsec', GITHUB_APP_SLUG: 'sitelens-studio', BING_CLIENT_ID: 'bid', BING_CLIENT_SECRET: 'bsec', VERCEL_CLIENT_ID: 'oac_x', VERCEL_CLIENT_SECRET: 'vsec', VERCEL_INTEGRATION_SLUG: 'sitelens' };

async function withStore(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'studio-connect-'));
  try {
    await fn(createStore(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('connect buttons stay hidden until the server has client credentials', () => {
  const connect = createConnect({ store: null, env: {}, baseUrl: 'https://x.test' });
  assert.equal(connect.available('bing'), false);
  assert.throws(() => connect.startUrl('vercel'), /isn’t set up/);
});

test('Connect Bing: code for tokens, then API calls carry a Bearer token and refresh it', async () => withStore(async (store) => {
  const calls = [];
  let clock = 1_000_000;
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u === 'https://www.bing.com/webmasters/oauth/token') {
      const body = new URLSearchParams(String(init.body));
      if (body.get('grant_type') === 'authorization_code') {
        assert.equal(body.get('redirect_uri'), 'https://x.test/auth/bing/callback');
        return Response.json({ access_token: 'at1', refresh_token: 'rt1', expires_in: 3599 });
      }
      assert.equal(body.get('refresh_token'), 'rt1');
      return Response.json({ access_token: 'at2', expires_in: 3599 });
    }
    if (u.startsWith('https://www.bing.com/webmaster/api.svc/json/GetUserSites')) return Response.json({ d: [{ Url: 'https://example.com/', IsVerified: true }] });
    throw new Error(`unexpected ${u}`);
  };
  const connect = createConnect({ store, env: ENV, baseUrl: 'https://x.test', fetchImpl, now: () => clock });
  const start = new URL(connect.startUrl('bing'));
  assert.equal(start.searchParams.get('scope'), 'webmaster.read');
  await assert.rejects(connect.finish('bing', new URLSearchParams({ code: 'c', state: 'forged' })), /expired or was not started here/);
  await connect.finish('bing', new URLSearchParams({ code: 'c', state: start.searchParams.get('state') }));

  const bing = createBing({ dbPath: join(store.dir, 'bing.db'), store, env: ENV, fetchImpl, now: () => clock });
  const status = await bing.status();
  assert.equal(status.source, 'oauth');
  assert.equal(status.sites[0].url, 'https://example.com/');
  const api = calls.find((c) => c.url.includes('GetUserSites'));
  assert.equal(api.init.headers.Authorization, 'Bearer at1');
  assert.ok(!api.url.includes('apikey'));

  // An hour later the access token is refreshed before use.
  clock += 3_600_000;
  bing.reset();
  await bing.status();
  assert.equal(calls.filter((c) => c.url.includes('GetUserSites')).at(-1).init.headers.Authorization, 'Bearer at2');

  // Removing disconnects.
  await bing.saveKey('');
  assert.equal((await bing.status()).source, '');
}));

test('Connect Vercel: the install hands back a token for its team', async () => withStore(async (store) => {
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u === 'https://api.vercel.com/v2/oauth/access_token') {
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get('redirect_uri'), 'https://x.test/auth/vercel/callback');
      return Response.json({ token_type: 'Bearer', access_token: 'vt', team_id: 'team_abcdef123', installation_id: 'icfg_1' });
    }
    throw new Error(`unexpected ${u}`);
  };
  const connect = createConnect({ store, env: ENV, baseUrl: 'https://x.test', fetchImpl });
  const start = new URL(connect.startUrl('vercel'));
  assert.equal(start.pathname, '/integrations/sitelens/new');
  await connect.finish('vercel', new URLSearchParams({ code: 'c', state: start.searchParams.get('state'), teamId: 'team_abcdef123' }));
  const vercel = createVercel({ store, env: {}, fetchImpl });
  const status = await vercel.status();
  assert.equal(status.tokenSource, 'oauth');
  assert.equal(status.teamId, 'team_abcdef123');
}));

test('the Integrations overview counts a connected Bing as connected', async () => {
  const { createApp } = await import('../server/index.mjs');
  await withStore(async (store) => {
    await store.update((s) => {
      s.sources = { bingOAuth: { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3_600_000 } };
    });
    const app = createApp({ store, env: {}, fetchImpl: async () => { throw new Error('offline'); } });
    const res = await (await import('../server/index.mjs')).selfFetch(app.handle, 'http://127.0.0.1:4318/api/integrations');
    assert.equal((await res.json()).bing.source, 'oauth');
  });
});

test('Connect GitHub: signs in, sends a first-timer on to install, and refreshes the 8-hour token', async () => withStore(async (store) => {
  let clock = 1_000_000;
  let installs = 0;
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    if (u === 'https://github.com/login/oauth/access_token') {
      assert.equal(init.headers.Accept, 'application/json');
      const body = new URLSearchParams(String(init.body));
      if (body.get('grant_type') === 'refresh_token') {
        assert.equal(body.get('refresh_token'), 'ghr_1');
        return Response.json({ access_token: 'ghu_2', expires_in: 28800 });
      }
      assert.equal(body.get('redirect_uri'), 'https://x.test/auth/github/callback');
      return Response.json({ access_token: 'ghu_1', expires_in: 28800, refresh_token: 'ghr_1', refresh_token_expires_in: 15897600 });
    }
    if (u === 'https://api.github.com/user/installations') return Response.json({ total_count: installs });
    throw new Error(`unexpected ${u}`);
  };
  const connect = createConnect({ store, env: ENV, baseUrl: 'https://x.test', fetchImpl, now: () => clock });
  const start = new URL(connect.startUrl('github'));
  assert.equal(start.origin + start.pathname, 'https://github.com/login/oauth/authorize');

  // No installation yet: on to GitHub's install page, whose return is accepted.
  const first = await connect.finish('github', new URLSearchParams({ code: 'c1', state: start.searchParams.get('state') }));
  const install = new URL(first.next);
  assert.equal(install.pathname, '/apps/sitelens-studio/installations/new');
  installs = 1;
  assert.deepEqual(await connect.finish('github', new URLSearchParams({ code: 'c2', state: install.searchParams.get('state'), installation_id: '9', setup_action: 'install' })), {});

  const opts = { store, env: ENV, fetchImpl, now: () => clock };
  assert.equal(await githubAccessToken(opts), 'ghu_1');
  clock += 8 * 3_600_000;
  assert.equal(await githubAccessToken(opts), 'ghu_2');
  assert.equal((await store.get()).sources.githubOAuth.refreshToken, 'ghr_1');
}));

test('a GitHub token without expiry (expiry turned off on the app) is used as is', async () => withStore(async (store) => {
  await store.update((s) => {
    s.sources = { githubOAuth: { accessToken: 'ghu_forever', refreshToken: '', expiresAt: 0 } };
  });
  assert.equal(await githubAccessToken({ store, env: ENV, fetchImpl: async () => { throw new Error('no network'); } }), 'ghu_forever');
}));
