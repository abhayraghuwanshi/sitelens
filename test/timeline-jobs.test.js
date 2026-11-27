import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimelineJobs } from '../server/timeline-jobs.mjs';
import { createTimelineSources } from '../server/timeline-sources.mjs';
import { createCalendar } from '../server/calendar.mjs';

const site = { id: 'a', label: 'Site A' };
function memoryStore() {
  const state = {};
  return { get: async () => state, update: async (fn) => fn(state), sites: async () => [site] };
}

test('a daily JSON API job records one numeric value per day, retains values on failure, and charts them', async () => {
  const store = memoryStore();
  let now = Date.parse('2026-10-12T10:00:00Z');
  let calls = 0;
  let result = 7;
  const jobs = createTimelineJobs({
    store, now: () => now, github: {}, metrics: { list: async () => [] },
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url, 'https://example.com/stats');
      assert.equal(init.method, 'GET');
      assert.equal(init.redirect, 'error');
      assert.equal(init.headers.Authorization, 'Bearer example-token');
      return Response.json({ totals: { visits: result } });
    },
  });
  const job = await jobs.create(site.id, { type: 'api', label: 'Visits', url: 'https://example.com/stats', path: 'totals.visits', schedule: 'daily', token: 'example-token' });
  assert.equal(job.authenticated, true);
  assert.equal(job.token, undefined);
  await jobs.tick();
  await jobs.tick();
  assert.equal(calls, 1);
  now += 86_400_000;
  result = 'unavailable';
  await jobs.tick();
  assert.match((await jobs.list(site.id)).jobs[0].error, /must contain a number/);
  now += 86_400_000;
  result = 0;
  const [first, second] = await Promise.all([jobs.runNow(site.id, job.id), jobs.runNow(site.id, job.id)]);
  assert.equal(first.lastSuccess, second.lastSuccess);
  assert.equal(calls, 3);

  const calendar = createCalendar({ store, jobSeries: jobs.series, now: () => now });
  const series = await calendar.breakdown({ site: site.id, from: '2026-10-12', to: '2026-10-14', by: 'job', daily: true });
  assert.equal((await jobs.list(site.id)).jobs[0].token, undefined);
  assert.deepEqual(series.rows[0].days, [7, null, 0]);
  assert.equal(series.rows[0].value, 0);
  await jobs.remove(site.id, job.id);
  assert.deepEqual(await jobs.series(site.id), []);
});

test('SQL and GitHub jobs reuse the configured site metric and sync', async () => {
  const store = memoryStore();
  const metric = { siteId: site.id, id: 'query01', label: 'Sign-ups' };
  let syncs = 0;
  const jobs = createTimelineJobs({
    store, now: () => Date.parse('2026-10-12T10:00:00Z'),
    github: {
      sync: async () => { syncs++; return { failures: 0 }; },
      timelineMetric: async (repo, metric, day) => {
        assert.equal(repo, 'example/repo');
        assert.equal(metric, 'issues');
        return { [day]: 3 };
      },
    },
    metrics: {
      list: async () => [metric],
      run: async (configured, range, options) => {
        assert.equal(configured, metric);
        assert.equal(range, '28d');
        assert.equal(options.fresh, true);
        return { dates: ['2026-10-11', '2026-10-12'], values: [4, null] };
      },
    },
  });
  await assert.rejects(jobs.create('b', { type: 'sql', label: 'Sign-ups', metricId: metric.id }), /for this site/);
  await assert.rejects(jobs.create(site.id, { type: 'api', label: 'Invalid', url: 'http://example.com' }), /public HTTPS/);
  const query = await jobs.create(site.id, { type: 'sql', label: 'Sign-ups', metricId: metric.id });
  const github = await jobs.create(site.id, { type: 'github', label: 'Releases' });
  await jobs.runNow(site.id, query.id);
  await jobs.runNow(site.id, github.id);
  assert.equal(syncs, 1);
  const issues = await jobs.create(site.id, { type: 'github', label: 'Issues', githubMetric: 'issues', repo: 'example/repo' });
  await jobs.runNow(site.id, issues.id);
  assert.deepEqual(await jobs.series(site.id), [
    { id: query.id, label: query.label, points: { '2026-10-11': 4 } },
    { id: issues.id, label: issues.label, points: { '2026-10-12': 3 } },
  ]);
});

