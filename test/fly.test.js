import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createFly, flyAuthHeader, matchFlySites, publicApp } from '../server/fly.mjs';

const NOW = Date.parse('2026-11-27T12:00:00Z');

function fakeFly() {
  const calls = [];
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
  const fetchImpl = async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, auth: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : null });
    if (!/good/.test(init.headers?.Authorization || '')) return json(401, { errors: [{ message: 'You must be authenticated to view this.' }] });
    if (u.startsWith('https://api.fly.io/prometheus/')) {
      const q = new URL(u).searchParams.get('query');
      if (u.includes('query_range')) return json(200, { status: 'success', data: { result: [{ values: [[NOW / 1000 - 86_400, '120'], [NOW / 1000, '80.4']] }] } });
      const v = q.includes('5..') ? '3' : q.includes('histogram_quantile') ? '0.2345' : '200.6';
      return json(200, { status: 'success', data: { result: [{ value: [NOW / 1000, v] }] } });
    }
    const { query } = JSON.parse(init.body);
    if (query.includes('viewer')) return json(200, { data: { viewer: { email: 'me@example.com' }, organizations: { nodes: [{ slug: 'personal', name: 'Personal' }] } } });
    if (query.includes('apps(first')) {
      return json(200, { data: { apps: { nodes: [
        { name: 'shop-web', hostname: 'shop-web.fly.dev', status: 'deployed', deployed: true, organization: { slug: 'personal', name: 'Personal' }, currentRelease: { version: 42, createdAt: '2026-11-26T10:00:00Z' }, certificates: { nodes: [{ hostname: 'www.shop.example' }] } },
        { name: 'api', hostname: 'api.fly.dev', status: 'suspended', deployed: false, organization: { slug: 'personal' }, currentRelease: null, certificates: { nodes: [] } },
      ] } } });
    }
    if (query.includes('releasesUnprocessed')) {
      return json(200, { data: { app: { releasesUnprocessed: { nodes: [
        { version: 42, status: 'complete', description: 'Deploy image', createdAt: '2026-11-26T10:00:00Z', user: { email: 'me@example.com' } },
        { version: 41, status: 'failed', createdAt: '2026-11-25T10:00:00Z' },
        { version: 40, status: 'complete', createdAt: '2025-01-01T10:00:00Z' },
      ] } } } });
    }
    if (query.includes('machines')) return json(200, { data: { app: { machines: { nodes: [{ id: 'm1', region: 'fra', state: 'started', updatedAt: '2026-11-27T00:00:00Z' }] } } } });
    return json(400, { errors: [{ message: 'unexpected query' }] });
  };
  return { calls, fetchImpl };
}

async function setup(env = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'studio-fly-'));
  const store = createStore(dir);
  await store.saveSite({ id: 'shop', host: 'shop.example' });
  await store.saveSite({ id: 'blog', host: 'blog.example' });
  const fake = fakeFly();
  const fly = createFly({ store, env, fetchImpl: fake.fetchImpl, now: () => NOW });
  return { dir, store, fly, ...fake };
}

test('flyAuthHeader: macaroons as they are, the rest as Bearer', () => {
  assert.equal(flyAuthHeader('FlyV1 fm2_abc'), 'FlyV1 fm2_abc');
  assert.equal(flyAuthHeader('fm2_abc'), 'FlyV1 fm2_abc');
  assert.equal(flyAuthHeader('personal-token'), 'Bearer personal-token');
});

test('matchFlySites: by *.fly.dev name or a certificate hostname, www. ignored; a hand pick wins', () => {
  const apps = [publicApp({ name: 'shop-web', hostname: 'shop-web.fly.dev', certificates: { nodes: [{ hostname: 'www.shop.example' }] } }), publicApp({ name: 'blog', hostname: 'blog.fly.dev' })];
  const sites = [{ id: 'a', host: 'shop.example' }, { id: 'b', host: 'blog.fly.dev' }, { id: 'c', host: 'other.example' }];
  assert.deepEqual(matchFlySites(sites, apps), { a: { app: 'shop-web', manual: false }, b: { app: 'blog', manual: false }, c: { app: '', manual: false } });
  assert.deepEqual(matchFlySites(sites, apps, { c: 'blog', a: '' }).c, { app: 'blog', manual: true });
  assert.deepEqual(matchFlySites(sites, apps, { a: '' }).a, { app: '', manual: true }, 'an empty pick means “not on Fly”');
});

test('saving a token checks it first; a bad one is refused and not saved', async () => {
  const { dir, store, fly } = await setup();
  try {
    await assert.rejects(fly.saveToken('bad'), /Fly rejected the token/);
    assert.equal((await store.get()).sources?.flyToken, undefined);
    const r = await fly.saveToken('FlyV1 fm2_good');
    assert.equal(r.login, 'me@example.com');
    const st = await fly.status();
    assert.equal(st.tokenSource, 'settings');
    assert.deepEqual(st.orgs, [{ slug: 'personal', name: 'Personal' }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('finished releases of the matched app become deploy moments on that site', async () => {
  const { dir, fly } = await setup({ FLY_API_TOKEN: 'good' });
  try {
    const marks = await fly.annotations({ from: '2026-11-01', to: '2026-11-30' });
    assert.deepEqual(marks.map((m) => [m.id, m.date, m.scope, m.source]), [['fly-shop-web-v42', '2026-11-26', 'site:shop', 'fly']]);
    assert.match(marks[0].label, /^Deploy shop-web v42: Deploy image/);
    assert.deepEqual(await fly.annotations({ scopes: ['site:blog'] }), [], 'scoped to other sites, nothing');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('traffic reads Fly’s Prometheus for the app’s org', async () => {
  const { dir, fly, calls } = await setup({ FLY_API_TOKEN: 'good' });
  try {
    const t = await fly.traffic('shop-web', 'personal');
    assert.deepEqual(t, { requests: 201, errors: 3, p95ms: 235, days: [{ date: '2026-11-25', requests: 120 }, { date: '2026-11-26', requests: 80 }] });
    const promCalls = calls.filter((c) => c.url.includes('/prometheus/personal/api/v1/'));
    assert.equal(promCalls.length, 4);
    assert.ok(promCalls.every((c) => c.auth === 'Bearer good'));
    assert.ok(promCalls.some((c) => new URL(c.url).searchParams.get('query').includes('app="shop-web"')));
    await assert.rejects(fly.traffic('bad name"}', 'personal'), /isn’t a Fly app name/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
