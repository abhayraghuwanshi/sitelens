import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index.mjs';
import { createStore, normalizeLeaveOut } from '../server/store.mjs';

let server;
let base;
let dir;
let bqCalls;
let nextDryRunBytes = 1000;

// Google APIs are faked: tokeninfo accepts any token, BigQuery records requests.
async function fakeFetch(url, init = {}) {
  const u = String(url);
  if (u.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
    return Response.json({ email: 'me@example.com', scope: 'https://www.googleapis.com/auth/bigquery', expires_in: 3000 });
  }
  if (u.includes('bigquery.googleapis.com') && u.includes('/tables?')) {
    return Response.json({ tables: ['events_intraday_20261024', 'events_20261023'].map((tableId) => ({ tableReference: { tableId } })) });
  }
  if (u.includes('bigquery.googleapis.com')) {
    const body = JSON.parse(init.body || '{}');
    bqCalls.push({ url: u, body });
    if (body.dryRun) return Response.json({ totalBytesProcessed: String(nextDryRunBytes), statistics: { query: { statementType: body.query.startsWith('DELETE') ? 'DELETE' : 'SELECT' } } });
    return Response.json({
      jobComplete: true,
      cacheHit: false,
      schema: { fields: [{ name: 'event_name', type: 'STRING' }, { name: 'events', type: 'INTEGER' }, { name: 'users', type: 'INTEGER' }] },
      rows: [{ f: [{ v: 'page_view' }, { v: '42' }, { v: '7' }] }],
    });
  }
  throw new Error(`unexpected fetch ${u}`);
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'studio-test-'));
  const app = createApp({ store: createStore(dir), port: 0, env: {}, fetchImpl: fakeFetch });
  server = createServer((req, res) => app.handle(req, res));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await rm(dir, { recursive: true, force: true });
});

const get = (path) => fetch(`${base}/api${path}`).then(async (r) => ({ status: r.status, body: await r.json() }));
const post = (path, body, headers = { 'X-Studio': '1' }) =>
  fetch(`${base}/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));

test('demo site works with no Google connection', async () => {
  const state = await get('/state');
  assert.equal(state.body.auth.connected, false);
  assert.equal(state.body.sites[0].id, 'demo');
  const dash = await get('/sites/demo/dashboard?range=28d');
  assert.equal(dash.status, 200);
  assert.ok(dash.body.reports.overview.current.sessions > 0);
  assert.ok(dash.body.insights.length > 0);
  const paths = await get('/sites/demo/warehouse/paths?range=28d');
  assert.equal(paths.body.source, 'demo');
  assert.ok(paths.body.edges.length > 0 && paths.body.exits.length > 0);
});

test('state-changing requests need the X-Studio header', async () => {
  const res = await post('/sites', { host: 'example.org' }, {});
  assert.equal(res.status, 403);
});

test('requests for non-loopback hosts are refused', async () => {
  // fetch() cannot override Host, so use a raw request (what a DNS-rebinding page would send).
  const status = await new Promise((resolve, reject) => {
    request(`${base}/api/state`, { headers: { Host: 'attacker.example' } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject).end();
  });
  assert.equal(status, 421);
});

test('site validation rejects bad input', async () => {
  assert.equal((await post('/sites', { host: 'not a host!' })).status, 400);
  assert.equal((await post('/sites', { host: 'a.com', propertyId: 'abc' })).status, 400);
  assert.equal((await post('/sites', { host: 'a.com', bq: { billingProject: 'p-1', dataset: 'bad-dataset!' } })).status, 400);
});

test('warehouse views without auth explain how to connect', async () => {
  const site = await post('/sites', { host: 'shop.example', bq: { billingProject: 'pay-proj', dataset: 'analytics_1' } });
  assert.equal(site.status, 200);
  const res = await get(`/sites/${site.body.id}/warehouse/events?range=7d`);
  assert.equal(res.status, 401);
  assert.equal(res.body.kind, 'auth');
});

test('token is stored owner-only and BigQuery queries are dry-run, parameterized and capped', async () => {
  assert.equal((await post('/auth/token', { token: 'ya29.test' })).status, 200);
  const mode = (await stat(join(dir, 'studio.json'))).mode & 0o777;
  assert.equal(mode, 0o600);

  const site = await post('/sites', { host: 'cap.example', bq: { billingProject: 'pay-proj', dataset: 'analytics_2', streamId: '77', maxBytes: 5000, endDate: '2026-10-29' } });
  bqCalls = [];
  nextDryRunBytes = 1000;
  const ok = await get(`/sites/${site.body.id}/warehouse/events?range=7d`);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.events, [{ name: 'page_view', events: 42, users: 7 }]);
  assert.equal(bqCalls.length, 2);
  assert.equal(bqCalls[0].body.dryRun, true);
  assert.match(bqCalls[0].body.query, /_TABLE_SUFFIX IN \('20261023', 'intraday_20261024'\)/, 'streaming-only days are read from intraday tables');
  assert.equal(ok.body.range.intradayDays, 1);
  assert.ok(bqCalls[1].body.maximumBytesBilled, 'real run carries a billing cap');
  assert.deepEqual(bqCalls[1].body.queryParameters, [{ name: 'stream_id', parameterType: { type: 'STRING' }, parameterValue: { value: '77' } }]);

  // Over the cap: refused after the dry run, nothing billed.
  bqCalls = [];
  nextDryRunBytes = 9_000_000;
  const refused = await get(`/sites/${site.body.id}/warehouse/cohorts?range=90d`);
  assert.equal(refused.status, 409);
  assert.equal(refused.body.kind, 'over-cap');
  assert.equal(refused.body.bytes, 9_000_000);
  assert.equal(bqCalls.length, 1);

  // The console only runs SELECT statements.
  nextDryRunBytes = 10;
  const write = await post(`/sites/${site.body.id}/warehouse/sql`, { range: '7d', sql: 'DELETE FROM x WHERE true' });
  assert.equal(write.status, 400);
  assert.equal(write.body.kind, 'forbidden');

  // The console may exceed the cap only for the exact size the user approved.
  nextDryRunBytes = 9_000_000;
  const approved = await post(`/sites/${site.body.id}/warehouse/sql`, { range: '7d', sql: 'SELECT 1', confirmBytes: 9_000_000 });
  assert.equal(approved.status, 200);
});

test('leave-out rules keep plain country names and default to unengaged visits only', () => {
  assert.deepEqual(normalizeLeaveOut({ countries: [' Singapore', 'China', 'China', ''] }), { countries: ['Singapore', 'China'], unengagedOnly: true });
  assert.deepEqual(normalizeLeaveOut({ countries: ['Côte d’Ivoire'], unengagedOnly: false }), { countries: ['Côte d’Ivoire'], unengagedOnly: false });
  assert.throws(() => normalizeLeaveOut({ countries: ["x') OR TRUE"] }), /doesn’t look like a country/);
});