test('automatic jobs reflect connected sources for the selected site without creating custom jobs', async () => {
  const state = {
    sources: { githubToken: 'test-secret' },
    products: [{ siteId: 'a', repos: ['me/app'], extensionIds: ['configured-extension'] }, { siteId: 'b', extensionIds: ['different-site'] }],
    extensions: [{ id: 'configured-extension', checkedAt: 456 }],
  };
  const configuredSite = { ...site, propertyId: '123', searchSite: 'sc-domain:example.com' };
  const store = { get: async () => state, site: async (id) => id === site.id ? configuredSite : null };
  const github = { status: () => ({ lastRun: 123 }), hasDb: () => false };
  const automaticJobs = createTimelineSources({
    store, github, githubSource: (sources) => sources.githubToken ? 'settings' : '',
    history: { status: () => ({ sites: [{ site: site.id, ga_at: 800 }] }) },
    auth: { status: async () => ({ connected: true }) },
    bing: { timelineStatus: async () => ({ status: 'History available', lastReported: '2026-10-12', siteUrl: 'https://example.com' }) },
  });
  const jobs = createTimelineJobs({ store, github, automaticJobs, metrics: { list: async () => [] } });
  const result = await jobs.list(site.id);
  assert.deepEqual(result.jobs, []);
  assert.deepEqual(result.automatic.map(({ id, status }) => [id, status]), [
    ['analytics', 'Synced'], ['search', 'Waiting for first sync'], ['bing', 'History available'], ['github', 'Synced'], ['extensions', 'Synced'],
  ]);
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
  assert.deepEqual(result.automatic.find(({ id }) => id === 'bing').timeline, { by: 'bing', f: 'clicks' });
  delete configuredSite.propertyId;
  assert.equal((await jobs.list(site.id)).automatic.some(({ id }) => id === 'analytics'), false);
});

test('editing a job: schedule and name keep its values; a new source starts fresh; the token stays unless cleared', async () => {
  const store = memoryStore();
  let now = Date.parse('2026-10-12T10:00:00Z');
  const seen = [];
  const jobs = createTimelineJobs({
    store, now: () => now, github: {}, metrics: { list: async () => [] },
    fetchImpl: async (url, init) => {
      seen.push(init.headers.Authorization || '');
      return Response.json({ n: 5 });
    },
  });
  const job = await jobs.create(site.id, { type: 'api', label: 'Signups', url: 'https://example.com/a', path: 'n', schedule: 'manual', token: 'secret-1' });
  await jobs.runNow(site.id, job.id);
  const saved = () => store.get().then((s) => s.timelineJobs[0]);
  assert.deepEqual((await saved()).points, { '2026-10-12': 5 });

  // Rename and switch to daily, token left blank: values, last run and token stay.
  const renamed = await jobs.update(site.id, job.id, { type: 'api', label: 'New signups', url: 'https://example.com/a', path: 'n', schedule: 'daily' });
  assert.equal(renamed.label, 'New signups');
  assert.equal(renamed.schedule, 'daily');
  assert.equal(renamed.authenticated, true);
  assert.equal(renamed.token, undefined, 'the token never goes back to the browser');
  assert.ok(renamed.lastSuccess);
  assert.deepEqual((await saved()).points, { '2026-10-12': 5 });
  assert.equal((await saved()).createdAt, job.createdAt);

  // Point it at another endpoint: the old values belonged to the old one.
  const moved = await jobs.update(site.id, job.id, { type: 'api', label: 'New signups', url: 'https://example.com/b', path: 'n', schedule: 'daily' });
  assert.deepEqual((await saved()).points, {});
  assert.equal(moved.lastRun, undefined);
  assert.equal(moved.authenticated, true);

  // Clearing the token removes it; the next run sends none.
  await jobs.update(site.id, job.id, { type: 'api', label: 'New signups', url: 'https://example.com/b', path: 'n', schedule: 'daily', clearToken: true });
  now += 1000;
  await jobs.runNow(site.id, job.id);
  assert.deepEqual(seen, ['Bearer secret-1', '']);

  // Bad input is refused the same way as on create, and nothing changes.
  await assert.rejects(jobs.update(site.id, job.id, { type: 'api', label: 'x', url: 'http://example.com', schedule: 'daily' }), /HTTPS/);
  assert.equal((await saved()).url, 'https://example.com/b');
  await assert.rejects(jobs.update(site.id, 'nope', { type: 'api', label: 'x', url: 'https://example.com/b' }), /no longer exists/);
});
