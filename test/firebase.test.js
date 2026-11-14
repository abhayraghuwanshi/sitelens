import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { createFirebase, classifyAgent, requestKind, parseLatency, parseRequestEntry, percentile, requestFilter } from '../server/firebase.mjs';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

function entry(id, iso, { path = '/', status = 200, ua = CHROME, ip = '203.0.113.7', revision = 'cooldesk-ui-build-1', referer = '', latency = '0.120s', service = 'cooldesk-ui', host = 'cool-desk.com' } = {}) {
  return {
    insertId: id,
    timestamp: iso,
    resource: { type: 'cloud_run_revision', labels: { service_name: service, revision_name: revision, location: 'us-central1' } },
    httpRequest: { requestMethod: 'GET', requestUrl: `https://${host}${path}`, status, userAgent: ua, remoteIp: ip, referer, latency, responseSize: '1200' },
  };
}

const REQUESTS = [
  entry('a1', '2026-10-28T09:00:00Z'),
  entry('a2', '2026-10-28T09:01:00Z', { path: '/blog/x?utm=1', referer: 'https://news.ycombinator.com/item?id=1' }),
  entry('a3', '2026-10-28T09:02:00Z', { path: '/assets/index.js' }),
  entry('b1', '2026-10-28T10:00:00Z', { ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)', path: '/robots.txt' }),
  entry('b2', '2026-10-29T10:00:00Z', { ua: 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', path: '/blog/x' }),
  entry('b3', '2026-10-29T10:05:00Z', { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', path: '/missing', status: 404 }),
  // New revision mid-range = a deploy.
  entry('c1', '2026-10-29T15:00:00Z', { revision: 'cooldesk-ui-build-2', path: '/api/update', ua: 'tauri-plugin-updater/2.0', ip: '198.51.100.1' }),
  entry('c2', '2026-10-30T08:00:00Z', { revision: 'cooldesk-ui-build-2', path: '/api/update', ua: 'tauri-plugin-updater/2.0', ip: '198.51.100.2' }),
  entry('c3', '2026-10-30T09:00:00Z', { revision: 'cooldesk-ui-build-2', status: 503, latency: '2.5s' }),
];

// Fake Cloud Logging: filters by logName and timestamp>=, pages two entries at a time.
function fakeLogging() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (init.headers.Authorization !== 'Bearer good') {
      return json(403, { error: { message: 'Request had insufficient authentication scopes.', details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } });
    }
    const since = /timestamp>="([^"]+)"/.exec(body.filter)?.[1] || '';
    const cold = body.filter.includes('varlog%2Fsystem');
    const source = cold
      ? [{ insertId: 'cold1', timestamp: '2026-10-29T15:00:00Z', resource: { labels: { revision_name: 'cooldesk-ui-build-2' } }, textPayload: 'Starting new instance. Reason: AUTOSCALING' }]
      : REQUESTS;
    let list = source.filter((e) => e.timestamp >= since);
    if (body.orderBy === 'timestamp desc') list = [...list].reverse();
    const start = Number(body.pageToken || 0);
    const page = list.slice(start, start + 2);
    return json(200, { entries: page, nextPageToken: start + 2 < list.length ? String(start + 2) : undefined });
  };
  return { calls, fetchImpl };
}

async function setup(opts = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'firebase-'));
  const store = createStore(dir);
  await store.update((s) => {
    s.showDemo = false;
    s.sites = [{ id: 'desk', label: 'Cooldesk', host: 'cool-desk.com' }];
  });
  const fake = fakeLogging(opts);
  const bigquery = { listProjects: async () => [{ id: 'cooldesk-896b9' }] };
  const firebase = createFirebase({ dbPath: join(dir, 'firebase.db'), store, getToken: async () => opts.token || 'good', bigquery, fetchImpl: fake.fetchImpl, now: () => NOW, log: { error() {}, warn() {} } });
  return { dir, store, firebase, ...fake };
}

test('classifyAgent separates AI crawlers, assistants, search and humans', () => {
  assert.deepEqual(classifyAgent('Mozilla/5.0 (compatible; GPTBot/1.2)'), { bot: 'GPTBot', kind: 'ai-crawler' });
  assert.deepEqual(classifyAgent('Mozilla/5.0 ChatGPT-User/1.0; +https://openai.com/bot'), { bot: 'ChatGPT-User', kind: 'ai-assistant' });
  assert.deepEqual(classifyAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), { bot: 'Googlebot', kind: 'search' });
  assert.deepEqual(classifyAgent('Kauzl-uptime/1.0'), { bot: 'Kauzl uptime', kind: 'monitor' });
  assert.deepEqual(classifyAgent('SiteLens-Studio-uptime/1.0'), { bot: 'Kauzl uptime', kind: 'monitor' });
  assert.equal(classifyAgent('python-requests/2.31').kind, 'automation');
  assert.equal(classifyAgent('').kind, 'automation');
  assert.deepEqual(classifyAgent(CHROME), { bot: '', kind: 'human' });
});

