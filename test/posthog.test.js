import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createPostHog, matchSites, normalizeBase, assertPublicBase, DEFAULT_BASE } from '../server/posthog.mjs';
import { createAlerts } from '../server/alerts.mjs';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const PROJECT = '12345';
const POSTHOG_SITES = [
  { host: 'tradifycapital.in', views: 100 },
  { host: 'www.kazekit.com', views: 50 },
  { host: 'other.example', views: 5 },
];

// Fake PostHog Query API: records the query body + auth, answers HogQL from
// small fixtures keyed on what the SQL asks for.
function fakePostHog() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: u, path: u.pathname, body, auth: init.headers?.Authorization, method: init.method });
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (init.headers?.Authorization !== 'Bearer good') return json(401, { error: 'Invalid API key' });
    if (!u.pathname.endsWith('/query/')) return json(404, { error: 'nope' });
    if (body?.query?.kind === 'TrendsQuery') return json(200, { results: [] });
    const sql = body?.query?.query || '';
    if (sql === 'SELECT 1 AS ok') return json(200, { results: [[1]], columns: ['ok'] });
    // Site listing.
    if (sql.includes('properties.$host AS host')) {
      return json(200, { results: POSTHOG_SITES.map((s) => [s.host, s.views]), columns: ['host', 'views'] });
    }
    // Per-session bounce rows.
    if (sql.includes('GROUP BY session')) {
      return json(200, {
        results: [
          ['a', '2026-10-28', 1],
          ['b', '2026-10-30', 3],
          ['c', '2026-10-30', 1],
        ],
        columns: ['session', 'day', 'views'],
      });
    }
    // Daily visitors + pageviews.
    if (sql.includes('GROUP BY day')) {
      return json(200, {
        results: [
          ['2026-10-28', 2, 3],
          ['2026-10-30', 4, 5],
        ],
        columns: ['day', 'visitors', 'pageviews'],
      });
    }
    // Range-wide totals.
    if (sql.includes('count(DISTINCT person_id) AS visitors, count() AS pageviews')) {
      return json(200, { results: [[6, 8]], columns: ['visitors', 'pageviews'] });
    }
    // Top pages.
    if (sql.includes('GROUP BY path')) {
      return json(200, { results: [['/', 7, 5], ['/about', 1, 1]], columns: ['path', 'views', 'visitors'] });
    }
    // Top referrers.
    if (sql.includes('GROUP BY host')) {
      return json(200, { results: [['google.com', 4, 5], ['$direct', 2, 3]], columns: ['host', 'views', 'visitors'] });
    }
    // Custom conversion events.
    if (sql.includes('event NOT LIKE')) {
      return json(200, { results: [['Signup', 4, 3]], columns: ['goal', 'events', 'visitors'] });
    }
    return json(200, { results: [], columns: [] });
  };
  return { calls, fetchImpl };
}

async function setup({ hosted = false, baseUrl = '', projectId = PROJECT, key = 'good', env = {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'posthog-'));
  const store = createStore(dir);
  await store.update((s) => {
    s.showDemo = false;
    s.sites = [
      { id: 'tradify', label: 'Tradify', host: 'tradifycapital.in' },
      { id: 'desk', label: 'Cooldesk', host: 'www.cool-desk.com' },
    ];
    if (baseUrl) s.posthog = { baseUrl };
    if (key) s.sources = { posthogKey: key };
    if (projectId) s.posthog = { ...(s.posthog || {}), projectId };
  });
  const fake = fakePostHog();
  const posthog = createPostHog({ store, env, fetchImpl: fake.fetchImpl, now: () => NOW, hosted });
  return { dir, store, posthog, ...fake };
}

