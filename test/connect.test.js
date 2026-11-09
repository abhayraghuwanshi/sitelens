import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnect } from '../server/connect.mjs';
import { createBing } from '../server/bing.mjs';
import { createVercel } from '../server/vercel.mjs';
import { createStore } from '../server/store.mjs';

const ENV = { BING_CLIENT_ID: 'bid', BING_CLIENT_SECRET: 'bsec', VERCEL_CLIENT_ID: 'oac_x', VERCEL_CLIENT_SECRET: 'vsec', VERCEL_INTEGRATION_SLUG: 'sitelens' };

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