test('requestKind and parseLatency', () => {
  assert.equal(requestKind('/'), 'page');
  assert.equal(requestKind('/blog/post'), 'page');
  assert.equal(requestKind('/robots.txt'), 'file');
  assert.equal(requestKind('/llms.txt'), 'file');
  assert.equal(requestKind('/assets/a.js'), 'asset');
  assert.equal(requestKind('/logo.png'), 'asset');
  assert.equal(requestKind('/api/update'), 'api');
  assert.equal(parseLatency('0.120s'), 120);
  assert.equal(parseLatency(undefined), null);
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2);
  assert.equal(percentile([], 0.95), null);
});

test('parseRequestEntry strips queries, never stores the IP, drops own-site referrers', () => {
  const row = parseRequestEntry(entry('x', '2026-10-28T09:00:00Z', { path: '/a?b=1', referer: 'https://www.cool-desk.com/' }), { salt: 's', siteHost: 'cool-desk.com' });
  assert.equal(row.path, '/a');
  assert.equal(row.referer_host, '');
  assert.equal(row.visitor.length, 16);
  assert.ok(!JSON.stringify(row).includes('203.0.113.7'));
  const other = parseRequestEntry(entry('y', '2026-10-29T09:00:00Z', { path: '/a' }), { salt: 's' });
  assert.notEqual(other.visitor, row.visitor, 'visitor hash rotates daily');
  assert.equal(parseRequestEntry({ insertId: 'z', timestamp: '2026-10-28T09:00:00Z' }), null);
});

test('requestFilter targets the Cloud Run request log', () => {
  const f = requestFilter({ project: 'p-123456', service: 'web', sinceIso: '2026-10-01T00:00:00.000Z' });
  assert.match(f, /logName="projects\/p-123456\/logs\/run\.googleapis\.com%2Frequests"/);
  assert.match(f, /resource\.labels\.service_name="web"/);
});

test('autoLink finds the backend serving the site host and syncs it', async () => {
  const { dir, firebase, store } = await setup();
  try {
    const result = await firebase.autoLink();
    assert.deepEqual(result.linked.map((l) => [l.siteId, l.project, l.service]), [['desk', 'cooldesk-896b9', 'cooldesk-ui']]);
    assert.equal((await store.get()).firebase.links.desk.service, 'cooldesk-ui');
  } finally {
    await firebase.sync().catch(() => {});
    firebase.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a sync links an unlinked site on its own, without pressing Find', async () => {
  const { dir, firebase, store } = await setup();
  try {
    await firebase.sync();
    assert.equal((await store.get()).firebase.links.desk.service, 'cooldesk-ui');
  } finally {
    firebase.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('sync pages through logs, dedupes on re-sync, and summarizes traffic', async () => {
  const { dir, firebase, calls } = await setup();
  try {
    await firebase.setLink('desk', { project: 'cooldesk-896b9', service: 'cooldesk-ui' });
    const [first] = await firebase.sync();
    assert.equal(first.added, REQUESTS.length);
    const [again] = await firebase.sync();
    assert.equal(again.added, 0, 'overlap window re-reads without duplicates');
    assert.ok(calls.some((c) => c.pageToken), 'follows nextPageToken');

    const o = await firebase.overview('desk', '7d');
    assert.equal(o.dataStart, '2026-10-28');
    assert.equal(o.series.human.at(-1), 1, 'today: one human page load (the 503)');
    assert.equal(o.series.human.at(-3), 2, 'assets are not page loads');
    assert.equal(o.series.human[0], null, 'days before history are blank, not zero');
    assert.equal(o.totals.ai, 2);
    assert.equal(o.totals.search, 1);
    assert.deepEqual(o.bots.map((b) => b.bot).sort(), ['ClaudeBot', 'GPTBot', 'Googlebot', 'tauri-plugin-updater']);
    assert.equal(o.bots.find((b) => b.bot === 'GPTBot').robots, 1);
    assert.deepEqual(o.referrers.map((r) => ({ ...r })), [{ host: 'news.ycombinator.com', hits: 1 }]);
    assert.deepEqual(o.errors.map((e) => [e.path, e.status]), [['/', 503], ['/missing', 404]]);
    assert.equal(o.endpoints[0].path, '/api/update');
    assert.equal(o.endpoints[0].clients, 2);
    assert.equal(o.totals.coldStarts, 1);
    assert.equal(o.totals.errors5xx, 1);
    assert.deepEqual(o.deploys.map((d) => [d.revision, d.date]), [['cooldesk-ui-build-2', '2026-10-29']], 'baseline revision is not a deploy');

    const notes = await firebase.annotations({ scopes: ['site:desk'] });
    assert.equal(notes.length, 1);
    assert.equal(notes[0].kind, 'deploy');
    assert.equal(notes[0].label, 'Deploy: build-2');
  } finally {
    await firebase.sync().catch(() => {});
    firebase.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test('a missing logging scope surfaces a re-sign-in hint', async () => {
  const { dir, firebase } = await setup({ token: 'old' });
  try {
    await firebase.setLink('desk', { project: 'cooldesk-896b9', service: 'cooldesk-ui' });
    const [result] = await firebase.sync();
    assert.equal(result.kind, 'needs-logging-scope');
    await assert.rejects(firebase.autoLink(), (err) => err.kind === 'needs-logging-scope');
    await assert.rejects(firebase.overview('nope'), (err) => err.kind === 'needs-firebase');
  } finally {
    await firebase.sync().catch(() => {});
    firebase.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
