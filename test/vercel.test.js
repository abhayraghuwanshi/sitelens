import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createVercel, matchSites, publicProject, publicDeployment, daily } from '../server/vercel.mjs';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const TEAM = 'team_abcdefghij';

const PROJECTS = [
  {
    id: 'prj_tradify01', name: 'tradify', framework: 'vite', env: [{ key: 'SECRET', value: 'x' }],
    targets: { production: { alias: ['www.tradifycapital.in', 'tradify.vercel.app'], createdAt: NOW - 3600_000, readyState: 'READY' } },
    webAnalytics: { id: 'w', enabledAt: 1, hasData: true }, link: { type: 'github', org: 'me', repo: 'tradify' },
  },
  { id: 'prj_kazekit01', name: 'kazekit', targets: { production: { alias: ['kazekit.com'] } }, webAnalytics: { id: 'w' } },
];

// Fake Vercel API: records requests, answers from small fixtures, and enforces a
// Hobby-style 31-day window on the observability query.
function fakeVercel({ retention = 31 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), body, auth: init.headers?.Authorization });
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (init.headers?.Authorization !== 'Bearer good') return json(403, { error: { message: 'Not authorized' } });
    if (u.pathname === '/v2/user') return json(200, { user: { username: 'me', defaultTeamId: TEAM } });
    if (u.pathname === '/v10/projects') return json(200, { projects: PROJECTS, pagination: { next: null } });
    if (u.pathname === '/v6/deployments') {
      return json(200, {
        deployments: [
          { uid: 'dpl_one', url: 'a.vercel.app', created: Date.parse('2026-10-20T09:00:00Z'), readyState: 'READY', target: 'production', meta: { githubCommitMessage: 'Ship it\n\nbody', githubCommitSha: 'abcdef1234' }, inspectorUrl: 'https://vercel.com/x/1' },
          { uid: 'dpl_two', url: 'b.vercel.app', created: Date.parse('2026-10-21T09:00:00Z'), readyState: 'ERROR', target: 'production', meta: {} },
        ],
      });
    }
    if (u.pathname === '/v2/observability/query') {
      if (Date.parse(body.startTime) < NOW - retention * 86_400_000) {
        return json(400, { error: { message: `Invalid request: the hobby plan only grants access to the latest ${retention} days of data.` } });
      }
      const col = body.aggregation === 'sum' ? 'vercel_analytics_pageview_count_sum' : 'vercel_analytics_pageview_count_unique_visitor_id';
      if (body.groupBy?.[0] === 'request_path') return json(200, { summary: [{ request_path: '/', [col]: 7 }, { request_path: '/about', [col]: 0 }], data: [] });
      if (body.groupBy?.[0] === 'referrer_hostname') return json(200, { summary: [{ referrer_hostname: '', [col]: 5 }, { referrer_hostname: 'news.ycombinator.com', [col]: 2 }], data: [] });
      return json(200, {
        summary: [{ [col]: body.aggregation === 'sum' ? 7 : 4 }],
        data: [
          { timestamp: '2026-10-28T00:00:00.000Z', [col]: body.aggregation === 'sum' ? 3 : 2 },
          { timestamp: '2026-10-30T00:00:00.000Z', [col]: body.aggregation === 'sum' ? 4 : null },
        ],
      });
    }
    return json(404, { error: { message: 'nope' } });
  };
  return { calls, fetchImpl };
}

async function setup(opts = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-'));
  const store = createStore(dir);
  await store.update((s) => {
    s.showDemo = false;
    s.sites = [{ id: 'tradify', label: 'Tradify', host: 'tradifycapital.in' }, { id: 'desk', label: 'Cooldesk', host: 'cool-desk.com' }];
  });
  const fake = fakeVercel(opts);
  const vercel = createVercel({ store, env: { VERCEL_TOKEN: 'good' }, fetchImpl: fake.fetchImpl, now: () => NOW });
  return { dir, store, vercel, ...fake };
}

test('publicProject keeps domains and drops env vars', () => {
  const p = publicProject(PROJECTS[0]);
  assert.deepEqual(p.domains, ['www.tradifycapital.in']);
  assert.deepEqual(p.vercelDomains, ['tradify.vercel.app']);
  assert.equal(p.repo, 'me/tradify');
  assert.deepEqual(p.webAnalytics, { enabled: true, hasData: true });
  assert.equal(publicProject(PROJECTS[1]).webAnalytics.enabled, false);
  assert.equal(JSON.stringify(p).includes('SECRET'), false);
});

