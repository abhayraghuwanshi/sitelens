import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createPlausible, matchSites } from '../server/plausible.mjs';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const SITES = [
  { domain: 'tradifycapital.in' },
  { domain: 'www.kazekit.com' },
  { domain: 'other.example' },
];

// Fake Plausible Stats API: records the query body and answers from small
// fixtures, so the tests can check exactly what Kauzl sends.
function fakePlausible() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: u, path: u.pathname, search: Object.fromEntries(u.searchParams), body, auth: init.headers?.Authorization });
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (init.headers?.Authorization !== 'Bearer good') return json(401, { error: 'Invalid API key' });
    if (u.pathname === '/api/v1/sites') return json(200, { sites: SITES, meta: { after: null } });
    if (u.pathname === '/api/v2/query') {
      if (body.dimensions?.[0] === 'time:day') {
        return json(200, {
          results: [
            { dimensions: ['2026-10-28'], metrics: [2, 3, 2, 40] },
            { dimensions: ['2026-10-30'], metrics: [4, 5, 4, 25] },
          ],
        });
      }
      if (!body.dimensions) return json(200, { results: [{ metrics: [6, 8, 6, 33.3] }] });
      if (body.dimensions[0] === 'event:page') {
        return json(200, { results: [
          { dimensions: ['/'], metrics: [7, 5] },
          { dimensions: ['/about'], metrics: [1, 1] },
        ] });
      }
      if (body.dimensions[0] === 'visit:source') {
        return json(200, { results: [
          { dimensions: ['Google'], metrics: [4, 5] },
          { dimensions: ['Direct / None'], metrics: [2, 3] },
        ] });
      }
      if (body.dimensions[0] === 'event:goal') {
        return json(200, { results: [{ dimensions: ['Signup'], metrics: [3, 4, 50] }] });
      }
    }
    return json(404, { error: 'nope' });
  };
  return { calls, fetchImpl };
}

async function setup({ hosted = false, baseUrl = '', key = 'good' } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'plausible-'));
  const store = createStore(dir);
  await store.update((s) => {
    s.showDemo = false;
    s.sites = [
      { id: 'tradify', label: 'Tradify', host: 'tradifycapital.in' },
      { id: 'desk', label: 'Cooldesk', host: 'www.cool-desk.com' },
    ];
    if (baseUrl) s.plausible = { baseUrl };
    if (key) s.sources = { plausibleKey: key };
  });
  const fake = fakePlausible();
  const plausible = createPlausible({ store, env: {}, fetchImpl: fake.fetchImpl, now: () => NOW, hosted });
  return { dir, store, plausible, ...fake };
}

test('matchSites matches by domain ignoring www, and a hand-picked map wins', () => {
  const sites = [
    { id: 'a', host: 'tradifycapital.in' },
    { id: 'b', host: 'www.kazekit.com' },
    { id: 'c', host: 'kazekit.com' },
    { id: 'demo', demo: true, host: 'kazekit.com' },
  ];
  assert.deepEqual(matchSites(sites, SITES, { c: 'custom.example' }), {
    a: { siteId: 'tradifycapital.in', manual: false },
    b: { siteId: 'www.kazekit.com', manual: false },
    c: { siteId: 'custom.example', manual: true },
  });
});

test('analytics sends the v2 query and returns daily traffic, pages, sources and goals', async () => {
  const { dir, plausible, calls } = await setup();
  try {
    const a = await plausible.analytics('tradifycapital.in', '7d');
    assert.equal(a.series.pageviews.length, 7);
    assert.deepEqual(a.series.visitors.slice(-3), [2, 0, 4]);
    assert.deepEqual(a.series.pageviews.slice(-3), [3, 0, 5]);
    assert.deepEqual(a.series.visits.slice(-3), [2, 0, 4]);
    assert.deepEqual(a.series.bounceRate.slice(-3), [40, 0, 25]);
    assert.deepEqual(a.totals, { pageviews: 8, visitors: 6, visits: 6, bounceRate: 33.3 });
    assert.deepEqual(a.pages, [{ path: '/', views: 7, visitors: 5 }, { path: '/about', views: 1, visitors: 1 }]);
    assert.deepEqual(a.sources, [
      { source: 'Google', visitors: 4, views: 5 },
      { source: 'Direct / None', visitors: 2, views: 3 },
    ]);
    assert.deepEqual(a.referrers, [
      { host: 'Google', views: 5, visitors: 4 },
      { host: '', views: 3, visitors: 2 },
    ]);
    assert.deepEqual(a.goals, [{ goal: 'Signup', visitors: 3, events: 4, conversionRate: 50 }]);

    const timeline = calls.find((c) => c.path === '/api/v2/query' && c.body.dimensions?.[0] === 'time:day');
    assert.equal(timeline.auth, 'Bearer good');
    assert.deepEqual(timeline.body, {
      site_id: 'tradifycapital.in',
      date_range: ['2026-10-24', '2026-10-30'],
      metrics: ['visitors', 'pageviews', 'visits', 'bounce_rate'],
      dimensions: ['time:day'],
      include: { time_labels: true },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a self-hosted base URL is used for the query', async () => {
  const { dir, plausible, calls } = await setup({ baseUrl: 'https://stats.example.com' });
  try {
    await plausible.analytics('tradifycapital.in', '7d');
    assert.equal(calls[0].url.origin, 'https://stats.example.com');
    assert.equal(calls[0].url.pathname, '/api/v2/query');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('save verifies the key, stores a self-hosted URL and matches sites', async () => {
  const { dir, store, plausible, calls } = await setup({ key: '' });
  try {
    const saved = await plausible.save({ key: 'good', baseUrl: 'https://stats.example.com' });
    assert.equal(saved.sites, 3);
    assert.equal((await store.get()).sources.plausibleKey, 'good');
    assert.equal((await store.get()).plausible.baseUrl, 'https://stats.example.com');
    assert.equal(calls[0].url.origin, 'https://stats.example.com');
    assert.equal(calls[0].url.pathname, '/api/v1/sites');

    const matched = await plausible.matches(await store.sites());
    assert.equal(matched.tradify.siteId, 'tradifycapital.in');
    assert.equal(matched.desk.siteId, '');
    await plausible.setMatch('desk', 'www.kazekit.com');
    assert.equal((await plausible.matches(await store.sites())).desk.siteId, 'www.kazekit.com');
    await assert.rejects(plausible.save({ key: 'bad' }), (err) => err.kind === 'plausible-auth');
    assert.equal((await store.get()).sources.plausibleKey, 'good');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('hosted refuses a private or internal base URL', async () => {
  const { dir, plausible } = await setup({ hosted: true });
  try {
    for (const baseUrl of ['http://127.0.0.1:8000', 'http://localhost:8000', 'http://10.0.0.4']) {
      await assert.rejects(
        plausible.save({ key: 'good', baseUrl }),
        (err) => err.kind === 'validation' && /private or internal/.test(err.message),
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('without a key, the status is empty and requests explain how to connect', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plausible-'));
  try {
    const plausible = createPlausible({ store: createStore(dir), env: {}, fetchImpl: () => assert.fail('no network without a key') });
    assert.equal((await plausible.status()).keySource, '');
    await assert.rejects(plausible.sites(), (err) => err.kind === 'needs-plausible' && err.status === 409);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