test('matchSites matches by domain ignoring www, and a hand-picked map wins', () => {
  const sites = [
    { id: 'a', host: 'tradifycapital.in' },
    { id: 'b', host: 'www.kazekit.com' },
    { id: 'c', host: 'kazekit.com' },
    { id: 'demo', demo: true, host: 'kazekit.com' },
  ];
  assert.deepEqual(matchSites(sites, POSTHOG_SITES, { c: 'custom.example' }), {
    a: { siteId: 'tradifycapital.in', manual: false },
    b: { siteId: 'kazekit.com', manual: false },
    c: { siteId: 'custom.example', manual: true },
  });
});

test('analytics posts a HogQL query with Bearer auth and returns vercel-shaped daily traffic', async () => {
  const { dir, posthog, calls } = await setup();
  try {
    const a = await posthog.analytics('tradifycapital.in', '7d');
    // Shaped like vercel.mjs.
    assert.equal(a.series.pageviews.length, 7);
    assert.deepEqual(a.series.pageviews.slice(-3), [3, 0, 5]);
    assert.deepEqual(a.series.visitors.slice(-3), [2, 0, 4]);
    assert.equal(a.range.start, '2026-10-24');
    assert.equal(a.range.end, '2026-10-30');
    assert.ok(Array.isArray(a.pages));
    assert.ok(Array.isArray(a.referrers));
    // Sessions ($session_id) + bounce rate.
    assert.equal(a.totals.sessions, 3);
    assert.equal(a.totals.visits, 3);
    assert.equal(a.series.sessions.reduce((x, y) => x + y, 0), 3);
    assert.equal(Math.round(a.totals.bounceRate), Math.round((2 / 3) * 100));
    // Top pages ($pathname) and top referrers ($referring_domain).
    assert.deepEqual(a.pages, [{ path: '/', views: 7, visitors: 5 }, { path: '/about', views: 1, visitors: 1 }]);
    assert.deepEqual(a.referrers.map((r) => r.host), ['google.com', '']);
    // Custom conversion events.
    assert.equal(a.goals.length, 1);
    assert.equal(a.goals[0].goal, 'Signup');
    assert.equal(a.goals[0].events, 4);
    assert.equal(a.goals[0].visitors, 3);

    // PostHog Query API request body + auth header.
    const q = calls.find((c) => c.path.endsWith('/query/') && c.body?.query?.query?.includes('GROUP BY day'));
    assert.equal(q.method, 'POST');
    assert.equal(q.auth, 'Bearer good');
    assert.equal(q.url.origin, DEFAULT_BASE);
    assert.equal(q.url.pathname, `/api/projects/${PROJECT}/query/`);
    assert.equal(q.body.query.kind, 'HogQLQuery');
    const sql = q.body.query.query;
    assert.match(sql, /event = '\$pageview'/);
    assert.match(sql, /person_id/);
    assert.match(sql, /properties\.\$host/);
    assert.match(sql, /toDate\(timestamp\)/);
    assert.match(sql, /2026-10-24/);
    assert.match(sql, /2026-10-30/);
    // $host matching, www ignored.
    assert.match(sql, /'tradifycapital\.in'/);
    assert.match(sql, /'www\.tradifycapital\.in'/);

    const sessions = calls.find((c) => c.body?.query?.query?.includes('GROUP BY session'));
    assert.match(sessions.body.query.query, /properties\.\$session_id/);
    const pages = calls.find((c) => c.body?.query?.query?.includes('GROUP BY path'));
    assert.match(pages.body.query.query, /properties\.\$pathname/);
    const refs = calls.find((c) => c.body?.query?.query?.includes('GROUP BY host'));
    assert.match(refs.body.query.query, /properties\.\$referring_domain/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a self-hosted base URL is used for the query', async () => {
  const { dir, posthog, calls } = await setup({ baseUrl: 'https://posthog.example.com' });
  try {
    await posthog.analytics('tradifycapital.in', '7d');
    assert.ok(calls.length);
    for (const c of calls) assert.equal(c.url.origin, 'https://posthog.example.com');
    assert.ok(calls.some((c) => c.url.pathname === `/api/projects/${PROJECT}/query/`));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('EU cloud base URL is supported', async () => {
  const { dir, posthog, calls } = await setup({ baseUrl: 'https://eu.posthog.com' });
  try {
    await posthog.analytics('tradifycapital.in', '7d');
    assert.equal(calls[0].url.origin, 'https://eu.posthog.com');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('key, project_id and base URL come from Settings, else POSTHOG_* in .env', async () => {
  // env fallback
  const dir = await mkdtemp(join(tmpdir(), 'posthog-'));
  try {
    const store = createStore(dir);
    const fake = fakePostHog();
    const posthog = createPostHog({
      store,
      env: { POSTHOG_API_KEY: 'good', POSTHOG_PROJECT_ID: PROJECT, POSTHOG_BASE_URL: 'https://posthog.example.com' },
      fetchImpl: fake.fetchImpl,
      now: () => NOW,
    });
    const s = await posthog.status();
    assert.equal(s.keySource, 'env');
    assert.equal(s.projectSource, 'env');
    assert.equal(s.baseSource, 'env');
    assert.equal(s.projectId, PROJECT);
    await posthog.analytics('tradifycapital.in', '7d');
    assert.equal(fake.calls[0].auth, 'Bearer good');
    assert.equal(fake.calls[0].url.origin, 'https://posthog.example.com');
    assert.equal(fake.calls[0].url.pathname, `/api/projects/${PROJECT}/query/`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('save verifies the key + project, stores base URL and project_id, and matches sites', async () => {
  const { dir, store, posthog, calls } = await setup({ key: '', projectId: '' });
  try {
    const saved = await posthog.save({ key: 'good', projectId: PROJECT, baseUrl: 'https://posthog.example.com' });
    assert.equal(saved.ok, true);
    assert.equal((await store.get()).sources.posthogKey, 'good');
    assert.equal((await store.get()).posthog.projectId, PROJECT);
    assert.equal((await store.get()).posthog.baseUrl, 'https://posthog.example.com');
    // verification query hit the self-hosted base + project
    const verify = calls.find((c) => c.body?.query?.query === 'SELECT 1 AS ok');
    assert.equal(verify.url.origin, 'https://posthog.example.com');
    assert.equal(verify.url.pathname, `/api/projects/${PROJECT}/query/`);
    assert.equal(verify.auth, 'Bearer good');

    const matched = await posthog.matches(await store.sites());
    assert.equal(matched.tradify.siteId, 'tradifycapital.in');
    assert.equal(matched.desk.siteId, '');
    await posthog.setMatch('desk', 'www.kazekit.com');
    assert.equal((await posthog.matches(await store.sites())).desk.siteId, 'kazekit.com');
    assert.equal((await posthog.matches(await store.sites())).desk.manual, true);

    await assert.rejects(posthog.save({ key: 'bad', projectId: PROJECT }), (err) => err.kind === 'posthog-auth');
    assert.equal((await store.get()).sources.posthogKey, 'good');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('hosted refuses a private or internal base URL', async () => {
  const { dir, posthog } = await setup({ hosted: true });
  try {
    for (const baseUrl of ['http://127.0.0.1:8000', 'http://localhost:8000', 'http://10.0.0.4', 'http://169.254.169.254', 'http://[::1]:8000', 'http://192.168.1.1']) {
      await assert.rejects(
        posthog.save({ key: 'good', projectId: PROJECT, baseUrl }),
        (err) => err.kind === 'validation' && /private or internal/.test(err.message),
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('assertPublicBase allows public URLs and defaults to US cloud', async () => {
  assert.equal(normalizeBase(''), DEFAULT_BASE);
  assert.equal(normalizeBase('https://eu.posthog.com'), 'https://eu.posthog.com');
  assert.equal(normalizeBase('https://posthog.example.com/'), 'https://posthog.example.com');
  assert.equal(await assertPublicBase('https://us.posthog.com', { hosted: true }), 'https://us.posthog.com');
  // not hosted: private addresses are allowed for local testing
  assert.equal(await assertPublicBase('http://127.0.0.1:8000', { hosted: false }), 'http://127.0.0.1:8000');
});

test('without a key or project, requests explain how to connect', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'posthog-'));
  try {
    const posthog = createPostHog({ store: createStore(dir), env: {}, fetchImpl: () => assert.fail('no network without a key') });
    assert.equal((await posthog.status()).keySource, '');
    await assert.rejects(posthog.analytics('x.example', '7d'), (err) => err.kind === 'needs-posthog' && err.status === 409);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('analyticsForSite uses the hand-picked or domain match', async () => {
  const { dir, store, posthog, calls } = await setup();
  try {
    const a = await posthog.analyticsForSite(await store.site('tradify'), '7d');
    assert.equal(a.siteId, 'tradifycapital.in');
    const sql = calls.find((c) => c.body?.query?.query?.includes('GROUP BY day')).body.query.query;
    assert.match(sql, /'tradifycapital\.in'/);
    await assert.rejects(posthog.analyticsForSite(await store.site('desk'), '7d'), (err) => err.kind === 'posthog-unmatched');
    await posthog.setMatch('desk', 'www.kazekit.com');
    const b = await posthog.analyticsForSite(await store.site('desk'), '7d');
    assert.equal(b.siteId, 'kazekit.com');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Alerts: the traffic rule falls back to PostHog when a site has no GA4.
test('traffic rule falls back to PostHog when a site has no GA4', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'posthog-alerts-'));
  try {
    const store = createStore(dir);
    await store.update((s) => {
      s.showDemo = false;
      s.sites = [{ id: 'site', label: 'Site', host: 'example.com' }]; // no propertyId
    });
    const sessions = Array(30).fill(50);
    sessions[sessions.length - 1] = 5; // a sharp drop on the latest day
    const users = Array(30).fill(40);
    users[users.length - 1] = 4;
    const posthog = {
      analyticsForSite: async () => ({ series: { sessions, visits: sessions, visitors: users } }),
    };
    const alerts = createAlerts({
      store,
      engines: { portfolio: async () => { throw new Error('GA4 should not be called'); }, search: async () => ({ trend: [] }) },
      github: null,
      extensions: { list: async () => [] },
      auth: null,
      listingProperty: null,
      posthog,
      plausible: null,
      now: () => NOW,
      deliver: { desktop: async () => {}, webhook: async () => {} },
    });
    const result = await alerts.run({ daily: true, digest: true, deliverNew: false });
    const row = result.digest.sites.find((r) => r.id === 'site');
    assert.ok(row, 'site row present');
    assert.equal(row.source, 'posthog');
    assert.equal(row.sessions, 5);
    assert.equal(row.users, 4);
    assert.ok(result.errors.length === 0 || !result.errors.some((e) => /GA4/.test(e)));
    const traffic = result.fired.filter((a) => a.rule === 'traffic');
    assert.ok(traffic.length >= 1, 'a traffic anomaly fired from PostHog data');
    assert.equal(traffic[0].subject.id, 'site');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('PostHog is not used when the site has GA4, or when it is not connected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'posthog-alerts-'));
  try {
    const store = createStore(dir);
    await store.update((s) => {
      s.showDemo = false;
      s.sites = [{ id: 'site', label: 'Site', host: 'example.com', propertyId: '123' }];
    });
    let called = false;
    const posthog = { analyticsForSite: async () => { called = true; return null; } };
    const alerts = createAlerts({
      store,
      engines: { portfolio: async () => [{ trend: [], error: null }], search: async () => ({ trend: [] }) },
      github: null,
      extensions: { list: async () => [] },
      auth: null,
      listingProperty: null,
      posthog,
      now: () => NOW,
      deliver: { desktop: async () => {}, webhook: async () => {} },
    });
    await alerts.run({ daily: true, deliverNew: false });
    assert.equal(called, false, 'PostHog not consulted when GA4 is present');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