test('publicDeployment takes the first commit line and a short sha', () => {
  const d = publicDeployment({ uid: 'dpl_1', readyState: 'READY', meta: { githubCommitMessage: 'Fix\n\nmore', githubCommitSha: '1234567890' } });
  assert.equal(d.commit, 'Fix');
  assert.equal(d.sha, '1234567');
  assert.equal(d.target, 'preview');
});

test('matchSites matches by domain ignoring www, and manual overrides win', () => {
  const projects = PROJECTS.map(publicProject);
  const sites = [{ id: 'a', host: 'tradifycapital.in' }, { id: 'b', host: 'www.kazekit.com' }, { id: 'c', host: 'kazekit.com' }, { id: 'demo', demo: true, host: 'kazekit.com' }];
  assert.deepEqual(matchSites(sites, projects, { c: '' }), {
    a: { projectId: 'prj_tradify01', manual: false },
    b: { projectId: 'prj_kazekit01', manual: false },
    c: { projectId: '', manual: true },
  });
});

test('daily aligns buckets to dates and blanks days before the window', () => {
  const res = { data: [{ timestamp: '2026-10-02T00:00:00.000Z', n: 5 }] };
  assert.deepEqual(daily(res, 'n', ['2026-10-01', '2026-10-02', '2026-10-03'], '2026-10-02'), [null, 5, 0]);
});

test('analytics clamps to the plan window and uses the default team', async () => {
  const { dir, vercel, calls } = await setup();
  try {
    const wa = await vercel.analytics('prj_tradify01', '90d');
    assert.equal(wa.retentionDays, 31);
    assert.equal(wa.dataStart, '2026-09-30');
    assert.equal(wa.series.pageviews.length, 90);
    assert.equal(wa.series.pageviews[0], null);
    assert.deepEqual(wa.series.pageviews.slice(-3), [3, 0, 4]);
    assert.deepEqual(wa.totals, { pageviews: 7, visitors: 4 });
    assert.deepEqual(wa.pages, [{ path: '/', views: 7 }]);
    assert.deepEqual(wa.referrers.map((r) => r.host), ['', 'news.ycombinator.com']);
    const q = calls.filter((c) => c.path === '/v2/observability/query');
    assert.equal(q.length, 8); // 4 rejected, 4 retried
    assert.equal(q.at(-1).query.teamId, TEAM);
    assert.deepEqual(q.at(-1).body.scope, { type: 'project', ownerId: TEAM, projectIds: ['prj_tradify01'] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('annotations: ready production deploys of matched sites, scoped per site', async () => {
  const { dir, vercel } = await setup();
  try {
    const items = await vercel.annotations({ from: '2026-10-01', to: '2026-10-30' });
    assert.deepEqual(items, [{
      id: 'vercel-dpl_one', date: '2026-10-20', label: 'Deploy: Ship it', kind: 'deploy', source: 'vercel', url: 'https://vercel.com/x/1', scope: 'site:tradify',
    }]);
    assert.deepEqual(await vercel.annotations({ scopes: ['site:desk'] }), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('no token: annotations are empty and requests explain how to connect', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-'));
  try {
    const vercel = createVercel({ store: createStore(dir), env: {}, fetchImpl: () => assert.fail('no network without a token') });
    assert.deepEqual(await vercel.annotations({}), []);
    await assert.rejects(vercel.projects(), (err) => err.kind === 'needs-vercel' && err.status === 409);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('saveToken verifies before storing; a bad token is a clear error', async () => {
  const { dir, store, vercel } = await setup();
  try {
    await assert.rejects(vercel.saveToken('bad'), (err) => err.kind === 'vercel-auth');
    assert.equal((await store.get()).sources?.vercelToken, undefined);
    assert.equal((await vercel.saveToken('good', TEAM)).login, 'me');
    assert.equal((await store.get()).sources.vercelToken, 'good');
    assert.equal((await vercel.status()).tokenSource, 'settings');
    await assert.rejects(vercel.saveToken('', 'nope'), (err) => err.kind === 'validation');
    await vercel.setMatch('desk', 'prj_kazekit01');
    assert.equal((await vercel.matches(await store.sites())).desk.projectId, 'prj_kazekit01');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
