import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createNetlify, matchNetlifySites, publicSite } from '../server/netlify.mjs';

const NOW = Date.parse('2026-11-27T12:00:00Z');

const SITES = [
  { id: 's1', name: 'shop-site', url: 'https://shop-site.netlify.app', custom_domain: 'www.shop.example', domain_aliases: ['beta.shop.example'] },
  { id: 's2', name: 'blog-site', url: 'https://blog-site.netlify.app', custom_domain: null, domain_aliases: ['blog.example'] },
  { id: 's3', name: 'other-site', url: 'https://other-site.netlify.app', custom_domain: '', domain_aliases: [] },
];

const DEPLOYS = {
  s1: [
    { id: 'd1', state: 'ready', context: 'production', created_at: '2026-11-26T10:00:00Z', commit_msg: 'Ship checkout', branch: 'main' },
    { id: 'd2', state: 'failed', context: 'production', created_at: '2026-11-25T10:00:00Z', commit_msg: 'Break the build', branch: 'main' },
    { id: 'd3', state: 'ready', context: 'deploy-preview', created_at: '2026-11-24T10:00:00Z', commit_msg: 'Preview' },
    { id: 'd4', state: 'building', context: 'production', created_at: '2026-11-23T10:00:00Z', commit_msg: 'Not done yet' },
    { id: 'd5', state: 'ready', context: 'production', created_at: '2025-01-01T10:00:00Z', commit_msg: 'Long ago' },
  ],
  s2: [{ id: 'd6', state: 'ready', context: 'production', created_at: '2026-11-20T10:00:00Z', commit_msg: 'Docs shipped' }],
  s3: [],
};

function fakeNetlify() {
  const calls = [];
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(String(url)).pathname.replace('/api/v1', '');
    const auth = init.headers?.Authorization || '';
    calls.push({ path, auth, query: String(url) });
    if (auth === 'Bearer forbidden') return json(403, { message: 'Your token cannot read sites.' });
    if (auth !== 'Bearer good') return json(401, { message: 'Invalid access token.' });
    if (path === '/user') return json(200, { email: 'me@example.com', full_name: 'Me', slug: 'me' });
    if (path === '/sites') return json(200, SITES);
    const deploys = path.match(/^\/sites\/([\w-]+)\/deploys$/);
    if (deploys) return json(200, DEPLOYS[deploys[1]] || []);
    return json(404, { message: 'Not found.' });
  };
  return { calls, fetchImpl };
}

async function setup(env = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'studio-netlify-'));
  const store = createStore(dir);
  await store.saveSite({ id: 'shop', host: 'shop.example' });
  await store.saveSite({ id: 'blog', host: 'blog.example' });
  const fake = fakeNetlify();
  const netlify = createNetlify({ store, env, fetchImpl: fake.fetchImpl, now: () => NOW });
  return { dir, store, netlify, ...fake };
}

test('matchNetlifySites: custom domain, alias or *.netlify.app, www ignored; a hand pick wins', () => {
  const list = SITES.map(publicSite);
  const sites = [
    { id: 'a', host: 'shop.example' },
    { id: 'b', host: 'blog.example' },
    { id: 'c', host: 'other-site.netlify.app' },
    { id: 'd', host: 'www.shop.example' },
    { id: 'e', host: 'nothing.example' },
  ];
  assert.deepEqual(matchNetlifySites(sites, list), {
    a: { siteId: 's1', manual: false },
    b: { siteId: 's2', manual: false },
    c: { siteId: 's3', manual: false },
    d: { siteId: 's1', manual: false },
    e: { siteId: '', manual: false },
  });
  assert.deepEqual(matchNetlifySites(sites, list, { c: 's1', a: '' }).c, { siteId: 's1', manual: true });
  assert.deepEqual(matchNetlifySites(sites, list, { c: 's1', a: '' }).a, { siteId: '', manual: true }, 'an empty pick means “not on Netlify”');
});

test('saving a token checks it first; a bad one is refused and not saved', async () => {
  const { dir, store, netlify } = await setup();
  try {
    await assert.rejects(netlify.saveToken('bad'), /Netlify rejected the token/);
    assert.equal((await store.get()).sources?.netlifyToken, undefined);
    const r = await netlify.saveToken('good');
    assert.equal(r.login, 'me@example.com');
    const st = await netlify.status();
    assert.equal(st.tokenSource, 'settings');
    assert.equal(st.login, 'me@example.com');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('sites are cached and a fresh read goes back to Netlify', async () => {
  const { dir, netlify, calls } = await setup({ NETLIFY_TOKEN: 'good' });
  try {
    const first = await netlify.sites();
    assert.equal(first.length, 3);
    assert.deepEqual(first[0], {
      id: 's1', name: 'shop-site', url: 'https://shop-site.netlify.app',
      customDomain: 'www.shop.example', domains: ['beta.shop.example'], netlifyDomain: 'shop-site.netlify.app',
    });
    await netlify.sites();
    assert.equal(calls.filter((c) => c.path === '/sites').length, 1, 'the second read uses the cache');
    await netlify.sites({ fresh: true });
    assert.equal(calls.filter((c) => c.path === '/sites').length, 2, 'fresh=1 reloads');
    assert.ok(calls.filter((c) => c.path === '/sites').every((c) => c.auth === 'Bearer good'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('production deploys of matched sites become deploy moments, failures included', async () => {
  const { dir, netlify } = await setup({ NETLIFY_TOKEN: 'good' });
  try {
    const marks = await netlify.annotations({ from: '2026-11-01', to: '2026-11-30' });
    assert.deepEqual(marks.map((m) => [m.id, m.date, m.scope, m.source, m.kind]), [
      ['netlify-d1', '2026-11-26', 'site:shop', 'netlify', 'deploy'],
      ['netlify-d2', '2026-11-25', 'site:shop', 'netlify', 'deploy'],
      ['netlify-d6', '2026-11-20', 'site:blog', 'netlify', 'deploy'],
    ], 'previews, unfinished and old deploys stay out');
    assert.equal(marks.find((m) => m.id === 'netlify-d1').label, 'Deploy on shop-site: Ship checkout');
    assert.equal(marks.find((m) => m.id === 'netlify-d2').label, 'Failed deploy on shop-site: Break the build');
    assert.deepEqual(await netlify.annotations({ scopes: ['site:other'] }), [], 'scoped to another site, nothing');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a refused token throws an EngineError with a hint, on 401 and 403', async () => {
  for (const bad of ['bad', 'forbidden']) {
    const { dir, netlify } = await setup({ NETLIFY_TOKEN: bad });
    try {
      await assert.rejects(netlify.sites(), (err) =>
        err.kind === 'netlify-auth' && err.status === 502 && /personal access token/i.test(err.hint) && /rejected the token/.test(err.message));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
