import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createCloudflareAnalytics, matchSites } from '../server/cloudflare-analytics.mjs';
import { createAlerts, lastDays } from '../server/alerts.mjs';

const NOW = Date.parse('2026-10-30T12:00:00Z');

function fakeCloudflare() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: u, path: u.pathname, body, auth: init.headers?.Authorization });
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (init.headers?.Authorization !== 'Bearer good') return json(401, { errors: [{ message: 'Invalid token' }] });
    return json(200, {
      data: {
        viewer: {
          accounts: [{
            rumPageloadEventsAdaptiveGroups: [
              { count: 3, dimensions: { date: '2026-10-28', requestPath: '/', refererHost: '' }, uniq: { visitors: 2 } },
              { count: 4, dimensions: { date: '2026-10-30', requestPath: '/about', refererHost: 'news.ycombinator.com' }, uniq: { visitors: 3 } },
            ],
          }],
          zones: [{
            httpRequests1dGroups: [
              { dimensions: { date: '2026-10-28', edgeResponseStatus: 200 }, sum: { requests: 3, pageViews: 3 }, uniq: { uniques: 2 } },
            ],
          }],
        },
      },
    });
  };
  return { calls, fetchImpl };
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'cf-'));
  const store = createStore(dir);
  await store.update((s) => {
    s.showDemo = false;
    s.sites = [{ id: 'tradify', label: 'Tradify', host: 'tradifycapital.in' }, { id: 'desk', label: 'Cooldesk', host: 'cool-desk.com' }];
    s.sources = { cloudflareToken: 'good', cloudflareAccountId: 'acct123' };
    s.cloudflare = { accountId: 'acct123', siteMap: {} };
  });
  const fake = fakeCloudflare();
  const cf = createCloudflareAnalytics({ store, env: {}, fetchImpl: fake.fetchImpl, now: () => NOW });
  return { dir, store, cf, ...fake };
}

test('matchSites matches by domain ignoring www, and a hand-picked map wins', () => {
  const sites = [
    { id: 'a', host: 'tradifycapital.in' },
    { id: 'b', host: 'www.kazekit.com' },
    { id: 'c', host: 'kazekit.com' },
    { id: 'demo', demo: true, host: 'kazekit.com' },
  ];
  const available = [{ domain: 'tradifycapital.in', siteTag: 'tag1', zoneTag: 'zone1' }, { domain: 'www.kazekit.com', siteTag: 'tag2', zoneTag: 'zone2' }];
  assert.deepEqual(matchSites(sites, available, { c: 'manual-tag' }), {
    a: { siteTag: 'tag1', zoneTag: 'zone1', manual: false },
    b: { siteTag: 'tag2', zoneTag: 'zone2', manual: false },
    c: { siteTag: 'manual-tag', zoneTag: 'manual-tag', manual: true },
  });
});

test('analytics sends a GraphQL query and returns daily traffic, pages and referrers', async () => {
  const { dir, cf, calls } = await setup();
  try {
    const wa = await cf.analytics('tag1', '7d');
    assert.equal(wa.series.pageviews.length, 7);
    assert.deepEqual(wa.series.pageviews.slice(-3), [3, 0, 4]);
    // 7-day range has 2 data days; check last includes 4 on 10-30
    assert.equal(wa.series.pageviews[6], 4);
    assert.deepEqual(wa.totals.pageviews, 7);
    assert.deepEqual(wa.pages[0], { path: '/about', views: 4 });
    assert.equal(wa.referrers.find((r) => r.host === 'news.ycombinator.com').views, 4);
    const q = calls[0];
    assert.equal(q.auth, 'Bearer good');
    assert.equal(q.path, '/client/v4/graphql');
    assert.match(q.body.query, /rumPageloadEventsAdaptiveGroups/);
    assert.match(q.body.query, /httpRequests1dGroups/);
    assert.equal(q.body.variables.accountTag, 'acct123');
    assert.equal(q.body.variables.siteTag, 'tag1');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fallback alert evaluation uses Cloudflare when a site has no GA4', async () => {
  const site = { id: 'p1', label: 'CF Shop', host: 'shop.test' };
  const dates = lastDays(NOW, 29);
  const visits = dates.map((_, i) => (i === dates.length - 1 ? 400 : 100 + (i % 3)));
  const visitors = dates.map(() => 80);
  const calls = [];
  const cloudflare = {
    async analyticsForSite(s, range) {
      calls.push([s.id, range]);
      return { series: { pageviews: visits, visitors } };
    },
  };
  const store = createStore(await mkdtemp(join(tmpdir(), 'cf-alert-')));
  await store.update((s) => { s.sites = [site]; s.alertSettings = { desktop: false }; });
  const engines = { async portfolio() { throw new Error('GA4 must not be used without a property'); }, async search() { return { trend: [] }; } };
  const alerts = createAlerts({ store, engines, cloudflare, extensions: { list: async () => [] }, github: null, now: () => NOW, notify: { desktop: async () => ({ ok: true }), webhook: async () => ({ ok: true }) } });
  const run = await alerts.run({ daily: true, digest: true });
  assert.deepEqual(run.errors, []);
  assert.deepEqual(calls, [['p1', '90d']]);
  assert.equal(run.digest.sites[0].source, 'cloudflare');
  assert.equal(run.digest.sites[0].sessions, 400);
});
